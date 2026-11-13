import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { DEMO_LYRICS } from '../../services/lyricAnalysis'
import { ColorPalette } from '../../types/spotify'
import type { SpotifyDeviceSource } from '../MP3Player3D'
import { makeCanvasTex } from '../lyric-reel/utils'
import { drawDisc, makeSheen } from '../shared/RecordDisc'
import { HudInfo } from '../shared/TrackHud'
import { useLyricSource } from '../shared/useLyricSource'
import { HYPE_STYLES, HypeLine, HypeStyle, HypeText, useHypeMaterials } from './HypeText'

/**
 * Director for the "Disc Reel": a record so big it fills the whole frame sits behind the lyrics and
 * turns slowly, like the spinning-vinyl backdrops in lyric videos. Every line enters with a
 * randomly picked animation (6 of them). Chorus lines get bigger type and a brighter hit.
 */

const BG_Z = -5

/** The full-screen record. Radius is chosen so the disc always covers the whole viewport. */
function BigDisc({
  radius,
  art,
  artVersion,
  accent,
  speed
}: {
  radius: number
  art: HTMLImageElement | null
  artVersion: number
  accent: string
  speed: React.MutableRefObject<number>
}) {
  const spin = useRef<THREE.Group>(null)
  const cap = useMemo(() => makeCanvasTex(2048, 2048), [])
  const sheen = useMemo(makeSheen, [])
  useEffect(() => {
    drawDisc(cap.ctx, 2048, art, accent)
    cap.tex.needsUpdate = true
  }, [cap, art, accent, artVersion])
  useEffect(
    () => () => {
      cap.tex.dispose()
      sheen.dispose()
    },
    [cap, sheen]
  )
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.z -= speed.current * dt
  })
  return (
    <group position={[0, 0, BG_Z]} scale={radius}>
      <group ref={spin}>
        <mesh>
          <circleGeometry args={[1, 128]} />
          {/* dimmed so the glass lyrics always read on top of busy album art */}
          <meshBasicMaterial map={cap.tex} color="#7d7d7d" toneMapped={false} />
        </mesh>
      </group>
      {/* the light sheen does not spin with the record, so the reflection seems to travel */}
      <mesh position={[0, 0, 0.01]}>
        <circleGeometry args={[1, 96]} />
        <meshBasicMaterial map={sheen} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

interface SceneProps {
  spotify: SpotifyDeviceSource
  colors: ColorPalette
  albumArtUrl?: string
  info: React.MutableRefObject<HudInfo>
}

export function HypeScene({ spotify, colors, albumArtUrl, info }: SceneProps) {
  const accent = colors.glow || colors.accent || '#ffffff'
  const viewport = useThree((s) => s.viewport)
  const camera = useThree((s) => s.camera)
  const { lines, art, artVersion } = useLyricSource(spotify, albumArtUrl)
  const mats = useHypeMaterials(accent)

  const live = useRef({ spotify, lines, receivedAt: performance.now(), demoStart: performance.now(), idx: -2, lastStyle: '' as HypeStyle | '' })
  live.current.spotify = spotify
  live.current.lines = lines
  useEffect(() => {
    live.current.receivedAt = performance.now()
  }, [spotify.currentTrack])
  useEffect(() => {
    live.current.idx = -2
  }, [lines])

  const [line, setLine] = useState<(HypeLine & { chorus: boolean; intro: boolean }) | null>(null)
  const discSpeed = useRef(0.1)
  const vel = useRef(0.1)
  const hit = useRef(0)
  const pointer = useRef({ x: 0, y: 0 })
  const bloom = useRef<any>(null)
  const energy = useRef(0)
  const energyTarget = useRef(0)
  const playing = useRef(true)

  useEffect(() => {
    const move = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [])

  useFrame((state, dt) => {
    const L = live.current
    const t = L.spotify.currentTrack
    const isDemo = !t?.item
    const dur = t?.item?.duration_ms ?? DEMO_LYRICS[DEMO_LYRICS.length - 1].timeMs + 8000
    let progress = isDemo ? (performance.now() - L.demoStart) % dur : (t?.progress_ms ?? 0)
    if (!isDemo && t?.is_playing) progress += performance.now() - L.receivedAt
    info.current.title = t?.item?.name ?? 'Lyric Void'
    info.current.artist = t?.item?.artists?.map((a) => a.name).join(', ') ?? 'Preview mode'
    info.current.progress = dur ? progress / dur : 0
    playing.current = isDemo ? true : !!t?.is_playing

    let i = 0
    const p = progress + 120
    for (let k = 0; k < L.lines.length; k++) if (L.lines[k].timeMs <= p) i = k
    if (i !== L.idx && L.lines.length) {
      L.idx = i
      const l = L.lines[i]
      const next = L.lines[i + 1]
      // random entrance, never the same one twice in a row
      const pool = HYPE_STYLES.filter((s) => s !== L.lastStyle)
      const style = pool[Math.floor(Math.random() * pool.length)]
      L.lastStyle = style
      const words = Math.max(1, (l.dots ? 1 : l.text.trim().split(/\s+/).length))
      const lineMs = next ? next.timeMs - l.timeMs : 3000
      setLine({
        text: l.dots ? info.current.title || 'Lyric Void' : l.text,
        startedAt: performance.now(),
        stagger: Math.min(0.16, ((lineMs / 1000) * 0.55) / words),
        style: l.dots ? 'slam' : style,
        dir: Math.random() < 0.5 ? 1 : -1,
        chorus: l.chorus,
        intro: !!l.dots
      })
      const strong = l.chorus || words <= 3
      hit.current = l.chorus ? 1 : strong ? 0.6 : 0.3
      vel.current += l.chorus ? 0.5 : 0.18 // the record gets a little shove on every line
      energyTarget.current = l.chorus ? 1 : next?.chorus ? 0.3 : 0
    }
    energy.current += (energyTarget.current - energy.current) * (1 - Math.exp(-dt * 3))

    // the record: slow turn, eases to a stop on pause, shoved forward by lines
    const base = playing.current ? 0.11 + 0.12 * energy.current : 0
    vel.current += (base - vel.current) * (1 - Math.exp(-dt * 1.6))
    discSpeed.current = vel.current

    // camera: tiny parallax so the flat record still feels like a deep set
    const e = state.clock.elapsedTime
    state.camera.position.set(Math.sin(e * 0.2) * 0.3 + pointer.current.x * 0.4 + (Math.random() - 0.5) * hit.current * 0.04, Math.cos(e * 0.17) * 0.18 - pointer.current.y * 0.25, 10)
    state.camera.lookAt(0, 0, 0)

    hit.current = Math.max(0, hit.current - dt * 2.4)
    if (bloom.current) bloom.current.intensity = 0.55 + hit.current * 1.1 + energy.current * 0.3
    mats.normal.emissiveIntensity = 0.45 + energy.current * 0.35
  })

  // cover the whole frame at the record's depth
  const bg = viewport.getCurrentViewport(camera, [0, 0, BG_Z])
  const radius = (Math.hypot(bg.width, bg.height) / 2) * 1.04

  const maxW = viewport.width * 0.8
  const maxH = viewport.height * 0.62

  return (
    <>
      <color attach="background" args={['#050508']} />
      <Environment resolution={256} frames={1} key={accent}>
        <Lightformer form="rect" intensity={5} color="#ffffff" position={[0, 6, 4]} scale={[14, 3, 1]} />
        <Lightformer form="rect" intensity={3} color={accent} position={[-7, 1, 2]} scale={[3, 8, 1]} />
        <Lightformer form="rect" intensity={2.5} color="#8ab4ff" position={[7, 2, -2]} scale={[3, 8, 1]} />
      </Environment>

      <BigDisc radius={radius} art={art} artVersion={artVersion} accent={accent} speed={discSpeed} />

      {line && (
        <group rotation={[0, 0, line.dir * 0.035]}>
          <HypeText key={`${line.startedAt}`} line={line} mats={mats} maxW={maxW} maxH={maxH} maxScale={line.chorus || line.intro ? 2.1 : 1.7} yOffset={line.intro ? 0.5 : 0} />
          {line.intro && (
            <HypeText
              key={`artist-${line.startedAt}`}
              line={{ text: (info.current.artist || '').slice(0, 40), startedAt: line.startedAt + 500, stagger: 0.08, style: 'slide', dir: -1 }}
              mats={mats}
              maxW={maxW}
              maxH={maxH}
              maxScale={0.6}
              yOffset={-1.7}
            />
          )}
        </group>
      )}

      <EffectComposer multisampling={0}>
        <Bloom ref={bloom} mipmapBlur intensity={0.55} luminanceThreshold={0.5} luminanceSmoothing={0.3} />
        <Vignette eskil={false} offset={0.2} darkness={0.75} />
      </EffectComposer>
    </>
  )
}
