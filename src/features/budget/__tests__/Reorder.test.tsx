import { render, screen, fireEvent } from '@testing-library/react-native'
import BudgetScreen from '../screens/BudgetScreen'
import { ToastContext } from '../../../shared/ui/ToastContext'
import { fake } from '../../../../test/fakeSupabase'

jest.mock('../../../shared/supabase', () => require('../../../../test/fakeSupabase').module)

const updates = () => fake.calls('budget_items').filter(c => c.ops.some(o => o.method === 'update'))
    .map(c => [c.ops.find(o => o.method === 'eq')!.args[1], c.ops.find(o => o.method === 'update')!.args[0].position])
const spendingOrder = () => screen.getAllByRole('button', { name: /^Change (Food|Rent|Fun),/ }).map(b => b.props.accessibilityLabel.split(',')[0].replace('Change ', ''))

beforeEach(() => {
    fake.reset()
    fake.table('budget_items', call => call.ops.some(o => o.method === 'update') ? { data: null, error: null } : { data: [
        { id: 'food', name: 'Food', type: 'expense', position: null, created_at: '2026-01-01' },
        { id: 'rent', name: 'Rent', type: 'expense', position: null, created_at: '2026-01-02' },
        { id: 'fun', name: 'Fun', type: 'expense', position: 0, created_at: '2026-01-03' },
        { id: 'pay', name: 'Pay', type: 'income', position: null, created_at: '2026-01-01' },
    ] })
    fake.table('budget_amounts', { data: [] })
})

it('shows items in the order you chose (moved ones first, the rest by when added)', async () => {
    await render(<ToastContext.Provider value={{ showToast: jest.fn() }}><BudgetScreen /></ToastContext.Provider>)
    await screen.findByText('Rent')
    expect(spendingOrder()).toEqual(['Fun', 'Food', 'Rent'])
})

it('moves an item up or down within its section, and saves the order', async () => {
    await render(<ToastContext.Provider value={{ showToast: jest.fn() }}><BudgetScreen /></ToastContext.Provider>)
    await screen.findByText('Rent')
    await fireEvent.press(screen.getByRole('button', { name: 'Reorder Spending' }))
    expect(screen.queryByRole('button', { name: 'Move Fun up' })).toBeNull()   // already first
    await fireEvent.press(screen.getByRole('button', { name: 'Move Rent up' }))
    expect(spendingOrder()).toEqual(['Fun', 'Rent', 'Food'])
    expect(updates()).toEqual([['fun', 0], ['rent', 1], ['food', 2]])
    await fireEvent.press(screen.getByRole('button', { name: 'Done reordering' }))
    expect(screen.queryByRole('button', { name: 'Move Rent up' })).toBeNull()
})
