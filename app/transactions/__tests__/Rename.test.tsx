import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import TransactionsScreen from '../index'
import { ToastContext } from '../../../context/ToastContext'
import { useTransactionStore } from '../../../store/useTransactionStore'
import { fake, supabase, auth } from '../../../test/fakeSupabase'

jest.mock('../../../lib/supabase', () => require('../../../test/fakeSupabase').module)

const saved = [
    { id: 'a', date: '2026-10-01', type: 'expense', amount: 12.31, name: 'TACOS TEXAS', note: '', category_label: 'Food' },
    { id: 'b', date: '2026-09-28', type: 'expense', amount: 14.55, name: 'TACOS TEXAS', note: '', category_label: 'Food' },
    { id: 'c', date: '2026-09-14', type: 'expense', amount: 14.16, name: 'Taco place', original_name: 'TACOS TEXAS', note: '', category_label: 'Food' },
    { id: 'd', date: '2026-10-02', type: 'expense', amount: 3, name: 'Wawa', note: '', category_label: 'Food' },
]
const showToast = jest.fn()
const rpc = supabase.rpc as jest.Mock
const nameInput = () => screen.getByPlaceholderText('e.g. Grocery run, Netflix, Paycheck...')

async function editFirstTacos() {
    await render(<ToastContext.Provider value={{ showToast }}><TransactionsScreen /></ToastContext.Provider>)
    await screen.findByText('Wawa')
    await fireEvent.press(screen.getByText('Edit'))
    await fireEvent.press(screen.getAllByText('TACOS TEXAS')[0])
}

beforeEach(() => {
    fake.reset()
    showToast.mockClear()
    rpc.mockReset()
    rpc.mockResolvedValue({ data: 3, error: null })
    useTransactionStore.setState({ transactions: [] })
    fake.table('transactions', { data: saved })
    fake.table('budget_items', { data: [] })
    fake.table('merchant_renames', { data: null, error: null })
})

it('offers to use a new name for every transaction from that place', async () => {
    await editFirstTacos()
    expect(screen.queryByText(/Use this name for all/)).toBeNull()
    await fireEvent.changeText(nameInput(), 'Tacos Texas')
    expect(screen.getByText('Use this name for all "TACOS TEXAS" transactions, now and in the future')).toBeTruthy()
})

it('renames every transaction from that place, keeps their original wording, and remembers the name', async () => {
    await editFirstTacos()
    await fireEvent.changeText(nameInput(), 'Tacos Texas')
    await fireEvent.press(screen.getByText('Save Changes'))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Renamed 3 TACOS TEXAS transactions to Tacos Texas. New ones will be too.'))
    expect(rpc).toHaveBeenCalledWith('rename_transactions', { p_ids: ['a', 'b', 'c'], p_name: 'Tacos Texas' })
    expect(fake.arg('merchant_renames', 'upsert')).toEqual({ user_id: 'user-1', merchant_key: 'tacos texas', display_name: 'Tacos Texas' })
    // The other changes still save, without overwriting the name
    expect(fake.arg('transactions', 'update')).not.toHaveProperty('name')
})

it('can rename just this one', async () => {
    await editFirstTacos()
    await fireEvent.changeText(nameInput(), 'Lunch with Sam')
    await fireEvent.press(screen.getByLabelText('Use this name for all "TACOS TEXAS" transactions, now and in the future'))
    await fireEvent.press(screen.getByText('Save Changes'))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('rename_transactions', { p_ids: ['a'], p_name: 'Lunch with Sam' }))
    expect(fake.arg('merchant_renames', 'upsert')).toBeUndefined()
})

it('explains the one-time setup if renaming isn\'t set up yet, and still saves the name', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'Could not find the function public.rename_transactions' } })
    await editFirstTacos()
    await fireEvent.changeText(nameInput(), 'Tacos Texas')
    await fireEvent.press(screen.getByText('Save Changes'))
    await waitFor(() => expect(showToast).toHaveBeenCalledWith(
        'Saved. To rename every TACOS TEXAS transaction, run supabase/sql/merchants/01_setup.sql in Supabase first.', 'error'))
    const updates = fake.calls('transactions').flatMap(c => c.ops.filter(o => o.method === 'update').map(o => o.args[0]))
    expect(updates).toContainEqual({ name: 'Tacos Texas' })
})
