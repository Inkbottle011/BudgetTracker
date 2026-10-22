// Which version of the website is running, and whether a newer one is online. Each build of the website
// has a unique code in its main file's name (…/entry-3f9a2c1d….js); the first 7 characters are the version.
import { Platform } from 'react-native'

/** The version code in a page or file name, or null. */
export function bundleId(text: string): string | null {
    const m = /_expo\/static\/js\/web\/[\w-]+?-([0-9a-f]{7,})\.js/.exec(text)
    return m ? m[1].slice(0, 7) : null
}

/** The version running now ('' off the web, where the app store handles updates). */
export function currentVersion(): string | null {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return null
    const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.getAttribute('src') ?? '')
    for (const src of scripts) { const id = bundleId(src); if (id) return id }
    return null
}

type Fetch = (url: string, init?: any) => Promise<{ ok: boolean; text: () => Promise<string> }>

/** Compares the running version with the one online. 'unknown' when offline or not on the web. */
export async function checkForUpdate(current = currentVersion(), fetcher: Fetch = (u, i) => fetch(u, i)): Promise<'new' | 'same' | 'unknown'> {
    if (!current) return 'unknown'
    try {
        const res = await fetcher(`/?version-check=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return 'unknown'
        const online = bundleId(await res.text())
        return !online ? 'unknown' : online === current ? 'same' : 'new'
    } catch {
        return 'unknown'
    }
}
