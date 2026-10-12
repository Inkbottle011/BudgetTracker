import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { AppHeader } from '../../App'
import { ThemeProvider } from '../../lib/theme'
import { ToastContext } from '../../context/ToastContext'
import { fake, auth } from '../../test/fakeSupabase'

jest.mock('../../lib/supabase', () => require('../../test/fakeSupabase').module)

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
