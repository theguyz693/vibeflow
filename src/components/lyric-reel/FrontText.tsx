import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { FONT, LineState } from './constants'
import { easeOutBack, easeOutBounce, easeOutCubic, easeOutElastic, easeOutExpo } from './utils'

export interface WordLayout {
  geo: THREE.BufferGeometry
  x: number
  y: number
  w: number
  row: number
}

export function layoutWords(text: string, maxW: number, maxH: number, maxScale: number): { words: WordLayout[]; scale: number } {
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

export interface FrontTextProps {
  line: Pick<LineState, 'text' | 'startedAt' | 'stagger' | 'style' | 'dir'>
  mats: { normal: THREE.Material; emph: THREE.Material }
  maxScale?: number
  yOffset?: number
}

export function FrontText({ line, mats, maxScale = 1.5, yOffset = 0 }: FrontTextProps) {
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
