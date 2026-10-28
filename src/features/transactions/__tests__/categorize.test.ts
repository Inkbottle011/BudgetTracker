import { keywordCategory, buildCategoryGuesser, placeGroups } from '../../../shared/money/entry'
import { groupUncategorized, groupForSplit } from '../logic/categorize'

const mine = ['Food', 'Subscriptions', 'Transportation', 'Entertainment', 'Rent/Utilities', 'Misc']

describe('keywordCategory (common merchants, matched to your own categories)', () => {
    it.each([
        ['TACOS TEXAS', 'Food'],
        ["MAXIE'S PIZZA SUBS BAR", 'Food'],
        ['GIANT FOOD # 6573', 'Food'],
        ['ALDI 60161 PHILADELPHI', 'Food'],
        ['SEPTA T0RGCYKC9GAM', 'Transportation'],
        ['METROPOLIS PARKING', 'Transportation'],
        ['Spotify', 'Subscriptions'],
        ['ANTHROPIC* CLAUDE SUB', 'Subscriptions'],
        ['Fandango', 'Entertainment'],
        ['WL *STEAM PURCHASE', 'Entertainment'],
        ['PECO ENERGY COMP', 'Rent/Utilities'],
        ['ULTRA MOBILE', 'Rent/Utilities'],
        ['eBay ****-*****-*****', 'Misc'],
        ['THE FOOT LONG TRUCK', 'Food'],
        ["TST* HANGRY JOE'S -", 'Food'],
        ["Applebee's", 'Food'],
        ['MOBILE SUICA APPLE V', 'Transportation'],
        ['MCGRAW-HILL HIGHER ED', 'Misc'],
        ['AFTON PHARMACY', 'Misc'],
        ['CASH WITHDRAWAL 10000JL9 TOKYO JP', 'Misc'],
        ['INTERNATIONAL TRANSACTION FEE 10000JL9', 'Misc'],
    ])('%p -> %p', (name, expected) => expect(keywordCategory(name, mine)).toBe(expected))

    it('prefers a more specific category when you have one', () => {
        expect(keywordCategory('MCGRAW-HILL HIGHER ED', ['Education', 'Misc'])).toBe('Education')
        expect(keywordCategory('AFTON PHARMACY', ['Health', 'Misc'])).toBe('Health')
        expect(keywordCategory('CASH WITHDRAWAL TOKYO', ['Cash', 'Misc'])).toBe('Cash')
        expect(keywordCategory('FOREIGN TRANSACTION FEE', ['Fees', 'Misc'])).toBe('Fees')
    })

    it('uses your spelling of the category, and only categories you have', () => {
        expect(keywordCategory('Chipotle', ['Food'])).toBe('Food')
        expect(keywordCategory('Chipotle', ['dining out', 'food'])).toBe('dining out')   // the more specific one
        expect(keywordCategory('Chipotle', ['Dining', 'Groceries'])).toBe('Dining')
        expect(keywordCategory('Chipotle', ['Rent'])).toBeNull()
    })

    it('rent: paying a landlord is rent, a "Rent" savings vault is not', () => {
        expect(keywordCategory('Zelle® Payment to Yan Landlord', mine)).toBe('Rent/Utilities')
        expect(keywordCategory('To Rent Willington Vault', mine)).toBeNull()
    })

    it('leaves unknown places alone', () => {
        expect(keywordCategory('FABI KIOSK --720463', mine)).toBeNull()
        expect(keywordCategory('', mine)).toBeNull()
    })

    it('does not mistake "Uber Eats" for a ride or "Gas" inside other words', () => {
        expect(keywordCategory('UBER EATS', mine)).toBe('Food')
        expect(keywordCategory('UBER TRIP', mine)).toBe('Transportation')
        expect(keywordCategory('VEGAS SHOW', mine)).toBeNull()
    })
})

describe('buildCategoryGuesser with common merchants', () => {
    it('falls back to them for places you have never categorized, using categories you use', () => {
        const guess = buildCategoryGuesser([{ name: 'Wawa', category_label: 'Food', type: 'expense' }, { name: 'SEPTA', category_label: 'Transportation', type: 'expense' }])
        expect(guess('TACOS TEXAS')).toEqual({ type: 'expense', category: 'Food' })
        expect(guess('LYFT RIDE')).toEqual({ type: 'expense', category: 'Transportation' })
        // No Subscriptions category in your history, so no guess
        expect(guess('Spotify')).toBeNull()
    })

    it('what you chose yourself wins over the common list', () => {
        const guess = buildCategoryGuesser([{ name: 'TACOS TEXAS', category_label: 'Entertainment', type: 'expense' }, { name: 'Wawa', category_label: 'Food', type: 'expense' }])
        expect(guess('TACOS TEXAS')).toEqual({ type: 'expense', category: 'Entertainment' })
    })
})

describe('groupUncategorized', () => {
    const tx = (id: string, name: string, amount: number, type = 'expense', category_label = '') =>
        ({ id, name, amount, type, category_label, date: '2026-09-01' })

    it('groups transactions with no category by place, biggest total first, with a suggestion', () => {
        const groups = groupUncategorized([
            tx('1', 'TACOS TEXAS', 12.31), tx('2', 'TACOS TEXAS', 14.55), tx('3', 'FABI KIOSK --720463', 408.99),
            tx('4', 'Wawa', 8.63, 'expense', 'Food'),             // already categorized
            tx('5', 'To Car Vault', 100, 'transfer'),             // transfers have no category
            tx('6', 'FENNER INC', 1252.96, 'income'),
        ], { expense: mine, income: ['Salary'] }, buildCategoryGuesser([{ name: 'Wawa', category_label: 'Food', type: 'expense' }]))
        expect(groups.map(g => [g.name, g.type, g.ids, g.total, g.suggestion])).toEqual([
            ['FENNER INC', 'income', ['6'], 1252.96, null],
            ['FABI KIOSK --720463', 'expense', ['3'], 408.99, null],
            ['TACOS TEXAS', 'expense', ['1', '2'], 26.86, 'Food'],
        ])
    })

    it('treats different store numbers as the same place', () => {
        const groups = groupUncategorized([tx('1', 'FABI KIOSK --720463', 408.99), tx('2', 'FABI KIOSK --720462', 208.99)], { expense: mine }, buildCategoryGuesser([]))
        expect(groups).toHaveLength(1)
        expect(groups[0].ids).toEqual(['1', '2'])
    })

    it('suggests from your categories for that type: refunds use spending categories', () => {
        const groups = groupUncategorized([tx('1', 'Fandango', 43.38, 'reimbursement')], { expense: mine }, buildCategoryGuesser([]))
        expect(groups[0].suggestion).toBe('Entertainment')
    })
})

describe('groceries vs eating out', () => {
    const split = ['Groceries', 'Eating out']
    it.each([
        ['GIANT FOOD # 6573', 'Groceries'], ['Giant', 'Groceries'], ['ALDI 60161 PHILADELPHI', 'Groceries'], ['Weis Markets', 'Groceries'],
        ['WHOLE FOODS MKT', 'Groceries'], ["TRADER JOE'S #544", 'Groceries'], ['WEGMANS #93', 'Groceries'], ['ACME 7821', 'Groceries'],
        ['Taco Bell', 'Eating out'], ['Chipotle', 'Eating out'], ['UBER EATS', 'Eating out'], ['TST*ROSA ROSA PIZZERIA', 'Eating out'],
        ['WAWA# 8491', 'Eating out'], ['Conestoga Restaurant', 'Eating out'], ['Mexican Food Truck', 'Eating out'], ['Burger King', 'Eating out'],
    ])('%p -> %p', (name, expected) => expect(keywordCategory(name, split)).toBe(expected))

    it('still uses one Food category when that is all you have', () => {
        expect(keywordCategory('Giant', ['Food'])).toBe('Food')
        expect(keywordCategory('Taco Bell', ['Food'])).toBe('Food')
        expect(keywordCategory('Giant', ['Dining', 'Groceries'])).toBe('Groceries')
        expect(keywordCategory('Giant', ['Dining'])).toBe('Dining')
    })
})

describe('groupForSplit (sorting one category into two, a place at a time)', () => {
    const t = (id: string, name: string, amount: number, category_label = 'Food', type = 'expense', original_name?: string) => ({ id, name, amount, category_label, type, original_name })
    const list = [
        t('1', 'Giant', 80), t('2', 'GIANT 6065', 40, 'Food', 'expense'), t('3', 'Taco Bell', 9), t('4', 'Taco Bell', 11),
        t('5', 'Owl Breakfast', 15), t('6', 'Spotify', 11, 'Subscriptions'), t('7', 'Giant', 5, 'food', 'reimbursement'),
        t('8', 'My Corner Store', 6, 'Food', 'expense', 'CORNER MKT 22'),
    ]

    it('groups the category\'s purchases (and paybacks) by place, biggest first, with a guess for each', () => {
        const groups = groupForSplit(list, 'Food', ['Groceries', 'Eating out'])
        expect(groups.map(g => [g.name, g.ids, g.total, g.suggestion])).toEqual([
            ['Giant', ['1', '2', '7'], 125, 'Groceries'],
            ['Taco Bell', ['3', '4'], 20, 'Eating out'],
            ['Owl Breakfast', ['5'], 15, null],
            ['My Corner Store', ['8'], 6, null],
        ])
    })

    it('what is spent at each place counts paybacks off', () => {
        const groups = groupForSplit(list, 'Food', ['Groceries', 'Eating out'])
        expect(groups[0].spent).toBe(115)   // 80 + 40 - 5
    })
})

describe('the same place spelled differently is grouped together', () => {
    it('placeGroups: a name that starts another is the same place, unless they are different kinds of thing', () => {
        const g = placeGroups(['giant', 'giant food', 'weis markets', 'weis', 'aldi philadelphi', 'aldi', 'whole foods', 'whole earth', 'amazon', 'amazon prime', 'taco bell'])
        expect(g.get('giant food')).toBe('giant')
        expect(g.get('weis markets')).toBe('weis')
        expect(g.get('aldi philadelphi')).toBe('aldi')
        expect(g.get('whole earth')).toBe('whole earth')
        expect(g.get('whole foods')).toBe('whole foods')
        expect(g.get('amazon prime')).toBe('amazon prime')   // a subscription, not shopping
        expect(g.get('taco bell')).toBe('taco bell')
    })

    it('when splitting a category, Giant and GIANT FOOD # 6573 are one place', () => {
        const t = (id: string, name: string, amount: number) => ({ id, name, amount, type: 'expense', category_label: 'Food' })
        const groups = groupForSplit([t('1', 'Giant', 10), t('2', 'Giant', 10), t('3', 'GIANT FOOD # 6573', 50), t('4', 'Weis Markets', 5), t('5', 'Weis', 5)], 'Food', ['Groceries', 'Eating out'])
        expect(groups.map(g => [g.name, g.ids])).toEqual([['Giant', ['1', '2', '3']], ['Weis Markets', ['4', '5']]])
    })

    it('when giving uncategorized transactions a category too', () => {
        const t = (id: string, name: string) => ({ id, name, amount: 5, type: 'expense', category_label: '' })
        const groups = groupUncategorized([t('1', 'ALDI 60161 PHILADELPHI'), t('2', 'Aldi'), t('3', 'Aldi')], { expense: ['Groceries'] }, () => null)
        expect(groups.map(g => [g.name, g.count])).toEqual([['Aldi', 3]])
    })
})
