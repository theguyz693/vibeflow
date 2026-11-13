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
 * "Lyric Void" - hype-reel edition.
 *
 *  - The disc is the stage: it is always on screen, always facing roughly at the camera, and the
 *    camera never cuts away from it, it just keeps orbiting.
 *  - Short lines alternate between WRAPPING AROUND THE DISC RIM (letters on a circle that
 *    "scratch" into place) and SLAMMING IN HUGE in front of it. Long lines always go big in front.
 *  - Every line uses a different entrance (slam / slide / stretch / drop); last word is emphasised.
 *  - Strong lines trigger a "hit": bloom + chromatic spike, camera shake, bg flash, disc kick.
 *    Every 6th line the disc scratches backwards like a DJ.
 *  - Background is a flat colour block from the album palette that flips on every line.
 *  - The old neon glass screens are kept as dim, drifting set-dressing far outside the camera orbit,
 *    so they can never block anything.
 */

const FLOOR_Y = -3.4
const DISC_R = 2.4
const BG_SCREEN_R = 14
const FONT = new FontLoader().parse(helvetikerBold)
const FONT_RES: number = (FONT as any).data.resolution || 1000

const DEMO_LYRICS: LyricLine[] = [
  'girl you look beautiful tonight',
  'stars on the ceiling',
  'all VVS',
  'music like this',
  'stay in the glow',
  'one more time',
  'never let it fade',
  'spin it back again',
  'hold on',
  'we are the only ones awake in this city'
].map((text, i) => ({ timeMs: 3200 + i * 2800, text }))

type Kind = 'ring' | 'front'
type Style = 'slam' | 'slide' | 'stretch' | 'drop'

interface LineState {
  idx: number
  text: string
  startedAt: number
  stagger: number
  kind: Kind
  style: Style
  dir: 1 | -1
}

/* ------------------------------------------------------------------------------------------ */
/* helpers                                                                                     */
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

const safeColor = (c: string, fallback: string) => {
  try {
    return new THREE.Color(c)
  } catch {
    return new THREE.Color(fallback)
  }
}

const easeOutBack = (p: number) => {
  const c1 = 2.2
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2)
}
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3)
const easeOutExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p))
const easeOutBounce = (x: number) => {
  const n1 = 7.5625
  const d1 = 2.75
  if (x < 1 / d1) return n1 * x * x
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375
  return n1 * (x -= 2.625 / d1) * x + 0.984375
}
const easeOutElastic = (x: number) => {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const c4 = (2 * Math.PI) / 3
  return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1
}

/* ------------------------------------------------------------------------------------------ */
/* glass material                                                                              */
/* ------------------------------------------------------------------------------------------ */

function useGlassMaterials(accent: string) {
  const normal = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        emissive: accent,
        emissiveIntensity: 0.55,
        transmission: 0.5,
        thickness: 0.8,
        ior: 1.45,
        roughness: 0.08,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMapIntensity: 2.2,
        toneMapped: false
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const emph = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        emissive: accent,
        emissiveIntensity: 1.5,
        transmission: 0.2,
        thickness: 0.6,
        roughness: 0.1,
        clearcoat: 1,
        envMapIntensity: 2.6,
        toneMapped: false
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  useEffect(() => {
    normal.emissive.set(accent)
    emph.emissive.set(accent)
  }, [accent, normal, emph])
  useEffect(
    () => () => {
      normal.dispose()
      emph.dispose()
    },
    [normal, emph]
  )
  return { normal, emph }
}

/* ------------------------------------------------------------------------------------------ */
/* front text: huge glass words in front of the disc                                           */
/* ------------------------------------------------------------------------------------------ */

interface WordLayout {
  geo: THREE.BufferGeometry
  x: number
  y: number
  w: number
  row: number
}

function layoutWords(text: string, maxW: number, maxH: number, maxScale: number): { words: WordLayout[]; scale: number } {
  const geos = text
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const geo = new TextGeometry(word, {
        font: FONT,
        size: 1,
        depth: 0.3,
        curveSegments: 6,
        bevelEnabled: true,
        bevelThickness: 0.035,
        bevelSize: 0.028,
        bevelSegments: 3
      })
      geo.computeBoundingBox()
      const bb = geo.boundingBox!
      geo.translate(-bb.min.x, 0, 0)
      return { geo, w: bb.max.x - bb.min.x }
    })

  const space = 0.36
  const lineH = 1.3
  let best = { rows: [] as { items: typeof geos; w: number }[], scale: 0.2 }
  for (let scale = maxScale; scale >= 0.2; scale -= 0.05) {
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
    if (rows.length * lineH * scale <= maxH) break
  }

  const words: WordLayout[] = []
  const totalH = best.rows.length * lineH
  best.rows.forEach((row, ri) => {
    let x = -row.w / 2
    const y = totalH / 2 - lineH * (ri + 0.5) - 0.35
    for (const item of row.items) {
      words.push({ geo: item.geo, x, y, w: item.w, row: ri })
      x += item.w + space
    }
  })
  return { words, scale: best.scale }
}

interface FrontTextProps {
  line: Pick<LineState, 'text' | 'startedAt' | 'stagger' | 'style' | 'dir'>
  mats: { normal: THREE.Material; emph: THREE.Material }
  maxScale?: number
  yOffset?: number
}

function FrontText({ line, mats, maxScale = 1.5, yOffset = 0 }: FrontTextProps) {
  const { words, scale } = useMemo(() => layoutWords(line.text, 6.0, 3.4, maxScale), [line.text, maxScale])
  useEffect(() => () => words.forEach((w) => w.geo.dispose()), [words])
  const refs = useRef<(THREE.Group | null)[]>([])

  useFrame(() => {
    const now = performance.now()
    words.forEach((w, i) => {
      const g = refs.current[i]
      if (!g) return
      const t = (now - line.startedAt) / 1000 - i * line.stagger
      if (t <= 0) {
        g.scale.setScalar(0.0001)
        return
      }
      const isLast = i === words.length - 1
      const emph = isLast && words.length > 1 ? 1.16 : 1
      const dur = line.style === 'stretch' ? 0.8 : line.style === 'drop' ? 0.75 : 0.55
      const p = Math.min(1, t / dur)
      let sx = 1,
        sy = 1,
        px = w.x,
        py = w.y,
        pz = 0,
        rz = 0,
        ry = 0
      switch (line.style) {
        case 'slam': {
          const k = 1 - easeOutExpo(p)
          sx = sy = 1 + k * 1.9
          pz = k * 3.2
          rz = k * 0.2 * line.dir
          break
        }
        case 'slide': {
          const k = 1 - easeOutCubic(p)
          px = w.x + k * 8 * (w.row % 2 === 0 ? line.dir : -line.dir)
          ry = k * 0.9 * line.dir
          break
        }
        case 'stretch': {
          const e = easeOutElastic(p)
          sy = Math.max(0.0001, e)
          sx = 1 + (1 - Math.min(1, e)) * 0.7
          break
        }
        case 'drop': {
          py = w.y + (1 - easeOutBounce(p)) * 5
          rz = (1 - easeOutCubic(p)) * 0.35 * line.dir
          break
        }
      }
      const pop = easeOutBack(Math.min(1, t / 0.35))
      const s = Math.max(0.0001, pop) * emph
      g.scale.set(sx * s, sy * s, s)
      g.position.set(px + (emph > 1 ? (w.w * (1 - emph)) / 2 : 0), py, pz)
      g.rotation.set(0, ry, rz)
    })
  })

  return (
    <group position={[0, yOffset, 0]}>
      <group scale={scale}>
        {words.map((w, i) => (
          <group
            key={`${line.text}-${i}`}
            ref={(g) => {
              refs.current[i] = g
            }}
            scale={0.0001}
          >
            <mesh geometry={w.geo} material={i === words.length - 1 && words.length > 1 ? mats.emph : mats.normal} />
          </group>
        ))}
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* ring text: letters wrapped on the disc rim                                                  */
/* ------------------------------------------------------------------------------------------ */

const letterGeoCache = new Map<string, THREE.BufferGeometry>()
function letterGeo(ch: string) {
  let g = letterGeoCache.get(ch)
  if (!g) {
    g = new TextGeometry(ch, {
      font: FONT,
      size: 1,
      depth: 0.28,
      curveSegments: 6,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.022,
      bevelSegments: 2
    })
    letterGeoCache.set(ch, g)
  }
  return g
}
const advanceOf = (ch: string) => {
  if (ch === ' ') return 0.32
  const gl = (FONT as any).data.glyphs[ch]
  return gl ? gl.ha / FONT_RES : 0.6
}

function RingText({ line, mats }: { line: LineState; mats: { normal: THREE.Material; emph: THREE.Material } }) {
  const letters = useMemo(() => {
    const chars = [...line.text.toUpperCase()]
    const adv = chars.map(advanceOf)
    const sum = adv.reduce((a, b) => a + b, 0)
    const R0 = DISC_R + 0.7
    const size = Math.min(0.5, (1.2 * Math.PI * R0) / sum)
    const R = DISC_R + 0.3 + size * 0.55
    const total = size * sum
    const lastWordStart = line.text.lastIndexOf(' ') + 1
    let cum = 0
    return chars.map((ch, i) => {
      const center = cum + adv[i] / 2
      cum += adv[i]
      return {
        ch,
        ha: adv[i],
        size,
        R,
        angle: Math.PI / 2 + (total / 2 - size * center) / R,
        emph: line.text.includes(' ') && i >= lastWordStart
      }
    })
  }, [line.text])

  const group = useRef<THREE.Group>(null)
  const refs = useRef<(THREE.Group | null)[]>([])

  useFrame((state) => {
    const now = performance.now()
    const t0 = (now - line.startedAt) / 1000
    if (group.current) {
      // scratch into place: the whole ring whips in from the side and settles
      group.current.rotation.z = line.dir * 2.6 * Math.exp(-t0 * 4.2) * Math.cos(t0 * 5) + Math.sin(state.clock.elapsedTime * 0.5) * 0.05
    }
    letters.forEach((l, i) => {
      const g = refs.current[i]
      if (!g) return
      if (l.ch === ' ') {
        g.visible = false
        return
      }
      const t = t0 - i * 0.028
      if (t <= 0) {
        g.scale.setScalar(0.0001)
        return
      }
      const p = Math.min(1, t / 0.45)
      const s = Math.max(0.0001, easeOutBack(p)) * l.size
      const r = l.R + (1 - easeOutCubic(p)) * 1.8
      g.scale.setScalar(s)
      g.position.set(Math.cos(l.angle) * r, Math.sin(l.angle) * r, 0.1 + (1 - p) * 0.5)
      g.rotation.z = l.angle - Math.PI / 2
    })
  })

  return (
    <group ref={group}>
      {letters.map((l, i) => (
        <group
          key={`${line.text}-${i}`}
          ref={(g) => {
            refs.current[i] = g
          }}
          scale={0.0001}
        >
          <mesh geometry={letterGeo(l.ch)} position={[-l.ha / 2, -0.36, 0]} material={l.emph ? mats.emph : mats.normal} />
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* the disc                                                                                    */
/* ------------------------------------------------------------------------------------------ */

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
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.font = '900 260px "Arial Black", Impact, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('♪', c, c)
  }
  ctx.lineWidth = 1
  for (let r = size * 0.14; r < c; r += 5) {
    ctx.strokeStyle = `rgba(0,0,0,${0.05 + 0.05 * Math.sin(r * 0.7)})`
    ctx.beginPath()
    ctx.arc(c, c, r, 0, Math.PI * 2)
    ctx.stroke()
  }
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
  const alphas = [0, 0.28, 0, 0, 0.2, 0, 0]
  stops.forEach((s, i) => g.addColorStop(s, `rgba(255,255,255,${alphas[i]})`))
  c.ctx.fillStyle = g
  c.ctx.beginPath()
  c.ctx.arc(256, 256, 254, 0, Math.PI * 2)
  c.ctx.fill()
  c.tex.needsUpdate = true
  return c.tex
}

interface DiscProps {
  accent: string
  art: HTMLImageElement | null
  artVersion: number
  playing: React.MutableRefObject<boolean>
  kick: React.MutableRefObject<number>
  ringLine: LineState | null
  mats: { normal: THREE.Material; emph: THREE.Material }
}

function Disc({ accent, art, artVersion, playing, kick, ringLine, mats }: DiscProps) {
  const outer = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  const vel = useRef(0)
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

  useFrame((state, dt) => {
    // vinyl-style spin-up / spin-down plus beat kicks / scratches
    const base = playing.current ? 1.7 : 0
    vel.current += (base - vel.current) * (1 - Math.exp(-dt * (playing.current ? 2.2 : 1.4)))
    if (kick.current !== 0) {
      vel.current += kick.current
      kick.current = 0
    }
    if (spin.current) spin.current.rotation.z -= vel.current * dt

    // always turn towards the camera (with lag, so the orbit still reads as parallax)
    if (outer.current) {
      const cam = state.camera.position
      const target = Math.atan2(cam.x, cam.z) * 0.8
      const cur = outer.current.rotation.y
      const diff = Math.atan2(Math.sin(target - cur), Math.cos(target - cur))
      outer.current.rotation.y = cur + diff * (1 - Math.exp(-dt * 2))
      outer.current.position.y = 0.15 + Math.sin(state.clock.elapsedTime * 0.7) * 0.1
    }
  })

  return (
    <group ref={outer} position={[0, 0.15, 0]} rotation={[-0.28, 0, 0.05]}>
      <group ref={spin}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[DISC_R, DISC_R, 0.08, 96]} />
          <meshStandardMaterial attach="material-0" color="#111" metalness={1} roughness={0.25} />
          <meshBasicMaterial attach="material-1" map={capTex.tex} toneMapped={false} />
          <meshBasicMaterial attach="material-2" map={capTex.tex} toneMapped={false} />
        </mesh>
      </group>
      <mesh position={[0, 0, 0.05]}>
        <circleGeometry args={[DISC_R, 64]} />
        <meshBasicMaterial map={sheen} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.25]}>
        <planeGeometry args={[DISC_R * 3.4, DISC_R * 3.4]} />
        <meshBasicMaterial map={radialTexture()} color={accent} transparent blending={THREE.AdditiveBlending} depthWrite={false} opacity={0.55} toneMapped={false} />
      </mesh>
      {ringLine && <RingText line={ringLine} mats={mats} />}
    </group>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* old neon glass screens, now dim set-dressing far outside the camera orbit                   */
/* ------------------------------------------------------------------------------------------ */

function drawBgScreen(t: ReturnType<typeof makeCanvasTex>, text: string, accent: string) {
  const { ctx, canvas } = t
  const { width: w, height: h } = canvas
  ctx.clearRect(0, 0, w, h)
  roundRect(ctx, 14, 14, w - 28, h - 28, 36)
  ctx.fillStyle = 'rgba(6,6,10,0.7)'
  ctx.fill()
  ctx.lineWidth = 9
  ctx.strokeStyle = accent
  ctx.shadowColor = accent
  ctx.shadowBlur = 30
  ctx.stroke()
  ctx.shadowBlur = 0
  if (!text) return
  const words = text.toUpperCase().split(/\s+/)
  let size = 200
  let lines: string[] = []
  for (; size > 48; size -= 12) {
    ctx.font = `900 ${size}px "Arial Black", Impact, sans-serif`
    lines = []
    let cur = ''
    for (const wd of words) {
      const test = cur ? `${cur} ${wd}` : wd
      if (ctx.measureText(test).width > w * 0.82 && cur) {
        lines.push(cur)
        cur = wd
      } else cur = test
    }
    if (cur) lines.push(cur)
    if (lines.length * size * 0.95 <= h * 0.7) break
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lh = size * 0.95
  const y0 = h / 2 - ((lines.length - 1) * lh) / 2
  ctx.shadowColor = accent
  ctx.shadowBlur = 30
  lines.forEach((l, i) => {
    ctx.fillStyle = i % 2 === 0 ? accent : '#ffffff'
    ctx.fillText(l, w / 2, y0 + i * lh)
  })
  ctx.shadowBlur = 0
}

function BgScreen({ angle, y, text, accent, index }: { angle: number; y: number; text: string; accent: string; index: number }) {
  const t = useMemo(() => makeCanvasTex(1024, 576), [])
  useEffect(() => {
    drawBgScreen(t, text, accent)
    t.tex.needsUpdate = true
  }, [t, text, accent])
  useEffect(() => () => t.tex.dispose(), [t])
  const g = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (g.current) g.current.position.y = y + Math.sin(state.clock.elapsedTime * 0.4 + index * 1.9) * 0.35
  })
  return (
    <group ref={g} position={[Math.sin(angle) * BG_SCREEN_R, y, Math.cos(angle) * BG_SCREEN_R]} rotation={[0, angle + Math.PI, 0]}>
      <mesh scale={[6, 3.375, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={t.tex} transparent opacity={0.55} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}

const BG_N = 7

function BgScreens({ texts, accent }: { texts: string[]; accent: string }) {
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.025
  })
  return (
    <group ref={g}>
      {Array.from({ length: BG_N }, (_, i) => (
        <BgScreen key={i} index={i} angle={(i / BG_N) * Math.PI * 2} y={[1.5, 4.2, -0.4, 3.0, 0.4, 5.0, 1.0][i]} text={texts[i] || ''} accent={accent} />
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* world                                                                                       */
/* ------------------------------------------------------------------------------------------ */

function World({ accent }: { accent: string }) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]}>
        <planeGeometry args={[80, 80]} />
        <MeshReflectorMaterial
          resolution={512}
          blur={[300, 100]}
          mixBlur={1}
          mixStrength={4}
          mirror={0.55}
          roughness={0.9}
          depthScale={0.6}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.2}
          color="#08080c"
          metalness={0.6}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y + 0.02, 0]}>
        <planeGeometry args={[14, 14]} />
        <meshBasicMaterial map={radialTexture()} color={accent} transparent blending={THREE.AdditiveBlending} depthWrite={false} opacity={0.5} toneMapped={false} />
      </mesh>
      <Sparkles count={180} scale={[24, 10, 24]} size={2.6} speed={0.3} opacity={0.55} color={accent} position={[0, 1, 0]} />
    </>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* director                                                                                    */
/* ------------------------------------------------------------------------------------------ */

export interface VoidInfo {
  title: string
  artist: string
  progress: number
}

interface SceneProps {
  spotify: SpotifyDeviceSource
  colors: ColorPalette
  albumArtUrl?: string
  info: React.MutableRefObject<VoidInfo>
}

const STYLES: Style[] = ['slam', 'slide', 'stretch', 'drop']

function VoidScene({ spotify, colors, albumArtUrl, info }: SceneProps) {
  const accent = colors.glow || colors.accent || '#facc15'
  const mats = useGlassMaterials(accent)

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

  // director state ----------------------------------------------------------------------------
  const [line, setLine] = useState<LineState | null>(null)
  const [bgTexts, setBgTexts] = useState<string[]>(() => Array(BG_N).fill(''))
  const playing = useRef(true)
  const kick = useRef(0)
  const hit = useRef(0)
  const flip = useRef(0)
  const dir = useRef({
    idx: -2,
    shotStart: 0,
    demoStart: performance.now(),
    az: 0,
    r: 7.6,
    h: 1.0,
    azT: 0,
    rT: 7.6,
    hT: 1.0,
    anchorAz: 0,
    anchorR: 7.6,
    trackId: ''
  })
  const frontAnchor = useRef<THREE.Group>(null)

  const bloom = useRef<any>(null)
  const chroma = useRef<any>(null)
  const bgBase = useMemo(() => safeColor(colors.primary, '#1a1030').multiplyScalar(0.3), [colors.primary])
  const bgAlt = useMemo(() => safeColor(colors.secondary, '#102040').multiplyScalar(0.34), [colors.secondary])
  const bgNow = useMemo(() => new THREE.Color('#0a0a14'), [])
  const white = useMemo(() => new THREE.Color('#ffffff'), [])
  const tmpC = useMemo(() => new THREE.Color(), [])
  const camPos = useMemo(() => new THREE.Vector3(0, 1.0, 7.6), [])

  useFrame((state, dt) => {
    const d = dir.current
    const { spotify: sp, receivedAt, lyrics: ly } = live.current
    const t = sp.currentTrack
    const demo = !t?.item
    const lines = demo ? DEMO_LYRICS : ly
    const dur = t?.item?.duration_ms ?? (DEMO_LYRICS[DEMO_LYRICS.length - 1].timeMs + 5000)
    let progress = demo ? (performance.now() - d.demoStart) % dur : (t?.progress_ms ?? 0)
    if (!demo && t?.is_playing) progress += performance.now() - receivedAt

    info.current.title = t?.item?.name ?? 'Lyric Void'
    info.current.artist = t?.item?.artists?.map((a) => a.name).join(', ') ?? 'demo mode'
    info.current.progress = dur ? progress / dur : 0
    playing.current = demo ? true : !!t?.is_playing

    // which lyric line are we on
    let idx = -1
    if (lines && lines.length) {
      const p = progress + 150
      for (let i = 0; i < lines.length; i++) if (lines[i].timeMs <= p) idx = i
    }

    const e = state.clock.elapsedTime
    const now = performance.now()
    const trackKey = t?.item?.id ?? 'demo'
    if (idx !== d.idx || trackKey !== d.trackId) {
      d.idx = idx
      d.trackId = trackKey
      d.shotStart = e
      const sign: 1 | -1 = idx % 2 === 0 ? 1 : -1
      if (idx >= 0 && lines) {
        const l = lines[idx]
        const next = lines[idx + 1]
        const lineMs = next ? next.timeMs - l.timeMs : 3000
        const words = l.text.trim().split(/\s+/)
        const stagger = Math.min(0.16, ((lineMs / 1000) * 0.55) / Math.max(1, words.length))
        const short = l.text.length <= 22
        const kind: Kind = short && idx % 2 === 0 ? 'ring' : 'front'
        const style = STYLES[(idx * 7 + words.length) % STYLES.length]
        setLine({ idx, text: l.text, startedAt: now, stagger, kind, style, dir: sign })
        setBgTexts((prev) => {
          const n = prev.slice()
          n[idx % BG_N] = l.text
          return n
        })
        // hit strength: short punchy lines and every 4th line land hardest
        const strong = words.length <= 3 || idx % 4 === 3
        hit.current = strong ? 1 : 0.5
        // disc kick; every 6th line scratches backwards like a DJ
        kick.current += idx % 6 === 5 ? -9 : strong ? 3.2 : 1.6
        flip.current += 1
      } else {
        setLine(null)
      }
      // new camera shot: jump round the disc, new radius/height
      d.azT += sign * (0.9 + (idx % 3) * 0.25)
      d.rT = [6.9, 7.9, 8.6][(idx + 3) % 3]
      d.hT = [0.8, 1.7, -0.1][(idx + 4) % 3]
    }

    // camera: keeps orbiting the disc, never cuts away -----------------------------------------
    const tl = e - d.shotStart
    d.azT += dt * 0.06
    const rate = 1.2 + 4.5 * Math.exp(-tl * 2.6)
    const f = 1 - Math.exp(-rate * dt)
    d.az += (d.azT - d.az) * f
    d.r += (d.rT - d.r) * f
    d.h += (d.hT - d.h) * f
    const shake = hit.current * 0.1
    camPos.set(
      Math.sin(d.az) * d.r + Math.sin(e * 0.8) * 0.1 + (Math.random() - 0.5) * shake,
      d.h + Math.cos(e * 0.9) * 0.08 + (Math.random() - 0.5) * shake,
      Math.cos(d.az) * d.r + (Math.random() - 0.5) * shake
    )
    state.camera.position.copy(camPos)
    state.camera.lookAt(0, 0.2, 0)
    state.camera.rotateZ(Math.sin(e * 0.5) * 0.015 + (Math.random() - 0.5) * hit.current * 0.012)
    const cam = state.camera as THREE.PerspectiveCamera
    const fov = 50 + 9 * Math.exp(-tl * 3.2) + hit.current * 3
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }

    // front-text anchor: sits between disc and camera, lags a little so the orbit reads ----------
    d.anchorAz += (d.az - d.anchorAz) * (1 - Math.exp(-dt * 2.4))
    d.anchorR += (d.r - d.anchorR) * (1 - Math.exp(-dt * 2.4))
    if (frontAnchor.current) {
      const dist = Math.max(2.4, d.anchorR - 4.4)
      frontAnchor.current.position.set(Math.sin(d.anchorAz) * dist, 0.3, Math.cos(d.anchorAz) * dist)
      frontAnchor.current.rotation.set(0, d.anchorAz + 0.1 * (flip.current % 2 ? 1 : -1), 0)
    }

    // hit effects -------------------------------------------------------------------------------
    hit.current = Math.max(0, hit.current - dt * 2.4)
    if (bloom.current) bloom.current.intensity = 0.8 + hit.current * 1.7
    if (chroma.current) chroma.current.offset.set(0.0006 + hit.current * 0.005, 0.0009 + hit.current * 0.006)
    // flat colour block that flips each line, flashes on hits
    const target = flip.current % 2 ? bgBase : bgAlt
    bgNow.lerp(target, 1 - Math.exp(-dt * 7))
    tmpC.copy(bgNow).lerp(white, hit.current * 0.28)
    ;(state.scene.background as THREE.Color).copy(tmpC)
    if (state.scene.fog) (state.scene.fog as THREE.Fog).color.copy(tmpC)
  })

  const ringLine = line && line.kind === 'ring' ? line : null
  const frontLine = line && line.kind === 'front' ? line : null
  const intro = !line

  return (
    <>
      <color attach="background" args={['#0a0a14']} />
      <fog attach="fog" args={['#0a0a14', 14, 40]} />
      <Environment resolution={256} frames={1} key={accent}>
        <Lightformer form="rect" intensity={5} color="#ffffff" position={[0, 6, 4]} scale={[14, 3, 1]} />
        <Lightformer form="rect" intensity={4} color={accent} position={[-7, 1, 2]} scale={[3, 8, 1]} />
        <Lightformer form="rect" intensity={3} color="#8ab4ff" position={[7, 2, -2]} scale={[3, 8, 1]} />
        <Lightformer form="ring" intensity={3} color={accent} position={[0, -1, -6]} scale={8} />
      </Environment>
      <pointLight position={[0, 2, 3]} intensity={6} color={accent} distance={16} />

      <World accent={accent} />
      <BgScreens texts={bgTexts} accent={accent} />
      <Disc accent={accent} art={art} artVersion={artVersion} playing={playing} kick={kick} ringLine={ringLine} mats={mats} />

      <group ref={frontAnchor}>
        {frontLine && <FrontText key={frontLine.idx} line={frontLine} mats={mats} />}
        {intro && (
          <IntroCard info={info} mats={mats} accent={accent} />
        )}
      </group>

      <EffectComposer multisampling={0}>
        <Bloom ref={bloom} mipmapBlur intensity={0.8} luminanceThreshold={0.4} luminanceSmoothing={0.3} />
        <ChromaticAberration ref={chroma} offset={new THREE.Vector2(0.0006, 0.0009)} radialModulation modulationOffset={0.3} blendFunction={BlendFunction.NORMAL} />
        <Vignette eskil={false} offset={0.25} darkness={0.8} />
      </EffectComposer>
    </>
  )
}

/** Title / artist slam shown before the first lyric line of a track. */
function IntroCard({ info, mats }: { info: React.MutableRefObject<VoidInfo>; mats: { normal: THREE.Material; emph: THREE.Material }; accent: string }) {
  const [state] = useState(() => ({
    title: info.current.title,
    artist: info.current.artist,
    startedAt: performance.now()
  }))
  return (
    <>
      <FrontText line={{ text: state.title.slice(0, 40), startedAt: state.startedAt, stagger: 0.12, style: 'slam', dir: 1 }} mats={mats} yOffset={0.5} />
      <FrontText line={{ text: state.artist.slice(0, 40), startedAt: state.startedAt + 500, stagger: 0.08, style: 'slide', dir: -1 }} mats={mats} maxScale={0.5} yOffset={-1.5} />
    </>
  )
}

/* ------------------------------------------------------------------------------------------ */
/* wrapper with a small HTML overlay                                                           */
/* ------------------------------------------------------------------------------------------ */

export const LyricVoid: React.FC<{
  spotify: SpotifyDeviceSource
  colors: ColorPalette
  albumArtUrl?: string
}> = ({ spotify, colors, albumArtUrl }) => {
  const info = useRef<VoidInfo>({ title: '', artist: '', progress: 0 })
  const titleEl = useRef<HTMLDivElement>(null)
  const artistEl = useRef<HTMLDivElement>(null)
  const barEl = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = window.setInterval(() => {
      if (titleEl.current) titleEl.current.textContent = info.current.title
      if (artistEl.current) artistEl.current.textContent = info.current.artist
      if (barEl.current) barEl.current.style.width = `${Math.min(1, Math.max(0, info.current.progress)) * 100}%`
    }, 120)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a14', position: 'relative' }}>
      <Canvas camera={{ position: [0, 1, 7.6], fov: 50 }} dpr={[1, 2]} gl={{ antialias: false }} style={{ width: '100%', height: '100%' }}>
        <React.Suspense fallback={null}>
          <VoidScene spotify={spotify} colors={colors} albumArtUrl={albumArtUrl} info={info} />
        </React.Suspense>
      </Canvas>
      <div
        style={{
          position: 'absolute',
          left: 28,
          bottom: 26,
          width: 'min(360px, 60vw)',
          color: '#fff',
          pointerEvents: 'none',
          fontFamily: '"Helvetica Neue", Arial, sans-serif',
          textShadow: '0 2px 14px rgba(0,0,0,0.6)'
        }}
      >
        <div ref={titleEl} style={{ fontWeight: 800, fontSize: 18, letterSpacing: 0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} />
        <div ref={artistEl} style={{ fontWeight: 500, fontSize: 13, opacity: 0.7, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} />
        <div style={{ height: 3, background: 'rgba(255,255,255,0.22)', borderRadius: 2, marginTop: 10 }}>
          <div ref={barEl} style={{ height: '100%', width: '0%', background: '#fff', borderRadius: 2 }} />
        </div>
      </div>
    </div>
  )
}

export default LyricVoid
