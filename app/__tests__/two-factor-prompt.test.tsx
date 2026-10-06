import { render, screen, fireEvent } from '@testing-library/react-native'
import TwoFactorPrompt from '../two-factor-prompt'
import { fake, auth } from '../../test/fakeSupabase'

jest.mock('../../lib/supabase', () => require('../../test/fakeSupabase').module)

const mfa = auth.mfa as unknown as Record<string, jest.Mock>
const VERIFIED = { id: 'factor-1', factor_type: 'totp', status: 'verified' }

beforeEach(() => {
    fake.reset()
    mfa.listFactors.mockResolvedValue({ data: { all: [VERIFIED], totp: [VERIFIED] }, error: null })
})

it('asks for the code and verifies it', async () => {
    const onDone = jest.fn()
    await render(<TwoFactorPrompt onDone={onDone} />)
    await fireEvent.changeText(screen.getByPlaceholderText('123456'), '654321')
    await fireEvent.press(screen.getByText('Verify'))
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'factor-1', code: '654321' })
    expect(onDone).toHaveBeenCalled()
})

it('explains a wrong code and lets you try again', async () => {
    mfa.challengeAndVerify.mockResolvedValueOnce({ data: null, error: { message: 'Invalid TOTP code entered' } })
    const onDone = jest.fn()
    await render(<TwoFactorPrompt onDone={onDone} />)
    await fireEvent.changeText(screen.getByPlaceholderText('123456'), '000000')
    await fireEvent.press(screen.getByText('Verify'))
    expect(await screen.findByText("That code didn't work. Check the time on your phone and try the newest code.")).toBeTruthy()
    expect(onDone).not.toHaveBeenCalled()
})

it('lets you sign out instead', async () => {
    await render(<TwoFactorPrompt onDone={jest.fn()} />)
    await fireEvent.press(screen.getByText('Sign out'))
    expect(auth.signOut).toHaveBeenCalled()
})
