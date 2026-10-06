import { render, screen, fireEvent } from '@testing-library/react-native'
import ResetPasswordScreen from '../reset-password'
import { fake, auth } from '../../test/fakeSupabase'

jest.mock('../../lib/supabase', () => require('../../test/fakeSupabase').module)

const newPassword = () => screen.getByPlaceholderText('Min. 8 chars, uppercase, number, symbol')
const confirm = () => screen.getByPlaceholderText('Re-enter new password')

beforeEach(() => fake.reset())

it('requires a strong password', async () => {
    await render(<ResetPasswordScreen onDone={jest.fn()} />)
    await fireEvent.changeText(newPassword(), 'weak')
    await fireEvent.changeText(confirm(), 'weak')
    await fireEvent.press(screen.getByText('Update Password'))
    expect(screen.getByText('Password must be at least 8 characters')).toBeTruthy()
    expect(auth.updateUser).not.toHaveBeenCalled()
})

it('requires both passwords to match', async () => {
    await render(<ResetPasswordScreen onDone={jest.fn()} />)
    await fireEvent.changeText(newPassword(), 'Abcdefg1!')
    await fireEvent.changeText(confirm(), 'Abcdefg1?')
    await fireEvent.press(screen.getByText('Update Password'))
    expect(screen.getByText('Passwords do not match')).toBeTruthy()
})

it('saves the new password, then continues into the app', async () => {
    const onDone = jest.fn()
    await render(<ResetPasswordScreen onDone={onDone} />)
    await fireEvent.changeText(newPassword(), 'Abcdefg1!')
    await fireEvent.changeText(confirm(), 'Abcdefg1!')
    await fireEvent.press(screen.getByText('Update Password'))
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'Abcdefg1!' })
    expect(await screen.findByText('Your password has been updated.')).toBeTruthy()
    await fireEvent.press(screen.getByText('Continue'))
    expect(onDone).toHaveBeenCalled()
})

it('shows the server\'s reason when saving fails', async () => {
    auth.updateUser.mockResolvedValueOnce({ data: {}, error: { message: 'New password should be different from the old password.' } } as any)
    await render(<ResetPasswordScreen onDone={jest.fn()} />)
    await fireEvent.changeText(newPassword(), 'Abcdefg1!')
    await fireEvent.changeText(confirm(), 'Abcdefg1!')
    await fireEvent.press(screen.getByText('Update Password'))
    expect(await screen.findByText('New password should be different from the old password.')).toBeTruthy()
})

it('cancelling signs out of the temporary reset session', async () => {
    const onDone = jest.fn()
    await render(<ResetPasswordScreen onDone={onDone} />)
    await fireEvent.press(screen.getByText('Cancel'))
    expect(auth.signOut).toHaveBeenCalled()
    expect(onDone).toHaveBeenCalled()
})

it('recovers if something unexpected goes wrong, instead of spinning forever', async () => {
    auth.updateUser.mockRejectedValueOnce(new Error('Network request failed'))
    await render(<ResetPasswordScreen onDone={jest.fn()} />)
    await fireEvent.changeText(newPassword(), 'Abcdefg1!')
    await fireEvent.changeText(confirm(), 'Abcdefg1!')
    await fireEvent.press(screen.getByText('Update Password'))
    expect(await screen.findByText('Something went wrong: Network request failed')).toBeTruthy()
    expect(screen.getByText('Update Password')).toBeTruthy()
})
