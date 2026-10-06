import Papa from 'papaparse'
import { convertRows, guessField, guessFields, prepareImport, ImportField } from '../importLogic'
import { supabase } from '../../../lib/supabase'

jest.mock('../../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))

function parse(csv: string) {
    const p = Papa.parse<Record<string, string>>(csv.trim(), { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim() })
    return { rows: p.data, mapping: guessFields(p.meta.fields!) }
}

const history = [
    { name: 'Blue Bottle Coffee', category_label: 'Food', type: 'expense' },
    { name: 'NETFLIX.COM', category_label: 'Entertainment', type: 'expense' },
    { name: 'Transfer to Savings', category_label: 'Emergency Fund', type: 'savings' },
    { name: 'ACME CORP PAYROLL', category_label: 'Salary', type: 'income' },
]

describe('guessField', () => {
    it.each([
        ['Date', 'date'], ['Transaction Date', 'date'], ['Posting Date', 'date'],
        ['Amount', 'amount'], ['Amt', 'amount'],
        ['Debit', 'debit'], ['Withdrawals', 'debit'], ['Money Out', 'debit'],
        ['Credit', 'credit'], ['Deposits', 'credit'], ['Money In', 'credit'],
        ['Description', 'description'], ['Payee', 'description'], ['Memo', 'description'],
        ['Category', 'category'], ['Type', 'type'],
        ['Balance', 'skip'], ['Running Bal.', 'skip'], ['Card No.', 'skip'], ['Check or Slip #', 'skip'], ['Foo', 'skip'],
    ])('%p -> %p', (header, expected) => {
        expect(guessField(header)).toBe(expected)
    })
})

describe('guessFields', () => {
    it('uses the posting date when it is the only date', () => {
        expect(guessFields(['Details', 'Posting Date', 'Description', 'Amount'])).toMatchObject({
            'Posting Date': 'date', Description: 'description', Details: 'skip', Amount: 'amount',
        })
    })

    it('prefers the transaction date over the posting date', () => {
        expect(guessFields(['Transaction Date', 'Post Date', 'Amount'])).toMatchObject({
            'Transaction Date': 'date', 'Post Date': 'skip',
        })
    })

    it('prefers a description column over memo', () => {
        expect(guessFields(['Memo', 'Description', 'Amount'])).toMatchObject({ Memo: 'skip', Description: 'description' })
    })

    it('keeps only one amount, category and type column', () => {
        const m = guessFields(['Amount', 'Amount (USD)', 'Category', 'Sub Category', 'Type', 'Kind'])
        expect(Object.values(m).filter(v => v === 'amount')).toHaveLength(1)
        expect(Object.values(m).filter(v => v === 'category')).toHaveLength(1)
        expect(Object.values(m).filter(v => v === 'type')).toHaveLength(1)
    })
})

describe('convertRows', () => {
    it('imports a Chase checking export', () => {
        const { rows, mapping } = parse(`
Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
DEBIT,10/02/2026,"SQ *BLUE BOTTLE #1234 OAKLAND CA",-6.50,DEBIT_CARD,1200.00,
CREDIT,10/01/2026,"ACME CORP PAYROLL PPD ID: 99887766",2000.00,ACH_CREDIT,1213.00,
DEBIT,10/04/2026,"NETFLIX.COM",($15.99),DEBIT_CARD,1084.01,`)
        const r = convertRows(rows, mapping, 'negative', [], history)
        expect(r.problems).toEqual([])
        expect(r.ready.map(x => x.transaction)).toEqual([
            expect.objectContaining({ date: '2026-10-02', amount: 6.5, type: 'expense', category_label: 'Food' }),
            expect.objectContaining({ date: '2026-10-01', amount: 2000, type: 'income', category_label: 'Salary' }),
            expect.objectContaining({ date: '2026-10-04', amount: 15.99, type: 'expense', category_label: 'Entertainment' }),
        ])
        expect(r.categorized).toBe(3)
    })

    it('handles separate money-out and money-in columns', () => {
        const { rows, mapping } = parse(`
Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit
2026-10-01,2026-10-02,1234,Corner Store,Dining,6.50,
2026-10-03,2026-10-04,1234,Refund from Store,Refund,,30.00`)
        const r = convertRows(rows, mapping, 'negative', [], [])
        expect(r.ready.map(x => [x.transaction.type, x.transaction.amount, x.transaction.category_label])).toEqual([
            ['expense', 6.5, 'Dining'], ['reimbursement', 30, ''], // a refund reduces spending
        ])
    })

    it('reads cards that show spending as positive', () => {
        const { rows, mapping } = parse(`
Date,Description,Amount
10/01/2026,Shop,15.99
10/02/2026,Refund,-5.00`)
        const r = convertRows(rows, mapping, 'positive', [], [])
        expect(r.ready.map(x => x.transaction.type)).toEqual(['expense', 'reimbursement']) // the refund reduces spending
    })

    it('detects day-first dates across the file', () => {
        const { rows, mapping } = parse(`
Date,Transaction Description,Money Out,Money In
03/04/2026,Early,1.00,
25/09/2026,Tesco,£23.40,`)
        const r = convertRows(rows, mapping, 'negative', [], [])
        expect(r.dateOrder).toBe('DMY')
        expect(r.ready.map(x => x.transaction.date)).toEqual(['2026-04-03', '2026-09-25'])
    })

    it('leaves out credit card payments instead of counting them as income', () => {
        const { rows, mapping } = parse(`
Date,Description,Amount
10/01/2026,Payment Thank You-Mobile,500.00
10/02/2026,AUTOPAY PAYMENT,200.00
10/03/2026,Payroll,1000.00`)
        const r = convertRows(rows, mapping, 'negative', [], [])
        expect(r.ready.map(x => x.transaction.name)).toEqual(['Payroll'])
        expect(r.problems).toHaveLength(2)
        expect(r.problems[0].reason).toMatch(/credit card payment/)
    })

    it('does not treat spending that mentions "payment" as a card payment', () => {
        const { rows, mapping } = parse(`
Date,Description,Amount
10/01/2026,AUTOPAY INSURANCE CO,-80.00`)
        expect(convertRows(rows, mapping, 'negative', [], []).ready).toHaveLength(1)
    })

    it('reports rows it cannot read with the spreadsheet row number', () => {
        const { rows, mapping } = parse(`
Date,Description,Amount
10/01/2026,Good,-1.00
13/40/2026,Bad date,-1.00
10/03/2026,No amount,
10/04/2026,Zero,0.00
10/05/2026,Words,abc`)
        const r = convertRows(rows, mapping, 'negative', [], [])
        expect(r.ready).toHaveLength(1)
        expect(r.problems).toEqual([
            { row: 3, reason: 'can\'t read the date "13/40/2026"' },
            { row: 4, reason: 'can\'t read the amount ""' },
            { row: 5, reason: 'no amount' },
            { row: 6, reason: 'can\'t read the amount "abc"' },
        ])
    })

    it('skips transactions already saved, one for one', () => {
        const { rows, mapping } = parse(`
Date,Description,Amount
10/01/2026,Coffee,-4.00
10/01/2026,Coffee,-4.00
10/02/2026,Lunch,-12.00`)
        const saved = [{ date: '2026-10-01', amount: 4, name: 'Coffee' }]
        const r = convertRows(rows, mapping, 'negative', saved, [])
        expect(r.duplicates).toBe(1)
        expect(r.ready.map(x => x.transaction.name)).toEqual(['Coffee', 'Lunch'])
    })

    it('imports nothing when the same file is imported again', () => {
        const { rows, mapping } = parse(`
Date,Description,Amount
10/01/2026,Coffee,-4.00
10/01/2026,Coffee,-4.00
10/02/2026,Netflix.com,-15.99`)
        const first = convertRows(rows, mapping, 'negative', [], history)
        const second = convertRows(rows, mapping, 'negative', first.ready.map(r => r.transaction), history)
        expect(second.ready).toEqual([])
        expect(second.duplicates).toBe(3)
        expect(second.categorized).toBe(0)
    })

    it('uses a valid type column, and lets history turn a transfer into savings', () => {
        const { rows, mapping } = parse(`
Date,Description,Amount,Type
10/01/2026,Something,-50.00,investment
10/02/2026,Transfer to Savings,-100.00,`)
        const r = convertRows(rows, mapping, 'negative', [], history)
        expect(r.ready.map(x => [x.transaction.type, x.transaction.category_label])).toEqual([
            ['investment', ''], ['savings', 'Emergency Fund'],
        ])
    })

    it('keeps reimbursements as reimbursements when re-importing an exported file', () => {
        const { rows, mapping } = parse(`
Date,Type,Category,Name,Amount
2026-10-02,reimbursement,Food,Sam paid back,30`)
        expect(convertRows(rows, mapping, 'negative', [], []).ready[0].transaction).toMatchObject({ type: 'reimbursement', amount: 30 })
    })

    it('imports refunds as reimbursements in the purchase\'s category', () => {
        const { rows, mapping } = parse(`
Date,Description,Amount
10/04/2026,AMAZON.COM REFUND,25.00`)
        const r = convertRows(rows, mapping, 'negative', [], [{ name: 'Amazon.com', category_label: 'Shopping', type: 'expense' }])
        expect(r.ready[0].transaction).toMatchObject({ type: 'reimbursement', category_label: 'Shopping' })
    })

    it('does not apply an income category to money going out', () => {
        const { rows, mapping } = parse(`
Date,Description,Amount
10/01/2026,ACME CORP PAYROLL,-20.00`)
        const r = convertRows(rows, mapping, 'negative', [], history)
        expect(r.ready[0].transaction).toMatchObject({ type: 'expense', category_label: '' })
        expect(r.categorized).toBe(0)
    })

    it('rounds amounts to cents', () => {
        const mapping: Record<string, ImportField> = { d: 'date', a: 'amount', n: 'description' }
        const r = convertRows([{ d: '2026-10-01', a: '-1.005', n: 'x' }], mapping, 'negative', [], [])
        expect(r.ready[0].transaction.amount).toBe(1.01)
    })
})

describe('prepareImport', () => {
    const from = supabase.from as jest.Mock

    // A fake query builder: every filter returns itself; awaiting it gives `result`
    function query(result: (args: { range?: [number, number] }) => any) {
        const args: { range?: [number, number] } = {}
        const q: any = {}
        for (const m of ['select', 'gte', 'lte', 'order', 'neq', 'not', 'limit']) q[m] = jest.fn(() => q)
        q.range = jest.fn((a: number, b: number) => { args.range = [a, b]; return q })
        q.then = (res: any, rej: any) => Promise.resolve(result(args)).then(res, rej)
        return q
    }

    beforeEach(() => jest.clearAllMocks())

    // Both lookups read the transactions table; tell them apart by the columns selected
    function useQueries(existingQuery: any, historyQuery: any) {
        from.mockImplementation(() => ({
            select: (cols: string) => (cols.startsWith('date') ? existingQuery : historyQuery),
        }))
    }

    it('checks saved transactions in the file\'s date range and pages past 1,000 rows', async () => {
        const saved = Array.from({ length: 1000 }, (_, i) => ({ date: '2026-10-01', amount: 999, name: `old ${i}` }))
        saved[500] = { date: '2026-10-01', amount: 4, name: 'Coffee' }
        const existingQuery = query(({ range }) => ({ data: range![0] === 0 ? saved : [{ date: '2026-10-02', amount: 9, name: 'Lunch' }], error: null }))
        const historyQuery = query(() => ({ data: [{ name: 'Lunch', category_label: 'Food', type: 'expense' }], error: null }))
        useQueries(existingQuery, historyQuery)

        const { rows, mapping } = parse(`
Date,Description,Amount
10/01/2026,Coffee,-4.00
10/02/2026,Lunch,-9.00
10/03/2026,Dinner,-20.00`)
        const r = await prepareImport(rows, mapping, 'negative')

        expect(existingQuery.gte).toHaveBeenCalledWith('date', '2026-10-01')
        expect(existingQuery.lte).toHaveBeenCalledWith('date', '2026-10-03')
        expect(existingQuery.range).toHaveBeenCalledTimes(2)
        expect(r.duplicates).toBe(2)
        expect(r.ready.map(x => x.transaction.name)).toEqual(['Dinner'])
    })

    it('passes database errors up so the screen can show them', async () => {
        useQueries(query(() => ({ data: null, error: new Error('offline') })), query(() => ({ data: [], error: null })))
        const { rows, mapping } = parse(`
Date,Description,Amount
10/01/2026,Coffee,-4.00`)
        await expect(prepareImport(rows, mapping, 'negative')).rejects.toThrow('offline')
    })
})
