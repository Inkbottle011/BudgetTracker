// The moving space background: what you can choose in Settings, and the colors for each choice.
// To add a color, add it to TINTS and TINT_COLORS. The animation itself is in lib/spaceScene.ts.

export type Scene = 'off' | 'stars' | 'warp' | 'nebula'
export type Speed = 'calm' | 'normal' | 'lively'
export type Amount = 'few' | 'some' | 'lots'
export type Tint = 'blue' | 'purple' | 'teal' | 'green' | 'rose' | 'gold'

export interface BackgroundSettings {
    scene: Scene
    speed: Speed
    amount: Amount
    tint: Tint
    shootingStars: boolean   // now and then one streaks across (Stars and Nebula)
    planets: boolean         // one or two planets drifting slowly far away (Stars and Nebula)
}

export const BACKGROUND_KEY = 'background'
export const DEFAULT_BACKGROUND: BackgroundSettings = {
    scene: 'stars', speed: 'calm', amount: 'some', tint: 'blue', shootingStars: true, planets: true,
}

export const SCENES: { value: Scene; label: string }[] = [
    { value: 'off', label: 'None' },
    { value: 'stars', label: 'Stars' },
    { value: 'warp', label: 'Warp' },
    { value: 'nebula', label: 'Nebula' },
]
export const SPEEDS: { value: Speed; label: string }[] = [
    { value: 'calm', label: 'Calm' },
    { value: 'normal', label: 'Normal' },
    { value: 'lively', label: 'Lively' },
]
export const AMOUNTS: { value: Amount; label: string }[] = [
    { value: 'few', label: 'Few' },
    { value: 'some', label: 'Some' },
    { value: 'lots', label: 'Lots' },
]
export const TINTS: { value: Tint; label: string }[] = [
    { value: 'blue', label: 'Blue' },
    { value: 'purple', label: 'Purple' },
    { value: 'teal', label: 'Teal' },
    { value: 'green', label: 'Green' },
    { value: 'rose', label: 'Rose' },
    { value: 'gold', label: 'Gold' },
]

const allowed = <T extends string>(list: { value: T }[], v: unknown): v is T => list.some(o => o.value === v)

/** Reads the saved settings; anything missing or unrecognised falls back to the default. */
export function parseBackground(raw: string | null): BackgroundSettings {
    let saved: any = {}
    try { saved = raw ? JSON.parse(raw) ?? {} : {} } catch { saved = {} }
    return {
        scene: allowed(SCENES, saved.scene) ? saved.scene : DEFAULT_BACKGROUND.scene,
        speed: allowed(SPEEDS, saved.speed) ? saved.speed : DEFAULT_BACKGROUND.speed,
        amount: allowed(AMOUNTS, saved.amount) ? saved.amount : DEFAULT_BACKGROUND.amount,
        tint: allowed(TINTS, saved.tint) ? saved.tint : DEFAULT_BACKGROUND.tint,
        shootingStars: typeof saved.shootingStars === 'boolean' ? saved.shootingStars : DEFAULT_BACKGROUND.shootingStars,
        planets: typeof saved.planets === 'boolean' ? saved.planets : DEFAULT_BACKGROUND.planets,
    }
}

export interface SkyColors {
    top: string        // sky at the top of the screen
    bottom: string     // sky at the bottom
    stars: string[]
    glows: string[]    // the soft clouds in the Nebula scene
    glowAlpha: number  // how strong the clouds are
    starAlpha: number  // how bright the stars are
    planets: string[]  // planet colors
    bandAlpha: number  // how strong the Milky Way band is
    planetShadow: number // how dark the night side of a planet is, 0 to 1
}

// [stars, glows] for each tint. Dark: bright stars on a night sky. Light: soft colored specks on a pale
// sky, quiet enough that text on the page stays easy to read.
const TINT_COLORS: Record<Tint, { dark: [string[], string[]]; light: [string[], string[]] }> = {
    blue: {
        dark: [['#ffffff', '#cfe3ff', '#8fbfff'], ['#1e4fa0', '#2a6fdb', '#173a7a']],
        light: [['#5b7fb8', '#8aa6d6', '#3d5f99'], ['#b9d0f2', '#cddcf5', '#a9c4ee']],
    },
    purple: {
        dark: [['#ffffff', '#e5d6ff', '#b99cff'], ['#5b2aa0', '#8a3fd1', '#3a1f73']],
        light: [['#7a5bb8', '#9d86d1', '#5d3f9c'], ['#dccdf5', '#e7dcfa', '#cdb9f0']],
    },
    teal: {
        dark: [['#ffffff', '#d2fbf4', '#7fe3d3'], ['#0f6b6b', '#13a19a', '#0b4a55']],
        light: [['#3d8f88', '#6bb3ab', '#2b6f6a'], ['#c3ece6', '#d6f3ef', '#b0e3dc']],
    },
    green: {
        dark: [['#ffffff', '#dcf7e4', '#94e0ae'], ['#1f6b3e', '#2f9156', '#16502e']],
        light: [['#4a8a5e', '#78ad88', '#336e47'], ['#c6e8cf', '#d8f0de', '#b3dfc0']],
    },
    rose: {
        dark: [['#ffffff', '#ffd9e6', '#ff9ec0'], ['#8a2252', '#c23a74', '#5a1a3d']],
        light: [['#b85b7f', '#d38aa6', '#9c3f63'], ['#f6cfdd', '#fadde8', '#f0bccf']],
    },
    gold: {
        dark: [['#ffffff', '#fff1cc', '#ffd27a'], ['#8a5a12', '#c7891c', '#5a3a0c']],
        light: [['#a8802d', '#c9a457', '#8a6418'], ['#f6e5bf', '#faefd6', '#f0d9a6']],
    },
}

/** The colors to paint the sky with, for light or dark mode. */
export function skyColors(scheme: 'light' | 'dark', tint: Tint): SkyColors {
    const t = TINT_COLORS[tint] ?? TINT_COLORS.blue
    if (scheme === 'dark') {
        const [stars, glows] = t.dark
        return {
            top: '#060a14', bottom: '#0e1428', stars, glows, glowAlpha: 0.42, starAlpha: 0.9, bandAlpha: 0.07, planetShadow: 0.65,
            planets: ['#c98b5a', '#7fa7d9', '#d9b77f', '#9fc7a8'],
        }
    }
    const [stars, glows] = t.light
    return {
        top: '#f2f5fa', bottom: '#e6eaf3', stars, glows, glowAlpha: 0.6, starAlpha: 0.7, bandAlpha: 0.12, planetShadow: 0.3,
        planets: ['#d9a882', '#a9c2e3', '#e3cfa5', '#b9d6c0'],
    }
}

/** The swatch shown in Settings for a tint. */
export function tintSwatch(tint: Tint) {
    return (TINT_COLORS[tint] ?? TINT_COLORS.blue).dark[1][1]
}
