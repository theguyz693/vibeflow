import React, { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createGlassMaterial, layoutWords, useGlassFont } from '../shared/glassType'

/**
 * One lyric line as 3D glass type. Lines are laid out once at "active" size and then simply glide
 * between roles (past / active / next / ...) - that single glide is the only motion language.
 */

export type Role = 'gone' | 'past' | 'active' | 'next' | 'hidden'

/** y / scale / opacity / glow for every role, in text-group units. */
const ROLES: Record<Role, { y: number; s: number; opacity: number; glow: number }> = {
  gone: { y: 3.6, s: 0.3, opacity: 0, glow: 0 },
  past: { y: 2.45, s: 0.46, opacity: 0.35, glow: 0.04 },
  active: { y: 0, s: 1, opacity: 1, glow: 0.12 },
  next: { y: -2.35, s: 0.52, opacity: 0.7, glow: 0.06 },
  hidden: { y: -4.6, s: 0.2, opacity: 0, glow: 0 }
}

export const roleFor = (distance: number): Role =>
  distance < -1 ? 'gone' : distance === -1 ? 'past' : distance === 0 ? 'active' : distance === 1 ? 'next' : 'hidden'

/** Width of the block an active line may occupy (text-group units). */
export const TEXT_BLOCK_W = 6.2

interface TextLineProps {
  text: string
  role: Role
  chorus: boolean
  accent: string
  /** 0 calm .. 1 chorus; the active chorus line glows with it */
  energy: React.MutableRefObject<number>
}

export function TextLine({ text, role, chorus, accent, energy }: TextLineProps) {
  const font = useGlassFont()
  const laid = useMemo(() => (font ? layoutWords(font, text, TEXT_BLOCK_W, 2.6, 1.15) : null), [font, text])
  useEffect(() => () => laid?.words.forEach((w) => w.geo.dispose()), [laid])

  const material = useMemo(() => {
    const m = createGlassMaterial(accent)
    m.transparent = true
    m.opacity = 0
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    material.emissive.set(accent)
    material.attenuationColor.set(accent).lerp(new THREE.Color('#ffffff'), 0.65)
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
    material.emissiveIntensity = c.glow + (role === 'active' && chorus ? 0.5 * energy.current : 0)
  })

  if (!laid) return null
  return (
    <group ref={group} visible={false}>
      <group scale={laid.scale}>
        {laid.words.map((w, i) => (
          <mesh key={`${text}-${i}`} geometry={w.geo} material={material} position={[w.x, w.y, 0]} />
        ))}
      </group>
    </group>
  )
}
