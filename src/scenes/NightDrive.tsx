import React from 'react'
import { SceneProps } from '../types/spotify'

const NightDrive: React.FC<SceneProps> = ({ colors, width, height }) => {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width, height, background: '#05050a' }}>
      <video
        src="../../videos/car_interior.mp4"
        autoPlay
        loop
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: 'contrast(1.2) brightness(0.8)'
        }}
        onError={(e) => {
          console.error('Failed to load night drive video', e)
          ;(e.target as HTMLVideoElement).style.display = 'none'
        }}
      />
      {/* Dynamic color tinting based on the current track's album art */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(to bottom, transparent, ${colors.primary})`,
          mixBlendMode: 'overlay',
          opacity: 0.6,
          pointerEvents: 'none'
        }}
      />
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          background: colors.glow,
          mixBlendMode: 'color',
          opacity: 0.2,
          pointerEvents: 'none'
        }}
      />
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.2)',
          zIndex: -1
        }}
      >
        Video not found. Place 'car_interior.mp4' in 'videos/' folder.
      </div>
    </div>
  )
}

export default NightDrive
