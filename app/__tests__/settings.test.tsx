import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import SettingsScreen from '../settings'
import { ToastContext } from '../../context/ToastContext'
import { fake, auth, functions } from '../../test/fakeSupabase'
import { openTellerConnect, bankLinkingAvailable } from '../../lib/tellerConnect'

jest.mock('../../lib/supabase', () => require('../../test/fakeSupabase').module)
jest.mock('../../lib/tellerConnect', () => ({
    bankLinkingAvailable: jest.fn(() => true),
    openTellerConnect: jest.fn(),
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
    ;(openTellerConnect as jest.Mock).mockReset()
    ;(bankLinkingAvailable as jest.Mock).mockReturnValue(true)
    twoFactor(false)
    fake.table('bank_connections', { data: [] })
    fake.table('bank_accounts', { data: [] })
    fake.table('transactions', { data: [{ date: '2026-10-03' }] })
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
        fake.table('bank_accounts', { data: [{ id: 'a1', connection_id: 'conn-1', name: 'Total Checking', last_four: '1234', type: 'depository' }] })
        await renderSettings()
        expect(await screen.findByText('Chase')).toBeTruthy()
        expect(screen.getByText('Total Checking ••1234')).toBeTruthy()
        expect(screen.getByText('Synced 3 hours ago')).toBeTruthy()
    })

    it('links a bank: pick a start date, sign in with Teller, then the server stores and syncs it', async () => {
        twoFactor(true)
        ;(openTellerConnect as jest.Mock).mockResolvedValue({ accessToken: 'token_abc', enrollment: { id: 'enr_1', institution: { name: 'Chase' } } })
        invoke.mockResolvedValueOnce({ data: { connectionId: 'conn-1', added: 12, status: 'active' }, error: null })
        await renderSettings()
        await fireEvent.press(await screen.findByText('+ Link a bank'))
        // Suggests the day after your latest transaction (Oct 3)
        expect(screen.getByLabelText('Import transactions from').props.value).toBe('2026-10-04')
        await fireEvent.press(screen.getByText('Continue to your bank'))
        expect(invoke).toHaveBeenCalledWith('bank', { body: {
            action: 'link', accessToken: 'token_abc', enrollmentId: 'enr_1', institutionName: 'Chase', syncFrom: '2026-10-04',
        } })
        await waitFor(() => expect(showToast).toHaveBeenCalledWith('Chase linked. Added 12 transactions.'))
    })

    it('does nothing if you close the bank sign-in', async () => {
        twoFactor(true)
        ;(openTellerConnect as jest.Mock).mockResolvedValue(null)
        await renderSettings()
        await fireEvent.press(await screen.findByText('+ Link a bank'))
        await fireEvent.press(screen.getByText('Continue to your bank'))
        expect(invoke).not.toHaveBeenCalled()
    })

    it('shows why linking failed', async () => {
        twoFactor(true)
        ;(openTellerConnect as jest.Mock).mockResolvedValue({ accessToken: 't', enrollment: { id: 'e', institution: { name: 'Chase' } } })
        invoke.mockResolvedValueOnce({ data: null, error: { message: 'x', context: { json: async () => ({ error: 'Teller certificate missing' }) } } })
        await renderSettings()
        await fireEvent.press(await screen.findByText('+ Link a bank'))
        await fireEvent.press(screen.getByText('Continue to your bank'))
        await waitFor(() => expect(showToast).toHaveBeenCalledWith('Teller certificate missing', 'error'))
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

    it('says when linking is only available on the website', async () => {
        twoFactor(true)
        ;(bankLinkingAvailable as jest.Mock).mockReturnValue(false)
        await renderSettings()
        expect(await screen.findByText('Link banks from the website version of the app.')).toBeTruthy()
    })
})
