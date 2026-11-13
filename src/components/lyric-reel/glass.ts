import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

export function useGlassMaterials(accent: string) {
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
