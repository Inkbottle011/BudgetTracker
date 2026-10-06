import { render, screen } from '@testing-library/react-native'
import { SavingsBalances } from '../SavingsBalances'
import { fake } from '../../../test/fakeSupabase'
import { isSavingsAccount } from '../../../lib/bank'

jest.mock('../../../lib/supabase', () => require('../../../test/fakeSupabase').module)
jest.mock('@react-navigation/native', () => ({
    useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]),
}))

const accounts = [
    { id: 's', name: 'SoFi Savings', last_four: '5213', type: 'depository', subtype: 'savings', balance_current: 2500, balance_updated_at: '2026-10-06T09:00:00Z' },
    { id: 'v1', name: 'Rent Willington', last_four: null, type: 'depository', subtype: 'cash management', balance_current: 6450.1, balance_updated_at: '2026-10-06T09:00:00Z' },
    { id: 'v2', name: 'Car', last_four: null, type: 'depository', subtype: 'cash management', balance_current: '300', balance_updated_at: '2026-10-06T09:00:00Z' },
    { id: 'c', name: 'SoFi Checking', last_four: '0026', type: 'depository', subtype: 'checking', balance_current: 900, balance_updated_at: null },
]
const transactions = [
    { date: '2026-06-22', type: 'savings', amount: 400 },
    { date: '2026-08-01', type: 'savings', amount: 900 },
    { date: '2026-09-03', type: 'withdrawal', amount: 700 },
    { date: '2025-12-01', type: 'savings', amount: 5000 },   // last year
    { date: '2026-09-01', type: 'expense', amount: 50 },
]

beforeEach(() => {
    fake.reset()
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date('2026-10-06T12:00:00Z'))
})
afterEach(() => jest.useRealTimers())

describe('isSavingsAccount', () => {
    it('counts savings, vaults ("cash management") and money market accounts, not checking or cards', () => {
        expect(accounts.map(a => isSavingsAccount(a))).toEqual([true, true, true, false])
        expect(isSavingsAccount({ type: 'depository', subtype: 'money market' })).toBe(true)
        expect(isSavingsAccount({ type: 'credit', subtype: 'savings' })).toBe(false)
    })
})

it('shows the total in savings, each account and vault, and this year\'s money in and out', async () => {
    fake.table('bank_accounts', { data: accounts })
    await render(<SavingsBalances transactions={transactions} year={2026} />)
    expect(await screen.findByText('Savings')).toBeTruthy()
    expect(screen.getByText('$9,250.10 in total')).toBeTruthy()
    expect(screen.getByText('Rent Willington')).toBeTruthy()
    expect(screen.getByText('$6,450.10')).toBeTruthy()
    expect(screen.getByText('SoFi Savings ••5213')).toBeTruthy()
    expect(screen.queryByText(/SoFi Checking/)).toBeNull()
    expect(screen.getByText('2026: put in $1,300.00 · taken out $700.00 · net +$600.00')).toBeTruthy()
})

it('lists the biggest balance first', async () => {
    fake.table('bank_accounts', { data: accounts })
    await render(<SavingsBalances transactions={transactions} year={2026} />)
    await screen.findByText('Savings')
    const names = screen.getAllByTestId('savings-account').map(n => n.props.children)
    expect(names).toEqual(['Rent Willington', 'SoFi Savings ••5213', 'Car'])
})

it('without linked savings accounts, still shows this year\'s money in and out', async () => {
    fake.table('bank_accounts', { data: [] })
    await render(<SavingsBalances transactions={transactions} year={2026} />)
    expect(await screen.findByText('2026: put in $1,300.00 · taken out $700.00 · net +$600.00')).toBeTruthy()
    expect(screen.queryByText(/in total/)).toBeNull()
})

it('shows nothing when there are no savings at all', async () => {
    fake.table('bank_accounts', { data: [] })
    await render(<SavingsBalances transactions={[{ date: '2026-09-01', type: 'expense', amount: 50 }]} year={2026} />)
    await new Promise(r => setImmediate(r))
    expect(screen.queryByText('Savings')).toBeNull()
})
