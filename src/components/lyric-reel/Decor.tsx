import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshReflectorMaterial, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { BG_SCREEN_R, FLOOR_Y } from './constants'
import { makeCanvasTex, radialTexture, roundRect } from './utils'

/** Set dressing: dim neon screens far outside the camera orbit, reflective floor, dust. */

export function drawBgScreen(t: ReturnType<typeof makeCanvasTex>, text: string, accent: string) {
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

export function BgScreen({ angle, y, text, accent, index }: { angle: number; y: number; text: string; accent: string; index: number }) {
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

export const BG_N = 7

export function BgScreens({ texts, accent }: { texts: string[]; accent: string }) {
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


export function World({ accent }: { accent: string }) {
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
