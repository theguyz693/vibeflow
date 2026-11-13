import React, { useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { ColorPalette } from '../../types/spotify'
import type { SpotifyDeviceSource } from '../MP3Player3D'
import { VoidInfo, VoidScene } from './Scene'

/**
 * "Lyric Reel": the 3D hype-reel mode. A spinning disc is the stage; lyrics wrap around its rim or
 * slam in huge in front of it; strong lines trigger hits (bloom, shake, flash, disc kick).
 *
 *   constants.ts   shared consts + types        glass.ts      glass text materials
 *   utils.ts       canvas/colour/easing helpers  FrontText.tsx big words in front of the disc
 *   RingText.tsx   letters wrapped on the rim    Disc.tsx      the spinning record
 *   Decor.tsx      neon screens, floor, dust     Scene.tsx     director: lyrics -> camera/effects
 */

export const LyricReel: React.FC<{
  spotify: SpotifyDeviceSource
  colors: ColorPalette
  albumArtUrl?: string
}> = ({ spotify, colors, albumArtUrl }) => {
  const info = useRef<VoidInfo>({ title: '', artist: '', progress: 0 })
  const titleEl = useRef<HTMLDivElement>(null)
  const artistEl = useRef<HTMLDivElement>(null)
  const barEl = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = window.setInterval(() => {
      if (titleEl.current) titleEl.current.textContent = info.current.title
      if (artistEl.current) artistEl.current.textContent = info.current.artist
      if (barEl.current) barEl.current.style.width = `${Math.min(1, Math.max(0, info.current.progress)) * 100}%`
    }, 120)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a14', position: 'relative' }}>
      <Canvas camera={{ position: [0, 1, 7.6], fov: 50 }} dpr={[1, 2]} gl={{ antialias: false }} style={{ width: '100%', height: '100%' }}>
        <React.Suspense fallback={null}>
          <VoidScene spotify={spotify} colors={colors} albumArtUrl={albumArtUrl} info={info} />
        </React.Suspense>
      </Canvas>
      <div
        style={{
          position: 'absolute',
          left: 28,
          bottom: 26,
          width: 'min(360px, 60vw)',
          color: '#fff',
          pointerEvents: 'none',
          fontFamily: '"Helvetica Neue", Arial, sans-serif',
          textShadow: '0 2px 14px rgba(0,0,0,0.6)'
        }}
      >
        <div ref={titleEl} style={{ fontWeight: 800, fontSize: 18, letterSpacing: 0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} />
        <div ref={artistEl} style={{ fontWeight: 500, fontSize: 13, opacity: 0.7, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} />
        <div style={{ height: 3, background: 'rgba(255,255,255,0.22)', borderRadius: 2, marginTop: 10 }}>
          <div ref={barEl} style={{ height: '100%', width: '0%', background: '#fff', borderRadius: 2 }} />
        </div>
      </div>
    </div>
  )
}

export default LyricReel
