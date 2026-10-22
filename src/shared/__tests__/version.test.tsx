import { render, screen, fireEvent, act } from '@testing-library/react-native'
import { bundleId, checkForUpdate } from '../version'
import { UpdateBanner } from '../ui/UpdateBanner'

const page = (id: string) => `<html><head><script src="/_expo/static/js/web/entry-${id}.js" defer></script></head></html>`

describe('the version of the app', () => {
    it('is the code in the main file name of each website build', () => {
        expect(bundleId(page('3f9a2c1d0b8e7a6f5e4d3c2b1a090807'))).toBe('3f9a2c1')
        expect(bundleId('/_expo/static/js/web/entry-aa11bb22cc33dd44.js')).toBe('aa11bb2')
        expect(bundleId('<html>no app here</html>')).toBeNull()
    })

    it('a different build online means a new version', async () => {
        const online = (id: string) => async () => ({ ok: true, text: async () => page(id) }) as any
        expect(await checkForUpdate('3f9a2c1', online('3f9a2c1d0b8e7a6f'))).toBe('same')
        expect(await checkForUpdate('3f9a2c1', online('9999999d0b8e7a6f'))).toBe('new')
        expect(await checkForUpdate(null, online('9999999d0b8e7a6f'))).toBe('unknown')
        expect(await checkForUpdate('3f9a2c1', async () => { throw new Error('offline') })).toBe('unknown')
    })
})

describe('UpdateBanner', () => {
    it('says when a new version is ready and reloads', async () => {
        const reload = jest.fn()
        let answer: 'same' | 'new' = 'same'
        await render(<UpdateBanner check={async () => answer} reload={reload} />)
        expect(screen.queryByText('A new version of the app is ready.')).toBeNull()
        answer = 'new'
        await act(async () => { await UpdateBanner.checkNow() })
        expect(screen.getByText('A new version of the app is ready.')).toBeTruthy()
        await fireEvent.press(screen.getByRole('button', { name: 'Reload' }))
        expect(reload).toHaveBeenCalled()
    })
})
