import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import helvetikerBold from 'three/examples/fonts/helvetiker_bold.typeface.json'

/**
 * One lyric line as 3D glass type. Lines are laid out once at "active" size and then simply glide
 * between roles (past / active / next / ...) - that single glide is the only motion language.
 */

const FONT = new FontLoader().parse(helvetikerBold)

export type Role = 'gone' | 'past' | 'active' | 'next' | 'hidden'

/** y / scale / opacity / glow for every role, in text-group units. */
const ROLES: Record<Role, { y: number; s: number; opacity: number; glow: number }> = {
  gone: { y: 3.6, s: 0.3, opacity: 0, glow: 0 },
  past: { y: 2.45, s: 0.46, opacity: 0.2, glow: 0.1 },
  active: { y: 0, s: 1, opacity: 1, glow: 0.55 },
  next: { y: -2.35, s: 0.52, opacity: 0.55, glow: 0.2 },
  hidden: { y: -4.6, s: 0.2, opacity: 0, glow: 0 }
}

export const roleFor = (distance: number): Role =>
  distance < -1 ? 'gone' : distance === -1 ? 'past' : distance === 0 ? 'active' : distance === 1 ? 'next' : 'hidden'

/** Width / height of the block an active line may occupy (text-group units). */
export const TEXT_BLOCK_W = 6.2

interface Word {
  geo: THREE.BufferGeometry
  x: number
  y: number
}

function layoutWords(text: string, maxW: number, maxH: number, maxScale: number): { words: Word[]; scale: number } {
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
  type Row = { items: typeof geos; w: number }
  const wrap = (scale: number) => {
    const rowW = maxW / scale
    const rows: Row[] = []
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
    return rows
  }
  // prefer big type on at most 2 rows; only fall back to 3+ rows (smaller) for long lines
  const passes = [
    { rows: 2, min: 0.5 },
    { rows: 3, min: 0.4 },
    { rows: 99, min: 0.2 }
  ]
  let best: { rows: Row[]; scale: number } = { rows: wrap(0.2), scale: 0.2 }
  search: for (const pass of passes) {
    for (let scale = maxScale; scale >= pass.min; scale -= 0.05) {
      const rows = wrap(scale)
      if (rows.length <= pass.rows && rows.length * lineH * scale <= maxH) {
        best = { rows, scale }
        break search
      }
    }
  }

  const words: Word[] = []
  const totalH = best.rows.length * lineH
  best.rows.forEach((row, ri) => {
    let x = -row.w / 2
    const y = totalH / 2 - lineH * (ri + 0.5) - 0.35
    for (const item of row.items) {
      words.push({ geo: item.geo, x, y })
      x += item.w + space
    }
  })
  return { words, scale: best.scale }
}

interface TextLineProps {
  text: string
  role: Role
  chorus: boolean
  accent: string
  /** 0 calm .. 1 chorus; the active chorus line glows with it */
  energy: React.MutableRefObject<number>
}

export function TextLine({ text, role, chorus, accent, energy }: TextLineProps) {
  const { words, scale } = useMemo(() => layoutWords(text, TEXT_BLOCK_W, 2.6, 1.15), [text])
  useEffect(() => () => words.forEach((w) => w.geo.dispose()), [words])

  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        emissive: accent,
        emissiveIntensity: 0.5,
        transmission: 0.35,
        thickness: 0.7,
        ior: 1.4,
        roughness: 0.1,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        envMapIntensity: 2,
        transparent: true,
        opacity: 0,
        toneMapped: false
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  useEffect(() => {
    material.emissive.set(accent)
  }, [accent, material])
  useEffect(() => () => material.dispose(), [material])

  const group = useRef<THREE.Group>(null)
  // every line starts below the stack and glides up into its role
  const cur = useRef({ ...ROLES.hidden })

  useFrame((_, dt) => {
    const t = ROLES[role]
    const k = 1 - Math.exp(-dt * 6)
    const c = cur.current
    c.y += (t.y - c.y) * k
    c.s += (t.s - c.s) * k
    c.opacity += (t.opacity - c.opacity) * k
    c.glow += (t.glow - c.glow) * k
    const g = group.current
    if (!g) return
    g.visible = c.opacity > 0.01
    g.position.y = c.y
    g.scale.setScalar(c.s)
    material.opacity = c.opacity
    material.emissiveIntensity = c.glow + (role === 'active' && chorus ? 0.55 * energy.current : 0)
  })

  return (
    <group ref={group} visible={false}>
      <group scale={scale}>
        {words.map((w, i) => (
          <mesh key={`${text}-${i}`} geometry={w.geo} material={material} position={[w.x, w.y, 0]} />
        ))}
      </group>
    </group>
  )
}
