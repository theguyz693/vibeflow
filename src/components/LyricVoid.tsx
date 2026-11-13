import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { fetchLyrics, LyricLine } from '../services/lyrics'
import { ColorPalette } from '../types/spotify'
import type { SpotifyDeviceSource } from './MP3Player3D'

/**
 * "Lyric Void" mode: a pitch-black room with a few glowing floating screens.
 * One screen is the player (album art + progress), the others receive the current
 * lyric line as kinetic typography. The camera glides to whichever screen is "live".
 */

interface Slot {
  pos: [number, number, number]
  rotY: number
  rotZ: number
  w: number
  h: number
}

// Slot 0 is always the player. Slots 1.. are lyric screens, used round-robin.
const SLOTS: Slot[] = [
  { pos: [-2.6, 0.2, 0], rotY: 0.42, rotZ: 0.03, w: 3.6, h: 2.25 },
  { pos: [1.9, -0.5, -0.8], rotY: -0.38, rotZ: -0.05, w: 3.0, h: 1.7 },
  { pos: [0.3, 1.5, -3.2], rotY: 0.08, rotZ: 0.06, w: 3.4, h: 1.9 },
  { pos: [4.6, 0.9, -3.0], rotY: -0.62, rotZ: 0.04, w: 3.0, h: 1.7 },
  { pos: [-4.8, -0.9, -3.6], rotY: 0.55, rotZ: -0.04, w: 3.0, h: 1.7 }
]

const DEMO_LYRICS: LyricLine[] = [
  'girl you look beautiful tonight',
  'stars on the ceiling',
  'all VVS',
  'music like this',
  'stay in the glow',
  'one more time'
].map((text, i) => ({ timeMs: i * 2600, text }))

const FONT = '900 {S}px "Arial Black", Impact, "Helvetica Neue", sans-serif'

function makeTexture(w: number, h: number) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return { canvas, ctx: canvas.getContext('2d')!, tex }
}

function frame(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string, bg: string) {
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = accent
  ctx.lineWidth = 10
  ctx.shadowColor = accent
  ctx.shadowBlur = 28
  ctx.strokeRect(5, 5, w - 10, h - 10)
  ctx.shadowBlur = 0
}

/** Fit words into lines no wider than maxW, shrinking the font until it fits maxH. */
function layoutText(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxH: number) {
  let size = 220
  let lines: string[] = []
  for (; size > 40; size -= 12) {
    ctx.font = FONT.replace('{S}', String(size))
    lines = []
    let cur = ''
    for (const word of text.split(/\s+/)) {
      const test = cur ? `${cur} ${word}` : word
      if (ctx.measureText(test).width > maxW && cur) {
        lines.push(cur)
        cur = word
      } else cur = test
    }
    if (cur) lines.push(cur)
    if (lines.length * size * 0.95 <= maxH) break
  }
  return { size, lines }
}

function drawLyric(
  tex: ReturnType<typeof makeTexture>,
  text: string,
  accent: string,
  bg: string,
  seed: number
) {
  const { ctx, canvas } = tex
  const { width: w, height: h } = canvas
  frame(ctx, w, h, accent, bg)
  const { size, lines } = layoutText(ctx, text.toUpperCase(), w * 0.84, h * 0.78)
  ctx.font = FONT.replace('{S}', String(size))
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lh = size * 0.95
  const y0 = h / 2 - ((lines.length - 1) * lh) / 2
  lines.forEach((line, i) => {
    // Slight per-line tilt + offset, like the stacked typography in the reference clip.
    const r = Math.sin(seed * 12.9898 + i * 4.1) * 0.5
    ctx.save()
    ctx.translate(w / 2 + r * 40, y0 + i * lh)
    ctx.rotate(r * 0.05)
    ctx.shadowColor = accent
    ctx.shadowBlur = 36
    ctx.fillStyle = i % 2 === 0 ? accent : '#ffffff'
    ctx.fillText(line, 0, 0)
    ctx.restore()
  })
  tex.tex.needsUpdate = true
}

function drawPlayer(
  tex: ReturnType<typeof makeTexture>,
  art: HTMLImageElement | null,
  title: string,
  artist: string,
  progress: number,
  playing: boolean,
  accent: string,
  bg: string
) {
  const { ctx, canvas } = tex
  const { width: w, height: h } = canvas
  frame(ctx, w, h, accent, bg)
  if (art && art.complete && art.naturalWidth) {
    ctx.save()
    ctx.globalAlpha = 0.9
    // cover-fit the art so the screen looks like a zoomed album, like the video.
    const s = Math.max(w / art.naturalWidth, h / art.naturalHeight) * 1.05
    ctx.drawImage(art, (w - art.naturalWidth * s) / 2, (h - art.naturalHeight * s) / 2, art.naturalWidth * s, art.naturalHeight * s)
    ctx.restore()
  }
  const grad = ctx.createLinearGradient(0, h * 0.55, 0, h)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(1, 'rgba(0,0,0,0.85)')
  ctx.fillStyle = grad
  ctx.fillRect(0, h * 0.55, w, h * 0.45)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#fff'
  ctx.font = '800 54px "Helvetica Neue", Arial, sans-serif'
  ctx.fillText(title.slice(0, 34), 48, h - 118)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '500 34px "Helvetica Neue", Arial, sans-serif'
  ctx.fillText(artist.slice(0, 44), 48, h - 72)
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.fillRect(48, h - 40, w - 96, 6)
  ctx.fillStyle = accent
  ctx.fillRect(48, h - 40, (w - 96) * Math.min(1, Math.max(0, progress)), 6)
  // play / pause glyph
  ctx.fillStyle = '#fff'
  if (playing) {
    ctx.fillRect(w - 96, 48, 12, 40)
    ctx.fillRect(w - 74, 48, 12, 40)
  } else {
    ctx.beginPath()
    ctx.moveTo(w - 96, 48)
    ctx.lineTo(w - 62, 68)
    ctx.lineTo(w - 96, 88)
    ctx.fill()
  }
  tex.tex.needsUpdate = true
}

interface VoidSceneProps {
  spotify: SpotifyDeviceSource
  colors: ColorPalette
  albumArtUrl?: string
}

function VoidScene({ spotify, colors, albumArtUrl }: VoidSceneProps) {
  const accent = colors.accent || colors.primary || '#facc15'
  const bg = '#050505'

  const textures = useMemo(
    () =>
      SLOTS.map((s, i) => makeTexture(i === 0 ? 1280 : 1024, Math.round((i === 0 ? 1280 : 1024) * (s.h / s.w)))),
    []
  )
  useEffect(() => () => textures.forEach((t) => t.tex.dispose()), [textures])

  // --- lyrics -------------------------------------------------------------------------------
  const item = spotify.currentTrack?.item
  const [lyrics, setLyrics] = useState<LyricLine[] | null>(null)
  useEffect(() => {
    let alive = true
    setLyrics(null)
    if (!item) return
    fetchLyrics(item.artists?.[0]?.name || '', item.name || '', item.album?.name || '', item.duration_ms || 0)
      .then((r) => alive && setLyrics(r))
      .catch(() => alive && setLyrics(null))
    return () => {
      alive = false
    }
  }, [item?.id])

  // --- album art ----------------------------------------------------------------------------
  const artRef = useRef<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!albumArtUrl) {
      artRef.current = null
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = albumArtUrl
    artRef.current = img
  }, [albumArtUrl])

  // Latest props for use inside the frame loop, plus progress interpolation between polls.
  const live = useRef({ spotify, receivedAt: performance.now(), lyrics, accent })
  live.current.spotify = spotify
  live.current.lyrics = lyrics
  live.current.accent = accent
  useEffect(() => {
    live.current.receivedAt = performance.now()
  }, [spotify.currentTrack])

  // --- animation state ----------------------------------------------------------------------
  const groups = useRef<(THREE.Group | null)[]>([])
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const st = useRef({
    lineIdx: -2,
    active: 0, // slot the camera is looking at
    lineSlot: new Map<number, number>(),
    lastPlayerDraw: 0,
    pop: new Array(SLOTS.length).fill(0) as number[],
    demoStart: performance.now(),
    lastAccent: ''
  })
  const camPos = useMemo(() => new THREE.Vector3(0, 0, 9), [])
  const camLook = useMemo(() => new THREE.Vector3(0, 0, 0), [])
  const tmpPos = useMemo(() => new THREE.Vector3(), [])
  const tmpLook = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, dt) => {
    const s = st.current
    const { spotify: sp, receivedAt, lyrics: ly } = live.current
    const t = sp.currentTrack
    const demo = !t?.item
    const dur = t?.item?.duration_ms ?? DEMO_LYRICS.length * 2600
    let progress = demo ? (performance.now() - s.demoStart) % dur : (t?.progress_ms ?? 0)
    if (!demo && t?.is_playing) progress += performance.now() - receivedAt
    const lines = demo ? DEMO_LYRICS : ly

    // current lyric line
    let idx = -1
    if (lines && lines.length) {
      const p = progress + 150
      for (let i = 0; i < lines.length; i++) if (lines[i].timeMs <= p) idx = i
    }

    const accentChanged = s.lastAccent !== live.current.accent
    if (accentChanged) s.lastAccent = live.current.accent

    if (idx !== s.lineIdx || accentChanged) {
      if (idx !== s.lineIdx) {
        s.lineIdx = idx
        if (idx >= 0 && lines) {
          // round-robin over lyric slots (1..N-1), never the same slot twice in a row
          const lyricSlots = SLOTS.length - 1
          const slot = 1 + (idx % lyricSlots)
          s.lineSlot.set(slot, idx)
          s.active = slot
          s.pop[slot] = 1
        } else {
          s.active = 0
        }
      }
      // (re)draw every lyric screen with its latest line
      for (let slot = 1; slot < SLOTS.length; slot++) {
        const li = s.lineSlot.get(slot)
        const text = li !== undefined && lines && lines[li] ? lines[li].text : '♪'
        drawLyric(textures[slot], text, live.current.accent, bg, li ?? slot)
      }
    }

    // player screen redraws ~10fps (progress bar)
    const now = performance.now()
    if (now - s.lastPlayerDraw > 100 || accentChanged) {
      s.lastPlayerDraw = now
      drawPlayer(
        textures[0],
        artRef.current,
        t?.item?.name ?? 'Lyric Void',
        t?.item?.artists?.map((a) => a.name).join(', ') ?? 'demo mode — play something on Spotify',
        dur ? progress / dur : 0,
        demo ? true : !!t?.is_playing,
        live.current.accent,
        bg
      )
    }

    // dim non-active screens, pop the active one
    SLOTS.forEach((slot, i) => {
      const g = groups.current[i]
      const m = mats.current[i]
      if (!g || !m) return
      const isActive = s.active === i
      const target = isActive ? 1 : 0.28
      const c = THREE.MathUtils.lerp(m.color.r, target, 1 - Math.pow(0.002, dt))
      m.color.setRGB(c, c, c)
      s.pop[i] = Math.max(0, s.pop[i] - dt * 2.2)
      const k = 1 + Math.sin(s.pop[i] * Math.PI) * 0.06 + s.pop[i] * 0.05
      g.scale.setScalar(k)
      // slow float
      g.position.y = slot.pos[1] + Math.sin(state.clock.elapsedTime * 0.5 + i * 1.7) * 0.08
    })

    // camera: sit in front of the active screen, looking at it, with a handheld sway
    const slot = SLOTS[s.active]
    const nx = Math.sin(slot.rotY)
    const nz = Math.cos(slot.rotY)
    const dist = slot.w * 1.25 + 1.2
    const e = state.clock.elapsedTime
    tmpPos.set(
      slot.pos[0] + nx * dist + Math.sin(e * 0.7) * 0.18,
      slot.pos[1] + Math.cos(e * 0.9) * 0.1,
      slot.pos[2] + nz * dist + Math.cos(e * 0.5) * 0.12
    )
    tmpLook.set(slot.pos[0], slot.pos[1], slot.pos[2])
    const f = 1 - Math.pow(0.12, dt)
    camPos.lerp(tmpPos, f)
    camLook.lerp(tmpLook, f)
    state.camera.position.copy(camPos)
    state.camera.lookAt(camLook)
    state.camera.rotation.z += Math.sin(e * 0.6) * 0.012
  })

  return (
    <>
      <color attach="background" args={[bg]} />
      {SLOTS.map((slot, i) => (
        <group
          key={i}
          ref={(g) => {
            groups.current[i] = g
          }}
          position={slot.pos}
          rotation={[0, slot.rotY, slot.rotZ]}
        >
          <mesh>
            <planeGeometry args={[slot.w, slot.h]} />
            <meshBasicMaterial
              ref={(m) => {
                mats.current[i] = m
              }}
              map={textures[i].tex}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </>
  )
}

export const LyricVoid: React.FC<{
  spotify: SpotifyDeviceSource
  colors: ColorPalette
  albumArtUrl?: string
}> = ({ spotify, colors, albumArtUrl }) => (
  <div style={{ width: '100%', height: '100%', background: '#050505' }}>
    <Canvas camera={{ position: [0, 0, 9], fov: 50 }} dpr={[1, 2]} style={{ width: '100%', height: '100%' }}>
      <VoidScene spotify={spotify} colors={colors} albumArtUrl={albumArtUrl} />
    </Canvas>
  </div>
)

export default LyricVoid
