// The standard shape every bank provider plug-in (Teller today; SimpleFIN or Plaid later) converts to.
// Nothing outside a provider file knows which provider is in use.

export interface BankAccount {
    providerAccountId: string
    name: string
    type: string              // 'depository' (checking, savings) or 'credit'
    subtype: string | null
    lastFour: string | null
    institutionName: string | null
}

export interface BankTransaction {
    externalId: string        // the provider's id, so the same transaction is never saved twice
    providerAccountId: string
    date: string              // YYYY-MM-DD
    amount: number            // positive = money in, negative = money out
    description: string
    pending: boolean
}

export interface BankProvider {
    name: string
    listAccounts(token: string): Promise<BankAccount[]>
    listTransactions(token: string, providerAccountId: string, since: string): Promise<BankTransaction[]>
    /** Remove our access to this bank login at the provider. */
    disconnect(token: string): Promise<void>
}

/**
 * needs_relink: the bank or person revoked access; they must link again.
 * temporary: the provider or bank is having trouble; try again later.
 */
export class ProviderError extends Error {
    constructor(public kind: 'needs_relink' | 'temporary' | 'other', message: string) {
        super(message)
        this.name = 'ProviderError'
    }
}
