import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { AppHeader } from '../App'
import { ThemeProvider } from '../shared/theme/theme'
import { ToastContext } from '../shared/ui/ToastContext'
import { fake, auth } from '../../test/fakeSupabase'
import { usePrivacy } from '../shared/ui/Private'

jest.mock('../shared/supabase', () => require('../../test/fakeSupabase').module)

const showToast = jest.fn()

async function renderHeader() {
    await render(
        <ThemeProvider>
            <ToastContext.Provider value={{ showToast }}>
                <AppHeader userEmail="me@example.com" />
            </ToastContext.Provider>
        </ThemeProvider>,
    )
}

beforeEach(() => { fake.reset(); showToast.mockClear() })

describe('app header', () => {
    it('shows the app name without emoji and your initial', async () => {
        await renderHeader()
        expect(screen.getByText('Budget Tracker')).toBeTruthy()
        expect(screen.getByText('M')).toBeTruthy()
    })

    it('opens the account menu with your email, and signs out', async () => {
        await renderHeader()
        await fireEvent.press(screen.getByLabelText('Account menu'))
        expect(screen.getByText('me@example.com')).toBeTruthy()
        await fireEvent.press(screen.getByText('Sign out'))
        expect(auth.signOut).toHaveBeenCalled()
        await waitFor(() => expect(showToast).toHaveBeenCalledWith('Signed out'))
    })

    it('says how to fix it when signing out fails', async () => {
        auth.signOut.mockResolvedValueOnce({ error: { message: 'Network request failed' } } as any)
        await renderHeader()
        await fireEvent.press(screen.getByLabelText('Account menu'))
        await fireEvent.press(screen.getByText('Sign out'))
        await waitFor(() => expect(showToast).toHaveBeenCalledWith(
            "Couldn't sign out: Network request failed. Check your connection and try again.", 'error'))
    })
})

describe('privacy mode', () => {
    beforeEach(() => usePrivacy.setState({ hidden: false, loaded: true }))

    it('the eye button hides amounts, and shows them again', async () => {
        await renderHeader()
        await fireEvent.press(screen.getByRole('button', { name: 'Hide amounts' }))
        expect(usePrivacy.getState().hidden).toBe(true)
        expect(showToast).toHaveBeenLastCalledWith('Privacy mode on. Choose what it hides in Settings.', 'info')   // the phone app's wording
        await fireEvent.press(screen.getByRole('button', { name: 'Show amounts' }))
        expect(usePrivacy.getState().hidden).toBe(false)
    })
})
