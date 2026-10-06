import { render, screen, waitFor, act } from '@testing-library/react-native'
import * as Linking from 'expo-linking'
import App from '../App'
import { fake, auth, supabase } from '../test/fakeSupabase'

jest.mock('../lib/supabase', () => require('../test/fakeSupabase').module)

const session = { user: { id: 'user-1', email: 'me@example.com' } }

/** Lets a test fire auth events, like Supabase does after a sign-in or a reset link. */
function captureAuthListener() {
    let listener: (event: string, s: any) => void = () => {}
    auth.onAuthStateChange.mockImplementation(((cb: any) => {
        listener = cb
        return { data: { subscription: { unsubscribe: jest.fn() } } }
    }) as any)
    return (event: string, s: any) => act(() => listener(event, s))
}

beforeEach(() => {
    fake.reset()
    ;(Linking.getInitialURL as jest.Mock).mockResolvedValue(null)
})

it('shows the sign-in screen when signed out', async () => {
    auth.getSession.mockResolvedValueOnce({ data: { session: null } } as any)
    await render(<App />)
    expect(await screen.findByText('Sign in to continue')).toBeTruthy()
})

it('when signed in, adds due subscription charges before showing the app', async () => {
    auth.getSession.mockResolvedValue({ data: { session } } as any)
    await render(<App />)
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith('generate_subscription_transactions', expect.any(Object)))
    expect(await screen.findByText('💰 Budget Tracker')).toBeTruthy()
    expect(screen.getAllByText('Subscriptions').length).toBeGreaterThan(0)
})

it('still opens the app if adding charges fails (for example, the database is paused)', async () => {
    auth.getSession.mockResolvedValue({ data: { session } } as any)
    ;(supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: { message: 'paused' } })
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    await render(<App />)
    expect(await screen.findByText('💰 Budget Tracker')).toBeTruthy()
})

it('exchanges the code from an email link for a session', async () => {
    auth.getSession.mockResolvedValueOnce({ data: { session: null } } as any)
    ;(Linking.getInitialURL as jest.Mock).mockResolvedValue('budgettracker://?code=abc123')
    await render(<App />)
    await waitFor(() => expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('abc123'))
})

it('explains an expired link on the sign-in screen', async () => {
    auth.getSession.mockResolvedValueOnce({ data: { session: null } } as any)
    auth.exchangeCodeForSession.mockResolvedValueOnce({ data: {}, error: { message: 'expired' } } as any)
    ;(Linking.getInitialURL as jest.Mock).mockResolvedValue('budgettracker://?code=old')
    await render(<App />)
    expect(await screen.findByText('That link is invalid or has expired. Please request a new one.')).toBeTruthy()
})

it('shows errors Supabase puts in the link', async () => {
    auth.getSession.mockResolvedValueOnce({ data: { session: null } } as any)
    ;(Linking.getInitialURL as jest.Mock).mockResolvedValue('budgettracker://?error_description=Email+link+is+invalid')
    await render(<App />)
    expect(await screen.findByText('Email link is invalid')).toBeTruthy()
})

it('opens the reset-password screen from a password reset link', async () => {
    const fire = captureAuthListener()
    auth.getSession.mockResolvedValueOnce({ data: { session: null } } as any)
    await render(<App />)
    await screen.findByText('Sign in to continue')
    await fire('PASSWORD_RECOVERY', session)
    expect(await screen.findByText('Choose a new password for your account')).toBeTruthy()
})

it('returns to sign-in after signing out', async () => {
    const fire = captureAuthListener()
    auth.getSession.mockResolvedValue({ data: { session } } as any)
    await render(<App />)
    await screen.findByText('💰 Budget Tracker')
    await fire('SIGNED_OUT', null)
    expect(await screen.findByText('Sign in to continue')).toBeTruthy()
})
