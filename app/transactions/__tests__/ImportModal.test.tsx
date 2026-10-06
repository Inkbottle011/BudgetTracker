import { render, screen, fireEvent } from '@testing-library/react-native'
import * as DocumentPicker from 'expo-document-picker'
import { ImportModal } from '../importModel'
import { fake } from '../../../test/fakeSupabase'

jest.mock('../../../lib/supabase', () => require('../../../test/fakeSupabase').module)
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }))

const CSV = `Transaction Date,Post Date,Description,Category,Type,Amount
10/01/2026,10/02/2026,SQ *BLUE BOTTLE #1234,Food & Drink,Sale,-6.50
10/02/2026,10/03/2026,NETFLIX.COM,Entertainment,Sale,-15.99
10/03/2026,10/04/2026,Payment Thank You-Mobile,,Payment,500.00
13/45/2026,10/05/2026,Broken row,,Sale,-1.00
10/04/2026,10/05/2026,Corner Store,Shopping,Sale,-4.25`

function pickFile(text: string, name = 'chase.csv') {
    ;(DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///x.csv', name }] })
    global.fetch = jest.fn(async () => ({ text: async () => text })) as any
}

/** Saved transactions (for duplicate checks, filtered by date) vs. past categories (for suggestions) are told apart by their filters. */
function database({ saved = [] as any[], history = [] as any[], rejectName = '' } = {}) {
    fake.table('transactions', call => {
        const insert = call.ops.find(o => o.method === 'insert')
        if (insert) {
            const rows = ([] as any[]).concat(insert.args[0])
            return rows.some(r => r.name === rejectName) ? { error: { message: 'value too long' } } : { data: null, error: null }
        }
        const byDate = call.ops.some(o => o.method === 'gte' && o.args[0] === 'date')
        return { data: byDate ? saved : history, error: null }
    })
}

async function openAndPick(text = CSV) {
    pickFile(text)
    const onImported = jest.fn()
    await render(<ImportModal visible onClose={jest.fn()} onImported={onImported} />)
    await fireEvent.press(screen.getByText('📂 Choose CSV File'))
    await screen.findByText('Match Columns')
    return onImported
}

const inserted = () => fake.calls('transactions')
    .flatMap(c => c.ops.filter(o => o.method === 'insert').flatMap(o => ([] as any[]).concat(o.args[0])))

beforeEach(() => fake.reset())

it('guesses the columns and shows a sample value for each', async () => {
    database()
    await openAndPick()
    expect(screen.getByText(/chase\.csv: 5 rows/)).toBeTruthy()
    expect(screen.getByText('e.g. SQ *BLUE BOTTLE #1234')).toBeTruthy()
    expect(screen.getByText('In this file, money you spent shows as:')).toBeTruthy()
})

it('requires a date and an amount column', async () => {
    database()
    await openAndPick('Foo,Bar\n1,2')
    await fireEvent.press(screen.getByText('Preview →'))
    expect(screen.getByText('Pick which column is the Date.')).toBeTruthy()
})

it('reviews before importing: ready, already imported and left out, with reasons', async () => {
    database({
        saved: [{ date: '2026-10-02', amount: 15.99, name: 'NETFLIX.COM' }],
        history: [{ name: 'Blue Bottle Coffee', category_label: 'Coffee', type: 'expense' }],
    })
    await openAndPick()
    await fireEvent.press(screen.getByText('Preview →'))
    expect(await screen.findByText('Review Import')).toBeTruthy()
    expect(screen.getByText(/Row 4: "Payment Thank You-Mobile" looks like a credit card payment/)).toBeTruthy()
    expect(screen.getByText(/Row 5: can't read the date "13\/45\/2026"/)).toBeTruthy()
    expect(screen.getByText('1 transaction was given a category based on how you categorized the same place before.')).toBeTruthy()
    expect(screen.getByText('Import 2 Transactions')).toBeTruthy()
})

it('imports the ready rows and reports the result', async () => {
    database({ history: [{ name: 'Blue Bottle Coffee', category_label: 'Coffee', type: 'expense' }] })
    const onImported = await openAndPick()
    await fireEvent.press(screen.getByText('Preview →'))
    await fireEvent.press(await screen.findByText('Import 3 Transactions'))
    expect(await screen.findByText('Imported 3 transactions')).toBeTruthy()
    expect(inserted()).toEqual([
        expect.objectContaining({ user_id: 'user-1', date: '2026-10-01', amount: 6.5, type: 'expense', category_label: 'Coffee' }),
        expect.objectContaining({ date: '2026-10-02', amount: 15.99, category_label: 'Entertainment' }),
        expect.objectContaining({ date: '2026-10-04', amount: 4.25, category_label: 'Shopping' }),
    ])
    expect(onImported).toHaveBeenCalled()
})

it('lists rows the database rejected instead of counting them as imported', async () => {
    database({ rejectName: 'NETFLIX.COM' })
    await openAndPick()
    await fireEvent.press(screen.getByText('Preview →'))
    await fireEvent.press(await screen.findByText('Import 3 Transactions'))
    expect(await screen.findByText('Imported 2 transactions')).toBeTruthy()
    expect(screen.getByText("1 couldn't be saved")).toBeTruthy()
    expect(screen.getByText('Row 3 (NETFLIX.COM): value too long')).toBeTruthy()
})

it('says there is nothing new when the whole file was imported before', async () => {
    database({
        saved: [
            { date: '2026-10-01', amount: 6.5, name: 'SQ *BLUE BOTTLE #1234' },
            { date: '2026-10-02', amount: 15.99, name: 'NETFLIX.COM' },
            { date: '2026-10-04', amount: 4.25, name: 'Corner Store' },
        ],
    })
    await openAndPick()
    await fireEvent.press(screen.getByText('Preview →'))
    expect(await screen.findByText('Nothing new to import.')).toBeTruthy()
    expect(screen.queryByText(/^Import \d/)).toBeNull()
})

it('reads cards that show spending as positive numbers', async () => {
    database()
    await openAndPick('Date,Description,Amount\n10/01/2026,Shop,15.99\n10/02/2026,Refund,-5.00')
    await fireEvent.press(screen.getByText('Positive (12.50)'))
    await fireEvent.press(screen.getByText('Preview →'))
    await fireEvent.press(await screen.findByText('Import 2 Transactions'))
    await screen.findByText('Imported 2 transactions')
    expect(inserted().map(t => t.type)).toEqual(['expense', 'reimbursement']) // the refund reduces spending
})

it('explains when the file has no rows', async () => {
    database()
    pickFile('')
    await render(<ImportModal visible onClose={jest.fn()} onImported={jest.fn()} />)
    await fireEvent.press(screen.getByText('📂 Choose CSV File'))
    expect(await screen.findByText(/doesn't have any rows we could read/)).toBeTruthy()
})
