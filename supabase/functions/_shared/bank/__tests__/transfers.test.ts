/** @jest-environment node */
import { findTransfers, type TransferCandidate } from '../transfers.ts'

const c = (key: string, accountId: string, date: string, amount: number, moneyIn: boolean, description = '', accountType = 'depository'): TransferCandidate =>
    ({ key, accountId, accountType, date, amount, moneyIn, description })

describe('findTransfers (money moving between your own linked accounts)', () => {
    it('pairs money leaving one account with the same amount arriving in another', () => {
        const found = findTransfers([
            c('out', 'savings', '2026-10-05', 500, false, 'To Checking - 0026'),
            c('in', 'checking', '2026-10-05', 500, true, 'From Savings - 5213'),
        ])
        expect([...found].sort()).toEqual(['in', 'out'])
    })

    it('pairs transfers between banks that take a few days to arrive', () => {
        const found = findTransfers([
            c('sofi', 'sofi-checking', '2026-08-01', 625, false, 'SoFi Bank TRANSFER SD1300'),
            c('sant', 'santander', '2026-08-03', 625, true, 'SANTANDER'),
        ])
        expect(found.size).toBe(2)
    })

    it('pairs paying a card from checking with the payment arriving on the card', () => {
        const found = findTransfers([
            c('chk', 'checking', '2026-10-05', 353.35, false, 'CAPITAL ONE'),
            c('card', 'cap1', '2026-10-05', 353.35, true, 'CAPITAL ONE MOBILE PYMT', 'credit'),
        ])
        expect(found.size).toBe(2)
    })

    it('leaves alone: the same account, more than 3 days apart, or a different amount', () => {
        expect(findTransfers([c('a', 'checking', '2026-10-01', 50, false), c('b', 'checking', '2026-10-01', 50, true)]).size).toBe(0)
        expect(findTransfers([c('a', 'savings', '2026-10-01', 50, false), c('b', 'checking', '2026-10-05', 50, true)]).size).toBe(0)
        expect(findTransfers([c('a', 'savings', '2026-10-01', 50, false), c('b', 'checking', '2026-10-01', 50.01, true)]).size).toBe(0)
    })

    it('never treats a card purchase as a transfer', () => {
        expect(findTransfers([
            c('bet', 'card', '2026-09-15', 20, false, 'DRAFT KINGS', 'credit'),
            c('zelle', 'checking', '2026-09-15', 20, true, 'Deposit'),
        ]).size).toBe(0)
    })

    it('never treats a Zelle, Venmo, Cash App or PayPal payment as a transfer (those are usually other people)', () => {
        expect(findTransfers([
            c('a', 'savings', '2026-08-16', 20, false, 'To Car Vault'),
            c('b', 'checking', '2026-08-16', 20, true, 'Zelle® Payment from Aidan Ross'),
        ]).size).toBe(0)
        expect(findTransfers([
            c('a', 'checking', '2026-08-16', 20, false, 'VENMO PAYMENT 1023'),
            c('b', 'savings', '2026-08-16', 20, true, 'Interest'),
        ]).size).toBe(0)
    })

    it('pairs each transaction once: rent moved to checking, then paid by Zelle, keeps the Zelle as spending', () => {
        const found = findTransfers([
            c('vault', 'rent-vault', '2026-10-01', 700, false, 'To checking balance'),
            c('chk-in', 'checking', '2026-10-01', 700, true, 'From Rent Willington Vault'),
            c('rent', 'checking', '2026-10-01', 700, false, 'Zelle® Payment to Yan Landlord'),
        ])
        expect([...found].sort()).toEqual(['chk-in', 'vault'])
    })

    it('pairs several same-amount moves into different vaults one for one', () => {
        const found = findTransfers([
            c('s1', 'savings', '2026-08-01', 100, false, 'To Car Vault'),
            c('s2', 'savings', '2026-08-01', 100, false, 'To MotorBike Vault'),
            c('s3', 'savings', '2026-08-01', 100, false, 'To PC Fund Vault'),
            c('v1', 'car', '2026-08-01', 100, true, 'From savings balance'),
            c('v2', 'bike', '2026-08-01', 100, true, 'From savings balance'),
            c('v3', 'pc', '2026-08-01', 100, true, 'From savings balance'),
        ])
        expect(found.size).toBe(6)
    })

    it('prefers the closest date', () => {
        const found = findTransfers([
            c('out', 'savings', '2026-10-03', 80, false),
            c('far', 'checking', '2026-10-01', 80, true),
            c('near', 'checking', '2026-10-03', 80, true),
        ])
        expect([...found].sort()).toEqual(['near', 'out'])
    })
})
