import { cellAmount, rowTotal, monthTotal, sectionTotal, netByMonth, netTotal, parseBudgetInput } from '../calculations'

const items = [
    { id: 'pay', type: 'income' },
    { id: 'side', type: 'income' },
    { id: 'rent', type: 'expense' },
    { id: 'ira', type: 'savings' },
    { id: 'etf', type: 'investment' },
] as any[]

const amounts = [
    ...Array.from({ length: 12 }, (_, i) => ({ budget_item_id: 'pay', month: i + 1, amount: 4000 })),
    { budget_item_id: 'side', month: 1, amount: '500' },
    ...Array.from({ length: 12 }, (_, i) => ({ budget_item_id: 'rent', month: i + 1, amount: 1500 })),
    { budget_item_id: 'ira', month: 1, amount: 500 },
    { budget_item_id: 'etf', month: 1, amount: 250 },
] as any[]

describe('budget calculations', () => {
    it('reads a cell, or 0 when empty', () => {
        expect(cellAmount(amounts, 'pay', 6)).toBe(4000)
        expect(cellAmount(amounts, 'side', 6)).toBe(0)
        expect(cellAmount(amounts, 'side', 1)).toBe(500)
    })

    it('totals a row across the year', () => {
        expect(rowTotal(amounts, 'rent')).toBe(18000)
    })

    it('totals a section for a month', () => {
        expect(monthTotal(items, amounts, 'income', 1)).toBe(4500)
        expect(monthTotal(items, amounts, 'income', 2)).toBe(4000)
    })

    it('totals a section for the year', () => {
        expect(sectionTotal(items, amounts, 'income')).toBe(48500)
    })

    it('net is income minus expenses, savings and investments', () => {
        expect(netByMonth(items, amounts, 1)).toBe(4500 - 1500 - 500 - 250)
        expect(netByMonth(items, amounts, 2)).toBe(2500)
        expect(netTotal(items, amounts)).toBe(2250 + 2500 * 11)
    })
})

describe('parseBudgetInput', () => {
    it.each([
        ['1200', 1200],
        ['1,200', 1200],
        ['$1,200.50', 1200.5],
        ['  75 ', 75],
        ['', 0],
        ['abc', 0],
        ['-50', 50],
    ])('%p -> %p', (input, expected) => {
        expect(parseBudgetInput(input)).toBe(expected)
    })
})
