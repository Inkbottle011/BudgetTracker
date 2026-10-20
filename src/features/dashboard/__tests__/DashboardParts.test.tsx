import { render, screen, fireEvent } from '@testing-library/react-native'
import { AccountsRow } from '../screens/AccountsRow'
import { BudgetList } from '../screens/BudgetList'
import { ActivityList } from '../screens/ActivityList'
import { accountsSummary } from '../logic/summary'

describe('AccountsRow', () => {
    const s = accountsSummary([
        { id: '1', name: 'SoFi Checking', last_four: '0026', type: 'depository', subtype: 'checking', balance_current: 1843.22 },
        { id: '2', name: 'SoFi Savings', last_four: '5213', type: 'depository', subtype: 'savings', balance_current: 2410.55 },
        { id: '3', name: 'Car', last_four: null, type: 'depository', subtype: 'cash management', balance_current: 300 },
        { id: '4', name: 'Quicksilver', last_four: '4412', type: 'credit', subtype: 'credit card', balance_current: 800, balance_available: 1200 },
    ] as any)

    it('shows checking, savings and what\'s owed, and lists the accounts in a group when tapped', async () => {
        await render(<AccountsRow {...s} updatedAt={null} wide />)
        expect(screen.getByText('$1,843.22')).toBeTruthy()
        expect(screen.getByText('$2,710.55')).toBeTruthy()
        expect(screen.getByText('$800.00')).toBeTruthy()
        expect(screen.queryByText('Car')).toBeNull()
        await fireEvent.press(screen.getByLabelText('Savings, show accounts'))
        expect(screen.getByText('SoFi Savings ••5213')).toBeTruthy()
        expect(screen.getByText('Car')).toBeTruthy()
        await fireEvent.press(screen.getByLabelText('Savings, show accounts'))
        expect(screen.queryByText('Car')).toBeNull()
    })

    it('warns when a card uses a lot of its limit', async () => {
        await render(<AccountsRow {...s} updatedAt={null} wide />)
        await fireEvent.press(screen.getByLabelText('Owed on cards, show accounts'))
        expect(screen.getByText('40% of the limit used, which can lower your credit score')).toBeTruthy()
    })

    it('shows nothing without linked banks', async () => {
        const empty = accountsSummary([])
        await render(<AccountsRow {...empty} updatedAt={null} wide />)
        expect(screen.queryByText('Checking')).toBeNull()
    })
})

describe('BudgetList', () => {
    const props = {
        title: 'Budget for October',
        rows: [
            { name: 'Entertainment', planned: 100, spent: 120, left: -20 },
            { name: 'Food', planned: 400, spent: 120, left: 280 },
            { name: 'Gifts', planned: 0, spent: 25, left: -25 },
            { name: 'Unused', planned: 0, spent: 0, left: 0 },
        ],
        uncategorized: 40,
        goals: [{ name: 'Fenner', type: 'income', planned: 1800, actual: 900 }, { name: 'Sofi Savings', type: 'savings', planned: 500, actual: 600 }],
        onCategorize: jest.fn(),
        onEditBudget: jest.fn(),
    }

    it('shows what\'s left or over in each category, and hides categories with no plan and no spending', async () => {
        await render(<BudgetList {...props} />)
        expect(screen.getByText('$20.00 over')).toBeTruthy()
        expect(screen.getByText('$280.00 left')).toBeTruthy()
        expect(screen.getByText('$120.00 of $400.00')).toBeTruthy()
        expect(screen.getByText('No budget')).toBeTruthy()
        expect(screen.queryByText('Unused')).toBeNull()
    })

    it('links uncategorized spending to categorizing, and the title to editing the budget', async () => {
        await render(<BudgetList {...props} />)
        await fireEvent.press(screen.getByText('Give these a category'))
        expect(props.onCategorize).toHaveBeenCalled()
        await fireEvent.press(screen.getByText('Edit budget'))
        expect(props.onEditBudget).toHaveBeenCalled()
    })

    it('shows income and savings goals', async () => {
        await render(<BudgetList {...props} />)
        expect(screen.getByText('$900.00 to go')).toBeTruthy()
        expect(screen.getByText('Reached')).toBeTruthy()
    })
})

describe('ActivityList', () => {
    it('shows short dates, money in green with +, money out with -, and transfers as moves', async () => {
        await render(<ActivityList title="Recent" empty="None" items={[
            { id: '1', name: 'Zelle from Jake', date: '2026-10-05', type: 'income', amount: 74.2 },
            { id: '2', name: 'SEPTA', date: '2026-10-05', type: 'expense', amount: 6.5 },
            { id: '3', name: 'CHASE CREDIT CRD', date: '2026-10-06', type: 'transfer', amount: 594.8 },
        ]} />)
        expect(screen.getAllByText('Oct 5')).toHaveLength(2)
        expect(screen.getByText('+$74.20')).toBeTruthy()
        expect(screen.getByText('-$6.50')).toBeTruthy()
        expect(screen.getByText('$594.80')).toBeTruthy()
        expect(screen.getByText('Transfer between your accounts')).toBeTruthy()
    })

    it('says when there is nothing to show', async () => {
        await render(<ActivityList title="Coming up" empty="No subscriptions due in the next 30 days." items={[]} />)
        expect(screen.getByText('No subscriptions due in the next 30 days.')).toBeTruthy()
    })
})
