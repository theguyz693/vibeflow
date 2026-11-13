import React, { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { ColorPalette } from '../../types/spotify'
import type { SpotifyDeviceSource } from '../MP3Player3D'
import { HudInfo, TrackHud } from '../shared/TrackHud'
import { HypeScene } from './Scene'

/**
 * "Disc Reel": a giant record fills the screen behind the lyrics and turns slowly; every line
 * enters with a randomly chosen animation.
 *
 *   HypeText.tsx   glass lyric type + the six entrances     Scene.tsx  director + full-screen disc
 *   ../shared/*    lyric loading, track HUD, easing, disc drawing (shared with the other visuals)
 */
export const LyricHype: React.FC<{
  spotify: SpotifyDeviceSource
  colors: ColorPalette
  albumArtUrl?: string
}> = ({ spotify, colors, albumArtUrl }) => {
  const info = useRef<HudInfo>({ title: '', artist: '', progress: 0 })

  return (
    <div style={{ width: '100%', height: '100%', background: '#050508', position: 'relative' }}>
      <Canvas camera={{ position: [0, 0, 10], fov: 45 }} dpr={[1, 2]} gl={{ antialias: false }} style={{ width: '100%', height: '100%' }}>
        <React.Suspense fallback={null}>
          <HypeScene spotify={spotify} colors={colors} albumArtUrl={albumArtUrl} info={info} />
        </React.Suspense>
      </Canvas>
      <TrackHud info={info} />
    </div>
  )
}

export default LyricHype
