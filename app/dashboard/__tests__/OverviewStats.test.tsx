import { render, screen } from '@testing-library/react-native'
import { OverviewStats } from '../OverviewStats'

const stats = (income: number, expenses: number, savings: number) =>
    render(<OverviewStats income={income} expenses={expenses} savings={savings} budgetItems={[]} budgetAmounts={[]} transactions={[]} year={2026} />)

describe('OverviewStats', () => {
    it('money put into savings is not taken away from what you kept: net is income minus spending', async () => {
        await stats(16100, 13200, 7800)
        expect(screen.getByText('Income − Spending')).toBeTruthy()
        expect(screen.getByText('+$2,900.00')).toBeTruthy()
        expect(screen.getByText('82.0% spent')).toBeTruthy()
    })

    it('shows when you spent more than you earned', async () => {
        await stats(16100, 19000, 7800)
        expect(screen.getByText('-$2,900.00')).toBeTruthy()
    })

    it('savings rate is what you saved out of what you earned', async () => {
        await stats(10000, 6000, 1500)
        expect(screen.getByText('15.0%')).toBeTruthy()
    })
})
