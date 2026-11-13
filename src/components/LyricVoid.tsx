import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import '@fontsource-variable/inter'
import { fetchLyrics, LyricLine } from '../services/lyrics'
import { buildLines, DEMO_LYRICS, fmtTime as fmt } from '../services/lyricAnalysis'
import { ColorPalette } from '../types/spotify'
import type { SpotifyDeviceSource } from './MP3Player3D'
import { Disc, Sync } from './shared/RecordDisc'

/**
 * Lyric Void - "Editorial" design.
 *
 * Design rules (so it stays a system, not a pile of effects):
 *  1. The record is the hero, the lyrics are its voice. Disc on one side, lyrics on the other,
 *     they never overlap.
 *  2. One type system: Inter, sentence case, three states per line (active / next / past).
 *  3. One motion language: a single easing curve, ~600ms, for every transition.
 *  4. Colour comes from the album: two toned-down palette colours drifting slowly, white text.
 *  5. Dynamics, not decoration: verses are calm. Only the chorus (lines that repeat in the
 *     lyrics) gets extra energy: bigger line, glow, faster disc, brighter halo.
 *  6. Chrome is minimal and fades away; every state (loading / no lyrics / preview) is designed.
 */

/* ------------------------------------------------------------------------------------------ */
/* data                                                                                        */
/* ------------------------------------------------------------------------------------------ */

function tone(hex: string, minSat: number, light: number) {
  try {
    const hsl = { h: 0, s: 0, l: 0 }
    new THREE.Color(hex).getHSL(hsl, THREE.SRGBColorSpace)
    return `hsl(${Math.round(hsl.h * 360)} ${Math.round(Math.max(hsl.s, minSat) * 100)}% ${Math.round(light * 100)}%)`
  } catch {
    return `hsl(260 50% ${Math.round(light * 100)}%)`
  }
}

/* ------------------------------------------------------------------------------------------ */
/* styles                                                                                      */
/* ------------------------------------------------------------------------------------------ */

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

const CSS = `
@property --lv-c1 { syntax: '<color>'; inherits: true; initial-value: #14121c; }
@property --lv-c2 { syntax: '<color>'; inherits: true; initial-value: #0e1420; }
.lv-root { position: relative; width: 100%; height: 100%; overflow: hidden; background: #07070a; color: #fff;
  font-family: 'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', sans-serif; -webkit-font-smoothing: antialiased; }
.lv-bg { position: absolute; inset: 0; transition: --lv-c1 1.6s ${EASE}, --lv-c2 1.6s ${EASE};
  background:
    radial-gradient(60% 80% at 22% 40%, var(--lv-c1) 0%, transparent 72%),
    radial-gradient(55% 75% at 88% 88%, var(--lv-c2) 0%, transparent 72%), #07070a;
  background-size: 150% 150%, 150% 150%, auto; animation: lv-drift 50s ease-in-out infinite alternate; }
.lv-bg::after { content: ''; position: absolute; inset: 0; background: radial-gradient(120% 100% at 50% 40%, transparent 55%, rgba(0,0,0,0.5) 100%); }
@keyframes lv-drift { from { background-position: 0% 0%, 100% 100%, 0 0; } to { background-position: 100% 60%, 0% 20%, 0 0; } }
.lv-canvas { position: absolute; inset: 0; }
.lv-lyrics { position: absolute; top: 0; bottom: 120px; left: 47%; right: 5%; overflow: hidden;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 16%, #000 80%, transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0, #000 16%, #000 80%, transparent 100%); }
.lv-track { position: absolute; left: 0; right: 0; top: 0; will-change: transform; transition: transform 700ms ${EASE}; }
.lv-line { margin: 0 0 0.5em; font-size: clamp(26px, 3.3vw, 52px); line-height: 1.14; font-weight: 800; letter-spacing: -0.028em;
  transform-origin: 0 60%; opacity: 0; transform: scale(0.92);
  transition: opacity 600ms ${EASE}, transform 600ms ${EASE}, filter 600ms ${EASE}; will-change: opacity, transform; text-wrap: balance; }
.lv-line.lv-active { color: transparent; background-clip: text; -webkit-background-clip: text;
  background-image: linear-gradient(90deg, #fff 0, #fff calc(var(--p, 0) * 100%), rgba(255,255,255,0.45) calc(var(--p, 0) * 100%)); }
.lv-line:not(.lv-active) { color: #fff; }
.lv-line.lv-active { transform: scale(1); }
.lv-line.lv-chorus.lv-active { transform: scale(1.06); filter: drop-shadow(0 0 22px var(--lv-accent)); }
.lv-dots { display: inline-flex; gap: 0.32em; height: 1em; align-items: center; }
.lv-dots i { width: 0.34em; height: 0.34em; border-radius: 50%; background: #fff; animation: lv-breathe 1.6s ease-in-out infinite; }
.lv-dots i:nth-child(2) { animation-delay: 0.2s; } .lv-dots i:nth-child(3) { animation-delay: 0.4s; }
@keyframes lv-breathe { 0%, 100% { opacity: 0.25; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.1); } }
.lv-state { position: absolute; top: 0; bottom: 120px; left: 47%; right: 5%; display: flex; flex-direction: column; justify-content: center; }
.lv-state h2 { margin: 0; font-size: clamp(26px, 3.3vw, 52px); font-weight: 800; letter-spacing: -0.028em; line-height: 1.12; }
.lv-state p { margin: 0.7em 0 0; font-size: 16px; font-weight: 500; color: rgba(255,255,255,0.6); }
.lv-chip { position: absolute; top: 24px; left: 50%; transform: translateX(-50%); white-space: nowrap; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; padding: 7px 12px;
  border-radius: 999px; background: rgba(255,255,255,0.1); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); color: rgba(255,255,255,0.85); }
.lv-bar { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 28px 22px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px;
  background: linear-gradient(to top, rgba(0,0,0,0.5), transparent); transition: opacity 500ms ${EASE}; }
.lv-bar.lv-hidden { opacity: 0; pointer-events: none; }
.lv-meta { min-width: 0; } .lv-meta b { display: block; font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lv-meta span { display: block; font-size: 13px; color: rgba(255,255,255,0.62); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lv-ctrl { display: flex; align-items: center; gap: 12px; }
.lv-btn { width: 40px; height: 40px; border-radius: 50%; border: 0; background: transparent; color: #fff; display: grid; place-items: center; cursor: pointer; opacity: 0.8; transition: opacity 200ms, transform 200ms; }
.lv-btn:hover { opacity: 1; transform: scale(1.08); } .lv-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.lv-btn.lv-play { width: 52px; height: 52px; background: #fff; color: #0b0b10; opacity: 1; }
.lv-time { justify-self: end; font-size: 12px; font-variant-numeric: tabular-nums; color: rgba(255,255,255,0.62); }
.lv-prog { position: absolute; left: 28px; right: 28px; bottom: 92px; height: 3px; background: rgba(255,255,255,0.2); border-radius: 2px; overflow: hidden; transition: opacity 500ms ${EASE}; }
.lv-prog.lv-hidden { opacity: 0; }
.lv-prog i { display: block; height: 100%; width: 0; background: #fff; border-radius: 2px; }
@media (max-width: 820px) {
  .lv-lyrics, .lv-state { left: 6%; right: 6%; top: 46%; bottom: 128px; }
  .lv-line, .lv-state h2 { font-size: clamp(22px, 6.4vw, 34px); }
  .lv-bar { grid-template-columns: 1fr auto; padding: 0 18px 18px; } .lv-time { display: none; } .lv-prog { left: 18px; right: 18px; }
  .lv-chip { top: 76px; }
}
@media (prefers-reduced-motion: reduce) {
  .lv-bg { animation: none; } .lv-track, .lv-line { transition-duration: 1ms; } .lv-dots i { animation: none; opacity: 0.8; }
}
`

/* ------------------------------------------------------------------------------------------ */
/* icons                                                                                       */
/* ------------------------------------------------------------------------------------------ */

const Icon = {
  prev: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h2v14H6zM20 5v14L9 12z" />
    </svg>
  ),
  next: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16 5h2v14h-2zM4 5v14l11-7z" />
    </svg>
  ),
  play: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  pause: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* main component                                                                              */
/* ------------------------------------------------------------------------------------------ */

export const LyricVoid: React.FC<{
  spotify: SpotifyDeviceSource
  colors: ColorPalette
  albumArtUrl?: string
}> = ({ spotify, colors, albumArtUrl }) => {
  const item = spotify.currentTrack?.item ?? null
  const demo = !item
  const reduced = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, [])

  /* lyrics ---------------------------------------------------------------------------------- */
  const [raw, setRaw] = useState<LyricLine[] | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'none'>('loading')
  useEffect(() => {
    let alive = true
    setRaw(null)
    if (!item) return
    setStatus('loading')
    fetchLyrics(item.artists?.[0]?.name || '', item.name || '', item.album?.name || '', item.duration_ms || 0)
      .then((r) => {
        if (!alive) return
        setRaw(r)
        setStatus(r && r.length ? 'ready' : 'none')
      })
      .catch(() => alive && setStatus('none'))
    return () => {
      alive = false
    }
  }, [item?.id])

  const lines = useMemo(() => buildLines(demo ? DEMO_LYRICS : raw || []), [demo, raw])
  const showLyrics = demo || status === 'ready'

  /* album art ------------------------------------------------------------------------------- */
  const [art, setArt] = useState<HTMLImageElement | null>(null)
  const [artVersion, setArtVersion] = useState(0)
  useEffect(() => {
    if (!albumArtUrl) {
      setArt(null)
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setArtVersion((v) => v + 1)
    img.src = albumArtUrl
    setArt(img)
  }, [albumArtUrl])

  /* palette --------------------------------------------------------------------------------- */
  const c1 = useMemo(() => tone(colors.primary, 0.42, 0.3), [colors.primary])
  const c2 = useMemo(() => tone(colors.secondary, 0.38, 0.22), [colors.secondary])
  const accent = colors.glow || colors.accent || '#ffffff'

  /* clock ----------------------------------------------------------------------------------- */
  const sync = useRef<Sync>({ playing: true, energy: 0, kick: 0, px: 0, py: 0, reduced })
  const [idx, setIdx] = useState(-1)
  const [demoPaused, setDemoPaused] = useState(false)
  const stateRef = useRef({ lines, idx: -1, demoT: 0, last: performance.now(), demoPaused: false, receivedAt: performance.now(), progress: 0, duration: 0 })
  stateRef.current.lines = lines
  stateRef.current.demoPaused = demoPaused
  useEffect(() => {
    stateRef.current.receivedAt = performance.now()
  }, [spotify.currentTrack])
  const track = spotify.currentTrack
  const liveRef = useRef({ track, demo })
  liveRef.current = { track, demo }

  const lineEls = useRef<(HTMLDivElement | null)[]>([])
  const barEl = useRef<HTMLElement | null>(null)
  const elapsedEl = useRef<HTMLSpanElement>(null)
  const totalEl = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let raf = 0
    let lastLabel = 0
    const tick = () => {
      const now = performance.now()
      const s = stateRef.current
      const { track: t, demo: isDemo } = liveRef.current
      const ls = s.lines
      let progress: number
      let duration: number
      let playing: boolean
      if (isDemo) {
        duration = (DEMO_LYRICS[DEMO_LYRICS.length - 1].timeMs || 0) + 8000
        if (!s.demoPaused) s.demoT = (s.demoT + (now - s.last)) % duration
        progress = s.demoT
        playing = !s.demoPaused
      } else {
        duration = t?.item?.duration_ms ?? 0
        progress = (t?.progress_ms ?? 0) + (t?.is_playing ? now - s.receivedAt : 0)
        if (duration) progress = Math.min(progress, duration)
        playing = !!t?.is_playing
      }
      s.last = now
      s.progress = progress
      s.duration = duration
      sync.current.playing = playing

      // current line
      let i = -1
      const p = progress + 120
      for (let k = 0; k < ls.length; k++) if (ls[k].timeMs <= p) i = k
      if (i !== s.idx) {
        s.idx = i
        setIdx(i)
        if (i >= 0 && ls[i].chorus) sync.current.kick += 1.6
        // energy: chorus = peak, the line before a chorus = a little build
        sync.current.energy = i >= 0 && ls[i].chorus ? 1 : i + 1 < ls.length && ls[i + 1].chorus ? 0.3 : 0
      }

      // karaoke-style fill of the active line
      if (i >= 0) {
        const el = lineEls.current[i]
        if (el && !ls[i].dots) {
          const end = ls[i + 1] ? ls[i + 1].timeMs : ls[i].timeMs + 4000
          const fillMs = Math.min(6000, Math.max(900, (end - ls[i].timeMs) * 0.85))
          el.style.setProperty('--p', String(Math.min(1, Math.max(0, (progress - ls[i].timeMs) / fillMs))))
        }
      }

      if (barEl.current) barEl.current.style.width = `${duration ? (progress / duration) * 100 : 0}%`
      if (now - lastLabel > 250) {
        lastLabel = now
        if (elapsedEl.current) elapsedEl.current.textContent = fmt(progress)
        if (totalEl.current) totalEl.current.textContent = fmt(duration)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // reset the demo / index when the lyrics change
  useEffect(() => {
    stateRef.current.idx = -2
    if (demo) stateRef.current.demoT = 0
  }, [lines, demo])

  /* lyric column layout ---------------------------------------------------------------------- */
  const colRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [layoutTick, setLayoutTick] = useState(0)
  useEffect(() => {
    const el = colRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setLayoutTick((n) => n + 1))
    ro.observe(el)
    return () => ro.disconnect()
  }, [showLyrics])
  useLayoutEffect(() => {
    const col = colRef.current
    const tr = trackRef.current
    if (!col || !tr) return
    const el = lineEls.current[Math.max(0, idx)]
    if (!el) return
    const center = col.clientHeight * 0.42
    tr.style.transform = `translateY(${center - (el.offsetTop + el.offsetHeight / 2)}px)`
  }, [idx, lines, layoutTick, showLyrics])

  /* controls: auto-hide, keyboard, pointer parallax ------------------------------------------ */
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    let timer = 0
    const wake = () => {
      setIdle(false)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setIdle(true), 3200)
    }
    const move = (e: PointerEvent) => {
      sync.current.px = (e.clientX / window.innerWidth) * 2 - 1
      sync.current.py = (e.clientY / window.innerHeight) * 2 - 1
      wake()
    }
    wake()
    window.addEventListener('pointermove', move)
    window.addEventListener('keydown', wake)
    window.addEventListener('touchstart', wake)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('keydown', wake)
      window.removeEventListener('touchstart', wake)
    }
  }, [])

  const playing = demo ? !demoPaused : !!track?.is_playing
  const togglePlay = useCallback(() => {
    if (liveRef.current.demo) setDemoPaused((p) => !p)
    else void spotify.togglePlay()
  }, [spotify])
  const jump = useCallback(
    (dir: -1 | 1) => {
      if (!liveRef.current.demo) {
        void (dir > 0 ? spotify.skipNext() : spotify.skipPrev())
        return
      }
      const s = stateRef.current
      const real = s.lines.map((l, k) => ({ l, k })).filter((x) => !x.l.dots)
      const cur = Math.max(0, s.idx)
      const cand = dir > 0 ? real.find((x) => x.k > cur) : [...real].reverse().find((x) => x.k < cur)
      if (cand) s.demoT = cand.l.timeMs
    },
    [spotify]
  )
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (e.code === 'ArrowRight') jump(1)
      else if (e.code === 'ArrowLeft') jump(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, jump])

  /* render ----------------------------------------------------------------------------------- */
  const lineStyle = (i: number): React.CSSProperties => {
    const d = i - idx
    const opacity = d === 0 ? 1 : d === 1 ? 0.5 : d === 2 ? 0.3 : d === 3 ? 0.16 : d === -1 ? 0.26 : d === -2 ? 0.1 : 0
    const scale = d === 0 ? 1 : 0.92
    const blur = d === 0 ? 0 : Math.min(2.5, Math.abs(d) * 0.7)
    return { opacity, transform: d === 0 ? undefined : `scale(${scale})`, filter: blur && d !== 0 ? `blur(${blur}px)` : undefined, pointerEvents: 'none' }
  }

  const title = item?.name ?? 'Lyric Void'
  const artist = item?.artists?.map((a) => a.name).join(', ') ?? 'Preview mode'

  return (
    <div className="lv-root" style={{ ['--lv-accent' as string]: accent }}>
      <style>{CSS}</style>
      <div className="lv-bg" style={{ ['--lv-c1' as string]: c1, ['--lv-c2' as string]: c2 }} />
      <div className="lv-canvas" aria-hidden>
        <Canvas camera={{ position: [0, 0, 12], fov: 30 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }} style={{ width: '100%', height: '100%', background: 'transparent' }}>
          <React.Suspense fallback={null}>
            <Environment resolution={128} frames={1}>
              <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 5, 5]} scale={[10, 2, 1]} />
              <Lightformer form="rect" intensity={2} color="#ffffff" position={[-6, 0, 3]} scale={[2, 8, 1]} />
              <Lightformer form="rect" intensity={1.5} color="#dfe8ff" position={[6, -1, 2]} scale={[2, 8, 1]} />
            </Environment>
            <Disc sync={sync} art={art} artVersion={artVersion} accent={accent} />
          </React.Suspense>
        </Canvas>
      </div>

      {showLyrics ? (
        <div className="lv-lyrics" ref={colRef} role="region" aria-label="Lyrics" aria-live="polite">
          <div className="lv-track" ref={trackRef}>
            {lines.map((l, i) => (
              <div
                key={`${i}-${l.timeMs}`}
                ref={(el) => {
                  lineEls.current[i] = el
                }}
                className={`lv-line${i === idx ? ' lv-active' : ''}${l.chorus ? ' lv-chorus' : ''}`}
                style={lineStyle(i)}
                aria-current={i === idx ? 'true' : undefined}
              >
                {l.dots ? (
                  <span className="lv-dots" aria-label="Instrumental">
                    <i />
                    <i />
                    <i />
                  </span>
                ) : (
                  l.text
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="lv-state">
          <h2>{status === 'loading' ? 'Finding lyrics…' : title}</h2>
          <p>{status === 'loading' ? `${title} · ${artist}` : "No synced lyrics for this song yet. Enjoy the record."}</p>
        </div>
      )}

      {demo && <div className="lv-chip">Preview · connect Spotify for live lyrics</div>}

      <div className={`lv-prog${idle && playing ? ' lv-hidden' : ''}`}>
        <i ref={barEl} />
      </div>
      <div className={`lv-bar${idle && playing ? ' lv-hidden' : ''}`}>
        <div className="lv-meta">
          <b>{title}</b>
          <span>{artist}</span>
        </div>
        <div className="lv-ctrl">
          <button className="lv-btn" onClick={() => jump(-1)} aria-label="Previous">
            {Icon.prev}
          </button>
          <button className="lv-btn lv-play" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? Icon.pause : Icon.play}
          </button>
          <button className="lv-btn" onClick={() => jump(1)} aria-label="Next">
            {Icon.next}
          </button>
        </div>
        <div className="lv-time">
          <span ref={elapsedEl}>0:00</span> / <span ref={totalEl}>0:00</span>
        </div>
      </div>
    </div>
  )
}

export default LyricVoid
