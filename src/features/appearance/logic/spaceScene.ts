// The moving space background, as plain math plus drawing on a 2D canvas. No React here, so it's easy
// to test. Sizes are in screen points; the component scales the canvas for sharp high-res screens.
//
// What's in the sky:
//   stars     small ones at different depths (far ones move slower), plus a few big bright ones
//   dust      a haze of tiny faint specks, gathered along a Milky Way band (still)
//   glows     soft drifting clouds (Nebula)
//   planets   one or two, very far away, drifting very slowly (optional)
//   meteors   a shooting star now and then (optional)
import type { Amount, BackgroundSettings, Scene, SkyColors, Speed } from '../../../shared/theme/background'

export interface Star {
    x: number; y: number    // Stars/Nebula: position on screen. Warp: position in space, -1 to 1
    z: number               // depth: near 1 = close (Stars), distance from you (Warp)
    size: number
    color: string
    phase: number           // for twinkling
    bright?: boolean        // a big bright star with a glow and a sparkle
    px?: number; py?: number // Warp: where it was drawn last, for the streak
}

export interface Speck { x: number; y: number; a: number; color: string }
export interface Glow { x: number; y: number; r: number; color: string; vx: number; vy: number }
export interface Planet { x: number; y: number; r: number; color: string; vx: number; ring: boolean; tilt: number }
export interface Meteor { x: number; y: number; vx: number; vy: number; age: number; life: number; color: string }

export interface SceneState {
    kind: Exclude<Scene, 'off'>
    speed: Speed
    w: number
    h: number
    sky: SkyColors
    stars: Star[]
    dust: Speck[]
    band: { x1: number; y1: number; x2: number; y2: number } | null
    glows: Glow[]
    planets: Planet[]
    meteors: Meteor[]
    shootingStars: boolean
    /** The still parts (sky, band, dust) painted once; set by the component. Redrawn from scratch if missing. */
    backdrop?: any
}

const SPEED_FACTOR: Record<Speed, number> = { calm: 0.5, normal: 1, lively: 2.2 }
const DENSITY: Record<Amount, number> = { few: 0.6, some: 1.2, lots: 2.4 }   // stars per 100×100 points
const DRIFT = 16            // points per second for the closest stars at Normal speed
const WARP = 0.32           // how fast Warp stars approach at Normal speed
const BRIGHT_SHARE = 0.03   // share of stars that are big bright ones
const METEOR_EVERY = 9      // seconds between shooting stars, on average
const BAND_BLOBS = 12       // soft patches making up the Milky Way band

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
/** Roughly bell-shaped, -1 to 1, mostly near 0 */
const bell = (rand: () => number) => (rand() + rand() + rand()) / 1.5 - 1

function warpStar(rand: () => number, sky: SkyColors, z: number): Star {
    return { x: rand() * 2 - 1, y: rand() * 2 - 1, z, size: 0.6 + rand() * 1.2, color: pick(sky.stars, rand), phase: rand() * Math.PI * 2 }
}

export function createScene(settings: BackgroundSettings, sky: SkyColors, w: number, h: number, rand: () => number = Math.random): SceneState {
    const kind = settings.scene === 'off' ? 'stars' : settings.scene
    const count = starCount(settings.amount, w, h)
    const stars: Star[] = []
    for (let i = 0; i < count; i++) {
        if (kind === 'warp') { stars.push(warpStar(rand, sky, 0.02 + rand() * 0.98)); continue }
        if (rand() < BRIGHT_SHARE) {
            stars.push({ x: rand() * w, y: rand() * h, z: 1, size: 1.5 + rand() * 0.9, color: pick(sky.stars, rand), phase: rand() * Math.PI * 2, bright: true })
            continue
        }
        const z = 0.25 + rand() * 0.75
        stars.push({ x: rand() * w, y: rand() * h, z, size: 0.35 + z * 1.25, color: pick(sky.stars, rand), phase: rand() * Math.PI * 2 })
    }

    // A Milky Way band from lower left to upper right, with star dust gathered along it
    const band = kind === 'warp' ? null : { x1: 0, y1: h * (0.7 + rand() * 0.25), x2: w, y2: h * (0.05 + rand() * 0.25) }
    const dust: Speck[] = []
    if (band) {
        const spread = Math.min(w, h) * 0.16
        const len = Math.hypot(band.x2 - band.x1, band.y2 - band.y1)
        const nx = -(band.y2 - band.y1) / len, ny = (band.x2 - band.x1) / len   // across the band
        for (let i = 0, n = Math.round(count * 1.5); i < n; i++) {
            const along = rand(), onBand = rand() < 0.7
            const off = onBand ? bell(rand) * spread : 0
            const x = onBand ? band.x1 + (band.x2 - band.x1) * along + nx * off : rand() * w
            const y = onBand ? band.y1 + (band.y2 - band.y1) * along + ny * off : rand() * h
            dust.push({ x, y, a: 0.15 + rand() * 0.35, color: pick(sky.stars, rand) })
        }
    }

    const glows: Glow[] = []
    if (kind === 'nebula') {
        const big = Math.max(w, h)
        for (let i = 0; i < 5; i++) {
            glows.push({
                x: rand() * w, y: rand() * h, r: big * (0.25 + rand() * 0.35), color: sky.glows[i % sky.glows.length],
                vx: (rand() - 0.5) * 12, vy: (rand() - 0.5) * 8,
            })
        }
    }

    const planets: Planet[] = []
    if (settings.planets && kind !== 'warp') {
        const n = rand() < 0.4 ? 2 : 1
        const small = Math.min(w, h)
        for (let i = 0; i < n; i++) {
            planets.push({
                x: w * (i === 0 ? 0.6 + rand() * 0.3 : 0.1 + rand() * 0.3), y: h * (0.12 + rand() * 0.6),
                r: Math.max(10, small * (i === 0 ? 0.05 + rand() * 0.04 : 0.025 + rand() * 0.02)),
                color: pick(sky.planets, rand), vx: -(1.5 + rand() * 1.5), ring: i === 0 ? rand() < 0.6 : false, tilt: -0.35 + rand() * 0.2,
            })
        }
    }

    return { kind, speed: settings.speed, w, h, sky, stars, dust, band, glows, planets, meteors: [], shootingStars: settings.shootingStars && kind !== 'warp' }
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
    for (const p of s.planets) {
        p.x += p.vx * f * dt
        if (p.x < -p.r * 3) p.x = s.w + p.r * 3
    }

    for (const m of s.meteors) { m.x += m.vx * dt; m.y += m.vy * dt; m.age += dt }
    s.meteors = s.meteors.filter(m => m.age < m.life)
    if (s.shootingStars && rand() < dt / METEOR_EVERY * (0.6 + 0.4 * f)) {
        const angle = Math.PI * (0.62 + rand() * 0.16)   // heading down and to the left
        const speed = 550 + rand() * 350
        s.meteors.push({
            x: s.w * (0.3 + rand() * 0.7), y: s.h * rand() * 0.45, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            age: 0, life: 0.6 + rand() * 0.5, color: s.sky.stars[0],
        })
    }
}

function rgba(hex: string, alpha: number) {
    const n = parseInt(hex.slice(1), 16)
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** Mixes a color toward white (amount > 0) or black (amount < 0). */
function shade(hex: string, amount: number) {
    const n = parseInt(hex.slice(1), 16)
    const to = amount > 0 ? 255 : 0, k = Math.abs(amount)
    const mix = (c: number) => Math.round(c + (to - c) * k)
    return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`
}

/** The parts that never move: the sky, the Milky Way band and its star dust. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, s: SceneState) {
    const { w, h, sky } = s
    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, sky.top)
    bg.addColorStop(1, sky.bottom)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    if (s.band) {
        const r = Math.min(w, h) * 0.32
        for (let i = 0; i < BAND_BLOBS; i++) {
            const t = i / (BAND_BLOBS - 1)
            const x = s.band.x1 + (s.band.x2 - s.band.x1) * t, y = s.band.y1 + (s.band.y2 - s.band.y1) * t
            const color = sky.glows[i % sky.glows.length]
            const g = ctx.createRadialGradient(x, y, 0, x, y, r)
            g.addColorStop(0, rgba(color, sky.bandAlpha * 1.6))
            g.addColorStop(0.5, rgba(sky.stars[1] ?? color, sky.bandAlpha * 0.5))
            g.addColorStop(1, rgba(color, 0))
            ctx.fillStyle = g
            ctx.fillRect(x - r, y - r, r * 2, r * 2)
        }
    }

    for (const d of s.dust) {
        ctx.globalAlpha = d.a * sky.starAlpha
        ctx.fillStyle = d.color
        ctx.fillRect(d.x, d.y, 0.8, 0.8)
    }
    ctx.globalAlpha = 1
}

function drawPlanet(ctx: CanvasRenderingContext2D, p: Planet, sky: SkyColors) {
    const ring = (from: number, to: number) => {
        ctx.strokeStyle = rgba(p.color, 0.55)
        ctx.lineWidth = Math.max(1.5, p.r * 0.14)
        ctx.beginPath()
        ctx.ellipse(p.x, p.y, p.r * 2, p.r * 0.5, p.tilt, from, to)
        ctx.stroke()
    }
    ctx.globalAlpha = sky.starAlpha
    // A faint haze of atmosphere
    const haze = ctx.createRadialGradient(p.x, p.y, p.r * 0.9, p.x, p.y, p.r * 1.5)
    haze.addColorStop(0, rgba(p.color, 0.25))
    haze.addColorStop(1, rgba(p.color, 0))
    ctx.fillStyle = haze
    ctx.fillRect(p.x - p.r * 1.5, p.y - p.r * 1.5, p.r * 3, p.r * 3)
    if (p.ring) ring(Math.PI, Math.PI * 2)                 // the part behind the planet
    // Lit from the upper left, in shadow on the lower right
    const body = ctx.createRadialGradient(p.x - p.r * 0.4, p.y - p.r * 0.4, p.r * 0.1, p.x, p.y, p.r)
    body.addColorStop(0, shade(p.color, 0.45))
    body.addColorStop(0.55, p.color)
    body.addColorStop(1, shade(p.color, -sky.planetShadow))
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fill()
    if (p.ring) ring(0, Math.PI)                           // the part in front
    ctx.globalAlpha = 1
}

/** Paints one frame. */
export function drawScene(ctx: CanvasRenderingContext2D, s: SceneState) {
    const { w, h, sky } = s
    if (s.backdrop) ctx.drawImage(s.backdrop, 0, 0, w, h)
    else drawBackdrop(ctx, s)

    for (const g of s.glows) {
        const rg = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r)
        rg.addColorStop(0, rgba(g.color, sky.glowAlpha))
        rg.addColorStop(1, rgba(g.color, 0))
        ctx.fillStyle = rg
        ctx.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2)
    }

    for (const p of s.planets) drawPlanet(ctx, p, sky)

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
        if (st.bright) {
            const glow = st.size * 7
            ctx.globalAlpha = sky.starAlpha * (0.5 + 0.5 * twinkle)
            const halo = ctx.createRadialGradient(st.x, st.y, 0, st.x, st.y, glow)
            halo.addColorStop(0, rgba(st.color, 0.45))
            halo.addColorStop(1, rgba(st.color, 0))
            ctx.fillStyle = halo
            ctx.fillRect(st.x - glow, st.y - glow, glow * 2, glow * 2)
            // A soft four-point sparkle
            const spike = st.size * (4 + 2 * twinkle)
            ctx.lineWidth = 0.6
            ctx.globalAlpha = sky.starAlpha * 0.55 * twinkle
            ctx.beginPath()
            ctx.moveTo(st.x - spike, st.y); ctx.lineTo(st.x + spike, st.y)
            ctx.moveTo(st.x, st.y - spike); ctx.lineTo(st.x, st.y + spike)
            ctx.stroke()
            ctx.fillStyle = st.color
            ctx.globalAlpha = sky.starAlpha
        } else {
            ctx.globalAlpha = sky.starAlpha * twinkle * (0.45 + st.z * 0.55)
        }
        ctx.beginPath()
        ctx.arc(st.x, st.y, st.size, 0, Math.PI * 2)
        ctx.fill()
    }

    for (const m of s.meteors) {
        const fade = Math.sin(Math.PI * Math.min(1, m.age / m.life))   // brightens, then fades
        const tail = 0.16                                             // seconds of travel shown as the tail
        const tx = m.x - m.vx * tail, ty = m.y - m.vy * tail
        const g = ctx.createLinearGradient(m.x, m.y, tx, ty)
        g.addColorStop(0, rgba(m.color, sky.starAlpha * fade))
        g.addColorStop(1, rgba(m.color, 0))
        ctx.globalAlpha = 1
        ctx.strokeStyle = g
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(m.x, m.y)
        ctx.lineTo(tx, ty)
        ctx.stroke()
    }
    ctx.globalAlpha = 1
}
