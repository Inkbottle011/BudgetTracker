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
})
