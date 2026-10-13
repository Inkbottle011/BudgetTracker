import { render, screen, fireEvent } from '@testing-library/react-native'
import BudgetScreen from '../index'
import { ToastContext } from '../../../context/ToastContext'
import { fake } from '../../../test/fakeSupabase'

jest.mock('../../../lib/supabase', () => require('../../../test/fakeSupabase').module)

const showToast = jest.fn()
const year = new Date().getFullYear()
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function setWidth(width: number) {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 })
}

async function renderScreen() {
    await render(<ToastContext.Provider value={{ showToast }}><BudgetScreen /></ToastContext.Provider>)
    await screen.findByText('Rent')
}

const upserts = () => fake.calls('budget_amounts').flatMap(c => c.ops.filter(o => o.method === 'upsert').map(o => o.args[0]))

beforeEach(() => {
    fake.reset()
    showToast.mockClear()
    fake.table('budget_items', { data: [{ id: 'rent', name: 'Rent', type: 'expense' }, { id: 'pay', name: 'Pay', type: 'income' }] })
    fake.table('budget_amounts', { data: [{ budget_item_id: 'pay', month: 1, year, amount: 5000 }] })
})
afterEach(() => jest.restoreAllMocks())

describe('on a computer: the 12-month grid', () => {
    beforeEach(() => setWidth(1200))

    it('shows a title, friendly section names and what is left over each month', async () => {
        await renderScreen()
        expect(screen.getByText('Budget')).toBeTruthy()
        expect(screen.getByText('Plan how much comes in, goes out and gets saved each month.')).toBeTruthy()
        for (const t of ['Income', 'Spending', 'Savings', 'Investments']) expect(screen.getByText(t)).toBeTruthy()
        expect(screen.getByText('Left over each month')).toBeTruthy()
        expect(screen.queryByText('Net')).toBeNull()
        expect(screen.getAllByText('$5,000').length).toBeGreaterThan(0)
        // Every month is on screen at once
        expect(screen.getByLabelText('Rent, Jan')).toBeTruthy()
        expect(screen.getByLabelText('Rent, Dec')).toBeTruthy()
    })

    it('edits one month, accepting "1,200", and shows a shortfall as -$1,200', async () => {
        await renderScreen()
        await fireEvent.press(screen.getByLabelText('Rent, Mar'))
        await fireEvent.changeText(screen.getByLabelText('Rent, Mar amount'), '1,200')
        await fireEvent.press(screen.getByLabelText('Save this month only'))
        expect(upserts()).toEqual([expect.objectContaining({ budget_item_id: 'rent', month: 3, year, amount: 1200 })])
        expect(screen.getAllByText('$1,200').length).toBeGreaterThan(0)
        expect(screen.getAllByText('-$1,200').length).toBeGreaterThan(0) // left over in March
        expect(screen.queryByText('$-1,200')).toBeNull()
    })

    it('fills a value across the rest of the year', async () => {
        await renderScreen()
        await fireEvent.press(screen.getByLabelText('Rent, Oct'))
        await fireEvent.changeText(screen.getByLabelText('Rent, Oct amount'), '1500')
        await fireEvent.press(screen.getByLabelText('Save for Oct to Dec'))
        expect(upserts().map(u => u.month)).toEqual([10, 11, 12])
        expect(screen.getAllByText('$4,500').length).toBeGreaterThan(0) // row total and section total
        expect(showToast).toHaveBeenCalledWith('Saved for the rest of the year')
    })

    it('cancels an edit without saving', async () => {
        await renderScreen()
        await fireEvent.press(screen.getByLabelText('Rent, Mar'))
        await fireEvent.press(screen.getByLabelText('Cancel'))
        expect(screen.queryByLabelText('Rent, Mar amount')).toBeNull()
        expect(upserts()).toEqual([])
    })

    it('adds and deletes items', async () => {
        await renderScreen()
        await fireEvent.press(screen.getByLabelText('Add a savings item'))
        await fireEvent.changeText(screen.getByPlaceholderText('Name, e.g. Roth IRA'), 'Roth IRA')
        fake.table('budget_items', { data: { id: 'ira', name: 'Roth IRA', type: 'savings' } })
        await fireEvent.press(screen.getByText('Add'))
        expect(fake.arg('budget_items', 'insert')).toEqual({ user_id: 'user-1', name: 'Roth IRA', type: 'savings' })
        expect(await screen.findByText('Roth IRA')).toBeTruthy()

        fake.table('budget_items', { data: null })
        await fireEvent.press(screen.getByLabelText('Delete Rent'))
        expect(screen.queryByText('Rent')).toBeNull()
    })

    it('moves between years', async () => {
        await renderScreen()
        await fireEvent.press(screen.getByLabelText('Next year'))
        expect(await screen.findByText(String(year + 1))).toBeTruthy()
        const amountsCall = fake.calls('budget_amounts').at(-1)!
        expect(amountsCall.ops).toContainEqual({ method: 'eq', args: ['year', year + 1] })
    })
})

describe('on a phone: one month at a time', () => {
    beforeEach(() => setWidth(400))

    async function goToJanuary() {
        for (let i = 0; i < 12; i++) await fireEvent.press(screen.getByLabelText('Previous month'))
        expect(screen.getByText('January')).toBeTruthy()
    }

    it('starts on this month and only shows that month', async () => {
        await renderScreen()
        expect(screen.getByText(MONTH_NAMES[new Date().getMonth()])).toBeTruthy()
        expect(screen.getAllByLabelText(/^Rent, [A-Z][a-z]{2}$/)).toHaveLength(1)
    })

    it('switches months with the arrows and shows each item with its yearly total', async () => {
        await renderScreen()
        await goToJanuary()
        expect(screen.getByLabelText('Pay, Jan')).toBeTruthy()
        expect(screen.getAllByText('$5,000').length).toBeGreaterThan(0)
        expect(screen.getByText('Year: $5,000')).toBeTruthy()
        expect(screen.getAllByText('Total for January')).toHaveLength(4) // one per section
        await fireEvent.press(screen.getByLabelText('Next month'))
        expect(screen.getByText('February')).toBeTruthy()
        expect(screen.getByLabelText('Pay, Feb')).toBeTruthy()
    })

    it('edits the amount for the shown month', async () => {
        await renderScreen()
        await goToJanuary()
        await fireEvent.press(screen.getByLabelText('Rent, Jan'))
        await fireEvent.changeText(screen.getByLabelText('Rent, Jan amount'), '800')
        await fireEvent.press(screen.getByLabelText('Save this month only'))
        expect(upserts()).toEqual([expect.objectContaining({ budget_item_id: 'rent', month: 1, year, amount: 800 })])
        expect(screen.getByText('Year: $800')).toBeTruthy()
    })

    it('can use the same amount for every month', async () => {
        await renderScreen()
        await goToJanuary()
        await fireEvent.press(screen.getByLabelText('Rent, Jan'))
        await fireEvent.changeText(screen.getByLabelText('Rent, Jan amount'), '1,000')
        await fireEvent.press(screen.getByLabelText('Save for every month'))
        expect(upserts().map(u => u.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
        expect(screen.getByText('Year: $12,000')).toBeTruthy()
    })

    it('adds and deletes items', async () => {
        await renderScreen()
        await fireEvent.press(screen.getByLabelText('Add a spending item'))
        await fireEvent.changeText(screen.getByPlaceholderText('Name, e.g. Groceries'), 'Food')
        fake.table('budget_items', { data: { id: 'food', name: 'Food', type: 'expense' } })
        await fireEvent.press(screen.getByText('Add'))
        expect(await screen.findByText('Food')).toBeTruthy()

        fake.table('budget_items', { data: null })
        await fireEvent.press(screen.getByLabelText('Delete Rent'))
        expect(screen.queryByText('Rent')).toBeNull()
    })
})
