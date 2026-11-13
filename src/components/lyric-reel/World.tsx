import { MeshReflectorMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { radialTexture } from './utils'

/** A quiet stage: one soft reflective floor and a pool of palette light under the record. */
export function World({ accent, floorY, poolX }: { accent: string; floorY: number; poolX: number }) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY, 0]}>
        <planeGeometry args={[80, 80]} />
        <MeshReflectorMaterial
          resolution={512}
          blur={[300, 100]}
          mixBlur={1}
          mixStrength={3}
          mirror={0.5}
          roughness={0.9}
          depthScale={0.6}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.2}
          color="#08080c"
          metalness={0.6}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[poolX, floorY + 0.02, 0]}>
        <planeGeometry args={[11, 11]} />
        <meshBasicMaterial map={radialTexture()} color={accent} transparent blending={THREE.AdditiveBlending} depthWrite={false} opacity={0.4} toneMapped={false} />
      </mesh>
    </>
  )
}
