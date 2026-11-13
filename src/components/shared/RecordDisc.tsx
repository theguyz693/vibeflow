import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * The spinning record shared by the editorial "Lyric Void" and the 3D "Lyric Reel".
 * It sits on the left on wide screens and at the top on narrow ones (see discLayout), spins up and
 * down with playback, and speeds up / glows with `sync.energy` (the chorus).
 */

/** Where the disc lives for a given viewport (world units at z=0). */
export function discLayout(viewport: { width: number; height: number }) {
  const wide = viewport.width / viewport.height > 0.95
  const scale = wide ? Math.min(viewport.height * 0.34, viewport.width * 0.2) : Math.min(viewport.height * 0.2, viewport.width * 0.34)
  return {
    wide,
    scale,
    x: wide ? -viewport.width * 0.245 : 0,
    y: wide ? 0.1 : viewport.height * 0.2
  }
}

/* disc (the only 3D object)                                                                   */
/* ------------------------------------------------------------------------------------------ */

export interface Sync {
  playing: boolean
  energy: number // 0 calm .. 1 chorus
  kick: number // one-shot spin impulse
  px: number // pointer parallax -1..1
  py: number
  reduced: boolean
}

function makeCanvasTex(size: number) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return { canvas, ctx: canvas.getContext('2d')!, tex }
}

export function drawDisc(ctx: CanvasRenderingContext2D, size: number, art: HTMLImageElement | null, accent: string) {
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
    g.addColorStop(1, '#14141c')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = 'rgba(0,0,0,0.38)'
    ctx.font = '700 300px "Inter Variable", Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('♪', c, c + 10)
  }
  // fine vinyl grooves
  for (let r = size * 0.16; r < c; r += 4) {
    ctx.strokeStyle = `rgba(0,0,0,${0.05 + 0.04 * Math.sin(r * 0.9)})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(c, c, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  // label + spindle hole
  ctx.fillStyle = '#0b0b10'
  ctx.beginPath()
  ctx.arc(c, c, size * 0.12, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.arc(c, c, size * 0.022, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function makeSheen() {
  const c = makeCanvasTex(512)
  const g = (c.ctx as any).createConicGradient(0.7, 256, 256) as CanvasGradient
  const stops = [0, 0.07, 0.15, 0.5, 0.57, 0.65, 1]
  const alphas = [0, 0.22, 0, 0, 0.14, 0, 0]
  stops.forEach((s, i) => g.addColorStop(s, `rgba(255,255,255,${alphas[i]})`))
  c.ctx.fillStyle = g
  c.ctx.beginPath()
  c.ctx.arc(256, 256, 254, 0, Math.PI * 2)
  c.ctx.fill()
  c.tex.needsUpdate = true
  return c.tex
}

function makeRadial(rgb: string, a0: number) {
  const c = makeCanvasTex(256)
  const g = c.ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  g.addColorStop(0, `rgba(${rgb},${a0})`)
  g.addColorStop(0.5, `rgba(${rgb},${a0 * 0.3})`)
  g.addColorStop(1, `rgba(${rgb},0)`)
  c.ctx.fillStyle = g
  c.ctx.fillRect(0, 0, 256, 256)
  c.tex.needsUpdate = true
  return c.tex
}

export function Disc({ sync, art, artVersion, accent }: { sync: React.MutableRefObject<Sync>; art: HTMLImageElement | null; artVersion: number; accent: string }) {
  const viewport = useThree((s) => s.viewport)
  const root = useRef<THREE.Group>(null)
  const tilt = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  const halo = useRef<THREE.MeshBasicMaterial>(null)
  const vel = useRef(0)
  const energy = useRef(0)

  const cap = useMemo(() => makeCanvasTex(1024), [])
  const sheen = useMemo(makeSheen, [])
  const haloTex = useMemo(() => makeRadial('255,255,255', 1), [])
  const shadowTex = useMemo(() => makeRadial('0,0,0', 0.55), [])
  useEffect(() => {
    drawDisc(cap.ctx, 1024, art, accent)
    cap.tex.needsUpdate = true
  }, [cap, art, accent, artVersion])
  useEffect(
    () => () => {
      cap.tex.dispose()
      sheen.dispose()
      haloTex.dispose()
      shadowTex.dispose()
    },
    [cap, sheen, haloTex, shadowTex]
  )

  const { wide, scale, x, y } = discLayout(viewport)
  const basePos: [number, number] = [x, y]

  useFrame((state, dt) => {
    const s = sync.current
    energy.current += (s.energy - energy.current) * (1 - Math.exp(-dt * 2.2))
    const base = s.playing ? 0.85 + (s.reduced ? 0 : 1.1 * energy.current) : 0
    vel.current += (base - vel.current) * (1 - Math.exp(-dt * (s.playing ? 2.4 : 1.5)))
    if (s.kick) {
      if (!s.reduced) vel.current += s.kick
      s.kick = 0
    }
    if (spin.current) spin.current.rotation.z -= vel.current * dt

    const t = state.clock.elapsedTime
    if (root.current) {
      const k = 1 + energy.current * 0.035
      root.current.scale.setScalar(scale * k)
      root.current.position.set(basePos[0], basePos[1] + (s.reduced ? 0 : Math.sin(t * 0.6) * 0.05), 0)
    }
    if (tilt.current) {
      const tx = s.reduced ? 0 : s.py * -0.1
      const ty = s.reduced ? 0 : s.px * 0.18
      tilt.current.rotation.x += (-0.08 + tx - tilt.current.rotation.x) * (1 - Math.exp(-dt * 3))
      tilt.current.rotation.y += (0.32 + ty - tilt.current.rotation.y) * (1 - Math.exp(-dt * 3))
    }
    if (halo.current) halo.current.opacity = 0.2 + energy.current * 0.28
  })

  return (
    <group ref={root}>
      {/* soft contact shadow under the disc */}
      <mesh position={[0.05, -1.32, -0.4]} scale={[1.7, 0.32, 1]}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      {/* palette halo behind it */}
      <mesh position={[0, 0, -0.6]}>
        <planeGeometry args={[4.4, 4.4]} />
        <meshBasicMaterial ref={halo} map={haloTex} color={accent} transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={tilt} rotation={[-0.08, 0.32, 0]}>
        <group ref={spin}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[1, 1, 0.07, 128]} />
            <meshStandardMaterial attach="material-0" color="#16161c" metalness={1} roughness={0.28} />
            <meshBasicMaterial attach="material-1" map={cap.tex} toneMapped={false} />
            <meshBasicMaterial attach="material-2" map={cap.tex} toneMapped={false} />
          </mesh>
        </group>
        <mesh position={[0, 0, 0.04]}>
          <circleGeometry args={[1, 96]} />
          <meshBasicMaterial map={sheen} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

