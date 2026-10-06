import { keywordCategory, buildCategoryGuesser } from '../entry'
import { groupUncategorized } from '../categorize'

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
        expect(keywordCategory('Chipotle', ['dining out', 'food'])).toBe('food')
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
