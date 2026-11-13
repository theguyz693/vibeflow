import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { DISC_R, FONT, FONT_RES, LineState } from './constants'
import { easeOutBack, easeOutCubic } from './utils'

export const letterGeoCache = new Map<string, THREE.BufferGeometry>()
export function letterGeo(ch: string) {
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
export const advanceOf = (ch: string) => {
  if (ch === ' ') return 0.32
  const gl = (FONT as any).data.glyphs[ch]
  return gl ? gl.ha / FONT_RES : 0.6
}

export function RingText({ line, mats }: { line: LineState; mats: { normal: THREE.Material; emph: THREE.Material } }) {
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
