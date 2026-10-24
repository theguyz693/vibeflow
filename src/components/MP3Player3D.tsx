import React, { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { SpotifyPlaybackState } from '../types/spotify'
import { MP3ScreenCanvas, ScreenData } from './MP3ScreenCanvas'
import { fetchLyrics, LyricLine } from '../services/lyrics'

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
  screenMode: 'now-playing' | 'lyrics'
  onToggleScreenMode: () => void
}

/** Gap between glass and display plane (model units) - prevents z-fighting. */
const SCREEN_OFFSET = 0.004

/**
 * The GLB is one baked mesh. Its front glass is the group of +Z-facing (mesh space) vertices
 * lying on the front-most plane. Measure that group so the display matches the real glass.
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

function MP3Device({ spotify, screenMode, onToggleScreenMode }: MP3ModelProps) {
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

  // Synchronized Lyrics State
  const [lyrics, setLyrics] = useState<LyricLine[] | null>(null)
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const currentItem = spotify.currentTrack?.item

  useEffect(() => {
    let active = true
    if (!currentItem) {
      setLyrics(null)
      return
    }

    setLyricsLoading(true)
    fetchLyrics(
      currentItem.artists?.[0]?.name || '',
      currentItem.name || '',
      currentItem.album?.name || '',
      currentItem.duration_ms || 0
    )
      .then((res) => {
        if (active) {
          setLyrics(res)
          setLyricsLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setLyrics(null)
          setLyricsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [currentItem?.id])

  // Latest Spotify snapshot + arrival time, so progress can be interpolated between polls.
  const snapRef = useRef({ spotify, receivedAt: performance.now() })
  snapRef.current.spotify = spotify
  useEffect(() => {
    snapRef.current.receivedAt = performance.now()
  }, [spotify.currentTrack])

  // Display plane: child of the model's own mesh node => inherits every transform of the device.
  const screenPlane = useMemo(() => {
    if (!screen) return null
    const tex = screenCanvas.texture
    tex.anisotropy = gl.capabilities.getMaxAnisotropy()
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(screen.width, screen.height),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        alphaTest: 0.5,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      })
    )
    plane.name = 'ScreenDisplay'
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

  // Redraw the screen on each animation frame
  useFrame(() => {
    const { spotify: sp, receivedAt } = snapRef.current
    const t = sp.currentTrack
    const item = t?.item ?? null
    const duration = item?.duration_ms ?? 0
    let progress = t?.progress_ms ?? 0
    if (t?.is_playing) progress += performance.now() - receivedAt
    if (duration) progress = Math.min(progress, duration)

    // Calculate current synced lyric line
    let lyricPrev = ''
    let lyricCur = ''
    let lyricNext = ''
    if (lyrics && lyrics.length > 0) {
      const offsetProgress = progress + 200
      const activeIdx = lyrics.findIndex(
        (line, i) =>
          line.timeMs <= offsetProgress &&
          (i === lyrics.length - 1 || lyrics[i + 1].timeMs > offsetProgress)
      )
      if (activeIdx >= 0) {
        lyricCur = lyrics[activeIdx].text
        lyricPrev = activeIdx > 0 ? lyrics[activeIdx - 1].text : ''
        lyricNext = activeIdx < lyrics.length - 1 ? lyrics[activeIdx + 1].text : ''
      }
    }

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
      volume: sp.volume,
      mode: screenMode,
      lyrics: {
        prev: lyricPrev,
        current: lyricCur,
        next: lyricNext
      },
      lyricsLoading
    }
    screenCanvas.render(data)

    // Smooth button return animation
    Object.keys(pressedDepthRef.current).forEach((k) => {
      pressedDepthRef.current[k] = THREE.MathUtils.lerp(pressedDepthRef.current[k], 0, 0.25)
    })
  })

  // Tactile button press trigger
  const triggerButton = (name: string, action: () => void) => {
    pressedDepthRef.current[name] = 0.015
    setActiveBtn(name)
    setTimeout(() => setActiveBtn(null), 180)
    action()
  }

  const setPointer = (isHover: boolean) => {
    document.body.style.cursor = isHover ? 'pointer' : 'auto'
  }

  return (
    <group position={[0, 0, 0]}>
      {/* 3D GLTF Model stood upright facing +Z */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        <primitive object={gltf.scene} scale={1} />
      </group>

      {/* Tactile Click-Wheel Interactive Hitboxes & Glow Highlights */}
      <group position={[0, -0.855, 0.015]}>
        {/* Center Select Button: circle becomes darker / blacker on press with physical depression */}
        <mesh
          position={[0, 0, activeBtn === 'center' ? -0.015 : 0]}
          onClick={(e) => {
            e.stopPropagation()
            triggerButton('center', () => spotify.togglePlay())
          }}
          onPointerDown={() => (pressedDepthRef.current.center = 0.015)}
          onPointerOver={() => setPointer(true)}
          onPointerOut={() => setPointer(false)}
        >
          <circleGeometry args={[0.265, 36]} />
          <meshBasicMaterial
            color="#000000"
            opacity={activeBtn === 'center' ? 0.58 : 0.001}
            transparent={true}
          />
        </mesh>

        {/* Top Button (MENU): Cycles Screen between Now Playing and Synced Lyrics! */}
        <mesh
          position={[0, 0, activeBtn === 'menu' ? -0.012 : 0]}
          onClick={(e) => {
            e.stopPropagation()
            triggerButton('menu', () => onToggleScreenMode())
          }}
          onPointerDown={() => (pressedDepthRef.current.menu = 0.012)}
          onPointerOver={() => setPointer(true)}
          onPointerOut={() => setPointer(false)}
        >
          <ringGeometry args={[0.285, 0.68, 36, 1, Math.PI / 4, Math.PI / 2]} />
          <meshBasicMaterial
            color="#38bdf8"
            opacity={activeBtn === 'menu' ? 0.46 : 0.001}
            transparent={true}
          />
        </mesh>

        {/* Bottom Button (PLAY / PAUSE): Cyan tactile highlight on press */}
        <mesh
          position={[0, 0, activeBtn === 'play' ? -0.012 : 0]}
          onClick={(e) => {
            e.stopPropagation()
            triggerButton('play', () => spotify.togglePlay())
          }}
          onPointerDown={() => (pressedDepthRef.current.play = 0.012)}
          onPointerOver={() => setPointer(true)}
          onPointerOut={() => setPointer(false)}
        >
          <ringGeometry args={[0.285, 0.68, 36, 1, (5 * Math.PI) / 4, Math.PI / 2]} />
          <meshBasicMaterial
            color="#38bdf8"
            opacity={activeBtn === 'play' ? 0.46 : 0.001}
            transparent={true}
          />
        </mesh>

        {/* Right Button (NEXT TRACK): Cyan tactile highlight on press */}
        <mesh
          position={[0, 0, activeBtn === 'next' ? -0.012 : 0]}
          onClick={(e) => {
            e.stopPropagation()
            triggerButton('next', () => spotify.skipNext())
          }}
          onPointerDown={() => (pressedDepthRef.current.next = 0.012)}
          onPointerOver={() => setPointer(true)}
          onPointerOut={() => setPointer(false)}
        >
          <ringGeometry args={[0.285, 0.68, 36, 1, -Math.PI / 4, Math.PI / 2]} />
          <meshBasicMaterial
            color="#38bdf8"
            opacity={activeBtn === 'next' ? 0.46 : 0.001}
            transparent={true}
          />
        </mesh>

        {/* Left Button (PREVIOUS TRACK): Cyan tactile highlight on press */}
        <mesh
          position={[0, 0, activeBtn === 'prev' ? -0.012 : 0]}
          onClick={(e) => {
            e.stopPropagation()
            triggerButton('prev', () => spotify.skipPrev())
          }}
          onPointerDown={() => (pressedDepthRef.current.prev = 0.012)}
          onPointerOver={() => setPointer(true)}
          onPointerOut={() => setPointer(false)}
        >
          <ringGeometry args={[0.285, 0.68, 36, 1, (3 * Math.PI) / 4, Math.PI / 2]} />
          <meshBasicMaterial
            color="#38bdf8"
            opacity={activeBtn === 'prev' ? 0.46 : 0.001}
            transparent={true}
          />
        </mesh>
      </group>
    </group>
  )
}

export const MP3Player3D: React.FC<{ spotify: SpotifyDeviceSource }> = ({ spotify }) => {
  const [screenMode, setScreenMode] = useState<'now-playing' | 'lyrics'>('now-playing')

  const toggleScreenMode = () => {
    setScreenMode((prev) => (prev === 'now-playing' ? 'lyrics' : 'now-playing'))
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 0, 7.8], fov: 38 }}
        style={{
          width: '100%',
          height: '100%',
          background: 'radial-gradient(circle at 50% 40%, #171b30 0%, #06080e 100%)'
        }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 8, 5]} intensity={2.0} castShadow />
        <directionalLight position={[-5, -4, -3]} intensity={0.8} />
        <pointLight position={[0, 2, 4]} intensity={1.5} color="#e0f2fe" />
        <pointLight position={[0, -2, 3]} intensity={1.0} color="#f8fafc" />

        <React.Suspense fallback={null}>
          <MP3Device
            spotify={spotify}
            screenMode={screenMode}
            onToggleScreenMode={toggleScreenMode}
          />
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

      {/* Sleek, Modern Glass Floating Control Bar at Bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 22,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(10, 15, 29, 0.72)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '8px 18px',
          borderRadius: '9999px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          color: '#e2e8f0',
          display: 'flex',
          gap: '14px',
          alignItems: 'center',
          fontSize: '12px',
          fontWeight: 500,
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          userSelect: 'none',
          zIndex: 50
        }}
      >
        {/* Screen Mode Quick Toggle */}
        <button
          onClick={toggleScreenMode}
          style={{
            background: screenMode === 'lyrics' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.06)',
            border: screenMode === 'lyrics' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
            color: screenMode === 'lyrics' ? '#38bdf8' : '#cbd5e1',
            borderRadius: '12px',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease'
          }}
          title="Click or press MENU on iPod click-wheel"
        >
          <span style={{ fontSize: '10px', opacity: 0.8 }}>MENU</span>
          <span>{screenMode === 'lyrics' ? '🎵 Lyrics View' : '🖼️ Album Art'}</span>
        </button>

        <div style={{ width: '1px', height: '14px', background: 'rgba(255, 255, 255, 0.15)' }} />

        {/* Tactile Hints */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#94a3b8' }}>
          <span>
            <b style={{ color: '#f8fafc', fontWeight: 600 }}>Center</b> Play/Pause
          </span>
          <span>•</span>
          <span>
            <b style={{ color: '#f8fafc', fontWeight: 600 }}>⏮ / ⏭</b> Tracks
          </span>
          <span>•</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '13px' }}>🖱️</span> Drag to 3D Orbit
          </span>
        </div>

        {/* Live Spotify Indicator */}
        <div style={{ width: '1px', height: '14px', background: 'rgba(255, 255, 255, 0.15)' }} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color: spotify.isLoggedIn ? '#34d399' : '#94a3b8'
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: spotify.isLoggedIn ? '#34d399' : '#64748b',
              boxShadow: spotify.isLoggedIn ? '0 0 8px #34d399' : 'none'
            }}
          />
          <span>{spotify.isLoggedIn ? 'Live' : 'Offline'}</span>
        </div>
      </div>
    </div>
  )
}
export default MP3Player3D
