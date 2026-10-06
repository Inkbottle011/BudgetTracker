import { render, screen } from '@testing-library/react-native'
import { CardBalances } from '../CardBalances'
import { fake } from '../../../test/fakeSupabase'

jest.mock('../../../lib/supabase', () => require('../../../test/fakeSupabase').module)
jest.mock('@react-navigation/native', () => ({
    useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]),
}))

beforeEach(() => {
    fake.reset()
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date('2026-10-06T12:00:00Z'))
})
afterEach(() => jest.useRealTimers())

it('shows each linked card: owed, credit left and how much of the limit is used', async () => {
    fake.table('bank_accounts', { data: [
        { id: 'a', name: 'Sapphire', last_four: '9876', type: 'credit', balance_current: 812.4, balance_available: 4187.6, balance_updated_at: '2026-10-06T09:00:00Z' },
        { id: 'c', name: 'Checking', last_four: '1234', type: 'depository', balance_current: 1500.25, balance_available: 1400, balance_updated_at: null },
    ] })
    await render(<CardBalances />)
    expect(await screen.findByText('Credit cards')).toBeTruthy()
    expect(screen.getByText('Sapphire ••9876')).toBeTruthy()
    expect(screen.getAllByText('$812.40 owed').length).toBeGreaterThan(0)
    expect(screen.getByText('$4,187.60 available · 16% used')).toBeTruthy()
    expect(screen.getByText('Updated 3 hours ago')).toBeTruthy()
    expect(screen.queryByText(/Checking/)).toBeNull()
})

it('flags cards using a lot of their limit', async () => {
    fake.table('bank_accounts', { data: [
        { id: 'a', name: 'Sapphire', last_four: '9876', type: 'credit', balance_current: 4000, balance_available: 1000, balance_updated_at: '2026-10-06T09:00:00Z' },
    ] })
    await render(<CardBalances />)
    expect(await screen.findByText('$1,000.00 available · 80% used')).toBeTruthy()
    expect(screen.getByLabelText('High card usage')).toBeTruthy()
})

it('says when a balance has not been fetched yet', async () => {
    fake.table('bank_accounts', { data: [
        { id: 'd', name: 'New card', last_four: '1111', type: 'credit', balance_current: null, balance_available: null, balance_updated_at: null },
    ] })
    await render(<CardBalances />)
    expect(await screen.findByText('Balance appears after the next sync')).toBeTruthy()
})

it('shows nothing when no cards are linked', async () => {
    fake.table('bank_accounts', { data: [] })
    await render(<CardBalances />)
    await new Promise(r => setImmediate(r))
    expect(screen.queryByText('Credit cards')).toBeNull()
})
