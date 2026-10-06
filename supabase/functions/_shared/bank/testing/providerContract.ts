// What every bank provider plug-in must do. Run it against each provider (with a fake bank behind it),
// so a future provider (SimpleFIN, Plaid, ...) is proven to behave exactly like Teller before switching.
import type { BankProvider } from '../types.ts'
import { ProviderError } from '../types.ts'

/**
 * A fake bank, described in provider-neutral terms. Each provider's test turns this into
 * that provider's own API responses.
 */
export const FAKE_BANK = {
    goodToken: 'token_good',
    revokedToken: 'token_revoked',
    accounts: [
        // balance: money in the account (checking) or owed on it (card); available: spendable / credit left
        { id: 'acc_checking', name: 'Everyday Checking', type: 'depository', subtype: 'checking', lastFour: '1234', institution: 'Chase', balance: 1500.25, available: 1400 },
        { id: 'acc_card', name: 'Sapphire', type: 'credit', subtype: 'credit_card', lastFour: '9876', institution: 'Chase', balance: 812.4, available: 4187.6 },
    ],
    // amount: positive = money in, negative = money out (from the account holder's point of view)
    transactions: [
        ...Array.from({ length: 30 }, (_, i) => ({
            id: `txn_${i}`, accountId: 'acc_checking', date: `2026-09-${String(30 - i).padStart(2, '0')}`,
            amount: -(i + 1), description: `Coffee ${i}`, pending: false,
        })),
        { id: 'txn_pay', accountId: 'acc_checking', date: '2026-10-01', amount: 2000, description: 'ACME PAYROLL', pending: false },
        { id: 'txn_pending', accountId: 'acc_checking', date: '2026-10-02', amount: -12.5, description: 'Pending lunch', pending: true },
        { id: 'txn_card', accountId: 'acc_card', date: '2026-10-01', amount: -45.99, description: 'Amazon', pending: false },
    ],
}

export function providerContract(name: string, make: () => BankProvider) {
    describe(`${name} provider (shared contract)`, () => {
        it('lists accounts in the standard shape', async () => {
            const accounts = await make().listAccounts(FAKE_BANK.goodToken)
            expect(accounts).toEqual([
                { providerAccountId: 'acc_checking', name: 'Everyday Checking', type: 'depository', subtype: 'checking', lastFour: '1234', institutionName: 'Chase' },
                { providerAccountId: 'acc_card', name: 'Sapphire', type: 'credit', subtype: 'credit_card', lastFour: '9876', institutionName: 'Chase' },
            ])
        })

        it('lists an account\'s transactions since a date, money out as negative', async () => {
            const txs = await make().listTransactions(FAKE_BANK.goodToken, 'acc_checking', '2026-09-28')
            const byId = Object.fromEntries(txs.map(t => [t.externalId, t]))
            expect(byId.txn_pay).toEqual({ externalId: 'txn_pay', providerAccountId: 'acc_checking', date: '2026-10-01', amount: 2000, description: 'ACME PAYROLL', pending: false })
            expect(byId.txn_0).toMatchObject({ amount: -1, date: '2026-09-30' })
            expect(byId.txn_pending).toMatchObject({ pending: true })
            expect(txs.every(t => t.date >= '2026-09-28')).toBe(true)
            expect(byId.txn_card).toBeUndefined()
        })

        it('returns every transaction even when the bank sends them in pages', async () => {
            const txs = await make().listTransactions(FAKE_BANK.goodToken, 'acc_checking', '2026-01-01')
            expect(txs).toHaveLength(32)
            expect(new Set(txs.map(t => t.externalId)).size).toBe(32)
        })

        it('says the bank needs relinking when access was revoked', async () => {
            const err = await make().listAccounts(FAKE_BANK.revokedToken).catch(e => e)
            expect(err).toBeInstanceOf(ProviderError)
            expect(err.kind).toBe('needs_relink')
        })

        it('reports balances: what\'s in checking, and what\'s owed on a card as a positive number', async () => {
            const p = make()
            expect(await p.getBalance!(FAKE_BANK.goodToken, 'acc_checking', 'depository')).toEqual({ current: 1500.25, available: 1400 })
            expect(await p.getBalance!(FAKE_BANK.goodToken, 'acc_card', 'credit')).toEqual({ current: 812.4, available: 4187.6 })
        })

        it('disconnects, and treats an already-removed connection as done', async () => {
            await expect(make().disconnect(FAKE_BANK.goodToken)).resolves.toBeUndefined()
            await expect(make().disconnect(FAKE_BANK.revokedToken)).resolves.toBeUndefined()
        })
    })
}
