import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { parse } from 'opentype.js'
// Default display face: a fat, rounded "bubble" font that inflates nicely into glass.
// To use your own font, drop a .ttf/.woff into public/fonts and point GLASS_FONT_URL at it
// (TrueType-flavoured fonts work best).
import bagelUrl from '@fontsource/bagel-fat-one/files/bagel-fat-one-latin-400-normal.woff?url'

/**
 * Real-font 3D glass type.
 *
 *   loadGlassFont / useGlassFont   load the font once
 *   makeWordGeometry               outline -> extruded, heavily bevelled, smooth-shaded letters
 *   layoutWords                    wrap words into rows and fit them into a box
 *   createGlassMaterial            see-through glass with refraction, dispersion and rim light
 */

export const GLASS_FONT_URL: string = bagelUrl

type Font = any

let fontPromise: Promise<Font> | null = null
let fontCache: Font | null = null

export function loadGlassFont(): Promise<Font> {
  if (!fontPromise) {
    fontPromise = fetch(GLASS_FONT_URL)
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        fontCache = parse(buf)
        return fontCache
      })
  }
  return fontPromise
}

/** The parsed font, or null while it is still loading (components render nothing until then). */
export function useGlassFont(): Font | null {
  const [font, setFont] = useState<Font | null>(fontCache)
  useEffect(() => {
    if (fontCache) return
    let alive = true
    loadGlassFont().then((f) => alive && setFont(f))
    return () => {
      alive = false
    }
  }, [])
  return font
}

const S = 100 // size the outline is extruded at (bevels are specified in these units)
const CAP = 0.72 // cap height of the finished letters, in text units

/** One word as an extruded, inflated, smooth-shaded glass mesh. Left edge at x=0, baseline at y=0. */
export function makeWordGeometry(font: Font, word: string): { geo: THREE.BufferGeometry; w: number } | null {
  const clean = [...word].filter((ch) => ch === ' ' || font.charToGlyphIndex(ch) > 0).join('')
  if (!clean.trim()) return null
  const path = font.getPath(clean, 0, 0, S)
  const sp = new THREE.ShapePath()
  for (const c of path.commands) {
    // opentype is y-down; flip so letters stand up
    if (c.type === 'M') sp.moveTo(c.x, -c.y)
    else if (c.type === 'L') sp.lineTo(c.x, -c.y)
    else if (c.type === 'C') sp.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y)
    else if (c.type === 'Q') sp.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y)
  }
  const shapes = sp.toShapes(false)
  if (!shapes.length) return null

  const depth = 0.16 * S
  let geo: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shapes, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.1 * S, // thick, rounded bevel = the "inflated glass" look
    bevelSize: 0.045 * S,
    bevelOffset: 0,
    bevelSegments: 8,
    curveSegments: 14
  })
  geo.translate(0, 0, -depth / 2)

  const capUnits = ((font.tables?.os2?.sCapHeight || 0.7 * font.unitsPerEm) / font.unitsPerEm) * S
  const k = CAP / capUnits
  geo.scale(k, k, k)
  geo = toCreasedNormals(geo, 0.9) // smooth across the bevel, crisp on the cap edges
  geo.computeBoundingBox()
  const bb = geo.boundingBox!
  geo.translate(-bb.min.x, 0, 0)
  return { geo, w: bb.max.x - bb.min.x }
}

export interface Word {
  geo: THREE.BufferGeometry
  x: number
  y: number
  /** width of the word at scale 1 */
  w: number
}

/** Wrap `text` into rows and pick the largest scale (<= maxScale) at which it fits maxW x maxH. */
export function layoutWords(font: Font, text: string, maxW: number, maxH: number, maxScale: number): { words: Word[]; scale: number } {
  const geos = text
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => makeWordGeometry(font, word))
    .filter((g): g is { geo: THREE.BufferGeometry; w: number } => !!g)

  const space = 0.34
  const lineH = 1.25
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
    const y = totalH / 2 - lineH * (ri + 0.5) - 0.3
    for (const item of row.items) {
      words.push({ geo: item.geo, x, y, w: item.w })
      x += item.w + space
    }
  })
  return { words, scale: best.scale }
}

/**
 * See-through glass: full transmission so the scene refracts through it, dispersion for the
 * rainbow-edged split, a faint accent tint, and a clearcoat for crisp rim highlights.
 */
export function createGlassMaterial(accent: string, emissive = 0.1) {
  return new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    metalness: 0,
    roughness: 0.12, // a touch of frosting keeps the letters readable over any backdrop
    transmission: 0.82,
    thickness: 1.8,
    ior: 1.45,
    dispersion: 6,
    attenuationColor: new THREE.Color(accent).lerp(new THREE.Color('#ffffff'), 0.65),
    attenuationDistance: 4,
    specularIntensity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    iridescence: 0.35,
    iridescenceIOR: 1.3,
    envMapIntensity: 5.5,
    emissive: new THREE.Color(accent),
    emissiveIntensity: emissive,
    toneMapped: false
  })
}
