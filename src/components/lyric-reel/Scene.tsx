import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { fetchLyrics, LyricLine } from '../../services/lyrics'
import { ColorPalette } from '../../types/spotify'
import type { SpotifyDeviceSource } from '../MP3Player3D'
import { DEMO_LYRICS, Kind, LineState, Style } from './constants'
import { BG_N, BgScreens, World } from './Decor'
import { Disc } from './Disc'
import { FrontText } from './FrontText'
import { useGlassMaterials } from './glass'
import { safeColor } from './utils'

export interface VoidInfo {
  title: string
  artist: string
  progress: number
}

export interface SceneProps {
  spotify: SpotifyDeviceSource
  colors: ColorPalette
  albumArtUrl?: string
  info: React.MutableRefObject<VoidInfo>
}

export const STYLES: Style[] = ['slam', 'slide', 'stretch', 'drop']

export function VoidScene({ spotify, colors, albumArtUrl, info }: SceneProps) {
  const accent = colors.glow || colors.accent || '#facc15'
  const mats = useGlassMaterials(accent)

  // lyrics ------------------------------------------------------------------------------------
  const item = spotify.currentTrack?.item
  const [lyrics, setLyrics] = useState<LyricLine[] | null>(null)
  useEffect(() => {
    let alive = true
    setLyrics(null)
    if (!item) return
    fetchLyrics(item.artists?.[0]?.name || '', item.name || '', item.album?.name || '', item.duration_ms || 0)
      .then((r) => alive && setLyrics(r))
      .catch(() => alive && setLyrics(null))
    return () => {
      alive = false
    }
  }, [item?.id])

  // album art ---------------------------------------------------------------------------------
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

  // latest props + progress interpolation between polls ---------------------------------------
  const live = useRef({ spotify, receivedAt: performance.now(), lyrics })
  live.current.spotify = spotify
  live.current.lyrics = lyrics
  useEffect(() => {
    live.current.receivedAt = performance.now()
  }, [spotify.currentTrack])

  // director state ----------------------------------------------------------------------------
  const [line, setLine] = useState<LineState | null>(null)
  const [bgTexts, setBgTexts] = useState<string[]>(() => Array(BG_N).fill(''))
  const playing = useRef(true)
  const kick = useRef(0)
  const hit = useRef(0)
  const flip = useRef(0)
  const dir = useRef({
    idx: -2,
    shotStart: 0,
    demoStart: performance.now(),
    az: 0,
    r: 7.6,
    h: 1.0,
    azT: 0,
    rT: 7.6,
    hT: 1.0,
    anchorAz: 0,
    anchorR: 7.6,
    trackId: ''
  })
  const frontAnchor = useRef<THREE.Group>(null)

  const bloom = useRef<any>(null)
  const chroma = useRef<any>(null)
  const bgBase = useMemo(() => safeColor(colors.primary, '#1a1030').multiplyScalar(0.3), [colors.primary])
  const bgAlt = useMemo(() => safeColor(colors.secondary, '#102040').multiplyScalar(0.34), [colors.secondary])
  const bgNow = useMemo(() => new THREE.Color('#0a0a14'), [])
  const white = useMemo(() => new THREE.Color('#ffffff'), [])
  const tmpC = useMemo(() => new THREE.Color(), [])
  const camPos = useMemo(() => new THREE.Vector3(0, 1.0, 7.6), [])

  useFrame((state, dt) => {
    const d = dir.current
    const { spotify: sp, receivedAt, lyrics: ly } = live.current
    const t = sp.currentTrack
    const demo = !t?.item
    const lines = demo ? DEMO_LYRICS : ly
    const dur = t?.item?.duration_ms ?? (DEMO_LYRICS[DEMO_LYRICS.length - 1].timeMs + 5000)
    let progress = demo ? (performance.now() - d.demoStart) % dur : (t?.progress_ms ?? 0)
    if (!demo && t?.is_playing) progress += performance.now() - receivedAt

    info.current.title = t?.item?.name ?? 'Lyric Void'
    info.current.artist = t?.item?.artists?.map((a) => a.name).join(', ') ?? 'demo mode'
    info.current.progress = dur ? progress / dur : 0
    playing.current = demo ? true : !!t?.is_playing

    // which lyric line are we on
    let idx = -1
    if (lines && lines.length) {
      const p = progress + 150
      for (let i = 0; i < lines.length; i++) if (lines[i].timeMs <= p) idx = i
    }

    const e = state.clock.elapsedTime
    const now = performance.now()
    const trackKey = t?.item?.id ?? 'demo'
    if (idx !== d.idx || trackKey !== d.trackId) {
      d.idx = idx
      d.trackId = trackKey
      d.shotStart = e
      const sign: 1 | -1 = idx % 2 === 0 ? 1 : -1
      if (idx >= 0 && lines) {
        const l = lines[idx]
        const next = lines[idx + 1]
        const lineMs = next ? next.timeMs - l.timeMs : 3000
        const words = l.text.trim().split(/\s+/)
        const stagger = Math.min(0.16, ((lineMs / 1000) * 0.55) / Math.max(1, words.length))
        const short = l.text.length <= 22
        const kind: Kind = short && idx % 2 === 0 ? 'ring' : 'front'
        const style = STYLES[(idx * 7 + words.length) % STYLES.length]
        setLine({ idx, text: l.text, startedAt: now, stagger, kind, style, dir: sign })
        setBgTexts((prev) => {
          const n = prev.slice()
          n[idx % BG_N] = l.text
          return n
        })
        // hit strength: short punchy lines and every 4th line land hardest
        const strong = words.length <= 3 || idx % 4 === 3
        hit.current = strong ? 1 : 0.5
        // disc kick; every 6th line scratches backwards like a DJ
        kick.current += idx % 6 === 5 ? -9 : strong ? 3.2 : 1.6
        flip.current += 1
      } else {
        setLine(null)
      }
      // new camera shot: jump round the disc, new radius/height
      d.azT += sign * (0.9 + (idx % 3) * 0.25)
      d.rT = [6.9, 7.9, 8.6][(idx + 3) % 3]
      d.hT = [0.8, 1.7, -0.1][(idx + 4) % 3]
    }

    // camera: keeps orbiting the disc, never cuts away -----------------------------------------
    const tl = e - d.shotStart
    d.azT += dt * 0.06
    const rate = 1.2 + 4.5 * Math.exp(-tl * 2.6)
    const f = 1 - Math.exp(-rate * dt)
    d.az += (d.azT - d.az) * f
    d.r += (d.rT - d.r) * f
    d.h += (d.hT - d.h) * f
    const shake = hit.current * 0.1
    camPos.set(
      Math.sin(d.az) * d.r + Math.sin(e * 0.8) * 0.1 + (Math.random() - 0.5) * shake,
      d.h + Math.cos(e * 0.9) * 0.08 + (Math.random() - 0.5) * shake,
      Math.cos(d.az) * d.r + (Math.random() - 0.5) * shake
    )
    state.camera.position.copy(camPos)
    state.camera.lookAt(0, 0.2, 0)
    state.camera.rotateZ(Math.sin(e * 0.5) * 0.015 + (Math.random() - 0.5) * hit.current * 0.012)
    const cam = state.camera as THREE.PerspectiveCamera
    const fov = 50 + 9 * Math.exp(-tl * 3.2) + hit.current * 3
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }

    // front-text anchor: sits between disc and camera, lags a little so the orbit reads ----------
    d.anchorAz += (d.az - d.anchorAz) * (1 - Math.exp(-dt * 2.4))
    d.anchorR += (d.r - d.anchorR) * (1 - Math.exp(-dt * 2.4))
    if (frontAnchor.current) {
      const dist = Math.max(2.4, d.anchorR - 4.4)
      frontAnchor.current.position.set(Math.sin(d.anchorAz) * dist, 0.3, Math.cos(d.anchorAz) * dist)
      frontAnchor.current.rotation.set(0, d.anchorAz + 0.1 * (flip.current % 2 ? 1 : -1), 0)
    }

    // hit effects -------------------------------------------------------------------------------
    hit.current = Math.max(0, hit.current - dt * 2.4)
    if (bloom.current) bloom.current.intensity = 0.8 + hit.current * 1.7
    if (chroma.current) chroma.current.offset.set(0.0006 + hit.current * 0.005, 0.0009 + hit.current * 0.006)
    // flat colour block that flips each line, flashes on hits
    const target = flip.current % 2 ? bgBase : bgAlt
    bgNow.lerp(target, 1 - Math.exp(-dt * 7))
    tmpC.copy(bgNow).lerp(white, hit.current * 0.28)
    ;(state.scene.background as THREE.Color).copy(tmpC)
    if (state.scene.fog) (state.scene.fog as THREE.Fog).color.copy(tmpC)
  })

  const ringLine = line && line.kind === 'ring' ? line : null
  const frontLine = line && line.kind === 'front' ? line : null
  const intro = !line

  return (
    <>
      <color attach="background" args={['#0a0a14']} />
      <fog attach="fog" args={['#0a0a14', 14, 40]} />
      <Environment resolution={256} frames={1} key={accent}>
        <Lightformer form="rect" intensity={5} color="#ffffff" position={[0, 6, 4]} scale={[14, 3, 1]} />
        <Lightformer form="rect" intensity={4} color={accent} position={[-7, 1, 2]} scale={[3, 8, 1]} />
        <Lightformer form="rect" intensity={3} color="#8ab4ff" position={[7, 2, -2]} scale={[3, 8, 1]} />
        <Lightformer form="ring" intensity={3} color={accent} position={[0, -1, -6]} scale={8} />
      </Environment>
      <pointLight position={[0, 2, 3]} intensity={6} color={accent} distance={16} />

      <World accent={accent} />
      <BgScreens texts={bgTexts} accent={accent} />
      <Disc accent={accent} art={art} artVersion={artVersion} playing={playing} kick={kick} ringLine={ringLine} mats={mats} />

      <group ref={frontAnchor}>
        {frontLine && <FrontText key={frontLine.idx} line={frontLine} mats={mats} />}
        {intro && (
          <IntroCard info={info} mats={mats} accent={accent} />
        )}
      </group>

      <EffectComposer multisampling={0}>
        <Bloom ref={bloom} mipmapBlur intensity={0.8} luminanceThreshold={0.4} luminanceSmoothing={0.3} />
        <ChromaticAberration ref={chroma} offset={new THREE.Vector2(0.0006, 0.0009)} radialModulation modulationOffset={0.3} blendFunction={BlendFunction.NORMAL} />
        <Vignette eskil={false} offset={0.25} darkness={0.8} />
      </EffectComposer>
    </>
  )
}

/** Title / artist slam shown before the first lyric line of a track. */
export function IntroCard({ info, mats }: { info: React.MutableRefObject<VoidInfo>; mats: { normal: THREE.Material; emph: THREE.Material }; accent: string }) {
  const [state] = useState(() => ({
    title: info.current.title,
    artist: info.current.artist,
    startedAt: performance.now()
  }))
  return (
    <>
      <FrontText line={{ text: state.title.slice(0, 40), startedAt: state.startedAt, stagger: 0.12, style: 'slam', dir: 1 }} mats={mats} yOffset={0.5} />
      <FrontText line={{ text: state.artist.slice(0, 40), startedAt: state.startedAt + 500, stagger: 0.08, style: 'slide', dir: -1 }} mats={mats} maxScale={0.5} yOffset={-1.5} />
    </>
  )
}
