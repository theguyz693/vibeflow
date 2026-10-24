import React, { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { SpotifyPlaybackState } from '../types/spotify'
import { MP3ScreenCanvas, ScreenData } from './MP3ScreenCanvas'

/** Subset of the existing useSpotify() return value used by the 3D device. */
export interface SpotifyDeviceSource {
  isLoggedIn: boolean
  currentTrack: SpotifyPlaybackState | null
  volume: number // 0-100
  togglePlay: () => Promise<void>
  skipNext: () => Promise<void>
  skipPrev: () => Promise<void>
  changeVolume: (percent: number) => Promise<void>
}

interface MP3ModelProps {
  spotify: SpotifyDeviceSource
}

/** Gap between glass and display plane (model units) - prevents z-fighting. */
const SCREEN_OFFSET = 0.004

/**
 * The GLB is one baked mesh. Its front glass is the group of +Z-facing (mesh space) vertices
 * lying on the front-most plane. Measure that group so the display matches the real glass
 * instead of hardcoded numbers. All values are in the mesh's local space.
 */
function measureScreen(root: THREE.Object3D) {
  let found: THREE.Mesh | null = null
  root.traverse((o) => {
    if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh
  })
  if (!found) return null
  const mesh = found as THREE.Mesh
  const pos = mesh.geometry.attributes.position
  const nor = mesh.geometry.attributes.normal
  let maxZ = -Infinity
  for (let i = 0; i < pos.count; i++) {
    if (nor.getZ(i) > 0.98) maxZ = Math.max(maxZ, pos.getZ(i))
  }
  const box = new THREE.Box3()
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    if (nor.getZ(i) > 0.98 && Math.abs(pos.getZ(i) - maxZ) < 0.002) {
      box.expandByPoint(v.fromBufferAttribute(pos, i))
    }
  }
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  return { mesh, width: size.x, height: size.y, center: new THREE.Vector3(center.x, center.y, maxZ) }
}

function MP3Device({ spotify }: MP3ModelProps) {
  const gltf = useGLTF('/models/mp3_player.glb')
  const gl = useThree((s) => s.gl)
  const screen = useMemo(() => measureScreen(gltf.scene), [gltf.scene])
  const screenCanvas = useMemo(
    () => new MP3ScreenCanvas(screen ? screen.width / screen.height : 1.17),
    [screen]
  )
  const [activeBtn, setActiveBtn] = useState<string | null>(null)
  const pressedDepthRef = useRef<{ [k: string]: number }>({
    center: 0,
    play: 0,
    menu: 0,
    next: 0,
    prev: 0
  })

  // Latest Spotify snapshot + arrival time, so progress can be interpolated between polls.
  const snapRef = useRef({ spotify, receivedAt: performance.now() })
  snapRef.current.spotify = spotify
  useEffect(() => {
    snapRef.current.receivedAt = performance.now()
  }, [spotify.currentTrack])

  // Display plane: a child of the model's own mesh node => inherits every transform of the device.
  const screenPlane = useMemo(() => {
    if (!screen) return null
    const tex = screenCanvas.texture
    tex.anisotropy = gl.capabilities.getMaxAnisotropy()
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(screen.width, screen.height),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.5, // rounded corners
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      })
    )
    plane.name = 'ScreenDisplay'
    // Mesh-local: plane faces +Z (same as the glass normal) and sits just above the glass.
    plane.position.set(screen.center.x, screen.center.y, screen.center.z + SCREEN_OFFSET)
    return plane
  }, [screen, screenCanvas, gl])

  useEffect(() => {
    if (!screen || !screenPlane) return
    screen.mesh.add(screenPlane)
    return () => {
      screen.mesh.remove(screenPlane)
      screenPlane.geometry.dispose()
      ;(screenPlane.material as THREE.Material).dispose()
    }
  }, [screen, screenPlane])

  useEffect(() => () => screenCanvas.dispose(), [screenCanvas])

  // Redraw the screen only when the (interpolated) Spotify state changes
  useFrame(() => {
    const { spotify: sp, receivedAt } = snapRef.current
    const t = sp.currentTrack
    const item = t?.item ?? null
    const duration = item?.duration_ms ?? 0
    let progress = t?.progress_ms ?? 0
    if (t?.is_playing) progress += performance.now() - receivedAt
    if (duration) progress = Math.min(progress, duration)
    const data: ScreenData = {
      connected: sp.isLoggedIn,
      hasTrack: !!item,
      title: item?.name ?? '',
      artist: item?.artists?.map((a) => a.name).join(', ') ?? '',
      album: item?.album?.name ?? '',
      artUrl: item?.album?.images?.[1]?.url || item?.album?.images?.[0]?.url,
      progressMs: progress,
      durationMs: duration,
      isPlaying: !!t?.is_playing,
      volume: sp.volume
    }
    screenCanvas.render(data)

    // Smooth button return animation
    Object.keys(pressedDepthRef.current).forEach((k) => {
      pressedDepthRef.current[k] = THREE.MathUtils.lerp(pressedDepthRef.current[k], 0, 0.25)
    })
  })

  // Click & Press handlers
  const triggerButton = (name: string, action: () => void) => {
    pressedDepthRef.current[name] = 0.04
    setActiveBtn(name)
    setTimeout(() => setActiveBtn(null), 180)
    action()
  }

  // Controls drive the existing Spotify actions
  const audio = {
    togglePlay: () => void spotify.togglePlay(),
    nextTrack: () => void spotify.skipNext(),
    prevTrack: () => void spotify.skipPrev(),
    volume: spotify.volume / 100,
    setVolume: (v: number) => void spotify.changeVolume(Math.round(v * 100))
  }

  // The GLB's node chain composes to (x, y, z) -> (x, z, -y): the device lies flat with the screen
  // facing world +Y (this is why a +Z-facing overlay looked perpendicular). A +90deg X rotation of
  // the model stands it upright facing the camera. The display is a child of the mesh, and the
  // click-wheel hitboxes share the same upright model frame.
  return (
    <group position={[0, 0, 0]}>
      <group rotation={[Math.PI / 2, 0, 0]}>
        <primitive object={gltf.scene} scale={1} />
      </group>

      {/* Interactive Physical Click-Wheel Hitboxes with tactile feedback */}
      <group position={[0.002, -0.855, -0.01]}>
        {/* Center Select Button */}
        <mesh
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, activeBtn === 'center' ? -0.03 : 0]}
          onClick={(e) => {
            e.stopPropagation()
            triggerButton('center', () => audio.togglePlay())
          }}
          onPointerDown={() => (pressedDepthRef.current.center = 0.03)}
        >
          <cylinderGeometry args={[0.26, 0.26, 0.04, 32]} />
          <meshStandardMaterial
            color={activeBtn === 'center' ? '#cbd5e1' : '#f8fafc'}
            roughness={0.3}
            metalness={0.1}
            opacity={0.15}
            transparent={true}
          />
        </mesh>

        {/* Play/Pause Button (Bottom Quadrant) */}
        <mesh
          position={[0, -0.45, activeBtn === 'play' ? -0.03 : 0]}
          onClick={(e) => {
            e.stopPropagation()
            triggerButton('play', () => audio.togglePlay())
          }}
          onPointerDown={() => (pressedDepthRef.current.play = 0.03)}
        >
          <boxGeometry args={[0.42, 0.28, 0.04]} />
          <meshStandardMaterial
            color={activeBtn === 'play' ? '#38bdf8' : '#ffffff'}
            roughness={0.3}
            opacity={activeBtn === 'play' ? 0.4 : 0.01}
            transparent={true}
          />
        </mesh>

        {/* Next Track Button (Right Quadrant) */}
        <mesh
          position={[0.45, 0, activeBtn === 'next' ? -0.03 : 0]}
          onClick={(e) => {
            e.stopPropagation()
            triggerButton('next', () => audio.nextTrack())
          }}
          onPointerDown={() => (pressedDepthRef.current.next = 0.03)}
        >
          <boxGeometry args={[0.28, 0.42, 0.04]} />
          <meshStandardMaterial
            color={activeBtn === 'next' ? '#38bdf8' : '#ffffff'}
            roughness={0.3}
            opacity={activeBtn === 'next' ? 0.4 : 0.01}
            transparent={true}
          />
        </mesh>

        {/* Previous Track Button (Left Quadrant) */}
        <mesh
          position={[-0.45, 0, activeBtn === 'prev' ? -0.03 : 0]}
          onClick={(e) => {
            e.stopPropagation()
            triggerButton('prev', () => audio.prevTrack())
          }}
          onPointerDown={() => (pressedDepthRef.current.prev = 0.03)}
        >
          <boxGeometry args={[0.28, 0.42, 0.04]} />
          <meshStandardMaterial
            color={activeBtn === 'prev' ? '#38bdf8' : '#ffffff'}
            roughness={0.3}
            opacity={activeBtn === 'prev' ? 0.4 : 0.01}
            transparent={true}
          />
        </mesh>

        {/* Menu / Volume Up Button (Top Quadrant) */}
        <mesh
          position={[0, 0.45, activeBtn === 'menu' ? -0.03 : 0]}
          onClick={(e) => {
            e.stopPropagation()
            triggerButton('menu', () => audio.setVolume(Math.min(1, audio.volume + 0.1)))
          }}
          onPointerDown={() => (pressedDepthRef.current.menu = 0.03)}
        >
          <boxGeometry args={[0.42, 0.28, 0.04]} />
          <meshStandardMaterial
            color={activeBtn === 'menu' ? '#38bdf8' : '#ffffff'}
            roughness={0.3}
            opacity={activeBtn === 'menu' ? 0.4 : 0.01}
            transparent={true}
          />
        </mesh>
      </group>
    </group>
  )
}

export const MP3Player3D: React.FC<{ spotify: SpotifyDeviceSource }> = ({ spotify }) => {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 0, 7.8], fov: 38 }}
        style={{ width: '100%', height: '100%', background: 'radial-gradient(circle at 50% 40%, #1e1b4b 0%, #09090b 100%)' }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 8, 5]} intensity={2.0} castShadow />
        <directionalLight position={[-5, -4, -3]} intensity={0.8} />
        <pointLight position={[0, 2, 4]} intensity={1.5} color="#e0f2fe" />
        <pointLight position={[0, -2, 3]} intensity={1.0} color="#f8fafc" />

        <React.Suspense fallback={null}>
          <MP3Device spotify={spotify} />
        </React.Suspense>

        <OrbitControls
          enablePan={false}
          minDistance={4}
          maxDistance={14}
          maxPolarAngle={Math.PI / 1.7}
          minPolarAngle={Math.PI / 3}
          dampingFactor={0.05}
        />
      </Canvas>

      {/* Floating Instructions HUD */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(12px)',
          padding: '10px 24px',
          borderRadius: '30px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          color: '#ffffff',
          display: 'flex',
          gap: '20px',
          alignItems: 'center',
          fontSize: '13px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          pointerEvents: 'none',
          userSelect: 'none'
        }}
      >
        <span>🎯 <b>Click Center or Play Button</b> to Play/Pause</span>
        <span>⏭ <b>Click Right</b>: Next</span>
        <span>⏮ <b>Click Left</b>: Prev</span>
        <span>🖱️ <b>Drag</b> to rotate 3D device</span>
      </div>
    </div>
  )
}
export default MP3Player3D
