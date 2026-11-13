import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DISC_R, LineState } from './constants'
import { RingText } from './RingText'
import { makeCanvasTex, radialTexture } from './utils'

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

export function makeSheenTexture() {
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

export interface DiscProps {
  accent: string
  art: HTMLImageElement | null
  artVersion: number
  playing: React.MutableRefObject<boolean>
  kick: React.MutableRefObject<number>
  ringLine: LineState | null
  mats: { normal: THREE.Material; emph: THREE.Material }
}

export function Disc({ accent, art, artVersion, playing, kick, ringLine, mats }: DiscProps) {
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
