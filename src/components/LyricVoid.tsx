import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer, MeshReflectorMaterial, Sparkles } from '@react-three/drei'
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import helvetikerBold from 'three/examples/fonts/helvetiker_bold.typeface.json'
import { fetchLyrics, LyricLine } from '../services/lyrics'
import { ColorPalette } from '../types/spotify'
import type { SpotifyDeviceSource } from './MP3Player3D'

/**
 * "Lyric Void": a black room. A spinning disc floats in the middle, ringed by glass slabs that
 * face inward. Each lyric line pops out of a slab as glass letters, word by word, and the camera
 * flies to it with a different move per line. Every 5th line (and instrumental gaps) the camera
 * pulls back to orbit the disc.
 *
 * Layout rule that fixes the old "cover blocks the lyrics" bug: slabs sit on a ring and face the
 * centre; the camera for a slab shot always sits on the centre side of that slab, so nothing
 * (disc included) can ever be between the camera and the slab it is filming.
 */

const BG = '#030305'
const RING_R = 8.5
const FLOOR_Y = -3.4
const FONT = new FontLoader().parse(helvetikerBold)

interface Slot {
  angle: number
  h: number
  w: number
  hgt: number
}
// Slot 0 is the now-playing card, slots 1.. take lyric lines round-robin.
const SLOTS: Slot[] = [
  { angle: 0, h: 0.2, w: 3.4, hgt: 1.25 },
  { angle: 1.05, h: 0.9, w: 4.0, hgt: 2.2 },
  { angle: 2.1, h: -0.5, w: 4.0, hgt: 2.2 },
  { angle: 3.14, h: 1.1, w: 4.0, hgt: 2.2 },
  { angle: 4.19, h: -0.2, w: 4.0, hgt: 2.2 },
  { angle: 5.24, h: 0.7, w: 4.0, hgt: 2.2 }
]
const LYRIC_SLOTS = SLOTS.length - 1
const slotPos = (s: Slot) => new THREE.Vector3(Math.sin(s.angle) * RING_R, s.h, Math.cos(s.angle) * RING_R)

const DEMO_LYRICS: LyricLine[] = [
  'girl you look beautiful tonight',
  'stars on the ceiling',
  'all VVS',
  'music like this',
  'stay in the glow',
  'one more time',
  'never let it fade',
  'spin it back again'
].map((text, i) => ({ timeMs: i * 2800, text }))

/* ------------------------------------------------------------------------------------------ */
/* canvas helpers                                                                              */
/* ------------------------------------------------------------------------------------------ */

function makeCanvasTex(w: number, h: number) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return { canvas, ctx: canvas.getContext('2d')!, tex }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Glass slab backing: dark frosted fill, diagonal sheen and a neon edge. */
function drawGlassFrame(ctx: CanvasRenderingContext2D, w: number, h: number, accent: string) {
  ctx.clearRect(0, 0, w, h)
  roundRect(ctx, 14, 14, w - 28, h - 28, 36)
  ctx.fillStyle = 'rgba(8,8,12,0.62)'
  ctx.fill()
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, 'rgba(255,255,255,0.14)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.02)')
  g.addColorStop(1, 'rgba(255,255,255,0.0)')
  ctx.fillStyle = g
  ctx.fill()
  ctx.lineWidth = 9
  ctx.strokeStyle = accent
  ctx.shadowColor = accent
  ctx.shadowBlur = 30
  ctx.stroke()
  ctx.shadowBlur = 0
}

function useGlassFrameTexture(w: number, h: number, accent: string) {
  const t = useMemo(() => makeCanvasTex(1024, Math.round(1024 * (h / w))), [w, h])
  useEffect(() => {
    drawGlassFrame(t.ctx, t.canvas.width, t.canvas.height, accent)
    t.tex.needsUpdate = true
  }, [t, accent])
  useEffect(() => () => t.tex.dispose(), [t])
  return t
}

const radialTexture = (() => {
  let tex: THREE.CanvasTexture | null = null
  return () => {
    if (tex) return tex
    const c = makeCanvasTex(256, 256)
    const g = c.ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.4, 'rgba(255,255,255,0.35)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    c.ctx.fillStyle = g
    c.ctx.fillRect(0, 0, 256, 256)
    c.tex.needsUpdate = true
    tex = c.tex
    return tex
  }
})()

/* ------------------------------------------------------------------------------------------ */
/* spinning disc                                                                               */
/* ------------------------------------------------------------------------------------------ */

const DISC_R = 1.8

function drawDisc(ctx: CanvasRenderingContext2D, size: number, art: HTMLImageElement | null, accent: string) {
  const c = size / 2
  ctx.clearRect(0, 0, size, size)
  ctx.save()
  ctx.beginPath()
  ctx.arc(c, c, c - 2, 0, Math.PI * 2)
  ctx.clip()
  if (art && art.complete && art.naturalWidth) {
    const s = Math.max(size / art.naturalWidth, size / art.naturalHeight)
    ctx.drawImage(art, c - (art.naturalWidth * s) / 2, c - (art.naturalHeight * s) / 2, art.naturalWidth * s, art.naturalHeight * s)
  } else {
    const g = ctx.createLinearGradient(0, 0, size, size)
    g.addColorStop(0, accent)
    g.addColorStop(1, '#101018')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.font = '900 220px "Arial Black", Impact, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('♪', c, c)
  }
  // vinyl grooves
  ctx.lineWidth = 1
  for (let r = size * 0.14; r < c; r += 5) {
    ctx.strokeStyle = `rgba(0,0,0,${0.05 + 0.05 * Math.sin(r * 0.7)})`
    ctx.beginPath()
    ctx.arc(c, c, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  // centre label + spindle hole
  ctx.fillStyle = '#0a0a0e'
  ctx.beginPath()
  ctx.arc(c, c, size * 0.13, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = accent
  ctx.lineWidth = 6
  ctx.stroke()
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.arc(c, c, size * 0.025, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function makeSheenTexture() {
  const c = makeCanvasTex(512, 512)
  const g = (c.ctx as any).createConicGradient(0.6, 256, 256) as CanvasGradient
  const stops = [0, 0.08, 0.16, 0.5, 0.58, 0.66, 1]
  const alphas = [0, 0.3, 0, 0, 0.22, 0, 0]
  stops.forEach((s, i) => g.addColorStop(s, `rgba(255,255,255,${alphas[i]})`))
  c.ctx.fillStyle = g
  c.ctx.beginPath()
  c.ctx.arc(256, 256, 254, 0, Math.PI * 2)
  c.ctx.fill()
  c.tex.needsUpdate = true
  return c.tex
}

function Disc({ accent, art, artVersion, spinning }: { accent: string; art: HTMLImageElement | null; artVersion: number; spinning: boolean }) {
  const spin = useRef<THREE.Group>(null)
  const speed = useRef(0)
  const capTex = useMemo(() => makeCanvasTex(1024, 1024), [])
  const sheen = useMemo(makeSheenTexture, [])
  useEffect(() => {
    drawDisc(capTex.ctx, 1024, art, accent)
    capTex.tex.needsUpdate = true
  }, [capTex, art, accent, artVersion])
  useEffect(
    () => () => {
      capTex.tex.dispose()
      sheen.dispose()
    },
    [capTex, sheen]
  )

  useFrame((_, dt) => {
    // vinyl-style spin-up / spin-down
    speed.current = THREE.MathUtils.lerp(speed.current, spinning ? 1.9 : 0, 1 - Math.exp(-dt * (spinning ? 2.5 : 1.4)))
    if (spin.current) spin.current.rotation.z -= speed.current * dt
  })

  return (
    <group position={[0, 0.1, 0]} rotation={[-0.32, 0.45, 0.06]}>
      <group ref={spin}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[DISC_R, DISC_R, 0.07, 96]} />
          <meshStandardMaterial attach="material-0" color="#111" metalness={1} roughness={0.25} />
          <meshBasicMaterial attach="material-1" map={capTex.tex} toneMapped={false} />
          <meshBasicMaterial attach="material-2" map={capTex.tex} toneMapped={false} />
        </mesh>
      </group>
      {/* light sheen that does NOT spin with the disc, so the reflection seems to travel */}
      <mesh position={[0, 0, 0.045]}>
        <circleGeometry args={[DISC_R, 64]} />
        <meshBasicMaterial map={sheen} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* halo */}
      <mesh position={[0, 0, -0.2]}>
        <planeGeometry args={[DISC_R * 3.2, DISC_R * 3.2]} />
        <meshBasicMaterial map={radialTexture()} color={accent} transparent blending={THREE.AdditiveBlending} depthWrite={false} opacity={0.5} toneMapped={false} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* glass lyric slab                                                                            */
/* ------------------------------------------------------------------------------------------ */

interface WordLayout {
  geo: THREE.BufferGeometry
  x: number
  y: number
  w: number
}

function layoutWords(text: string, slot: Slot): { words: WordLayout[]; scale: number } {
  const size = 1
  const geos = text
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const geo = new TextGeometry(word, {
        font: FONT,
        size,
        depth: 0.28,
        curveSegments: 6,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.025,
        bevelSegments: 3
      })
      geo.computeBoundingBox()
      const bb = geo.boundingBox!
      geo.translate(-bb.min.x, 0, 0)
      return { geo, w: bb.max.x - bb.min.x }
    })

  const space = 0.34
  const lineH = 1.3
  const maxW = slot.w * 0.8
  // find a scale at which the wrapped block fits the slab
  let best = { rows: [] as { items: typeof geos; w: number }[], scale: 0.2 }
  for (let scale = 0.95; scale >= 0.2; scale -= 0.05) {
    const rowW = maxW / scale
    const rows: { items: typeof geos; w: number }[] = []
    let cur: typeof geos = []
    let curW = 0
    for (const g of geos) {
      const add = cur.length ? space + g.w : g.w
      if (curW + add > rowW && cur.length) {
        rows.push({ items: cur, w: curW })
        cur = [g]
        curW = g.w
      } else {
        cur.push(g)
        curW += add
      }
    }
    if (cur.length) rows.push({ items: cur, w: curW })
    best = { rows, scale }
    if (rows.length * lineH * scale <= slot.hgt * 0.7) break
  }

  const words: WordLayout[] = []
  const totalH = best.rows.length * lineH
  best.rows.forEach((row, ri) => {
    let x = -row.w / 2
    const y = totalH / 2 - lineH * (ri + 0.5) - 0.35
    for (const item of row.items) {
      words.push({ geo: item.geo, x, y, w: item.w })
      x += item.w + space
    }
  })
  return { words, scale: best.scale }
}

const easeOutBack = (p: number) => {
  const c1 = 2.2
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2)
}

interface SlabProps {
  slot: Slot
  text: string
  startedAt: number
  stagger: number
  active: boolean
  accent: string
}

function LyricSlab({ slot, text, startedAt, stagger, active, accent }: SlabProps) {
  const frameTex = useGlassFrameTexture(slot.w, slot.hgt, accent)
  const { words, scale } = useMemo(() => layoutWords(text, slot), [text, slot])
  useEffect(() => () => words.forEach((w) => w.geo.dispose()), [words])

  const group = useRef<THREE.Group>(null)
  const wordRefs = useRef<(THREE.Group | null)[]>([])
  const frameMat = useRef<THREE.MeshBasicMaterial>(null)
  const glassMat = useRef<THREE.MeshPhysicalMaterial>(null)
  const dim = useRef(active ? 1 : 0.3)

  useFrame((_, dt) => {
    const now = performance.now()
    dim.current = THREE.MathUtils.lerp(dim.current, active ? 1 : 0.3, 1 - Math.exp(-dt * 3))
    if (frameMat.current) frameMat.current.opacity = 0.35 + 0.65 * dim.current
    if (glassMat.current) glassMat.current.emissiveIntensity = 0.12 + 0.75 * dim.current
    if (group.current) group.current.scale.setScalar(0.94 + 0.06 * dim.current)
    words.forEach((w, i) => {
      const g = wordRefs.current[i]
      if (!g) return
      const t = (now - startedAt) / 1000 - i * stagger
      if (t <= 0) {
        g.scale.setScalar(0.0001)
        return
      }
      const p = Math.min(1, t / 0.5)
      const s = Math.max(0.0001, easeOutBack(p))
      g.scale.setScalar(s)
      g.position.set(w.x, w.y, THREE.MathUtils.lerp(-0.9, 0.12, 1 - Math.pow(1 - p, 3)))
      g.rotation.set(0, (1 - p) * 0.9, (1 - p) * -0.12)
    })
  })

  const pos = useMemo(() => slotPos(slot), [slot])
  return (
    <group ref={group} position={[pos.x, pos.y, pos.z]} rotation={[0, slot.angle + Math.PI, 0]}>
      <mesh>
        <planeGeometry args={[slot.w, slot.hgt]} />
        <meshBasicMaterial ref={frameMat} map={frameTex.tex} transparent toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <group scale={scale} position={[0, 0, 0.05]}>
        {words.map((w, i) => (
          <group
            key={`${text}-${i}`}
            ref={(g) => {
              wordRefs.current[i] = g
            }}
            scale={0.0001}
          >
            <mesh geometry={w.geo}>
              <meshPhysicalMaterial
                ref={i === 0 ? glassMat : undefined}
                color="#ffffff"
                emissive={accent}
                emissiveIntensity={0.8}
                transmission={0.55}
                thickness={0.8}
                ior={1.45}
                roughness={0.08}
                metalness={0}
                clearcoat={1}
                clearcoatRoughness={0.05}
                envMapIntensity={2.2}
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* now-playing card                                                                            */
/* ------------------------------------------------------------------------------------------ */

function NowPlayingCard({
  slot,
  accent,
  info
}: {
  slot: Slot
  accent: string
  info: React.MutableRefObject<{ title: string; artist: string; progress: number; playing: boolean }>
}) {
  const frameTex = useGlassFrameTexture(slot.w, slot.hgt, accent)
  const tex = useMemo(() => makeCanvasTex(1024, Math.round(1024 * (slot.hgt / slot.w))), [slot])
  useEffect(() => () => tex.tex.dispose(), [tex])
  const last = useRef(0)
  useFrame(() => {
    const now = performance.now()
    if (now - last.current < 100) return
    last.current = now
    const { ctx, canvas } = tex
    const { width: w, height: h } = canvas
    const { title, artist, progress, playing } = info.current
    ctx.clearRect(0, 0, w, h)
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#fff'
    ctx.font = '800 92px "Helvetica Neue", Arial, sans-serif'
    ctx.fillText(title.slice(0, 22), 70, h * 0.45)
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.font = '500 52px "Helvetica Neue", Arial, sans-serif'
    ctx.fillText(artist.slice(0, 34), 70, h * 0.45 + 74)
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    ctx.fillRect(70, h - 110, w - 140, 9)
    ctx.fillStyle = accent
    ctx.shadowColor = accent
    ctx.shadowBlur = 18
    ctx.fillRect(70, h - 110, (w - 140) * Math.min(1, Math.max(0, progress)), 9)
    ctx.shadowBlur = 0
    ctx.fillStyle = '#fff'
    if (playing) {
      ctx.fillRect(w - 130, 70, 16, 54)
      ctx.fillRect(w - 98, 70, 16, 54)
    } else {
      ctx.beginPath()
      ctx.moveTo(w - 130, 70)
      ctx.lineTo(w - 84, 97)
      ctx.lineTo(w - 130, 124)
      ctx.fill()
    }
    tex.tex.needsUpdate = true
  })
  const pos = useMemo(() => slotPos(slot), [slot])
  return (
    <group position={[pos.x, pos.y, pos.z]} rotation={[0, slot.angle + Math.PI, 0]}>
      <mesh>
        <planeGeometry args={[slot.w, slot.hgt]} />
        <meshBasicMaterial map={frameTex.tex} transparent toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[slot.w, slot.hgt]} />
        <meshBasicMaterial map={tex.tex} transparent toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* world: floor, light pools, dust                                                             */
/* ------------------------------------------------------------------------------------------ */

function World({ accent }: { accent: string }) {
  const pool = radialTexture()
  return (
    <>
      <fog attach="fog" args={[BG, 12, 34]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]}>
        <planeGeometry args={[60, 60]} />
        <MeshReflectorMaterial
          resolution={512}
          blur={[300, 100]}
          mixBlur={1}
          mixStrength={5}
          mirror={0.6}
          roughness={0.9}
          depthScale={0.6}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.2}
          color="#050507"
          metalness={0.6}
        />
      </mesh>
      {/* light spilled on the floor under the disc and below every slab */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y + 0.02, 0]}>
        <planeGeometry args={[11, 11]} />
        <meshBasicMaterial map={pool} color={accent} transparent blending={THREE.AdditiveBlending} depthWrite={false} opacity={0.45} toneMapped={false} />
      </mesh>
      {SLOTS.map((s, i) => {
        const p = slotPos(s)
        // pool sits just inside the ring, below the slab
        const k = 0.78
        return (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[p.x * k, FLOOR_Y + 0.02, p.z * k]}>
            <planeGeometry args={[7, 7]} />
            <meshBasicMaterial map={pool} color={accent} transparent blending={THREE.AdditiveBlending} depthWrite={false} opacity={0.3} toneMapped={false} />
          </mesh>
        )
      })}
      <Sparkles count={160} scale={[22, 9, 22]} size={2.4} speed={0.25} opacity={0.5} color={accent} position={[0, 0.5, 0]} />
    </>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* director: lyrics -> slabs, camera                                                           */
/* ------------------------------------------------------------------------------------------ */

interface SlabState {
  text: string
  startedAt: number
  stagger: number
}

interface SceneProps {
  spotify: SpotifyDeviceSource
  colors: ColorPalette
  albumArtUrl?: string
}

const ease = (t: number) => t * t * (3 - 2 * t)

function VoidScene({ spotify, colors, albumArtUrl }: SceneProps) {
  const accent = colors.accent || colors.primary || '#facc15'

  // lyrics ------------------------------------------------------------------------------------
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

  // album art ---------------------------------------------------------------------------------
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

  // latest props + progress interpolation between polls ---------------------------------------
  const live = useRef({ spotify, receivedAt: performance.now(), lyrics })
  live.current.spotify = spotify
  live.current.lyrics = lyrics
  useEffect(() => {
    live.current.receivedAt = performance.now()
  }, [spotify.currentTrack])

  const info = useRef({ title: '', artist: '', progress: 0, playing: true })

  // director state ----------------------------------------------------------------------------
  const [slabs, setSlabs] = useState<(SlabState | null)[]>(() => SLOTS.map(() => null))
  const [activeSlot, setActiveSlot] = useState(0)
  const [spinning, setSpinning] = useState(true)
  const dir = useRef({
    idx: -2,
    shotStart: 0,
    shot: 'disc' as 'disc' | 'dolly' | 'orbit' | 'low' | 'whip',
    slot: 0,
    demoStart: performance.now()
  })

  const camPos = useMemo(() => new THREE.Vector3(0, 1.5, 7), [])
  const camLook = useMemo(() => new THREE.Vector3(0, 0, 0), [])
  const tPos = useMemo(() => new THREE.Vector3(), [])
  const tLook = useMemo(() => new THREE.Vector3(), [])
  const v1 = useMemo(() => new THREE.Vector3(), [])
  const v2 = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, dt) => {
    const d = dir.current
    const { spotify: sp, receivedAt, lyrics: ly } = live.current
    const t = sp.currentTrack
    const demo = !t?.item
    const lines = demo ? DEMO_LYRICS : ly
    const dur = t?.item?.duration_ms ?? DEMO_LYRICS.length * 2800
    let progress = demo ? (performance.now() - d.demoStart) % dur : (t?.progress_ms ?? 0)
    if (!demo && t?.is_playing) progress += performance.now() - receivedAt

    info.current.title = t?.item?.name ?? 'Lyric Void'
    info.current.artist = t?.item?.artists?.map((a) => a.name).join(', ') ?? 'demo mode'
    info.current.progress = dur ? progress / dur : 0
    info.current.playing = demo ? true : !!t?.is_playing
    const wantSpin = info.current.playing
    if (wantSpin !== spinning) setSpinning(wantSpin)

    // which line is current
    let idx = -1
    if (lines && lines.length) {
      const p = progress + 150
      for (let i = 0; i < lines.length; i++) if (lines[i].timeMs <= p) idx = i
    }

    const now = performance.now()
    if (idx !== d.idx) {
      d.idx = idx
      d.shotStart = state.clock.elapsedTime
      if (idx < 0 || !lines) {
        d.shot = 'disc'
        setActiveSlot(0)
        d.slot = 0
      } else {
        const slot = 1 + (idx % LYRIC_SLOTS)
        d.slot = slot
        const line = lines[idx]
        const next = lines[idx + 1]
        const lineMs = next ? next.timeMs - line.timeMs : 3000
        const nWords = Math.max(1, line.text.split(/\s+/).length)
        const stagger = Math.min(0.16, (lineMs / 1000) * 0.55 / nWords)
        setSlabs((prev) => {
          const n = prev.slice()
          n[slot] = { text: line.text, startedAt: now, stagger }
          return n
        })
        setActiveSlot(slot)
        // every 5th line pull back to the disc, otherwise cycle through the moves
        d.shot = (idx + 1) % 5 === 0 ? 'disc' : (['dolly', 'orbit', 'low', 'whip'] as const)[idx % 4]
      }
    }

    // camera -------------------------------------------------------------------------------
    const e = state.clock.elapsedTime
    const tl = e - d.shotStart
    if (d.shot === 'disc') {
      const a = e * 0.22
      tPos.set(Math.sin(a) * 6.6, 1.4 + Math.sin(e * 0.4) * 0.4, Math.cos(a) * 6.6)
      tLook.set(0, 0.1, 0)
    } else {
      const s = SLOTS[d.slot]
      const base = slotPos(s)
      // unit vector from slab toward the ring centre (the side the slab faces)
      v1.set(-Math.sin(s.angle), 0, -Math.cos(s.angle))
      v2.set(-Math.cos(s.angle), 0, Math.sin(s.angle)) // sideways
      let dist = s.w * 0.85 + 1.2
      let lateral = 0
      let lift = 0.05
      if (d.shot === 'dolly') dist = THREE.MathUtils.lerp(dist + 1.4, dist - 0.5, ease(Math.min(1, tl / 3.5)))
      else if (d.shot === 'orbit') lateral = THREE.MathUtils.lerp(-0.7, 0.7, ease(Math.min(1, tl / 4.5)))
      else if (d.shot === 'low') {
        lift = THREE.MathUtils.lerp(-1.1, -0.45, ease(Math.min(1, tl / 4)))
        dist -= 0.3
      } else dist -= 0.5
      const cosL = Math.cos(lateral)
      const sinL = Math.sin(lateral)
      tPos.copy(base).addScaledVector(v1, dist * cosL).addScaledVector(v2, dist * sinL)
      tPos.y += lift
      tLook.copy(base)
    }
    // handheld sway
    tPos.x += Math.sin(e * 0.8) * 0.12
    tPos.y += Math.cos(e * 0.9) * 0.08
    // fast at the start of a shot (whip), calm afterwards
    const rate = 1.4 + 4.5 * Math.exp(-tl * 2.6)
    const f = 1 - Math.exp(-rate * dt)
    camPos.lerp(tPos, f)
    camLook.lerp(tLook, f)
    state.camera.position.copy(camPos)
    state.camera.lookAt(camLook)
    state.camera.rotateZ(Math.sin(e * 0.5) * 0.015)
    // zoom punch on every new shot
    const cam = state.camera as THREE.PerspectiveCamera
    const fov = 50 + 9 * Math.exp(-tl * 3.2)
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }
  })

  const aberration = useMemo(() => new THREE.Vector2(0.0007, 0.001), [])

  return (
    <>
      <color attach="background" args={[BG]} />
      <Environment resolution={256} frames={1} key={accent}>
        <Lightformer form="rect" intensity={5} color="#ffffff" position={[0, 6, 4]} scale={[14, 3, 1]} />
        <Lightformer form="rect" intensity={4} color={accent} position={[-7, 1, 2]} scale={[3, 8, 1]} />
        <Lightformer form="rect" intensity={3} color="#8ab4ff" position={[7, 2, -2]} scale={[3, 8, 1]} />
        <Lightformer form="ring" intensity={3} color={accent} position={[0, -1, -6]} scale={8} />
      </Environment>
      <pointLight position={[0, 1.5, 2]} intensity={6} color={accent} distance={14} />

      <World accent={accent} />
      <Disc accent={accent} art={art} artVersion={artVersion} spinning={spinning} />
      <NowPlayingCard slot={SLOTS[0]} accent={accent} info={info} />
      {SLOTS.slice(1).map((slot, i) => {
        const s = slabs[i + 1]
        return s ? (
          <LyricSlab key={i} slot={slot} text={s.text} startedAt={s.startedAt} stagger={s.stagger} active={activeSlot === i + 1} accent={accent} />
        ) : null
      })}

      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.35} luminanceSmoothing={0.3} />
        <ChromaticAberration offset={aberration} radialModulation modulationOffset={0.3} blendFunction={BlendFunction.NORMAL} />
        <Vignette eskil={false} offset={0.25} darkness={0.85} />
      </EffectComposer>
    </>
  )
}

export const LyricVoid: React.FC<{
  spotify: SpotifyDeviceSource
  colors: ColorPalette
  albumArtUrl?: string
}> = ({ spotify, colors, albumArtUrl }) => (
  <div style={{ width: '100%', height: '100%', background: BG }}>
    <Canvas camera={{ position: [0, 1.5, 7], fov: 50 }} dpr={[1, 2]} gl={{ antialias: false }} style={{ width: '100%', height: '100%' }}>
      <React.Suspense fallback={null}>
        <VoidScene spotify={spotify} colors={colors} albumArtUrl={albumArtUrl} />
      </React.Suspense>
    </Canvas>
  </div>
)

export default LyricVoid
