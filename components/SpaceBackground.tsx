// The moving space background behind every screen. Chosen in Settings → Moving background.
// On the web (the app on Netlify, including on phones) it's animated on a canvas. In the native
// phone app it's a still starry sky. It never takes taps and screen readers skip it.
import { createElement, useEffect, useMemo, useRef } from 'react'
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native'
import { useTheme } from '../lib/theme'
import { skyColors, type BackgroundSettings, type SkyColors } from '../lib/background'
import { createScene, stepScene, drawScene, drawBackdrop, seededRandom, type SceneState } from '../lib/spaceScene'

const FRAME_MS = 33   // about 30 frames a second: smooth enough, and easy on the battery

export function SpaceBackground() {
    const { background, scheme } = useTheme()
    const sky = useMemo(() => skyColors(scheme, background.tint), [scheme, background.tint])
    if (background.scene === 'off') return null
    return (
        <View
            testID="space-background"
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            aria-hidden
            style={[StyleSheet.absoluteFill, { backgroundColor: sky.top }]}
        >
            {Platform.OS === 'web' ? <AnimatedSky settings={background} sky={sky} /> : <StillSky settings={background} sky={sky} />}
        </View>
    )
}

/** Web: draws and moves the scene on a canvas. Stays still if the device asks for reduced motion. */
function AnimatedSky({ settings, sky }: { settings: BackgroundSettings; sky: SkyColors }) {
    const ref = useRef<HTMLCanvasElement | null>(null)

    useEffect(() => {
        const canvas = ref.current
        const ctx = canvas?.getContext?.('2d')
        if (!canvas || !ctx) return
        let scene: SceneState
        let raf = 0
        let last = 0

        const size = () => ({ w: canvas.clientWidth || window.innerWidth, h: canvas.clientHeight || window.innerHeight })
        const dpr = () => Math.min(window.devicePixelRatio || 1, 2)
        const fit = (w: number, h: number) => {
            canvas.width = Math.round(w * dpr())
            canvas.height = Math.round(h * dpr())
            ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0)
        }
        const build = () => {
            const { w, h } = size()
            fit(w, h)
            scene = createScene(settings, sky, w, h)
            // The sky, Milky Way and star dust never move: paint them once and reuse them every frame
            const still = document.createElement('canvas')
            still.width = canvas.width
            still.height = canvas.height
            const sctx = still.getContext('2d')
            if (sctx) {
                sctx.setTransform(dpr(), 0, 0, dpr(), 0, 0)
                drawBackdrop(sctx, scene)
                scene.backdrop = still
            }
            drawScene(ctx, scene)
        }

        const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
        const frame = (t: number) => {
            raf = requestAnimationFrame(frame)
            if (last && t - last < FRAME_MS) return
            const dt = last ? Math.min((t - last) / 1000, 0.1) : 0   // a hidden tab doesn't jump ahead
            last = t
            stepScene(scene, dt)
            drawScene(ctx, scene)
        }
        const start = () => {
            cancelAnimationFrame(raf)
            last = 0
            if (!motion?.matches) raf = requestAnimationFrame(frame)
        }

        // Small size changes (a phone's address bar hiding) keep the same sky; big ones start a new one
        const onResize = () => {
            const { w, h } = size()
            if (Math.abs(w - scene.w) / scene.w > 0.2 || Math.abs(h - scene.h) / scene.h > 0.2) build()
            else { fit(w, h); scene.w = w; scene.h = h; drawScene(ctx, scene) }
        }

        build()
        start()
        window.addEventListener('resize', onResize)
        motion?.addEventListener?.('change', start)
        return () => {
            cancelAnimationFrame(raf)
            window.removeEventListener('resize', onResize)
            motion?.removeEventListener?.('change', start)
        }
    }, [settings.scene, settings.speed, settings.amount, settings.shootingStars, settings.planets, sky])

    return createElement('canvas', { ref, style: { width: '100%', height: '100%', display: 'block' } })
}

/** Native app: a still sky with the same stars and clouds. */
function StillSky({ settings, sky }: { settings: BackgroundSettings; sky: SkyColors }) {
    const { width, height } = useWindowDimensions()
    const scene = useMemo(() => createScene({ ...settings, scene: settings.scene === 'warp' ? 'stars' : settings.scene },
        sky, width, height, seededRandom(42)), [settings.scene, settings.amount, settings.planets, sky, width, height])
    return (
        <>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: sky.bottom, opacity: 0.6, top: '50%' }]} />
            {scene.glows.map((g, i) => (
                <View key={`g${i}`} style={{
                    position: 'absolute', left: g.x - g.r / 2, top: g.y - g.r / 2, width: g.r, height: g.r,
                    borderRadius: g.r / 2, backgroundColor: g.color, opacity: sky.glowAlpha * 0.5,
                }} />
            ))}
            {scene.planets.map((p, i) => (
                <View key={`p${i}`} style={{
                    position: 'absolute', left: p.x - p.r, top: p.y - p.r, width: p.r * 2, height: p.r * 2,
                    borderRadius: p.r, backgroundColor: p.color, opacity: sky.starAlpha,
                }} />
            ))}
            {scene.stars.map((st, i) => (
                <View key={i} style={{
                    position: 'absolute', left: st.x, top: st.y, width: st.size * 2, height: st.size * 2,
                    borderRadius: st.size, backgroundColor: st.color, opacity: sky.starAlpha * (0.45 + st.z * 0.55),
                }} />
            ))}
        </>
    )
}
