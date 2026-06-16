import React from 'react'
import { SceneProps } from '../types/spotify'

const VideoScene: React.FC<SceneProps> = ({ colors, width, height }) => {
  // In production, the app is loaded from out/renderer/index.html
  // So the relative path to the videos folder at the project root is ../../videos/
  const videoPath = '../../videos/car_interior.mp4'

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width, height, background: '#05050a' }}>
      <video
        src={videoPath}
        loop
        muted
        autoPlay
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
        onError={(e) => {
          console.error('[VideoScene] Failed to load video at', videoPath)
          const target = e.target as HTMLVideoElement
          target.style.display = 'none'
        }}
      />
      
      {/* Audio Reactive Color Overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent})`,
          mixBlendMode: 'overlay', // Changes the tint of the video without hiding details
          opacity: 0.6,
          transition: 'background 1.5s ease',
          pointerEvents: 'none'
        }}
      />

      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        color: 'rgba(255,255,255,0.2)',
        textAlign: 'center',
        fontFamily: 'Inter',
        pointerEvents: 'none',
        zIndex: -1
      }}>
        <h2>No Video Found</h2>
        <p>Drop a video named "car_interior.mp4" into the `videos` folder.</p>
      </div>
    </div>
  )
}

export default VideoScene
