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
