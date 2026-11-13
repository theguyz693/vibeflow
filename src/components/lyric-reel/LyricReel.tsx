import React, { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { ColorPalette } from '../../types/spotify'
import type { SpotifyDeviceSource } from '../MP3Player3D'
import { HudInfo, TrackHud } from '../shared/TrackHud'
import { ReelScene } from './Scene'

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
  const info = useRef<HudInfo>({ title: '', artist: '', progress: 0 })

  return (
    <div style={{ width: '100%', height: '100%', background: '#0a0a12', position: 'relative' }}>
      <Canvas camera={{ position: [0, 0.6, 11.5], fov: 40 }} dpr={[1, 2]} gl={{ antialias: false }} style={{ width: '100%', height: '100%' }}>
        <React.Suspense fallback={null}>
          <ReelScene spotify={spotify} colors={colors} albumArtUrl={albumArtUrl} info={info} />
        </React.Suspense>
      </Canvas>
      <TrackHud info={info} />
    </div>
  )
}

export default LyricReel
