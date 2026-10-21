import { render, screen } from '@testing-library/react-native'
import { SpendingSummary } from '../screens/SpendingSummary'

const base = { heading: 'Spent in October', spent: 867.22, planned: 1770, elapsed: 12 / 31, income: 147.7, saved: 300, left: -719.52, remainingDays: 19, wide: true }

it('shows what you spent against the plan, what is left and how you are pacing', async () => {
    await render(<SpendingSummary {...base} />)
    expect(screen.getByText('Spent in October')).toBeTruthy()
    expect(screen.getByText('$867.22')).toBeTruthy()
    expect(screen.getByText('of $1,770.00 planned')).toBeTruthy()
    expect(screen.getByText('$902.78 left for the next 19 days. $182 more than planned by today.')).toBeTruthy()
    expect(screen.getByLabelText('Today')).toBeTruthy()
})

it('says when you are under your plan by today', async () => {
    await render(<SpendingSummary {...base} spent={400} />)
    expect(screen.getByText('$1,370.00 left for the next 19 days. $285 less than planned by today.')).toBeTruthy()
})

it('says when you went over', async () => {
    await render(<SpendingSummary {...base} spent={1900} remainingDays={null} elapsed={1} />)
    expect(screen.getByText('$130.00 over your plan.')).toBeTruthy()
})

it('without a budget, points to the Budget tab', async () => {
    await render(<SpendingSummary {...base} planned={0} />)
    expect(screen.getByText('Set monthly amounts on the Budget tab to see how your spending is pacing.')).toBeTruthy()
    expect(screen.queryByLabelText('Today')).toBeNull()
})

it('shows money taken out of savings as that, not as negative savings', async () => {
    await render(<SpendingSummary {...base} saved={-1200} />)
    expect(screen.getByText('Taken from savings')).toBeTruthy()
    expect(screen.getByText('$1,200.00')).toBeTruthy()
    expect(screen.queryByText('Saved')).toBeNull()
})
