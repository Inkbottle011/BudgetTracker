jest.mock('../supabase', () => require('../../test/fakeSupabase').module)

/** Loads lib/bankConnect fresh with a given platform and settings, plus the fake server it talks to. */
function load(env: Record<string, string>, os = 'web') {
    jest.resetModules()
    jest.doMock('react-native', () => ({ Platform: { OS: os } }))
    delete process.env.EXPO_PUBLIC_BANK_PROVIDER
    delete process.env.EXPO_PUBLIC_TELLER_APP_ID
    Object.assign(process.env, env)
    const mod = require('../bankConnect') as typeof import('../bankConnect')
    const invoke = require('../../test/fakeSupabase').functions.invoke as jest.Mock
    return Object.assign(mod, { invoke })
}

afterEach(() => {
    delete (globalThis as any).Plaid
    delete process.env.EXPO_PUBLIC_BANK_PROVIDER
    delete process.env.EXPO_PUBLIC_TELLER_APP_ID
})

describe('bankLinkingAvailable', () => {
    it('is on for the website with Plaid (the default)', () => {
        expect(load({}).bankLinkingAvailable()).toBe(true)
    })
    it('is off in the phone app', () => {
        expect(load({}, 'ios').bankLinkingAvailable()).toBe(false)
    })
    it('needs an app ID for Teller', () => {
        expect(load({ EXPO_PUBLIC_BANK_PROVIDER: 'teller' }).bankLinkingAvailable()).toBe(false)
        expect(load({ EXPO_PUBLIC_BANK_PROVIDER: 'teller', EXPO_PUBLIC_TELLER_APP_ID: 'app_1' }).bankLinkingAvailable()).toBe(true)
    })
})

describe('openBankConnect with Plaid', () => {
    function fakePlaidLink(outcome: 'success' | 'exit') {
        const created: any[] = []
        ;(globalThis as any).Plaid = {
            create: (config: any) => {
                created.push(config)
                return {
                    open: () => outcome === 'success'
                        ? config.onSuccess('public-abc', { institution: { name: 'Chase', institution_id: 'ins_3' } })
                        : config.onExit(null, {}),
                    destroy: jest.fn(),
                }
            },
        }
        return created
    }

    it('gets a session from the server, opens Plaid Link with it, and returns the one-time token', async () => {
        const { openBankConnect, invoke } = load({})
        const created = fakePlaidLink('success')
        invoke.mockResolvedValueOnce({ data: { linkToken: 'link-sandbox-1' }, error: null })
        await expect(openBankConnect()).resolves.toEqual({ publicToken: 'public-abc', institutionName: 'Chase' })
        expect(invoke).toHaveBeenCalledWith('bank', { body: { action: 'link-session' } })
        expect(created[0].token).toBe('link-sandbox-1')
    })

    it('returns nothing if the person closes the window', async () => {
        const { openBankConnect, invoke } = load({})
        fakePlaidLink('exit')
        invoke.mockResolvedValueOnce({ data: { linkToken: 'link-sandbox-1' }, error: null })
        await expect(openBankConnect()).resolves.toBeNull()
    })
})
