import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { fetchLyrics, LyricLine } from '../../services/lyrics'
import { buildLines, DEMO_LYRICS } from '../../services/lyricAnalysis'
import { ColorPalette } from '../../types/spotify'
import type { SpotifyDeviceSource } from '../MP3Player3D'
import { Disc, discLayout, Sync } from '../shared/RecordDisc'
import { roleFor, TEXT_BLOCK_W, TextLine } from './TextLine'
import { World } from './World'
import { safeColor } from './utils'

/**
 * Director for the 3D reel. One composition, one camera, one motion:
 *
 *   record (left / top)   lyric stack in glass type (right / bottom): past - ACTIVE - next - next2
 *   a slow ±12° camera drift, a reflective floor, a quiet bloom. Chorus lines (repeats) glow and
 *   spin the record faster; nothing else reacts.
 */

export interface ReelInfo {
  title: string
  artist: string
  progress: number
}

interface SceneProps {
  spotify: SpotifyDeviceSource
  colors: ColorPalette
  albumArtUrl?: string
  info: React.MutableRefObject<ReelInfo>
}

export function ReelScene({ spotify, colors, albumArtUrl, info }: SceneProps) {
  const accent = colors.glow || colors.accent || '#ffffff'
  const viewport = useThree((s) => s.viewport)

  /* lyrics -------------------------------------------------------------------------------- */
  const item = spotify.currentTrack?.item ?? null
  const demo = !item
  const [raw, setRaw] = useState<LyricLine[] | null>(null)
  useEffect(() => {
    let alive = true
    setRaw(null)
    if (!item) return
    fetchLyrics(item.artists?.[0]?.name || '', item.name || '', item.album?.name || '', item.duration_ms || 0)
      .then((r) => alive && setRaw(r))
      .catch(() => alive && setRaw(null))
    return () => {
      alive = false
    }
  }, [item?.id])
  const lines = useMemo(() => buildLines(demo ? DEMO_LYRICS : raw || []), [demo, raw])

  /* album art ----------------------------------------------------------------------------- */
  const [art, setArt] = useState<HTMLImageElement | null>(null)
  const [artVersion, setArtVersion] = useState(0)
  useEffect(() => {
    if (!albumArtUrl) {
      setArt(null)
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setArtVersion((v) => v + 1)
    img.src = albumArtUrl
    setArt(img)
  }, [albumArtUrl])

  /* clock --------------------------------------------------------------------------------- */
  const reduced = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, [])
  const sync = useRef<Sync>({ playing: true, energy: 0, kick: 0, px: 0, py: 0, reduced })
  const energy = useRef(0)
  const [idx, setIdx] = useState(0)
  const live = useRef({ spotify, lines, receivedAt: performance.now(), demoStart: performance.now(), idx: -2, track: '' })
  live.current.spotify = spotify
  live.current.lines = lines
  useEffect(() => {
    live.current.receivedAt = performance.now()
  }, [spotify.currentTrack])
  useEffect(() => {
    live.current.idx = -2 // re-evaluate when the lyrics change
  }, [lines])

  useEffect(() => {
    const move = (e: PointerEvent) => {
      sync.current.px = (e.clientX / window.innerWidth) * 2 - 1
      sync.current.py = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [])

  const bloom = useRef<any>(null)
  const bgTarget = useMemo(() => safeColor(colors.primary, '#1a1030').multiplyScalar(0.2), [colors.primary])
  const bgNow = useMemo(() => new THREE.Color('#0a0a12'), [])

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
    sync.current.playing = isDemo ? true : !!t?.is_playing

    let i = 0
    const p = progress + 120
    for (let k = 0; k < L.lines.length; k++) if (L.lines[k].timeMs <= p) i = k
    if (i !== L.idx) {
      L.idx = i
      setIdx(i)
      const line = L.lines[i]
      if (line?.chorus) sync.current.kick += 1.6
      const next = L.lines[i + 1]
      sync.current.energy = line?.chorus ? 1 : next?.chorus ? 0.3 : 0
    }
    energy.current += (sync.current.energy - energy.current) * (1 - Math.exp(-dt * 3))

    // camera: a slow drift, never a cut
    const e = state.clock.elapsedTime
    const az = Math.sin(e * 0.16) * 0.2
    state.camera.position.set(Math.sin(az) * 11.5, 0.6 + Math.sin(e * 0.23) * 0.25, Math.cos(az) * 11.5)
    state.camera.lookAt(0, 0, 0)

    if (bloom.current) bloom.current.intensity = 0.6 + energy.current * 0.5
    bgNow.lerp(bgTarget, 1 - Math.exp(-dt * 2))
    ;(state.scene.background as THREE.Color).copy(bgNow)
    if (state.scene.fog) (state.scene.fog as THREE.Fog).color.copy(bgNow)
  })

  /* layout: record left / top, lyric stack right / bottom --------------------------------- */
  const D = discLayout(viewport)
  const textScale = D.wide ? Math.min(1, (viewport.width * 0.38) / TEXT_BLOCK_W) : Math.min(1, (viewport.width * 0.86) / TEXT_BLOCK_W)
  const textPos: [number, number, number] = D.wide ? [viewport.width * 0.2, 0, 0] : [0, -viewport.height * 0.2, 0]
  const floorY = D.y - D.scale * 1.15 - 0.5

  const window_ = [idx - 1, idx, idx + 1, idx + 2].filter((i) => i >= 0 && i < lines.length)
  const display = (i: number) => (lines[i].dots ? info.current.title || 'Lyric Void' : lines[i].text)

  return (
    <>
      <color attach="background" args={['#0a0a12']} />
      <fog attach="fog" args={['#0a0a12', 16, 44]} />
      <Environment resolution={256} frames={1} key={accent}>
        <Lightformer form="rect" intensity={5} color="#ffffff" position={[0, 6, 4]} scale={[14, 3, 1]} />
        <Lightformer form="rect" intensity={3} color={accent} position={[-7, 1, 2]} scale={[3, 8, 1]} />
        <Lightformer form="rect" intensity={2.5} color="#8ab4ff" position={[7, 2, -2]} scale={[3, 8, 1]} />
      </Environment>

      <World accent={accent} floorY={floorY} poolX={D.x} />
      <Disc sync={sync} art={art} artVersion={artVersion} accent={accent} />

      <group position={textPos} rotation={[0, D.wide ? -0.12 : 0, 0]} scale={textScale}>
        {window_.map((i) => (
          <TextLine key={i} text={display(i)} role={roleFor(i - idx)} chorus={lines[i].chorus} accent={accent} energy={energy} />
        ))}
      </group>

      <EffectComposer multisampling={0}>
        <Bloom ref={bloom} mipmapBlur intensity={0.6} luminanceThreshold={0.5} luminanceSmoothing={0.3} />
        <Vignette eskil={false} offset={0.25} darkness={0.7} />
      </EffectComposer>
    </>
  )
}
