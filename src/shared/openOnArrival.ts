// Lets one page ask another to open something (a window, a guide) when you get there,
// for buttons like "Import a file" on the Dashboard that take you to another tab.
import { useEffect } from 'react'
import { create } from 'zustand'

export function createOpenOnArrival() {
    const store = create<{ asked: boolean }>(() => ({ asked: false }))
    return {
        /** Ask for it to open next time the page is shown (or now, if it's already showing). */
        ask: () => store.setState({ asked: true }),
        /** On the page: calls `open` once each time it's asked for. */
        useOpen(open: () => void) {
            const asked = store(s => s.asked)
            useEffect(() => {
                if (!asked) return
                store.setState({ asked: false })
                open()
            }, [asked])
        },
    }
}
