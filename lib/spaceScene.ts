// The moving space background, as plain math plus drawing on a 2D canvas. No React here, so it's easy
// to test. Sizes are in screen points; the component scales the canvas for sharp high-res screens.
import type { Amount, BackgroundSettings, Scene, SkyColors, Speed } from './background'

export interface Star {
    x: number; y: number    // Stars/Nebula: position on screen. Warp: position in space, -1 to 1
    z: number               // depth: near 1 = close (Stars), distance from you (Warp)
    size: number
    color: string
    phase: number           // for twinkling
    px?: number; py?: number // Warp: where it was drawn last, for the streak
}

export interface Glow { x: number; y: number; r: number; color: string; vx: number; vy: number }

export interface SceneState {
    kind: Exclude<Scene, 'off'>
    speed: Speed
    w: number
    h: number
    sky: SkyColors
    stars: Star[]
    glows: Glow[]
}

const SPEED_FACTOR: Record<Speed, number> = { calm: 0.5, normal: 1, lively: 2.2 }
const DENSITY: Record<Amount, number> = { few: 0.6, some: 1.2, lots: 2.4 }   // stars per 100×100 points
const DRIFT = 16          // points per second for the closest stars at Normal speed
const WARP = 0.32         // how fast Warp stars approach at Normal speed

/** A repeatable random number source (the same seed gives the same sky). */
export function seededRandom(seed: number) {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

export function starCount(amount: Amount, w: number, h: number) {
    const n = Math.round((w * h) / 10000 * (DENSITY[amount] ?? DENSITY.some))
    return Math.max(20, Math.min(600, n))
}

const pick = <T,>(list: T[], rand: () => number) => list[Math.floor(rand() * list.length) % list.length]

function warpStar(rand: () => number, sky: SkyColors, z: number): Star {
    return { x: rand() * 2 - 1, y: rand() * 2 - 1, z, size: 0.6 + rand() * 1.2, color: pick(sky.stars, rand), phase: rand() * Math.PI * 2 }
}

export function createScene(settings: BackgroundSettings, sky: SkyColors, w: number, h: number, rand: () => number = Math.random): SceneState {
    const kind = settings.scene === 'off' ? 'stars' : settings.scene
    const count = starCount(settings.amount, w, h)
    const stars: Star[] = []
    for (let i = 0; i < count; i++) {
        if (kind === 'warp') { stars.push(warpStar(rand, sky, 0.02 + rand() * 0.98)); continue }
        const z = 0.25 + rand() * 0.75
        stars.push({ x: rand() * w, y: rand() * h, z, size: 0.35 + z * 1.25, color: pick(sky.stars, rand), phase: rand() * Math.PI * 2 })
    }
    const glows: Glow[] = []
    if (kind === 'nebula') {
        const big = Math.max(w, h)
        for (let i = 0; i < 4; i++) {
            glows.push({
                x: rand() * w, y: rand() * h, r: big * (0.3 + rand() * 0.3), color: sky.glows[i % sky.glows.length],
                vx: (rand() - 0.5) * 12, vy: (rand() - 0.5) * 8,
            })
        }
    }
    return { kind, speed: settings.speed, w, h, sky, stars, glows }
}

/** Moves everything forward by `dt` seconds. */
export function stepScene(s: SceneState, dt: number, rand: () => number = Math.random) {
    const f = SPEED_FACTOR[s.speed] ?? 1
    for (const st of s.stars) {
        st.phase += dt * (0.8 + st.z)
        if (s.kind === 'warp') {
            st.z -= dt * WARP * f
            if (st.z <= 0.02 || Math.abs(st.x / st.z) > 3 || Math.abs(st.y / st.z) > 3) {
                Object.assign(st, warpStar(rand, s.sky, 0.6 + rand() * 0.4), { px: undefined, py: undefined })
            }
            continue
        }
        // Nebula stars barely move, so the clouds are what you notice
        st.x -= DRIFT * st.z * f * dt * (s.kind === 'nebula' ? 0.3 : 1)
        if (st.x < -2) { st.x = s.w + 2; st.y = rand() * s.h }
    }
    for (const g of s.glows) {
        g.x += g.vx * f * dt
        g.y += g.vy * f * dt
        if (g.x < -g.r) g.x = s.w + g.r
        if (g.x > s.w + g.r) g.x = -g.r
        if (g.y < -g.r) g.y = s.h + g.r
        if (g.y > s.h + g.r) g.y = -g.r
    }
}

function rgba(hex: string, alpha: number) {
    const n = parseInt(hex.slice(1), 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** Paints one frame. */
export function drawScene(ctx: CanvasRenderingContext2D, s: SceneState) {
    const { w, h, sky } = s
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, sky.top)
    bg.addColorStop(1, sky.bottom)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    for (const g of s.glows) {
        const rg = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r)
        rg.addColorStop(0, rgba(g.color, sky.glowAlpha))
        rg.addColorStop(1, rgba(g.color, 0))
        ctx.fillStyle = rg
        ctx.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2)
    }

    const cx = w / 2, cy = h / 2, k = Math.max(w, h) * 0.35
    for (const st of s.stars) {
        const twinkle = 0.65 + 0.35 * Math.sin(st.phase)
        ctx.fillStyle = st.color
        ctx.strokeStyle = st.color
        if (s.kind === 'warp') {
            const x = cx + (st.x / st.z) * k, y = cy + (st.y / st.z) * k
            const near = 1 - st.z
            ctx.globalAlpha = sky.starAlpha * Math.min(1, near * 1.6)
            if (st.px !== undefined && st.py !== undefined) {
                ctx.lineWidth = st.size * (0.4 + near * 1.6)
                ctx.beginPath()
                ctx.moveTo(st.px, st.py)
                ctx.lineTo(x, y)
                ctx.stroke()
            }
            st.px = x; st.py = y
            ctx.beginPath()
            ctx.arc(x, y, st.size * (0.3 + near * 1.2), 0, Math.PI * 2)
            ctx.fill()
            continue
        }
        ctx.globalAlpha = sky.starAlpha * twinkle * (0.45 + st.z * 0.55)
        ctx.beginPath()
        ctx.arc(st.x, st.y, st.size, 0, Math.PI * 2)
        ctx.fill()
    }
    ctx.globalAlpha = 1
}
