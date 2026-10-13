import { parseBackground, DEFAULT_BACKGROUND, skyColors, TINTS } from '../background'
import { createScene, stepScene, drawScene, drawBackdrop, starCount, seededRandom } from '../spaceScene'

describe('saved background settings', () => {
    it('starts with slow drifting blue stars', () => {
        expect(parseBackground(null)).toEqual({ scene: 'stars', speed: 'calm', amount: 'some', tint: 'blue', shootingStars: true, planets: true })
        expect(DEFAULT_BACKGROUND.scene).toBe('stars')
    })

    it('reads what was saved, keeping defaults for anything missing or broken', () => {
        expect(parseBackground(JSON.stringify({ scene: 'warp', tint: 'rose' })))
            .toMatchObject({ scene: 'warp', speed: 'calm', amount: 'some', tint: 'rose' })
        expect(parseBackground(JSON.stringify({ scene: 'lava', speed: 'lively', amount: 12 })))
            .toMatchObject({ scene: 'stars', speed: 'lively', amount: 'some', tint: 'blue' })
        expect(parseBackground('not json')).toEqual(DEFAULT_BACKGROUND)
    })

    it('has light and dark colors for every tint', () => {
        for (const { value } of TINTS) {
            for (const scheme of ['light', 'dark'] as const) {
                const sky = skyColors(scheme, value)
                expect(sky.top).toMatch(/^#[0-9a-f]{6}$/i)
                expect(sky.stars.length).toBeGreaterThan(0)
                expect(sky.glows.length).toBeGreaterThan(0)
            }
        }
    })
})

const sky = skyColors('dark', 'blue')
const settings = (over = {}) => ({ ...DEFAULT_BACKGROUND, ...over })

describe('the moving scene', () => {
    it('has more stars on bigger screens and when you ask for more, within limits', () => {
        expect(starCount('some', 1600, 900)).toBeGreaterThan(starCount('some', 400, 800))
        expect(starCount('lots', 1000, 800)).toBeGreaterThan(starCount('few', 1000, 800))
        expect(starCount('few', 10, 10)).toBeGreaterThanOrEqual(20)
        expect(starCount('lots', 10000, 10000)).toBeLessThanOrEqual(600)
    })

    it('places every star on the screen', () => {
        const s = createScene(settings(), sky, 800, 600, seededRandom(1))
        expect(s.stars.length).toBe(starCount('some', 800, 600))
        expect(s.stars.every(st => st.x >= 0 && st.x <= 800 && st.y >= 0 && st.y <= 600)).toBe(true)
    })

    it('is the same every time for the same seed', () => {
        const a = createScene(settings(), sky, 800, 600, seededRandom(7))
        const b = createScene(settings(), sky, 800, 600, seededRandom(7))
        expect(a.stars).toEqual(b.stars)
    })

    it('drifting stars move sideways and come back round the other side', () => {
        const s = createScene(settings(), sky, 800, 600, seededRandom(2))
        const before = s.stars.map(st => st.x)
        stepScene(s, 1, seededRandom(3))
        expect(s.stars.some((st, i) => st.x < before[i])).toBe(true)
        // Push one star off the left edge
        s.stars[0].x = -10
        stepScene(s, 0.01, seededRandom(3))
        expect(s.stars[0].x).toBeGreaterThan(790)
    })

    it('moves faster when set to Lively than Calm', () => {
        const moved = (speed: 'calm' | 'lively') => {
            const s = createScene(settings({ speed }), sky, 800, 600, seededRandom(4))
            const x = s.stars[5].x
            stepScene(s, 0.5, seededRandom(5))
            return x - s.stars[5].x
        }
        expect(moved('lively')).toBeGreaterThan(moved('calm'))
    })

    it('warp stars fly toward you and start again in the distance once they pass', () => {
        const s = createScene(settings({ scene: 'warp' }), sky, 800, 600, seededRandom(6))
        const z = s.stars[0].z
        stepScene(s, 0.1, seededRandom(7))
        expect(s.stars[0].z).toBeLessThan(z)
        s.stars[1].z = 0.001
        stepScene(s, 0.01, seededRandom(7))
        expect(s.stars[1].z).toBeGreaterThan(0.5)
    })

    it('the nebula has slow-moving glows', () => {
        const s = createScene(settings({ scene: 'nebula' }), sky, 800, 600, seededRandom(8))
        expect(s.glows.length).toBeGreaterThan(0)
        const x = s.glows[0].x
        stepScene(s, 2, seededRandom(9))
        expect(s.glows[0].x).not.toBe(x)
    })

    it('paints the sky, then each star', () => {
        const calls: string[] = []
        const gradient = { addColorStop: () => {} }
        const ctx: any = new Proxy({}, {
            get: (_t, prop: string) => {
                if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient
                return (...args: any[]) => { calls.push(prop); return undefined }
            },
            set: () => true,
        })
        const s = createScene(settings({ planets: false }), sky, 300, 200, seededRandom(1))
        drawScene(ctx, s)
        expect(calls[0]).toBe('fillRect')
        expect(calls.filter(c => c === 'arc').length).toBe(s.stars.length)
    })
})

describe('extra details', () => {
    it('shooting stars and planets are on unless you turn them off', () => {
        expect(parseBackground(null)).toMatchObject({ shootingStars: true, planets: true })
        expect(parseBackground(JSON.stringify({ planets: false, shootingStars: 'yes' }))).toMatchObject({ shootingStars: true, planets: false })
    })

    it('some stars are big bright ones', () => {
        const s = createScene(settings({ amount: 'lots' }), sky, 1200, 800, seededRandom(11))
        const bright = s.stars.filter(st => st.bright).length
        expect(bright).toBeGreaterThan(0)
        expect(bright).toBeLessThan(s.stars.length / 10)
    })

    it('has a planet or two drifting slowly, unless turned off or flying at warp speed', () => {
        const s = createScene(settings(), sky, 1200, 800, seededRandom(12))
        expect(s.planets.length).toBeGreaterThanOrEqual(1)
        expect(s.planets.length).toBeLessThanOrEqual(2)
        const x = s.planets[0].x
        stepScene(s, 4, seededRandom(1))
        expect(s.planets[0].x).toBeLessThan(x)
        expect(x - s.planets[0].x).toBeLessThan(20)
        expect(createScene(settings({ planets: false }), sky, 1200, 800, seededRandom(12)).planets).toEqual([])
        expect(createScene(settings({ scene: 'warp' }), sky, 1200, 800, seededRandom(12)).planets).toEqual([])
    })

    it('a shooting star flashes by now and then, and is gone a moment later', () => {
        const s = createScene(settings(), sky, 1200, 800, seededRandom(13))
        const rand = seededRandom(14)
        let seen = 0
        for (let i = 0; i < 30 * 60; i++) { stepScene(s, 1 / 30, rand); if (s.meteors.length) seen++ }   // a minute
        expect(seen).toBeGreaterThan(0)
        expect(seen).toBeLessThan(30 * 60 / 4)   // not most of the time
        const off = createScene(settings({ shootingStars: false }), sky, 1200, 800, seededRandom(13))
        for (let i = 0; i < 30 * 60; i++) stepScene(off, 1 / 30, rand)
        expect(off.meteors).toEqual([])
    })

    it('paints the still parts (sky, Milky Way, star dust) once, then reuses them each frame', () => {
        const calls: string[] = []
        const gradient = { addColorStop: () => {} }
        const ctx: any = new Proxy({}, {
            get: (_t, prop: string) => {
                if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient
                return () => { calls.push(prop) }
            },
            set: () => true,
        })
        const s = createScene(settings(), sky, 600, 400, seededRandom(1))
        drawBackdrop(ctx, s)
        expect(calls.filter(c => c === 'fillRect').length).toBeGreaterThan(s.stars.length)   // sky, band and dust
        calls.length = 0
        s.backdrop = { fake: 'image' }
        drawScene(ctx, s)
        expect(calls[0]).toBe('drawImage')
    })
})
