import { findRecurringCharges, findPriceChanges, recurringKey } from '../logic/detect'
import type { Subscription } from '../logic/subscriptions'

const TODAY = '2026-10-21'
let n = 0
const tx = (date: string, name: string, amount: number, over: Record<string, any> = {}) =>
    ({ id: `t${++n}`, date, name, amount, type: 'expense', category_label: 'Subscriptions', original_name: null, subscription_id: null, ...over })
const monthly = (name: string, amount: number, dates: string[], over = {}) => dates.map(d => tx(d, name, amount, over))
const sub = (over: Partial<Subscription> = {}): Subscription => ({
    id: 's1', user_id: 'u', name: 'Netflix', amount: 15.49, type: 'expense', category_label: 'Subscriptions', note: null,
    frequency: 'monthly', start_date: '2026-01-10', end_date: null, status: 'active', generated_through: null, created_at: '', ...over,
})

describe('recurringKey', () => {
    it('groups the same place even when the bank adds a different code each time', () => {
        expect(recurringKey('SPOTIFY P1A2B3')).toBe(recurringKey('SPOTIFY P9Z8C7'))
        expect(recurringKey('Spotify')).toBe(recurringKey('SPOTIFY P1A2B3'))
        expect(recurringKey('NETFLIX.COM')).toBe(recurringKey('Netflix.com 866-579-7172 CA'))
        expect(recurringKey('Amazon Prime')).not.toBe(recurringKey('Amazon Mktp'))
    })
})

describe('findRecurringCharges', () => {
    it('spots a monthly charge and predicts the next one', () => {
        const list = monthly('SPOTIFY P1A2B3', 11.99, ['2026-07-07', '2026-08-07', '2026-09-07', '2026-10-07'])
        expect(findRecurringCharges(list, [], [], TODAY)).toEqual([{
            key: 'spotify', name: 'SPOTIFY P1A2B3', amount: 11.99, frequency: 'monthly', category: 'Subscriptions',
            lastDate: '2026-10-07', nextDate: '2026-11-07', count: 4,
        }])
    })

    it('always predicts a date after today, so adding it never repeats a charge the bank already has', () => {
        // Last seen Sep 18: Oct 18 has passed (already imported, or skipped), so the next one is Nov 18
        const list = monthly('Claude', 21.2, ['2026-07-18', '2026-08-18', '2026-09-18'])
        expect(findRecurringCharges(list, [], [], TODAY)).toMatchObject([{ nextDate: '2026-11-18' }])
        // A charge due today might already be in: the next one after it
        const due = monthly('Gym', 30, ['2026-08-21', '2026-09-21'].concat(['2026-07-21']).sort())
        expect(findRecurringCharges(due, [], [], TODAY)).toMatchObject([{ nextDate: '2026-11-21' }])
    })

    it('copes with charges landing a few days early or late (weekends, short months)', () => {
        const list = monthly('Gym', 30, ['2026-07-31', '2026-08-29', '2026-10-01'])
        expect(findRecurringCharges(list, [], [], TODAY)).toMatchObject([{ frequency: 'monthly', count: 3 }])
    })

    it('allows one missed charge (say, a month paid another way), but not two', () => {
        const once = monthly('Claude', 21.2, ['2026-06-12', '2026-07-13', '2026-09-18'])
        expect(findRecurringCharges(once, [], [], TODAY)).toMatchObject([{ frequency: 'monthly', count: 3, lastDate: '2026-09-18' }])
        const twice = monthly('Patchy', 9, ['2026-03-01', '2026-05-01', '2026-07-01', '2026-09-01'])
        expect(findRecurringCharges(twice, [], [], TODAY)).toEqual([])
    })

    it('needs three monthly charges, but two are enough for a yearly one', () => {
        expect(findRecurringCharges(monthly('Hulu', 7.99, ['2026-09-03', '2026-10-03']), [], [], TODAY)).toEqual([])
        expect(findRecurringCharges(monthly('Domain renewal', 12, ['2025-03-15', '2026-03-14']), [], [], TODAY))
            .toMatchObject([{ frequency: 'yearly', nextDate: '2027-03-14' }])
    })

    it('spots weekly and every-two-weeks charges', () => {
        const weekly = monthly('Meal kit', 60, ['2026-09-29', '2026-10-06', '2026-10-13', '2026-10-20'])
        const biweekly = monthly('Cleaner', 80, ['2026-09-09', '2026-09-23', '2026-10-07', '2026-10-21'])
        const found = findRecurringCharges([...weekly, ...biweekly], [], [], TODAY)
        expect(found.map(f => [f.name, f.frequency, f.nextDate])).toEqual([
            ['Meal kit', 'weekly', '2026-10-27'],
            ['Cleaner', 'biweekly', '2026-11-04'],
        ])
    })

    it('ignores places you visit often but not on a schedule, or with very different amounts', () => {
        const coffee = [tx('2026-09-02', 'Coffee Co', 4.5), tx('2026-09-05', 'Coffee Co', 5.25), tx('2026-09-19', 'Coffee Co', 4.5), tx('2026-10-14', 'Coffee Co', 6)]
        const groceries = monthly('Fresh Market', 0, []).concat([tx('2026-08-01', 'Fresh Market', 40), tx('2026-09-01', 'Fresh Market', 120), tx('2026-10-01', 'Fresh Market', 75)])
        expect(findRecurringCharges([...coffee, ...groceries], [], [], TODAY)).toEqual([])
    })

    it('still spots it after a small price rise, using the newest price', () => {
        const list = [...monthly('Netflix', 15.49, ['2026-07-10', '2026-08-10']), tx('2026-09-10', 'Netflix', 17.99), tx('2026-10-10', 'Netflix', 17.99)]
        expect(findRecurringCharges(list, [], [], TODAY)).toMatchObject([{ amount: 17.99 }])
    })

    it('leaves out ones that seem to have stopped', () => {
        const list = monthly('Old app', 4.99, ['2026-04-02', '2026-05-02', '2026-06-02'])
        expect(findRecurringCharges(list, [], [], TODAY)).toEqual([])
    })

    it('only looks at money going out, not income, transfers or savings', () => {
        const dates = ['2026-07-15', '2026-08-15', '2026-09-15', '2026-10-15']
        const list = [
            ...monthly('Paycheck', 2000, dates, { type: 'income' }),
            ...monthly('Card payment', 300, dates, { type: 'transfer' }),
            ...monthly('To savings', 100, dates, { type: 'savings' }),
        ]
        expect(findRecurringCharges(list, [], [], TODAY)).toEqual([])
    })

    it('skips charges you already have as a subscription, even under your own name for it', () => {
        const list = monthly('SPOTIFY P1A2B3', 11.99, ['2026-07-07', '2026-08-07', '2026-09-07', '2026-10-07'], { name: 'Music', original_name: 'SPOTIFY P1A2B3' })
        expect(findRecurringCharges(list, [sub({ name: 'Spotify' })], [], TODAY)).toEqual([])
        expect(findRecurringCharges(list, [sub({ name: 'Music' })], [], TODAY)).toEqual([])
        // ...and charges the app added for a subscription never count as a new one
        const added = monthly('Gym', 30, ['2026-08-01', '2026-09-01', '2026-10-01'], { subscription_id: 's9' })
        expect(findRecurringCharges(added, [], [], TODAY)).toEqual([])
    })

    it('recognizes your subscription when the bank words it differently', () => {
        const list = monthly('ANTHROPIC* CLAUDE SUB', 21.2, ['2026-08-18', '2026-09-18', '2026-10-18'])
        expect(findRecurringCharges(list, [sub({ name: 'Claude', amount: 21.2 })], [], TODAY)).toEqual([])
    })

    it('does not confuse two brands that share a word', () => {
        const list = monthly('Google Cloud Storage', 2.11, ['2026-08-13', '2026-09-13', '2026-10-13'])
        expect(findRecurringCharges(list, [sub({ name: 'Apple Cloud Storage', amount: 2.99 })], [], TODAY)).toMatchObject([{ name: 'Google Cloud Storage' }])
    })

    it('skips ones you said are not subscriptions', () => {
        const list = monthly('Spotify', 11.99, ['2026-08-07', '2026-09-07', '2026-10-07'])
        expect(findRecurringCharges(list, [], ['spotify'], TODAY)).toEqual([])
    })

    it('lists the soonest next charge first', () => {
        const mid = monthly('Mid-month', 5, ['2026-08-15', '2026-09-15', '2026-10-15'])      // next Nov 15
        const early = monthly('Early-month', 5, ['2026-08-01', '2026-09-01', '2026-10-01'])  // next Nov 1
        expect(findRecurringCharges([...mid, ...early], [], [], TODAY).map(s => s.name)).toEqual(['Early-month', 'Mid-month'])
    })
})

describe('findPriceChanges', () => {
    it('notices when a subscription now charges a different amount', () => {
        const list = [tx('2026-09-10', 'NETFLIX.COM', 15.49), tx('2026-10-10', 'NETFLIX.COM', 17.99)]
        expect(findPriceChanges([sub()], list, TODAY)).toEqual([{ subscription: sub(), amount: 17.99, date: '2026-10-10' }])
    })

    it('says nothing when the price is the same, or for paused and income ones', () => {
        expect(findPriceChanges([sub()], [tx('2026-10-10', 'Netflix', 15.49)], TODAY)).toEqual([])
        expect(findPriceChanges([sub({ status: 'paused' })], [tx('2026-10-10', 'Netflix', 17.99)], TODAY)).toEqual([])
        expect(findPriceChanges([sub({ type: 'income', name: 'Paycheck' })], [tx('2026-10-10', 'Paycheck', 900, { type: 'income' })], TODAY)).toEqual([])
    })

    it('matches the bank\'s wording too, but not other purchases at the same company', () => {
        expect(findPriceChanges([sub({ name: 'Claude', amount: 21.2 })], [tx('2026-10-18', 'ANTHROPIC* CLAUDE SUB', 25.44)], TODAY))
            .toMatchObject([{ amount: 25.44 }])
        expect(findPriceChanges([sub({ name: 'Amazon Prime', amount: 7.94 })], [tx('2026-10-18', 'AMAZON MKTP US', 34.99)], TODAY)).toEqual([])
    })

    it('only goes by recent charges from your bank, not the ones the app added', () => {
        expect(findPriceChanges([sub()], [tx('2026-05-10', 'Netflix', 17.99)], TODAY)).toEqual([])
        expect(findPriceChanges([sub()], [tx('2026-10-10', 'Netflix', 17.99, { subscription_id: 's1' })], TODAY)).toEqual([])
    })
})
