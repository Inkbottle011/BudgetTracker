import {
    Subscription, occurrence, addDays, toDateString, localToday, isValidDate, hasEnded, chargesBetween,
    nextCharge, monthlyAmount, upcomingCharges, formatDate, syncSubscriptionCharges, fetchSubscriptions,
} from '../subscriptions'
import { supabase } from '../supabase'

jest.mock('../supabase', () => ({
    supabase: { rpc: jest.fn(), from: jest.fn() },
}))

function sub(overrides: Partial<Subscription> = {}): Subscription {
    return {
        id: 's1', user_id: 'u1', name: 'Netflix', amount: 15.99, type: 'expense', category_label: 'Entertainment',
        note: null, frequency: 'monthly', start_date: '2026-01-15', end_date: null, status: 'active',
        generated_through: null, created_at: '2026-01-01T00:00:00Z', ...overrides,
    }
}

describe('occurrence', () => {
    it('counts weekly and biweekly in days', () => {
        expect(occurrence('2026-10-01', 'weekly', 0)).toBe('2026-10-01')
        expect(occurrence('2026-10-01', 'weekly', 5)).toBe('2026-11-05')
        expect(occurrence('2026-12-25', 'biweekly', 1)).toBe('2027-01-08')
    })

    it('keeps a month-end charge on the last day of shorter months without drifting', () => {
        const dates = [0, 1, 2, 3, 4].map(n => occurrence('2026-01-31', 'monthly', n))
        expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31'])
    })

    it('handles leap years', () => {
        expect(occurrence('2024-01-31', 'monthly', 1)).toBe('2024-02-29')
        expect(occurrence('2024-02-29', 'yearly', 1)).toBe('2025-02-28')
        expect(occurrence('2024-02-29', 'yearly', 4)).toBe('2028-02-29')
    })

    it('rolls over the year for monthly charges', () => {
        expect(occurrence('2026-11-15', 'monthly', 3)).toBe('2027-02-15')
        expect(occurrence('2026-01-15', 'monthly', 24)).toBe('2028-01-15')
    })

    it('is unaffected by daylight saving changes', () => {
        // US clocks change on Nov 1 2026 and Mar 14 2027
        expect(occurrence('2026-10-25', 'weekly', 1)).toBe('2026-11-01')
        expect(occurrence('2027-03-07', 'weekly', 1)).toBe('2027-03-14')
    })
})

describe('date helpers', () => {
    afterEach(() => jest.useRealTimers())

    it('addDays crosses months and years', () => {
        expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
        expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    })

    it('toDateString pads month and day', () => {
        expect(toDateString(new Date(2026, 0, 5))).toBe('2026-01-05')
    })

    it('localToday uses local time', () => {
        jest.useFakeTimers()
        jest.setSystemTime(new Date(2026, 9, 5, 23, 30))
        expect(localToday()).toBe('2026-10-05')
    })

    it('isValidDate checks format and real calendar dates', () => {
        expect(isValidDate('2026-02-28')).toBe(true)
        expect(isValidDate('2024-02-29')).toBe(true)
        expect(isValidDate('2026-02-29')).toBe(false)
        expect(isValidDate('2026-13-01')).toBe(false)
        expect(isValidDate('10/05/2026')).toBe(false)
        expect(isValidDate('')).toBe(false)
    })

    it('formatDate shows a readable date for the same day', () => {
        expect(formatDate('2026-10-05')).toMatch(/Oct.*5.*2026/)
    })
})

describe('chargesBetween', () => {
    it('lists charge dates in the range', () => {
        expect(chargesBetween(sub(), '2026-03-01', '2026-05-31')).toEqual(['2026-03-15', '2026-04-15', '2026-05-15'])
    })

    it('includes both ends of the range', () => {
        expect(chargesBetween(sub(), '2026-03-15', '2026-04-15')).toEqual(['2026-03-15', '2026-04-15'])
    })

    it('skips charges already added', () => {
        expect(chargesBetween(sub({ generated_through: '2026-04-15' }), '2026-03-01', '2026-05-31')).toEqual(['2026-05-15'])
    })

    it('stops at the end date', () => {
        expect(chargesBetween(sub({ end_date: '2026-04-20' }), '2026-03-01', '2026-12-31')).toEqual(['2026-03-15', '2026-04-15'])
    })

    it('returns nothing for paused or cancelled subscriptions', () => {
        expect(chargesBetween(sub({ status: 'paused' }), '2026-01-01', '2026-12-31')).toEqual([])
        expect(chargesBetween(sub({ status: 'cancelled' }), '2026-01-01', '2026-12-31')).toEqual([])
    })

    it('returns nothing before the start date', () => {
        expect(chargesBetween(sub(), '2025-01-01', '2026-01-14')).toEqual([])
    })
})

describe('nextCharge', () => {
    it('is the start date when nothing has been added yet', () => {
        expect(nextCharge(sub())).toBe('2026-01-15')
    })
    it('is the first charge after the last one added', () => {
        expect(nextCharge(sub({ generated_through: '2026-09-15' }))).toBe('2026-10-15')
        expect(nextCharge(sub({ generated_through: '2026-09-20' }))).toBe('2026-10-15')
    })
    it('is null once past the end date', () => {
        expect(nextCharge(sub({ generated_through: '2026-09-15', end_date: '2026-10-01' }))).toBeNull()
    })
    it('is null unless active', () => {
        expect(nextCharge(sub({ status: 'paused' }))).toBeNull()
    })
})

describe('hasEnded', () => {
    it('is true for cancelled subscriptions', () => {
        expect(hasEnded(sub({ status: 'cancelled' }), '2026-10-05')).toBe(true)
    })
    it('is true once the end date has passed', () => {
        expect(hasEnded(sub({ end_date: '2026-10-04' }), '2026-10-05')).toBe(true)
    })
    it('is false on the end date itself', () => {
        expect(hasEnded(sub({ end_date: '2026-10-05' }), '2026-10-05')).toBe(false)
    })
    it('is false for active subscriptions without an end date', () => {
        expect(hasEnded(sub(), '2026-10-05')).toBe(false)
    })
})

describe('monthlyAmount', () => {
    it.each([
        ['weekly', 10, 43.33],
        ['biweekly', 100, 216.67],
        ['monthly', 15.99, 15.99],
        ['yearly', 120, 10],
    ] as const)('%s %p is about %p a month', (frequency, amount, expected) => {
        expect(monthlyAmount(sub({ frequency, amount }))).toBeCloseTo(expected, 2)
    })
})

describe('upcomingCharges', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        jest.setSystemTime(new Date(2026, 9, 5, 12, 0)) // Oct 5 2026
    })
    afterEach(() => jest.useRealTimers())

    it('lists charges in the next 30 days across subscriptions, soonest first', () => {
        const result = upcomingCharges([
            sub({ id: 'a', name: 'Netflix', start_date: '2026-01-20', generated_through: '2026-09-20' }),
            sub({ id: 'b', name: 'Gym', frequency: 'weekly', start_date: '2026-10-01', generated_through: '2026-10-01', amount: 10 }),
            sub({ id: 'c', name: 'Paused', status: 'paused', start_date: '2026-10-06' }),
            sub({ id: 'd', name: 'Far', frequency: 'yearly', start_date: '2026-12-25' }),
        ])
        expect(result.map(r => `${r.nextDate} ${r.name}`)).toEqual([
            '2026-10-08 Gym', '2026-10-15 Gym', '2026-10-20 Netflix', '2026-10-22 Gym', '2026-10-29 Gym',
        ])
        expect(result[0]).toMatchObject({ id: 'b', amount: 10, type: 'expense', recurring: 'Weekly' })
    })

    it('includes a charge due today that has not been added yet', () => {
        const result = upcomingCharges([sub({ start_date: '2026-10-05' })])
        expect(result.map(r => r.nextDate)).toEqual(['2026-10-05'])
    })

    it('is empty with no subscriptions', () => {
        expect(upcomingCharges([])).toEqual([])
    })
})

describe('database calls', () => {
    const rpc = supabase.rpc as jest.Mock
    const from = supabase.from as jest.Mock
    beforeEach(() => { jest.clearAllMocks(); jest.spyOn(console, 'warn').mockImplementation(() => {}) })

    it('syncSubscriptionCharges sends the local date and returns the count', async () => {
        rpc.mockResolvedValue({ data: 3, error: null })
        await expect(syncSubscriptionCharges()).resolves.toBe(3)
        expect(rpc).toHaveBeenCalledWith('generate_subscription_transactions', { p_today: localToday() })
    })

    it('syncSubscriptionCharges returns 0 instead of failing when the database errors', async () => {
        rpc.mockResolvedValue({ data: null, error: { message: 'paused' } })
        await expect(syncSubscriptionCharges()).resolves.toBe(0)
    })

    it('fetchSubscriptions returns rows sorted by name', async () => {
        const order = jest.fn().mockResolvedValue({ data: [sub()], error: null })
        from.mockReturnValue({ select: () => ({ order }) })
        await expect(fetchSubscriptions()).resolves.toEqual([sub()])
        expect(from).toHaveBeenCalledWith('subscriptions')
        expect(order).toHaveBeenCalledWith('name')
    })

    it('fetchSubscriptions throws database errors so the screen can show them', async () => {
        from.mockReturnValue({ select: () => ({ order: jest.fn().mockResolvedValue({ data: null, error: new Error('nope') }) }) })
        await expect(fetchSubscriptions()).rejects.toThrow('nope')
    })
})
