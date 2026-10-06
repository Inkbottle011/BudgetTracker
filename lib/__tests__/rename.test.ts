import { renameFor, duplicateKey, buildCategoryGuesser, merchantKey } from '../entry'
import { groupUncategorized } from '../categorize'

describe('renameFor (your names for places)', () => {
    const renames = new Map([[merchantKey('TACOS TEXAS'), 'Tacos Texas'], [merchantKey('Zelle® Payment to Yan Landlord'), 'Rent']])

    it('gives your name for a place, keeping the original', () => {
        expect(renameFor('TACOS TEXAS', renames)).toEqual({ name: 'Tacos Texas', original_name: 'TACOS TEXAS' })
        expect(renameFor('Zelle® Payment to Yan Landlord', renames)).toEqual({ name: 'Rent', original_name: 'Zelle® Payment to Yan Landlord' })
    })

    it('leaves places you have not renamed alone', () => {
        expect(renameFor('Wawa', renames)).toEqual({ name: 'Wawa' })
        expect(renameFor('', renames)).toEqual({ name: '' })
    })
})

describe('renamed transactions still match by the bank\'s wording', () => {
    it('duplicate checks use the original name', () => {
        const renamed = { date: '2026-10-01', amount: 12.31, name: 'Tacos Texas', original_name: 'TACOS TEXAS' }
        expect(duplicateKey(renamed)).toBe(duplicateKey({ date: '2026-10-01', amount: 12.31, name: 'TACOS TEXAS' }))
    })

    it('category learning knows both names', () => {
        const guess = buildCategoryGuesser([{ name: 'Rent', original_name: 'Zelle® Payment to Yan Landlord', category_label: 'Housing', type: 'expense' }])
        expect(guess('Zelle® Payment to Yan Landlord')).toEqual({ type: 'expense', category: 'Housing' })
        expect(guess('Rent')).toEqual({ type: 'expense', category: 'Housing' })
    })

    it('uncategorized groups put renamed and not-yet-renamed together, shown by your name', () => {
        const groups = groupUncategorized([
            { id: '1', name: 'Tacos Texas', original_name: 'TACOS TEXAS', amount: 12, type: 'expense', category_label: '' },
            { id: '2', name: 'TACOS TEXAS', amount: 14, type: 'expense', category_label: '' },
            { id: '3', name: 'Tacos Texas', original_name: 'TACOS TEXAS', amount: 10, type: 'expense', category_label: '' },
        ], { expense: [] }, () => null)
        expect(groups).toHaveLength(1)
        expect(groups[0]).toMatchObject({ name: 'Tacos Texas', ids: ['1', '2', '3'] })
    })
})
