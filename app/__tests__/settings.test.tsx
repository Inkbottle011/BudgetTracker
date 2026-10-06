import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import SettingsScreen from '../settings'
import { ToastContext } from '../../context/ToastContext'
import { fake, auth, functions, supabase } from '../../test/fakeSupabase'
import { openBankConnect, bankLinkingAvailable } from '../../lib/bankConnect'

jest.mock('../../lib/supabase', () => require('../../test/fakeSupabase').module)
jest.mock('../../lib/bankConnect', () => ({
    bankLinkingAvailable: jest.fn(() => true),
    openBankConnect: jest.fn(),
}))
// Like the real one: runs when the screen is shown and again whenever the callback changes
jest.mock('@react-navigation/native', () => ({
    useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]),
}))

const showToast = jest.fn()
const mfa = auth.mfa as unknown as Record<string, jest.Mock>
const invoke = functions.invoke as jest.Mock

const VERIFIED = { id: 'factor-1', factor_type: 'totp', status: 'verified', friendly_name: 'Authenticator' }

function twoFactor(on: boolean) {
    mfa.listFactors.mockResolvedValue({ data: { all: on ? [VERIFIED] : [], totp: on ? [VERIFIED] : [] }, error: null })
}

async function renderSettings() {
    await render(<ToastContext.Provider value={{ showToast }}><SettingsScreen /></ToastContext.Provider>)
    await screen.findByText('Two-factor sign-in')
}

beforeEach(() => {
    fake.reset()
    showToast.mockClear()
    invoke.mockReset()
    invoke.mockResolvedValue({ data: {}, error: null })
    ;(openBankConnect as jest.Mock).mockReset()
    ;(bankLinkingAvailable as jest.Mock).mockReturnValue(true)
    twoFactor(false)
    fake.table('bank_connections', { data: [] })
    fake.table('bank_accounts', { data: [] })
    fake.table('transactions', { data: [{ date: '2026-10-03' }] })
    fake.table('bank_possible_duplicates', { data: [] })
    ;(supabase.rpc as jest.Mock).mockClear()
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] })
    jest.setSystemTime(new Date('2026-10-06T12:00:00Z'))
})
afterEach(() => jest.useRealTimers())

describe('two-factor sign-in', () => {
    it('sets up an authenticator app: QR code, key to type, then a code to confirm', async () => {
        await renderSettings()
        expect(screen.getByText('Off')).toBeTruthy()
        await fireEvent.press(screen.getByText('Set up two-factor sign-in'))
        expect(mfa.enroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'Authenticator' })
        expect(screen.getByLabelText('QR code for your authenticator app')).toBeTruthy()
        expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeTruthy()

        twoFactor(true)
        await fireEvent.changeText(screen.getByPlaceholderText('123456'), '123 456')
        await fireEvent.press(screen.getByText('Confirm'))
        expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'factor-1', code: '123456' })
        expect(await screen.findByText('On')).toBeTruthy()
        expect(showToast).toHaveBeenCalledWith('Two-factor sign-in is on')
    })

    it('clears out a half-finished setup before starting again', async () => {
        mfa.listFactors.mockResolvedValue({ data: { all: [{ id: 'old', status: 'unverified', factor_type: 'totp' }], totp: [] }, error: null })
        await renderSettings()
        await fireEvent.press(screen.getByText('Set up two-factor sign-in'))
        expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'old' })
    })

    it('explains a wrong code', async () => {
        await renderSettings()
        await fireEvent.press(screen.getByText('Set up two-factor sign-in'))
        mfa.challengeAndVerify.mockResolvedValueOnce({ data: null, error: { message: 'Invalid TOTP code entered' } })
        await fireEvent.changeText(screen.getByPlaceholderText('123456'), '000000')
        await fireEvent.press(screen.getByText('Confirm'))
        expect(await screen.findByText("That code didn't work. Check the time on your phone and try the newest code.")).toBeTruthy()
    })

    it('needs all six digits', async () => {
        await renderSettings()
        await fireEvent.press(screen.getByText('Set up two-factor sign-in'))
        await fireEvent.changeText(screen.getByPlaceholderText('123456'), '12')
        await fireEvent.press(screen.getByText('Confirm'))
        expect(screen.getByText('Enter the 6-digit code from your authenticator app.')).toBeTruthy()
        expect(mfa.challengeAndVerify).not.toHaveBeenCalled()
    })

    it('turns off after confirming', async () => {
        twoFactor(true)
        await renderSettings()
        await fireEvent.press(await screen.findByText('Turn off'))
        expect(screen.getByText(/Linked banks will stop syncing/)).toBeTruthy()
        twoFactor(false)
        await fireEvent.press(screen.getByText('Yes, turn off'))
        expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'factor-1' })
        expect(await screen.findByText('Off')).toBeTruthy()
    })
})

describe('linked banks', () => {
    const connection = {
        id: 'conn-1', institution_name: 'Chase', status: 'active', last_error: null, provider: 'teller',
        last_synced_at: '2026-10-06T09:00:00Z', sync_from: '2026-09-01',
    }

    it('asks for two-factor sign-in before linking a bank', async () => {
        await renderSettings()
        expect(screen.getByText('Turn on two-factor sign-in above to link a bank.')).toBeTruthy()
        expect(screen.queryByText('+ Link a bank')).toBeNull()
    })

    it('lists linked banks with their accounts and status', async () => {
        twoFactor(true)
        fake.table('bank_connections', { data: [connection] })
        fake.table('bank_accounts', { data: [
            { id: 'a1', connection_id: 'conn-1', name: 'Total Checking', last_four: '1234', type: 'depository', balance_current: 1500.25 },
            { id: 'a2', connection_id: 'conn-1', name: 'Sapphire', last_four: '9876', type: 'credit', balance_current: 812.4 },
        ] })
        await renderSettings()
        expect(await screen.findByText('Chase')).toBeTruthy()
        expect(screen.getByText('Total Checking ••1234 · $1,500.25')).toBeTruthy()
        expect(screen.getByText('Sapphire ••9876 · $812.40 owed')).toBeTruthy()
        expect(screen.getByText('Synced 3 hours ago')).toBeTruthy()
    })

    it('links a bank: pick a start date, sign in with Plaid, then the server stores and syncs it', async () => {
        twoFactor(true)
        ;(openBankConnect as jest.Mock).mockResolvedValue({ publicToken: 'public-abc', institutionName: 'Chase' })
        invoke.mockResolvedValueOnce({ data: { connectionId: 'conn-1', added: 12, status: 'active' }, error: null })
        await renderSettings()
        await fireEvent.press(await screen.findByText('+ Link a bank'))
        // Suggests the day after your latest transaction (Oct 3)
        expect(screen.getByLabelText('Import transactions from').props.value).toBe('2026-10-04')
        await fireEvent.press(screen.getByText('Continue to your bank'))
        expect(invoke).toHaveBeenCalledWith('bank', { body: {
            action: 'link', publicToken: 'public-abc', institutionName: 'Chase', syncFrom: '2026-10-04',
        } })
        await waitFor(() => expect(showToast).toHaveBeenCalledWith('Chase linked. Added 12 transactions.'))
    })

    it('lets you go back as far as January 1, but no further', async () => {
        twoFactor(true)
        await renderSettings()
        await fireEvent.press(await screen.findByText('+ Link a bank'))
        expect(screen.getByText(/Banks share history back to Jan 1/)).toBeTruthy()
        await fireEvent.changeText(screen.getByLabelText('Import transactions from'), '2025-12-31')
        await fireEvent.press(screen.getByText('Continue to your bank'))
        expect(showToast).toHaveBeenCalledWith('Banks share history back to 2026-01-01. Pick that date or later.', 'error')
        expect(openBankConnect).not.toHaveBeenCalled()
    })

    it('says how many transactions need a look after linking', async () => {
        twoFactor(true)
        ;(openBankConnect as jest.Mock).mockResolvedValue({ publicToken: 'public-abc', institutionName: 'Chase' })
        invoke.mockResolvedValueOnce({ data: { connectionId: 'conn-1', added: 40, toReview: 3, status: 'active' }, error: null })
        await renderSettings()
        await fireEvent.press(await screen.findByText('+ Link a bank'))
        await fireEvent.press(screen.getByText('Continue to your bank'))
        await waitFor(() => expect(showToast).toHaveBeenCalledWith(
            'Chase linked. Added 40 transactions. 3 might already be in the app: check them under Possible duplicates.'))
    })

    it('says when the bank is still loading its transactions', async () => {
        twoFactor(true)
        ;(openBankConnect as jest.Mock).mockResolvedValue({ publicToken: 'public-abc', institutionName: 'Chase' })
        invoke.mockResolvedValueOnce({ data: { connectionId: 'conn-1', added: 0, status: 'pending' }, error: null })
        await renderSettings()
        await fireEvent.press(await screen.findByText('+ Link a bank'))
        await fireEvent.press(screen.getByText('Continue to your bank'))
        await waitFor(() => expect(showToast).toHaveBeenCalledWith(
            "Chase linked. Its transactions are still loading; they'll appear at the next sync, or tap Sync now in a few minutes."))
    })

    it('does nothing if you close the bank sign-in', async () => {
        twoFactor(true)
        ;(openBankConnect as jest.Mock).mockResolvedValue(null)
        await renderSettings()
        await fireEvent.press(await screen.findByText('+ Link a bank'))
        await fireEvent.press(screen.getByText('Continue to your bank'))
        expect(invoke).not.toHaveBeenCalled()
    })

    it('shows why linking failed', async () => {
        twoFactor(true)
        ;(openBankConnect as jest.Mock).mockResolvedValue({ publicToken: 'p', institutionName: 'Chase' })
        invoke.mockResolvedValueOnce({ data: null, error: { message: 'x', context: { json: async () => ({ error: 'PLAID_SECRET missing' }) } } })
        await renderSettings()
        await fireEvent.press(await screen.findByText('+ Link a bank'))
        await fireEvent.press(screen.getByText('Continue to your bank'))
        await waitFor(() => expect(showToast).toHaveBeenCalledWith('PLAID_SECRET missing', 'error'))
    })

    it('syncs now', async () => {
        twoFactor(true)
        fake.table('bank_connections', { data: [connection] })
        invoke.mockResolvedValueOnce({ data: { added: 4, connections: 1 }, error: null })
        await renderSettings()
        await fireEvent.press(await screen.findByText('Sync now'))
        expect(invoke).toHaveBeenCalledWith('bank', { body: { action: 'sync' } })
        await waitFor(() => expect(showToast).toHaveBeenCalledWith('Added 4 new transactions'))
    })

    it('unlinks after confirming, keeping past transactions', async () => {
        twoFactor(true)
        fake.table('bank_connections', { data: [connection] })
        await renderSettings()
        await fireEvent.press(await screen.findByText('Unlink'))
        expect(screen.getByText('Unlink Chase? Transactions already imported stay.')).toBeTruthy()
        await fireEvent.press(screen.getByText('Yes, unlink'))
        expect(invoke).toHaveBeenCalledWith('bank', { body: { action: 'unlink', connectionId: 'conn-1' } })
    })

    describe('possible duplicates', () => {
        const review = {
            id: 'rev-1', date: '2026-10-02', amount: 84.23, type: 'expense', name: 'WHOLE FOODS #10234', existing_transaction_id: 'mine-1',
        }
        function withReview(mine: object[] = [{ id: 'mine-1', date: '2026-10-01', amount: 84.23, name: 'Groceries', note: '' }]) {
            twoFactor(true)
            fake.table('bank_connections', { data: [connection] })
            fake.table('bank_possible_duplicates', { data: [review] })
            fake.table('transactions', call => ({
                data: call.ops.some(o => o.method === 'in') ? mine : [{ date: '2026-10-03' }], error: null,
            }))
        }

        it('shows yours and the bank\'s side by side', async () => {
            withReview()
            await renderSettings()
            expect(await screen.findByText('Possible duplicates (1)')).toBeTruthy()
            expect(screen.getByText('$84.23')).toBeTruthy()
            expect(screen.getByText('Yours: Oct 1 · Groceries')).toBeTruthy()
            expect(screen.getByText("Bank's: Oct 2 · WHOLE FOODS #10234")).toBeTruthy()
        })

        it.each([
            ['Keep mine', 'keep_mine'],
            ["Use bank's", 'use_bank'],
            ['Keep both', 'keep_both'],
        ])('"%s" resolves it', async (button, choice) => {
            withReview()
            await renderSettings()
            await screen.findByText('Possible duplicates (1)')
            fake.table('bank_possible_duplicates', { data: [] })
            await fireEvent.press(screen.getByText(button))
            expect(supabase.rpc).toHaveBeenCalledWith('resolve_possible_duplicate', { p_id: 'rev-1', p_choice: choice })
            await waitFor(() => expect(screen.queryByText('Possible duplicates (1)')).toBeNull())
        })

        it('says when you deleted yours since', async () => {
            withReview([])
            await renderSettings()
            expect(await screen.findByText('Yours: deleted since')).toBeTruthy()
        })

        it('shows why resolving failed', async () => {
            withReview()
            ;(supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: { message: 'Possible duplicate not found' } })
            await renderSettings()
            await fireEvent.press(await screen.findByText('Keep both'))
            await waitFor(() => expect(showToast).toHaveBeenCalledWith('Possible duplicate not found', 'error'))
        })

        it('mentions them after syncing', async () => {
            twoFactor(true)
            fake.table('bank_connections', { data: [connection] })
            invoke.mockResolvedValueOnce({ data: { added: 4, toReview: 1, connections: 1 }, error: null })
            await renderSettings()
            await fireEvent.press(await screen.findByText('Sync now'))
            await waitFor(() => expect(showToast).toHaveBeenCalledWith(
                'Added 4 new transactions. 1 might already be in the app: check it under Possible duplicates.'))
        })
    })

    it('says when linking is only available on the website', async () => {
        twoFactor(true)
        ;(bankLinkingAvailable as jest.Mock).mockReturnValue(false)
        await renderSettings()
        expect(await screen.findByText('Link banks from the website version of the app.')).toBeTruthy()
    })
})
