import { render, screen, fireEvent } from '@testing-library/react-native'
import { MonthlyTrend } from '../MonthlyTrend'

describe('MonthlyTrend', () => {
    beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date(2026, 9, 15)) })
    afterEach(() => jest.useRealTimers())

    it('renders the last 6 months, then all 12 when expanded', async () => {
        await render(<MonthlyTrend transactions={[{ date: '2026-10-01', type: 'income', amount: 100 }]} selectedYear={2026} />)
        expect(screen.getByText('Monthly Trend')).toBeTruthy()
        expect(screen.getByText('May')).toBeTruthy()
        expect(screen.getByText('Oct')).toBeTruthy()
        expect(screen.queryByText('Jan')).toBeNull()
    })

    const list = [
        { date: '2026-08-01', type: 'income', amount: 2488 },
        { date: '2026-08-05', type: 'expense', amount: 3695.5 },
        { date: '2026-09-01', type: 'income', amount: 842 },
    ]

    it('shows a month\'s numbers when you hover over it, and hides them when you move away', async () => {
        await render(<MonthlyTrend transactions={list} selectedYear={2026} />)
        expect(screen.queryByText('Aug 2026')).toBeNull()
        await fireEvent(screen.getByLabelText('Aug'), 'hoverIn')
        expect(screen.getByText('Aug 2026')).toBeTruthy()
        expect(screen.getByText('Income $2,488.00')).toBeTruthy()
        expect(screen.getByText('Spent $3,695.50')).toBeTruthy()
        expect(screen.getByText('Net -$1,207.50')).toBeTruthy()
        await fireEvent(screen.getByLabelText('Aug'), 'hoverOut')
        expect(screen.queryByText('Aug 2026')).toBeNull()
    })

    it('highlights the hovered month and dims the others', async () => {
        await render(<MonthlyTrend transactions={list} selectedYear={2026} />)
        await fireEvent(screen.getByLabelText('Aug'), 'hoverIn')
        const flat = (el: any) => Object.assign({}, ...[el.props.style].flat(Infinity).filter(Boolean))
        expect(flat(screen.getByLabelText('Aug')).backgroundColor).toBe('#eef4fb')
        expect(flat(screen.getByLabelText('Sep')).opacity).toBe(0.45)
    })

    it('on a phone, tapping a month shows its numbers and tapping again hides them', async () => {
        await render(<MonthlyTrend transactions={list} selectedYear={2026} />)
        await fireEvent.press(screen.getByLabelText('Sep'))
        expect(screen.getByText('Sep 2026')).toBeTruthy()
        expect(screen.getByText('Net +$842.00')).toBeTruthy()
        await fireEvent.press(screen.getByLabelText('Sep'))
        expect(screen.queryByText('Sep 2026')).toBeNull()
    })
})
