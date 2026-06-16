import React, { useRef, useEffect } from 'react'
import { SceneProps } from '../types/spotify'
import { resolveVideoSrc } from '../config/videoConfig'

export function createVideoScene(videoSrc: string) {
  const VideoSceneComponent: React.FC<SceneProps> = ({ colors, width, height }) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const hasErrorRef = useRef(false)

    // Resolve src at render time so window.location is definitely available
    const src = resolveVideoSrc(videoSrc)

    useEffect(() => {
      // Force reload video when src changes
      if (videoRef.current && !hasErrorRef.current) {
        videoRef.current.load()
        videoRef.current.play().catch(() => {
          // Autoplay might be blocked, that's ok
        })
      }
    }, [src])

    return (
      <div style={{ position: 'absolute', top: 0, left: 0, width, height, background: '#05050a' }}>
        <video
          ref={videoRef}
          src={src}
          autoPlay
          loop
          muted
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'contrast(1.2) brightness(0.8)'
          }}
          onError={(e) => {
            console.error(`[VibeFlow] Failed to load video: "${videoSrc}" (resolved: "${src}")`)
            hasErrorRef.current = true
            ;(e.target as HTMLVideoElement).style.display = 'none'
          }}
          onLoadedData={() => {
            console.log(`[VibeFlow] Video loaded: "${videoSrc}"`)
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
          Video not found. Check source: '{videoSrc}'
        </div>
      </div>
    )
  }

  return VideoSceneComponent
}
