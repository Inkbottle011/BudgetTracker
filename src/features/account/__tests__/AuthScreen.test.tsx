import { render, screen, fireEvent } from '@testing-library/react-native'
import AuthScreen from '../screens/AuthScreen'
import { fake, auth } from '../../../../test/fakeSupabase'

jest.mock('../../../shared/supabase', () => require('../../../../test/fakeSupabase').module)

const email = () => screen.getByPlaceholderText('you@example.com')
const password = () => screen.getByPlaceholderText(/Your password|Min\. 8 chars/)
// The mode switch at the top and the button under the form share a name; the form button comes last
const submit = (name: string) => screen.getAllByRole('button', { name }).pop()!
const modeTab = (name: string) => screen.getAllByRole('button', { name })[0]

beforeEach(() => fake.reset())

describe('signing in', () => {
    it('asks for an email and password before contacting the server', async () => {
        await render(<AuthScreen />)
        await fireEvent.press(submit('Sign in'))
        expect(screen.getByText('Email is required')).toBeTruthy()
        expect(screen.getByText('Password is required')).toBeTruthy()
        expect(auth.signInWithPassword).not.toHaveBeenCalled()
    })

    it('rejects an email without an @', async () => {
        await render(<AuthScreen />)
        await fireEvent.changeText(email(), 'not-an-email')
        await fireEvent.changeText(password(), 'secret1')
        await fireEvent.press(submit('Sign in'))
        expect(screen.getByText('Enter a valid email address')).toBeTruthy()
    })

    it('signs in with the email and password', async () => {
        await render(<AuthScreen />)
        await fireEvent.changeText(email(), 'me@example.com')
        await fireEvent.changeText(password(), 'secret1')
        await fireEvent.press(submit('Sign in'))
        expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'me@example.com', password: 'secret1' })
    })

    it.each([
        [{ code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' }, 'Incorrect email or password. Please try again.'],
        [{ code: 'email_not_confirmed', status: 400, message: 'Email not confirmed' }, 'Please confirm your email first. Check your inbox for the confirmation link.'],
        [{ status: 0, message: 'Failed to fetch' }, "Couldn't reach the server. Check your internet connection and try again."],
        [{ code: 'unexpected_failure', status: 500, message: 'Database error querying schema' }, 'Sign-in failed: Database error querying schema'],
    ])('explains why sign-in failed (%o)', async (error, message) => {
        auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error } as any)
        await render(<AuthScreen />)
        await fireEvent.changeText(email(), 'me@example.com')
        await fireEvent.changeText(password(), 'secret1')
        await fireEvent.press(submit('Sign in'))
        expect(await screen.findByText(message)).toBeTruthy()
    })

    it('says what the app is for', async () => {
        await render(<AuthScreen />)
        expect(screen.getByText('Budget Tracker')).toBeTruthy()
        expect(screen.getByText('Track what comes in, what goes out, and what you save.')).toBeTruthy()
    })

    it('can show the password while typing it', async () => {
        await render(<AuthScreen />)
        expect(password().props.secureTextEntry).toBe(true)
        await fireEvent.press(screen.getByLabelText('Show password'))
        expect(password().props.secureTextEntry).toBe(false)
        await fireEvent.press(screen.getByLabelText('Hide password'))
        expect(password().props.secureTextEntry).toBe(true)
    })

    it('shows an error passed in from an expired email link', async () => {
        await render(<AuthScreen initialError="That link is invalid or has expired. Please request a new one." />)
        expect(screen.getByText('That link is invalid or has expired. Please request a new one.')).toBeTruthy()
    })
})

describe('signing up', () => {
    async function openSignUp() {
        await render(<AuthScreen />)
        await fireEvent.press(modeTab('Create account'))
    }

    it.each([
        ['short1!', 'Password must be at least 8 characters'],
        ['lowercase1!', 'Must contain an uppercase letter'],
        ['NoNumbers!', 'Must contain a number'],
        ['NoSymbol123', 'Must contain a special character'],
    ])('requires a strong password (%p)', async (pw, message) => {
        await openSignUp()
        await fireEvent.changeText(email(), 'new@example.com')
        await fireEvent.changeText(password(), pw)
        await fireEvent.press(submit('Create account'))
        expect(screen.getByText(message)).toBeTruthy()
        expect(auth.signUp).not.toHaveBeenCalled()
    })

    it('shows password strength as you type', async () => {
        await openSignUp()
        await fireEvent.changeText(password(), 'abc')
        expect(screen.getByText('Weak')).toBeTruthy()
        await fireEvent.changeText(password(), 'Abcdefg1!')
        expect(screen.getByText('Strong')).toBeTruthy()
    })

    it('creates the account and asks the user to confirm their email', async () => {
        await openSignUp()
        await fireEvent.changeText(email(), 'new@example.com')
        await fireEvent.changeText(password(), 'Abcdefg1!')
        await fireEvent.press(submit('Create account'))
        expect(auth.signUp).toHaveBeenCalledWith({ email: 'new@example.com', password: 'Abcdefg1!' })
        expect(await screen.findByText('Account created! Check your email to confirm before signing in.')).toBeTruthy()
        expect(submit('Sign in')).toBeTruthy()
    })
})

describe('forgot password', () => {
    async function openForgot() {
        await render(<AuthScreen />)
        await fireEvent.press(screen.getByText('Forgot password?'))
    }

    it('only asks for an email', async () => {
        await openForgot()
        expect(screen.queryByPlaceholderText('Your password')).toBeNull()
        expect(screen.getByText('Send reset link')).toBeTruthy()
    })

    it('needs a valid email', async () => {
        await openForgot()
        await fireEvent.press(screen.getByText('Send reset link'))
        expect(screen.getByText('Email is required')).toBeTruthy()
        expect(auth.resetPasswordForEmail).not.toHaveBeenCalled()
    })

    it('sends a reset email that links back to the app', async () => {
        await openForgot()
        await fireEvent.changeText(email(), 'me@example.com')
        await fireEvent.press(screen.getByText('Send reset link'))
        expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('me@example.com', { redirectTo: 'budgettracker://' })
        expect(await screen.findByText(/If an account exists for me@example.com/)).toBeTruthy()
    })

    it('shows server errors, like sending too many emails', async () => {
        auth.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: { message: 'Email rate limit exceeded' } } as any)
        await openForgot()
        await fireEvent.changeText(email(), 'me@example.com')
        await fireEvent.press(screen.getByText('Send reset link'))
        expect(await screen.findByText('Email rate limit exceeded')).toBeTruthy()
    })

    it('recovers if something unexpected goes wrong, instead of spinning forever', async () => {
        auth.resetPasswordForEmail.mockRejectedValueOnce(new Error('Network request failed'))
        await openForgot()
        await fireEvent.changeText(email(), 'me@example.com')
        await fireEvent.press(screen.getByText('Send reset link'))
        expect(await screen.findByText('Something went wrong: Network request failed')).toBeTruthy()
        expect(screen.getByText('Send reset link')).toBeTruthy()
    })

    it('goes back to sign in', async () => {
        await openForgot()
        await fireEvent.press(screen.getByText('Back to sign in'))
        expect(submit('Sign in')).toBeTruthy()
        expect(screen.getByPlaceholderText('Your password')).toBeTruthy()
    })
})
