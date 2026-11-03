import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ThemeProvider } from '../../../shared/theme/theme'
import SettingsScreen from '../screens/SettingsScreen'
import { ToastContext } from '../../../shared/ui/ToastContext'
import { fake, auth, functions, supabase } from '../../../../test/fakeSupabase'
import { openBankConnect, bankLinkingAvailable } from '../../bank/logic/bankConnect'

jest.mock('../../../shared/supabase', () => require('../../../../test/fakeSupabase').module)
jest.mock('../../bank/logic/bankConnect', () => ({
    bankLinkingAvailable: jest.fn(() => true),
    openBankConnect: jest.fn(),
}))
// Like the real one: runs when the screen is shown and again whenever the callback changes
const mockNavigate = jest.fn()
jest.mock('@react-navigation/native', () => ({
    useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]),
    useNavigation: () => ({ navigate: mockNavigate }),
}))

const showToast = jest.fn()

/** The bank server's answers: which ways you can link (asked when the page opens), and the reply to the next other action. */
function answerBank(reply: any, providers = ['plaid', 'simplefin']) {
    let used = false
    invoke.mockImplementation(async (_name: string, { body }: any) => {
        if (body.action === 'providers') return { data: { providers }, error: null }
        if (reply && !used) { used = true; return reply }
        return { data: {}, error: null }
    })
}
const mfa = auth.mfa as unknown as Record<string, jest.Mock>
const invoke = functions.invoke as jest.Mock

const VERIFIED = { id: 'factor-1', factor_type: 'totp', status: 'verified', friendly_name: 'Authenticator' }

function twoFactor(on: boolean) {
    mfa.listFactors.mockResolvedValue({ data: { all: on ? [VERIFIED] : [], totp: on ? [VERIFIED] : [] }, error: null })
}

async function renderSettings() {
    await render(<ThemeProvider><ToastContext.Provider value={{ showToast }}><SettingsScreen /></ToastContext.Provider></ThemeProvider>)
    await screen.findByText('Two-factor sign-in')
}

beforeEach(() => {
    fake.reset()
    showToast.mockClear()
    invoke.mockReset()
    answerBank(null, ['plaid', 'simplefin'])
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

describe('appearance', () => {
    it('follows the device until you pick light or dark, and remembers your choice', async () => {
        await AsyncStorage.clear()
        await renderSettings()
        expect(screen.getByText('Appearance')).toBeTruthy()
        expect(screen.getByText(/Match device follows your phone or computer's light or dark setting/)).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Match device' }).props.accessibilityState.selected).toBe(true)
        await fireEvent.press(screen.getByRole('button', { name: 'Dark' }))
        expect(screen.getByRole('button', { name: 'Dark' }).props.accessibilityState.selected).toBe(true)
        expect(await AsyncStorage.getItem('appearance')).toBe('dark')
        await fireEvent.press(screen.getByRole('button', { name: 'Light' }))
        expect(await AsyncStorage.getItem('appearance')).toBe('light')
    })

    it('lets you pick a color theme, which recolors the app and is remembered', async () => {
        await AsyncStorage.clear()
        await renderSettings()
        for (const name of ['Night sky', 'Ocean', 'Forest', 'Sunset', 'Classic']) expect(screen.getByRole('button', { name: `${name} theme` })).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Night sky theme' }).props.accessibilityState.selected).toBe(true)
        await fireEvent.press(screen.getByRole('button', { name: 'Ocean theme' }))
        expect(screen.getByRole('button', { name: 'Ocean theme' }).props.accessibilityState.selected).toBe(true)
        await waitFor(async () => expect(await AsyncStorage.getItem('colorTheme')).toBe('ocean'))
    })

    it('lets you pick a moving background, how fast and how many stars, and its color, or turn it off', async () => {
        await AsyncStorage.clear()
        await renderSettings()
        expect(screen.getByText('Moving background')).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Stars' }).props.accessibilityState.selected).toBe(true)
        await fireEvent.press(screen.getByRole('button', { name: 'Nebula' }))
        await fireEvent.press(screen.getByRole('button', { name: 'Lively' }))
        await fireEvent.press(screen.getByRole('button', { name: 'Lots' }))
        await fireEvent.press(screen.getByRole('button', { name: 'Purple' }))
        expect(screen.getByRole('button', { name: 'Purple' }).props.accessibilityState.selected).toBe(true)
        await fireEvent.press(screen.getByRole('switch', { name: 'Shooting stars' }))
        expect(screen.getByRole('switch', { name: 'Shooting stars' }).props.accessibilityState.checked).toBe(false)
        expect(screen.getByRole('switch', { name: 'Planets' }).props.accessibilityState.checked).toBe(true)
        await waitFor(async () => expect(JSON.parse((await AsyncStorage.getItem('background'))!))
            .toEqual({ scene: 'nebula', speed: 'lively', amount: 'lots', tint: 'purple', shootingStars: false, planets: true }))

        // Turned off, the other choices go away
        await fireEvent.press(screen.getByRole('button', { name: 'None' }))
        expect(screen.queryByRole('button', { name: 'Lively' })).toBeNull()
        expect(screen.queryByRole('button', { name: 'Purple' })).toBeNull()
    })
})

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

    it('walks through setup in three steps, for the phone you pick', async () => {
        await renderSettings()
        await fireEvent.press(screen.getByText('Set up two-factor sign-in'))
        expect(screen.getByText('1. Get an authenticator app')).toBeTruthy()
        expect(screen.getByText('2. Add Budget Tracker to it')).toBeTruthy()
        expect(screen.getByText('3. Type the code it shows')).toBeTruthy()

        // iPhone: nothing to install, scan with the Camera
        expect(screen.getByRole('button', { name: 'iPhone' }).props.accessibilityState.selected).toBe(true)
        expect(screen.getByText(/built-in Passwords app/)).toBeTruthy()
        expect(screen.getByText(/Open the Camera app/)).toBeTruthy()
        expect(screen.getByText(/Add Verification Code in Passwords/)).toBeTruthy()

        // Android: Google Authenticator
        await fireEvent.press(screen.getByRole('button', { name: 'Android' }))
        expect(screen.getByText(/Install Google Authenticator/)).toBeTruthy()
        expect(screen.getByText(/Scan a QR code/)).toBeTruthy()
        expect(screen.queryByText(/Open the Camera app/)).toBeNull()
    })

    it('explains what to do when this page is open on the same phone, so the code can\'t be scanned', async () => {
        await renderSettings()
        await fireEvent.press(screen.getByText('Set up two-factor sign-in'))
        expect(screen.getByText(/Reading this on the same phone\?/)).toBeTruthy()
        expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeTruthy()
        expect(screen.getByText(/Enter Setup Key/)).toBeTruthy()
        await fireEvent.press(screen.getByRole('button', { name: 'Android' }))
        expect(screen.getByText(/Enter a setup key/)).toBeTruthy()
    })

    it('says where to find the code next time you sign in', async () => {
        await renderSettings()
        await fireEvent.press(screen.getByText('Set up two-factor sign-in'))
        expect(screen.getByText(/Each time you sign in/)).toBeTruthy()
        expect(screen.getByText(/open the Passwords app, tap Codes/)).toBeTruthy()
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
        // Turning off first looks up every authenticator, then removes them
        mfa.listFactors.mockResolvedValueOnce({ data: { all: [VERIFIED], totp: [VERIFIED] }, error: null })
        await fireEvent.press(screen.getByText('Yes, turn off'))
        expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'factor-1' })
        expect(await screen.findByText('Off')).toBeTruthy()
    })

    it('adds a backup authenticator, so losing your phone doesn\'t lock you out', async () => {
        twoFactor(true)
        await renderSettings()
        expect(await screen.findByText('Your authenticators')).toBeTruthy()
        expect(screen.getByText(/so you can still sign in if you lose your phone/)).toBeTruthy()
        await fireEvent.press(screen.getByRole('button', { name: 'Add a backup authenticator' }))
        expect(mfa.enroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'Backup authenticator' })
        expect(screen.getByLabelText('QR code for your authenticator app')).toBeTruthy()
        const backup = { ...VERIFIED, id: 'factor-2', friendly_name: 'Backup authenticator' }
        mfa.listFactors.mockResolvedValue({ data: { all: [VERIFIED, backup], totp: [VERIFIED, backup] }, error: null })
        await fireEvent.changeText(screen.getByPlaceholderText('123456'), '123456')
        await fireEvent.press(screen.getByText('Confirm'))
        expect(showToast).toHaveBeenCalledWith('Backup authenticator added')
        expect(await screen.findByText('Backup authenticator')).toBeTruthy()
    })

    it('removes one of several authenticators after confirming', async () => {
        const backup = { ...VERIFIED, id: 'factor-2', friendly_name: 'Backup authenticator' }
        mfa.listFactors.mockResolvedValue({ data: { all: [VERIFIED, backup], totp: [VERIFIED, backup] }, error: null })
        await renderSettings()
        await fireEvent.press(await screen.findByRole('button', { name: 'Remove Backup authenticator' }))
        expect(screen.getByText(/You can still sign in with your other authenticator/)).toBeTruthy()
        await fireEvent.press(screen.getByText('Yes, remove'))
        expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'factor-2' })
    })

    it('has no remove button when there is only one (turn off instead)', async () => {
        twoFactor(true)
        await renderSettings()
        await screen.findByText('Your authenticators')
        expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull()
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
        expect(screen.queryByText('Link a bank')).toBeNull()
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
        answerBank({ data: { connectionId: 'conn-1', added: 12, status: 'active' }, error: null })
        await renderSettings()
        await fireEvent.press(await screen.findByText('Link a bank'))
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
        await fireEvent.press(await screen.findByText('Link a bank'))
        expect(screen.getByText(/Banks share history back to Jan 1/)).toBeTruthy()
        await fireEvent.changeText(screen.getByLabelText('Import transactions from'), '2025-12-31')
        await fireEvent.press(screen.getByText('Continue to your bank'))
        expect(showToast).toHaveBeenCalledWith('Banks share history back to 2026-01-01. Pick that date or later.', 'error')
        expect(openBankConnect).not.toHaveBeenCalled()
    })

    it('says how many transactions need a look after linking', async () => {
        twoFactor(true)
        ;(openBankConnect as jest.Mock).mockResolvedValue({ publicToken: 'public-abc', institutionName: 'Chase' })
        answerBank({ data: { connectionId: 'conn-1', added: 40, toReview: 3, status: 'active' }, error: null })
        await renderSettings()
        await fireEvent.press(await screen.findByText('Link a bank'))
        await fireEvent.press(screen.getByText('Continue to your bank'))
        await waitFor(() => expect(showToast).toHaveBeenCalledWith(
            'Chase linked. Added 40 transactions. 3 might already be in the app: check them under Possible duplicates.'))
    })

    it('says when the bank is still loading its transactions', async () => {
        twoFactor(true)
        ;(openBankConnect as jest.Mock).mockResolvedValue({ publicToken: 'public-abc', institutionName: 'Chase' })
        answerBank({ data: { connectionId: 'conn-1', added: 0, status: 'pending' }, error: null })
        await renderSettings()
        await fireEvent.press(await screen.findByText('Link a bank'))
        await fireEvent.press(screen.getByText('Continue to your bank'))
        await waitFor(() => expect(showToast).toHaveBeenCalledWith(
            "Chase linked. Its transactions are still loading; they'll appear at the next sync, or tap Sync now in a few minutes."))
    })

    it('does nothing if you close the bank sign-in', async () => {
        twoFactor(true)
        ;(openBankConnect as jest.Mock).mockResolvedValue(null)
        await renderSettings()
        await fireEvent.press(await screen.findByText('Link a bank'))
        await fireEvent.press(screen.getByText('Continue to your bank'))
        expect(invoke).not.toHaveBeenCalledWith('bank', { body: expect.objectContaining({ action: 'link' }) })
    })

    it('shows why linking failed', async () => {
        twoFactor(true)
        ;(openBankConnect as jest.Mock).mockResolvedValue({ publicToken: 'p', institutionName: 'Chase' })
        answerBank({ data: null, error: { message: 'x', context: { json: async () => ({ error: 'PLAID_SECRET missing' }) } } })
        await renderSettings()
        await fireEvent.press(await screen.findByText('Link a bank'))
        await fireEvent.press(screen.getByText('Continue to your bank'))
        await waitFor(() => expect(showToast).toHaveBeenCalledWith('PLAID_SECRET missing', 'error'))
    })

    it('syncs now', async () => {
        twoFactor(true)
        fake.table('bank_connections', { data: [connection] })
        answerBank({ data: { added: 4, connections: 1 }, error: null })
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
        expect(screen.getByText("Unlink Chase? Transactions already imported stay. This can't be undone: to sync it again you'd link it again.")).toBeTruthy()
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
            answerBank({ data: { added: 4, toReview: 1, connections: 1 }, error: null })
            await renderSettings()
            await fireEvent.press(await screen.findByText('Sync now'))
            await waitFor(() => expect(showToast).toHaveBeenCalledWith(
                'Added 4 new transactions. 1 might already be in the app: check it under Possible duplicates.'))
        })
    })

    it('in the phone app, links with SimpleFIN (Plaid\'s sign-in window is website-only)', async () => {
        twoFactor(true)
        ;(bankLinkingAvailable as jest.Mock).mockReturnValue(false)
        await renderSettings()
        expect(await screen.findByText('Link a bank')).toBeTruthy()
        expect(screen.queryByText('Link banks from the website version of the app.')).toBeNull()
    })
})

describe('About this app', () => {
    it('shows the version and checks for a newer one', async () => {
        const version = require('../../../shared/version')
        jest.spyOn(version, 'currentVersion').mockReturnValue('3f9a2c1')
        const check = jest.spyOn(version, 'checkForUpdate').mockResolvedValue('same')
        await renderSettings()
        expect(screen.getByText('Version 3f9a2c1')).toBeTruthy()
        await fireEvent.press(screen.getByRole('button', { name: 'Check for updates' }))
        expect(check).toHaveBeenCalled()
        expect(await screen.findByText("You're on the latest version.")).toBeTruthy()
        check.mockResolvedValue('new')
        await fireEvent.press(screen.getByRole('button', { name: 'Check for updates' }))
        expect(await screen.findByText('A newer version is online. Reload the page to get it.')).toBeTruthy()
    })
})

describe('Privacy mode settings', () => {
    it('lets you choose what privacy mode hides', async () => {
        const { usePrivacy, DEFAULT_HIDDEN_KINDS } = require('../../../shared/ui/Private')
        usePrivacy.setState({ hidden: false, kinds: DEFAULT_HIDDEN_KINDS, loaded: true })
        await renderSettings()
        expect(screen.getByText('Privacy mode')).toBeTruthy()
        expect(screen.getByRole('checkbox', { name: 'Bank balances' }).props.accessibilityState.checked).toBe(true)
        expect(screen.getByRole('checkbox', { name: 'Transaction amounts' }).props.accessibilityState.checked).toBe(false)
        await fireEvent.press(screen.getByRole('checkbox', { name: 'Transaction amounts' }))
        expect(usePrivacy.getState().kinds).toContain('transactions')
        await fireEvent.press(screen.getByRole('checkbox', { name: 'Bank balances' }))
        expect(usePrivacy.getState().kinds).not.toContain('balances')
    })
})

describe('linking with SimpleFIN', () => {
    it('everyone else links with a SimpleFIN setup token, with steps to get one', async () => {
        twoFactor(true)
        answerBank({ data: { connectionId: 'conn-2', added: 25, status: 'active' }, error: null }, ['simplefin'])
        await renderSettings()
        await fireEvent.press(await screen.findByText('Link a bank'))
        expect(screen.queryByText('Continue to your bank')).toBeNull()   // no Plaid for this person
        expect(screen.getByText(/bridge\.simplefin\.org/)).toBeTruthy()
        expect(screen.getByRole('button', { name: 'Link with SimpleFIN' }).props.accessibilityState.disabled).toBe(true)
        await fireEvent.changeText(screen.getByLabelText('SimpleFIN setup token'), '  aHR0cHM6Ly9icmlkZ2Uuc2ltcGxlZmluLm9yZy9jbGFpbS94  ')
        await fireEvent.press(screen.getByRole('button', { name: 'Link with SimpleFIN' }))
        expect(invoke).toHaveBeenCalledWith('bank', { body: {
            action: 'link', setupToken: 'aHR0cHM6Ly9icmlkZ2Uuc2ltcGxlZmluLm9yZy9jbGFpbS94', syncFrom: '2026-10-04',
        } })
        await waitFor(() => expect(showToast).toHaveBeenCalledWith('Your banks are linked through SimpleFIN. Added 25 transactions.'))
    })

    it('someone allowed Plaid chooses between the two', async () => {
        twoFactor(true)
        await renderSettings()
        await fireEvent.press(await screen.findByText('Link a bank'))
        expect(screen.getByText('Continue to your bank')).toBeTruthy()   // Plaid first
        await fireEvent.press(screen.getByRole('button', { name: 'SimpleFIN' }))
        expect(screen.getByLabelText('SimpleFIN setup token')).toBeTruthy()
        expect(screen.queryByText('Continue to your bank')).toBeNull()
    })

    it('works in the phone app too, where Plaid\'s sign-in window isn\'t available', async () => {
        twoFactor(true)
        ;(bankLinkingAvailable as jest.Mock).mockReturnValue(false)
        answerBank(null, ['plaid', 'simplefin'])
        await renderSettings()
        await fireEvent.press(await screen.findByText('Link a bank'))
        expect(screen.getByLabelText('SimpleFIN setup token')).toBeTruthy()
        expect(screen.queryByRole('button', { name: 'Plaid' })).toBeNull()
    })

    it('unlinking a SimpleFIN bank says to remove the app in SimpleFIN too', async () => {
        twoFactor(true)
        fake.table('bank_connections', { data: [{ id: 'conn-2', institution_name: 'Chase', status: 'active', last_error: null, provider: 'simplefin', last_synced_at: null, sync_from: '2026-09-01' }] })
        await renderSettings()
        await fireEvent.press(await screen.findByText('Unlink'))
        expect(screen.getByText(/also remove this app in SimpleFIN Bridge/)).toBeTruthy()
    })
})

describe('Suggestions forum', () => {
    it('opens the forum', async () => {
        await renderSettings()
        await fireEvent.press(screen.getByRole('button', { name: 'Open the forum' }))
        expect(mockNavigate).toHaveBeenCalledWith('Forum')
    })
})

describe('getting started', () => {
    it('offers to bring back the getting-started list after it was hidden', async () => {
        const { setChecklistHidden } = require('../../onboarding/logic/remember')
        await setChecklistHidden(true)
        await renderSettings()
        expect(await screen.findByText('Show the getting-started list')).toBeTruthy()
    })
})
