import React, { useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { ColorPalette } from '../../types/spotify'
import type { SpotifyDeviceSource } from '../MP3Player3D'
import { ReelInfo, ReelScene } from './Scene'

/**
 * "Lyric Reel 3D": the record plus a stack of glass 3D lyrics. Same layout idea as the editorial
 * Lyric Void, rendered fully in 3D.
 *
 *   utils.ts       canvas / colour helpers        TextLine.tsx  one glass lyric line (+ role motion)
 *   World.tsx      floor + light pool             Scene.tsx     director: lyrics -> stack/camera/glow
 *   ../shared/RecordDisc.tsx  the spinning record (shared with the editorial mode)
 */
export const LyricReel: React.FC<{
  spotify: SpotifyDeviceSource
  colors: ColorPalette
  albumArtUrl?: string
}> = ({ spotify, colors, albumArtUrl }) => {
  const info = useRef<ReelInfo>({ title: '', artist: '', progress: 0 })
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
    <div style={{ width: '100%', height: '100%', background: '#0a0a12', position: 'relative' }}>
      <Canvas camera={{ position: [0, 0.6, 11.5], fov: 40 }} dpr={[1, 2]} gl={{ antialias: false }} style={{ width: '100%', height: '100%' }}>
        <React.Suspense fallback={null}>
          <ReelScene spotify={spotify} colors={colors} albumArtUrl={albumArtUrl} info={info} />
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
          fontFamily: '"Inter Variable", "Helvetica Neue", Arial, sans-serif',
          textShadow: '0 2px 14px rgba(0,0,0,0.6)'
        }}
      >
        <div ref={titleEl} style={{ fontWeight: 800, fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} />
        <div ref={artistEl} style={{ fontWeight: 500, fontSize: 13, opacity: 0.7, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} />
        <div style={{ height: 3, background: 'rgba(255,255,255,0.22)', borderRadius: 2, marginTop: 10 }}>
          <div ref={barEl} style={{ height: '100%', width: '0%', background: '#fff', borderRadius: 2 }} />
        </div>
      </div>
    </div>
  )
}

export default LyricReel
