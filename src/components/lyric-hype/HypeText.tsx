import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { easeOutBack, easeOutBounce, easeOutCubic, easeOutElastic, easeOutExpo } from '../shared/easing'
import { createGlassMaterial, layoutWords, useGlassFont } from '../shared/glassType'

/**
 * Big glass lyric type with six interchangeable entrances. The director picks one at random for
 * every line (never the same twice in a row), so the reel keeps surprising you.
 */

export type HypeStyle = 'slam' | 'slide' | 'stretch' | 'drop' | 'spin' | 'zoom'
export const HYPE_STYLES: HypeStyle[] = ['slam', 'slide', 'stretch', 'drop', 'spin', 'zoom']

export interface HypeMats {
  normal: THREE.MeshPhysicalMaterial
  emph: THREE.MeshPhysicalMaterial
}

export function useHypeMaterials(accent: string): HypeMats {
  const mats = useMemo<HypeMats>(
    () => ({
      normal: createGlassMaterial(accent, 0.04),
      // the last word of a line: same glass, but it glows and refracts harder
      emph: Object.assign(createGlassMaterial(accent, 0.7), { dispersion: 10 })
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  useEffect(() => {
    for (const m of [mats.normal, mats.emph]) {
      m.emissive.set(accent)
      m.attenuationColor.set(accent).lerp(new THREE.Color('#ffffff'), 0.65)
    }
  }, [accent, mats])
  useEffect(
    () => () => {
      mats.normal.dispose()
      mats.emph.dispose()
    },
    [mats]
  )
  return mats
}

export interface HypeLine {
  text: string
  startedAt: number
  stagger: number
  style: HypeStyle
  /** +1 / -1, flips the direction of slides, spins and tilts */
  dir: 1 | -1
}

interface HypeTextProps {
  line: HypeLine
  mats: HypeMats
  maxW: number
  maxH: number
  maxScale: number
  yOffset?: number
}

const DURATION: Record<HypeStyle, number> = { slam: 0.55, slide: 0.6, stretch: 0.85, drop: 0.8, spin: 0.7, zoom: 0.65 }

export function HypeText({ line, mats, maxW, maxH, maxScale, yOffset = 0 }: HypeTextProps) {
  const font = useGlassFont()
  const laid = useMemo(() => (font ? layoutWords(font, line.text, maxW, maxH, maxScale) : null), [font, line.text, maxW, maxH, maxScale])
  const words = laid?.words ?? []
  const scale = laid?.scale ?? 1
  useEffect(() => () => laid?.words.forEach((w) => w.geo.dispose()), [laid])
  const refs = useRef<(THREE.Group | null)[]>([])
  const last = words.length - 1

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
      const p = Math.min(1, t / DURATION[line.style])
      let sx = 1
      let sy = 1
      let px = w.x
      let py = w.y
      let pz = 0
      let rx = 0
      let ry = 0
      let rz = 0
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
          px = w.x + k * 9 * (i % 2 === 0 ? line.dir : -line.dir)
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
        case 'spin': {
          const k = 1 - easeOutCubic(p)
          ry = k * Math.PI * 1.1 * line.dir
          rx = k * 0.5
          sx = sy = 0.5 + 0.5 * easeOutBack(p)
          break
        }
        case 'zoom': {
          const k = 1 - easeOutExpo(p)
          pz = -k * 12
          sx = sy = 1 - k * 0.6
          break
        }
      }
      const pop = easeOutBack(Math.min(1, t / 0.35))
      const emph = i === last && words.length > 1 ? 1.16 : 1
      const s = Math.max(0.0001, pop) * emph
      g.scale.set(sx * s, sy * s, s)
      g.position.set(px, py, pz)
      g.rotation.set(rx, ry, rz)
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
            <mesh geometry={w.geo} material={i === last && words.length > 1 ? mats.emph : mats.normal} />
          </group>
        ))}
      </group>
    </group>
  )
}
