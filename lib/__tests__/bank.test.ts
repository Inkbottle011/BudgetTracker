import { suggestedStartDate, callBank, describeStatus } from '../bank'
import { functions } from '../../test/fakeSupabase'

jest.mock('../supabase', () => require('../../test/fakeSupabase').module)

describe('suggestedStartDate', () => {
    it('starts the day after your latest transaction, so nothing is imported twice', () => {
        expect(suggestedStartDate([{ date: '2026-09-20' }, { date: '2026-10-03' }, { date: '2026-08-01' }], '2026-10-06')).toBe('2026-10-04')
    })

    it('uses the last 30 days when you have no recent transactions', () => {
        expect(suggestedStartDate([], '2026-10-06')).toBe('2026-09-06')
        expect(suggestedStartDate([{ date: '2025-01-01' }], '2026-10-06')).toBe('2026-09-06')
    })

    it('never suggests a future date', () => {
        expect(suggestedStartDate([{ date: '2026-10-06' }], '2026-10-06')).toBe('2026-10-06')
        expect(suggestedStartDate([{ date: '2026-12-25' }], '2026-10-06')).toBe('2026-10-06')
    })
})

describe('describeStatus', () => {
    const now = new Date('2026-10-06T12:00:00Z')
    it.each([
        [{ status: 'active', last_synced_at: '2026-10-06T11:30:00Z' }, 'Synced 30 minutes ago'],
        [{ status: 'active', last_synced_at: '2026-10-06T09:00:00Z' }, 'Synced 3 hours ago'],
        [{ status: 'active', last_synced_at: '2026-10-04T12:00:00Z' }, 'Synced 2 days ago'],
        [{ status: 'active', last_synced_at: null }, 'Not synced yet'],
        [{ status: 'needs_relink', last_error: 'The enrollment was disconnected' }, 'Needs relinking: the bank stopped sharing data'],
        [{ status: 'error', last_error: 'Bank is down' }, 'Last sync failed: Bank is down'],
    ])('%o -> %p', (conn, text) => {
        expect(describeStatus(conn as any, now)).toBe(text)
    })
})

describe('callBank', () => {
    const invoke = functions.invoke as jest.Mock
    beforeEach(() => invoke.mockReset())

    it('calls the bank server function with the action', async () => {
        invoke.mockResolvedValueOnce({ data: { added: 3 }, error: null })
        await expect(callBank('sync')).resolves.toEqual({ added: 3 })
        expect(invoke).toHaveBeenCalledWith('bank', { body: { action: 'sync' } })
    })

    it('passes on the server\'s explanation when something fails', async () => {
        invoke.mockResolvedValueOnce({
            data: null,
            error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ error: 'Enter your two-factor code to continue.', code: 'two_factor_needed' }) } },
        })
        const err = await callBank('sync').catch(e => e)
        expect(err.message).toBe('Enter your two-factor code to continue.')
        expect(err.code).toBe('two_factor_needed')
    })

    it('falls back to a plain message when the server could not be reached', async () => {
        invoke.mockResolvedValueOnce({ data: null, error: { message: 'Failed to send a request to the Edge Function' } })
        await expect(callBank('sync')).rejects.toThrow("Couldn't reach the bank service. Check your connection and try again.")
    })
})

import { cardSummary, formatBalance } from '../bank'

describe('cardSummary', () => {
    const cards = [
        { id: 'a', name: 'Sapphire', last_four: '9876', type: 'credit', balance_current: '812.40', balance_available: '4187.60', balance_updated_at: '2026-10-06T09:00:00Z' },
        { id: 'b', name: 'Quicksilver', last_four: '4455', type: 'credit', balance_current: 0, balance_available: 3000, balance_updated_at: '2026-10-06T09:00:00Z' },
        { id: 'c', name: 'Checking', last_four: '1234', type: 'depository', balance_current: 1500.25, balance_available: 1400, balance_updated_at: null },
        { id: 'd', name: 'New card', last_four: '1111', type: 'credit', balance_current: null, balance_available: null, balance_updated_at: null },
    ] as any[]

    it('lists credit cards only, with what is owed, credit left and how much of the limit is used', () => {
        const s = cardSummary(cards)
        expect(s.cards.map(c => [c.name, c.owed, c.available, c.usedPercent])).toEqual([
            ['Sapphire', 812.4, 4187.6, 16],
            ['Quicksilver', 0, 3000, 0],
            ['New card', null, null, null],
        ])
    })

    it('totals what is owed across cards with a known balance', () => {
        expect(cardSummary(cards)).toMatchObject({ totalOwed: 812.4, totalAvailable: 7187.6, usedPercent: 10 })
    })

    it('is empty without linked cards', () => {
        expect(cardSummary([cards[2]])).toEqual({ cards: [], totalOwed: 0, totalAvailable: 0, usedPercent: null })
    })
})

describe('formatBalance', () => {
    it('formats money with thousands separators', () => {
        expect(formatBalance(4187.6)).toBe('$4,187.60')
        expect(formatBalance(-12)).toBe('-$12.00')
        expect(formatBalance(null)).toBe('—')
    })
})
