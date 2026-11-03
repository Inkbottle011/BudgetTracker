import { loadProgress, stepsFrom, isBrandNew } from '../logic/progress'
import { wasWelcomed, markWelcomed, isChecklistHidden, setChecklistHidden } from '../logic/remember'
import { fake, auth } from '../../../../test/fakeSupabase'

jest.mock('../../../shared/supabase', () => require('../../../../test/fakeSupabase').module)
const mfa = auth.mfa as unknown as Record<string, jest.Mock>
const VERIFIED = { id: 'f1', factor_type: 'totp', status: 'verified' }

beforeEach(() => {
    fake.reset()
    fake.table('transactions', { data: [] })
    fake.table('budget_items', { data: [] })
    fake.table('subscriptions', { data: [] })
    mfa.listFactors.mockResolvedValue({ data: { all: [], totp: [] }, error: null })
})

describe('what you have set up', () => {
    it('a brand-new account has nothing yet', async () => {
        const p = await loadProgress()
        expect(p).toEqual({ transactions: false, budget: false, subscriptions: false, twoFactor: false })
        expect(isBrandNew(p!)).toBe(true)
    })

    it('sees transactions, a budget, subscriptions and two-factor sign-in', async () => {
        fake.table('transactions', { data: [{ date: '2026-10-01' }] })
        fake.table('budget_items', { data: [{ id: 'food', name: 'Food', type: 'expense' }] })
        fake.table('subscriptions', { data: [{ id: 's', name: 'Rent' }] })
        mfa.listFactors.mockResolvedValue({ data: { all: [VERIFIED], totp: [VERIFIED] }, error: null })
        expect(await loadProgress()).toEqual({ transactions: true, budget: true, subscriptions: true, twoFactor: true })
    })

    it("anyone with something already isn't brand new", () => {
        expect(isBrandNew({ transactions: false, budget: true, subscriptions: false, twoFactor: false })).toBe(false)
        expect(isBrandNew({ transactions: false, budget: false, subscriptions: false, twoFactor: true })).toBe(true)
    })

    it("says it can't tell when the database doesn't answer", async () => {
        fake.table('subscriptions', { data: null, error: { message: 'paused' } })
        expect(await loadProgress()).toBeNull()
    })

    it('lists the steps in order: transactions, budget, subscriptions, two-factor', () => {
        const s = stepsFrom({ transactions: true, budget: false, subscriptions: false, twoFactor: true })
        expect(s.map(x => [x.id, x.done])).toEqual([['transactions', true], ['budget', false], ['subscriptions', false], ['twoFactor', true]])
    })
})

describe('remembered on this device, for each person', () => {
    it('remembers the welcome was shown', async () => {
        expect(await wasWelcomed()).toBe(false)
        await markWelcomed()
        expect(await wasWelcomed()).toBe(true)
        auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'someone-else' } } } } as any)
        expect(await wasWelcomed()).toBe(false)
    })

    it('remembers hiding the checklist, and showing it again', async () => {
        expect(await isChecklistHidden()).toBe(false)
        await setChecklistHidden(true)
        expect(await isChecklistHidden()).toBe(true)
        await setChecklistHidden(false)
        expect(await isChecklistHidden()).toBe(false)
    })
})
