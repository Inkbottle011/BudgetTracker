import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { GettingStarted } from '../screens/GettingStarted'
import { WelcomeTour } from '../screens/WelcomeTour'
import { ShowGettingStartedAgain } from '../screens/ShowGettingStartedAgain'
import { wasWelcomed, setChecklistHidden, isChecklistHidden, markWelcomed } from '../logic/remember'
import { fake, auth } from '../../../../test/fakeSupabase'
import { useTransactionFilters } from '../../transactions/api'

jest.mock('../../../shared/supabase', () => require('../../../../test/fakeSupabase').module)
jest.mock('@react-navigation/native', () => ({
    useFocusEffect: (effect: () => void) => require('react').useEffect(effect, []),
}))
// The pages they open, standing in for the real ones
jest.mock('../../transactions/logic/arrival', () => ({ openImportOnArrival: jest.fn(), useOpenImportOnArrival: jest.fn() }))
jest.mock('../../budget/logic/arrival', () => ({ openPlanGuideOnArrival: jest.fn(), usePlanGuideOnArrival: jest.fn() }))
const { openImportOnArrival } = require('../../transactions/logic/arrival')
const { openPlanGuideOnArrival } = require('../../budget/logic/arrival')

const mfa = auth.mfa as unknown as Record<string, jest.Mock>
const onGo = jest.fn()

function has({ transactions = false, budget = false, subscriptions = false }) {
    fake.table('transactions', { data: transactions ? [{ date: '2026-10-01' }] : [] })
    fake.table('budget_items', { data: budget ? [{ id: 'food', name: 'Food', type: 'expense' }] : [] })
    fake.table('subscriptions', { data: subscriptions ? [{ id: 's', name: 'Rent' }] : [] })
}

beforeEach(() => {
    fake.reset()
    onGo.mockClear()
    has({})
    mfa.listFactors.mockResolvedValue({ data: { all: [], totp: [] }, error: null })
})

describe('getting-started list', () => {
    it('shows the steps, how many are done, and ticks off what you already have', async () => {
        has({ transactions: true })
        await render(<GettingStarted onGo={onGo} />)
        expect(await screen.findByText('Getting started')).toBeTruthy()
        expect(screen.getByText('1 of 4 done')).toBeTruthy()
        expect(screen.getByLabelText('Add your transactions, done')).toBeTruthy()
        expect(screen.getByLabelText('Plan your budget, not done yet')).toBeTruthy()
        // A step that's done has nothing left to press
        expect(screen.queryByText('Import a file')).toBeNull()
        expect(screen.getByText('Plan my budget')).toBeTruthy()
    })

    it('takes you to the right place for each step', async () => {
        await render(<GettingStarted onGo={onGo} />)
        await screen.findByText('Getting started')
        await fireEvent.press(screen.getByText('Link a bank'))
        expect(onGo).toHaveBeenLastCalledWith('Settings')
        await fireEvent.press(screen.getByText('Import a file'))
        expect(openImportOnArrival).toHaveBeenCalled()
        expect(onGo).toHaveBeenLastCalledWith('Transactions')
        await fireEvent.press(screen.getByText('Add one'))
        expect(onGo).toHaveBeenLastCalledWith('Transactions')
        await fireEvent.press(screen.getByText('Plan my budget'))
        expect(openPlanGuideOnArrival).toHaveBeenCalled()
        expect(onGo).toHaveBeenLastCalledWith('Budget')
        await fireEvent.press(screen.getByText('Add subscriptions'))
        expect(onGo).toHaveBeenLastCalledWith('Subscriptions')
        await fireEvent.press(screen.getByText('Turn it on'))
        expect(onGo).toHaveBeenLastCalledWith('Settings')
    })

    it('shows the whole transaction list when you go to add one', async () => {
        useTransactionFilters.getState().set({ category: 'Food', preset: 'custom', from: '2026-01-01', to: '2026-01-31' })
        await render(<GettingStarted onGo={onGo} />)
        await fireEvent.press(await screen.findByText('Add one'))
        expect(useTransactionFilters.getState().category).toBeNull()
        expect(useTransactionFilters.getState().preset).toBe('all')
    })

    it('goes away once everything is done', async () => {
        has({ transactions: true, budget: true, subscriptions: true })
        mfa.listFactors.mockResolvedValue({ data: { all: [{ id: 'f', factor_type: 'totp', status: 'verified' }], totp: [] }, error: null })
        await render(<GettingStarted onGo={onGo} />)
        await waitFor(() => expect(fake.calls('subscriptions').length).toBeGreaterThan(0))
        await new Promise(r => setImmediate(r))
        expect(screen.queryByText('Getting started')).toBeNull()
    })

    it("can be hidden, and stays hidden", async () => {
        await render(<GettingStarted onGo={onGo} />)
        await fireEvent.press(await screen.findByRole('button', { name: 'Hide getting started' }))
        expect(screen.queryByText('Getting started')).toBeNull()
        expect(await isChecklistHidden()).toBe(true)
    })

    it('shows nothing if the database does not answer', async () => {
        fake.table('subscriptions', { data: null, error: { message: 'paused' } })
        await render(<GettingStarted onGo={onGo} />)
        await waitFor(() => expect(fake.calls('subscriptions').length).toBeGreaterThan(0))
        await new Promise(r => setImmediate(r))
        expect(screen.queryByText('Getting started')).toBeNull()
    })
})

describe('bringing the list back (in Settings)', () => {
    it('only offers it when the list is hidden', async () => {
        await render(<ShowGettingStartedAgain />)
        await new Promise(r => setImmediate(r))
        expect(screen.queryByText('Show the getting-started list')).toBeNull()
    })

    it('shows the list on the Dashboard again', async () => {
        await setChecklistHidden(true)
        await render(<ShowGettingStartedAgain />)
        await fireEvent.press(await screen.findByText('Show the getting-started list'))
        expect(await isChecklistHidden()).toBe(false)
        expect(await screen.findByText('It\'s back on the Dashboard.')).toBeTruthy()
    })
})

describe('welcome, the first time', () => {
    it('welcomes someone brand new, then asks how they want to add transactions', async () => {
        await render(<WelcomeTour onGo={onGo} />)
        expect(await screen.findByText('Welcome to Budget Tracker')).toBeTruthy()
        await fireEvent.press(screen.getByText("Let's get started"))
        expect(screen.getByText('How would you like to add your transactions?')).toBeTruthy()
        expect(screen.getByText(/First you'll turn on two-factor sign-in/)).toBeTruthy()
    })

    it.each([
        ['Link my bank', 'Settings'],
        ['Bring in a file from my bank', 'Transactions'],
        ['Type them in myself', 'Transactions'],
    ])('"%s" takes you to %s, and the welcome doesn\'t come back', async (choice, tab) => {
        await render(<WelcomeTour onGo={onGo} />)
        await fireEvent.press(await screen.findByText("Let's get started"))
        await fireEvent.press(screen.getByText(choice))
        expect(onGo).toHaveBeenCalledWith(tab)
        expect(screen.queryByText('How would you like to add your transactions?')).toBeNull()
        expect(await wasWelcomed()).toBe(true)
    })

    it('opens the import window for a file from the bank', async () => {
        await render(<WelcomeTour onGo={onGo} />)
        await fireEvent.press(await screen.findByText("Let's get started"))
        await fireEvent.press(screen.getByText('Bring in a file from my bank'))
        expect(openImportOnArrival).toHaveBeenCalled()
    })

    it('can be skipped, or left for later, without going anywhere', async () => {
        await render(<WelcomeTour onGo={onGo} />)
        await fireEvent.press(await screen.findByText('Skip for now'))
        expect(screen.queryByText('Welcome to Budget Tracker')).toBeNull()
        expect(onGo).not.toHaveBeenCalled()
        expect(await wasWelcomed()).toBe(true)
    })

    it('goes back a step', async () => {
        await render(<WelcomeTour onGo={onGo} />)
        await fireEvent.press(await screen.findByText("Let's get started"))
        await fireEvent.press(screen.getByText('Back'))
        expect(screen.getByText('Welcome to Budget Tracker')).toBeTruthy()
    })

    it("doesn't show for someone who already has things, and remembers that", async () => {
        has({ budget: true })
        await render(<WelcomeTour onGo={onGo} />)
        await waitFor(async () => expect(await wasWelcomed()).toBe(true))
        expect(screen.queryByText('Welcome to Budget Tracker')).toBeNull()
    })

    it("doesn't show again once seen", async () => {
        await markWelcomed()
        await render(<WelcomeTour onGo={onGo} />)
        await new Promise(r => setImmediate(r))
        expect(screen.queryByText('Welcome to Budget Tracker')).toBeNull()
        expect(fake.calls('budget_items')).toEqual([])
    })
})
