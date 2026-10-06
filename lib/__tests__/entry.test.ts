import {
    parseAmount, parseDate, detectDateOrder, todayString, merchantKey, buildCategoryGuesser, duplicateKey,
} from '../entry'

describe('parseAmount', () => {
    it.each([
        ['12', 12],
        ['12.50', 12.5],
        ['$1,234.50', 1234.5],
        ['1,234', 1234],
        ['-12.00', -12],
        ['-$5', -5],
        ['$-5', -5],
        ['(12.00)', -12],
        ['($1,000.00)', -1000],
        ['12.00-', -12],
        ['USD -7.5', -7.5],
        ['£23.40', 23.4],
        ['  42 ', 42],
        ['1.234,56', 1234.56],
        ['12,50', 12.5],
    ])('reads %p as %p', (input, expected) => {
        expect(parseAmount(input)).toBe(expected)
    })

    it.each([[''], ['   '], ['abc'], ['1.2.3'], [null], [undefined], [{}]])('returns null for %p', input => {
        expect(parseAmount(input as any)).toBeNull()
    })

    it('passes numbers through', () => {
        expect(parseAmount(3.25)).toBe(3.25)
        expect(parseAmount(NaN)).toBeNull()
        expect(parseAmount(Infinity)).toBeNull()
    })
})

describe('parseDate', () => {
    it.each([
        ['2026-10-05', '2026-10-05'],
        ['2026/10/05', '2026-10-05'],
        ['2026-10-05T23:30:00Z', '2026-10-05'],
        ['20261005', '2026-10-05'],
        ['10/05/2026', '2026-10-05'],
        ['10/5/2026', '2026-10-05'],
        ['10/5/26', '2026-10-05'],
        ['10-05-2026', '2026-10-05'],
        ['10/05/2026 14:32', '2026-10-05'],
        ['Oct 5, 2026', '2026-10-05'],
        ['October 5 2026', '2026-10-05'],
        ['Sept 3, 2026', '2026-09-03'],
        ['5 Oct 2026', '2026-10-05'],
        ['05-Oct-2026', '2026-10-05'],
        ['05-Oct-26', '2026-10-05'],
        ['2/29/2024', '2024-02-29'],
    ])('reads %p (US order) as %p', (input, expected) => {
        expect(parseDate(input)).toBe(expected)
    })

    it('reads day-first dates when told the column is day-first', () => {
        expect(parseDate('25/12/2026', 'DMY')).toBe('2026-12-25')
        expect(parseDate('05.10.2026', 'DMY')).toBe('2026-10-05')
        expect(parseDate('03/04/2026', 'DMY')).toBe('2026-04-03')
        expect(parseDate('03/04/2026', 'MDY')).toBe('2026-03-04')
    })

    it('uses this year when the year is missing', () => {
        const y = new Date().getFullYear()
        expect(parseDate('10/5')).toBe(`${y}-10-05`)
    })

    it.each([
        ['2/30/2026'], ['2/29/2026'], ['13/40/2026'], ['2026-13-01'], ['Foo 5, 2026'],
        ['not a date'], [''], [null], [undefined], ['1850-01-01'],
    ])('returns null for %p', input => {
        expect(parseDate(input as any)).toBeNull()
    })

    it('accepts Date objects using their local date', () => {
        expect(parseDate(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05')
        expect(parseDate(new Date('invalid'))).toBeNull()
    })
})

describe('detectDateOrder', () => {
    it('assumes US month-first when it could be either', () => {
        expect(detectDateOrder(['03/04/2026', '10/05/2026'])).toBe('MDY')
    })
    it('detects day-first when a first number is over 12', () => {
        expect(detectDateOrder(['03/04/2026', '25/12/2026'])).toBe('DMY')
    })
    it('stays month-first when a second number is over 12', () => {
        expect(detectDateOrder(['12/25/2026', '03/04/2026'])).toBe('MDY')
    })
    it('ignores ISO dates and blanks', () => {
        expect(detectDateOrder(['2026-10-05', '', null])).toBe('MDY')
    })
})

describe('todayString', () => {
    afterEach(() => jest.useRealTimers())

    it('uses the local date, not UTC', () => {
        jest.useFakeTimers()
        // 10pm on Oct 5 local time; in UTC (east of the US) this can already be Oct 6
        jest.setSystemTime(new Date(2026, 9, 5, 22, 0))
        expect(todayString()).toBe('2026-10-05')
        expect(todayString(-1)).toBe('2026-10-04')
        expect(todayString(1)).toBe('2026-10-06')
    })

    it('crosses month and year boundaries', () => {
        jest.useFakeTimers()
        jest.setSystemTime(new Date(2026, 0, 1, 9, 0))
        expect(todayString(-1)).toBe('2025-12-31')
    })
})

describe('merchantKey', () => {
    it.each([
        ['SQ *BLUE BOTTLE #1234 OAKLAND CA  10/01', 'blue bottle oakland'],
        ['Blue Bottle Coffee', 'blue bottle coffee'],
        ['TST* JOES PIZZA 00123', 'joes pizza'],
        ['POS DEBIT CARD PURCHASE WHOLE FOODS 10234', 'whole foods'],
        ['NETFLIX.COM', 'netflix com'],
        ['', ''],
    ])('%p -> %p', (input, expected) => {
        expect(merchantKey(input)).toBe(expected)
    })

    it('keeps at most three words', () => {
        expect(merchantKey('The Very Long Merchant Name Here')).toBe('the very long')
    })
})

describe('buildCategoryGuesser', () => {
    const guess = buildCategoryGuesser([
        { name: 'Blue Bottle', category_label: 'Food', type: 'expense' },
        { name: 'SQ *BLUE BOTTLE #22', category_label: 'Food', type: 'expense' },
        { name: 'Blue Bottle', category_label: 'Coffee', type: 'expense' },
        { name: 'Amazon', category_label: 'Shopping', type: 'expense' },
        { name: 'Paycheck', category_label: 'Salary', type: 'income' },
        { name: 'No category', category_label: '', type: 'expense' },
        { name: null, note: 'Rent payment', category_label: 'Rent', type: 'expense' },
    ])

    it('picks the most-used category for a merchant', () => {
        expect(guess('BLUE BOTTLE')).toEqual({ type: 'expense', category: 'Food' })
    })
    it('matches messy bank descriptions', () => {
        expect(guess('SQ *BLUE BOTTLE #999')).toEqual({ type: 'expense', category: 'Food' })
    })
    it('matches when the new name starts with a known merchant', () => {
        expect(guess('Amazon Mktpl')).toEqual({ type: 'expense', category: 'Shopping' })
    })
    it('learns from notes when there is no name', () => {
        expect(guess('Rent payment')).toEqual({ type: 'expense', category: 'Rent' })
    })
    it('matches the same merchant when the words after the name differ', () => {
        const g = buildCategoryGuesser([{ name: 'Blue Bottle Coffee', category_label: 'Food', type: 'expense' }])
        expect(g('SQ *BLUE BOTTLE #1234 OAKLAND CA')).toEqual({ type: 'expense', category: 'Food' })
    })

    it('does not match merchants that only share their first word', () => {
        const g = buildCategoryGuesser([{ name: 'Whole Earth Bakery', category_label: 'Treats', type: 'expense' }])
        expect(g('WHOLE FOODS MARKET')).toBeNull()
    })

    it('prefers the past merchant that shares the most words', () => {
        const g = buildCategoryGuesser([
            { name: 'Shell', category_label: 'Gas', type: 'expense' },
            { name: 'Shell Beach Cafe', category_label: 'Food', type: 'expense' },
        ])
        expect(g('SHELL BEACH CAFE #12')).toEqual({ type: 'expense', category: 'Food' })
        expect(g('SHELL OIL 5741')).toEqual({ type: 'expense', category: 'Gas' })
    })

    it('returns null for unknown merchants and blanks', () => {
        expect(guess('Unknown Place')).toBeNull()
        expect(guess('')).toBeNull()
        expect(guess('No category')).toBeNull()
    })
})

describe('duplicateKey', () => {
    const base = { date: '2026-10-05', amount: 12.5, name: 'Coffee Shop' }

    it('matches the same date, amount and description', () => {
        expect(duplicateKey(base)).toBe(duplicateKey({ ...base, name: '  coffee   SHOP ' }))
    })
    it('ignores sign and type', () => {
        expect(duplicateKey(base)).toBe(duplicateKey({ ...base, amount: -12.5, type: 'savings' } as any))
    })
    it('uses the note when there is no name', () => {
        expect(duplicateKey({ date: '2026-10-05', amount: 1, name: '', note: 'X' }))
            .toBe(duplicateKey({ date: '2026-10-05', amount: 1, name: 'x' }))
    })
    it('treats a timestamp date as the same day', () => {
        expect(duplicateKey({ ...base, date: '2026-10-05T00:00:00' })).toBe(duplicateKey(base))
    })
    it('differs when anything meaningful differs', () => {
        expect(duplicateKey(base)).not.toBe(duplicateKey({ ...base, date: '2026-10-06' }))
        expect(duplicateKey(base)).not.toBe(duplicateKey({ ...base, amount: 12.51 }))
        expect(duplicateKey(base)).not.toBe(duplicateKey({ ...base, name: 'Other' }))
    })
})
