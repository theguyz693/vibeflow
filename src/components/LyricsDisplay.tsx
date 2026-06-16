import React, { useEffect, useState, useRef } from 'react'
import { SpotifyPlaybackState } from '../types/spotify'
import { fetchLyrics, LyricLine } from '../services/lyrics'

interface LyricsDisplayProps {
  track: SpotifyPlaybackState | null
  mode?: 'list' | 'single' | 'bounce'
}

const LyricsDisplay: React.FC<LyricsDisplayProps> = ({ track, mode = 'list' }) => {
  const [lyrics, setLyrics] = useState<LyricLine[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const currentItem = track?.item

  useEffect(() => {
    let active = true

    if (!currentItem) {
      setLyrics(null)
      return
    }

    const loadLyrics = async () => {
      setIsLoading(true)
      const result = await fetchLyrics(
        currentItem.artists[0].name,
        currentItem.name,
        currentItem.album.name,
        currentItem.duration_ms
      )
      
      if (active) {
        setLyrics(result)
        setIsLoading(false)
      }
    }

    loadLyrics()

    return () => {
      active = false
    }
  }, [currentItem?.id])

  // Auto-scroll logic for list mode
  useEffect(() => {
    if (mode !== 'list' || !lyrics || !track?.progress_ms || !scrollRef.current) return

    const offsetProgress = track.progress_ms + 300
    const activeIndex = lyrics.findIndex(
      (line, i) => 
        line.timeMs <= offsetProgress && 
        (i === lyrics.length - 1 || lyrics[i + 1].timeMs > offsetProgress)
    )

    if (activeIndex !== -1) {
      const container = scrollRef.current
      const lineElements = container.children
      if (lineElements[activeIndex]) {
        const targetElement = lineElements[activeIndex] as HTMLElement
        const scrollPosition = targetElement.offsetTop - container.clientHeight / 2 + targetElement.clientHeight / 2
        
        container.scrollTo({
          top: scrollPosition,
          behavior: 'smooth'
        })
      }
    }
  }, [track?.progress_ms, lyrics, mode])

  if (!currentItem) return null

  // Find active line index for all modes
  let activeIndex = -1
  if (lyrics && track?.progress_ms) {
    const offsetProgress = track.progress_ms + 300
    activeIndex = lyrics.findIndex(
      (line, i) => 
        line.timeMs <= offsetProgress && 
        (i === lyrics.length - 1 || lyrics[i + 1].timeMs > offsetProgress)
    )
  }

  const positionStyles: React.CSSProperties = {
    position: 'absolute',
    top: mode === 'list' ? '10%' : '25%',
    right: mode === 'list' ? '5%' : '0',
    left: mode === 'list' ? 'auto' : '0',
    width: mode === 'list' ? '350px' : '100%',
    height: mode === 'list' ? '80%' : 'auto',
    pointerEvents: 'auto',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    textAlign: mode === 'list' ? 'right' : 'center',
    padding: mode === 'list' ? '0' : '0 10%'
  }

  if (isLoading) {
    return (
      <div style={{ ...positionStyles, color: 'var(--vf-text)', opacity: 0.5, fontSize: '14px' }}>
        Loading lyrics...
      </div>
    )
  }

  if (!lyrics) {
    return (
      <div style={{ ...positionStyles, color: 'var(--vf-text)', opacity: 0.3, fontSize: '14px' }}>
        No synced lyrics found
      </div>
    )
  }

  // ── Single & Bounce Modes ──
  if (mode === 'single' || mode === 'bounce') {
    const activeLine = activeIndex !== -1 ? lyrics[activeIndex] : null
    const nextLine = activeIndex !== -1 && activeIndex < lyrics.length - 1 ? lyrics[activeIndex + 1] : null

    return (
      <div style={positionStyles}>
        {activeLine && (
          <div 
            key={activeLine.timeMs} // Key forces re-mount/re-animation
            style={{
              color: 'var(--vf-text)',
              fontSize: '48px',
              fontWeight: 800,
              textShadow: '0 0 30px var(--vf-glow)',
              animation: mode === 'bounce' 
                ? 'popIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards' 
                : 'fadeIn 0.5s ease forwards'
            }}
          >
            {activeLine.text}
          </div>
        )}
        {nextLine && (
          <div 
            style={{
              color: 'var(--vf-text)',
              fontSize: '24px',
              opacity: 0.3,
              marginTop: '16px',
              fontWeight: 500,
              transition: 'all 0.3s ease'
            }}
          >
            {nextLine.text}
          </div>
        )}
        <style>{`
          @keyframes popIn {
            0% { transform: scale(0.5) translateY(20px); opacity: 0; }
            100% { transform: scale(1) translateY(0); opacity: 1; }
          }
          @keyframes fadeIn {
            0% { opacity: 0; transform: translateY(10px); }
            100% { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    )
  }

  // ── List Mode (Default) ──
  return (
    <div style={positionStyles}>
      <div 
        ref={scrollRef}
        style={{
          height: '100%',
          overflowY: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)',
          maskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)'
        }}
        className="no-scrollbar"
      >
        <div style={{ height: '40%' }} />
        
        {lyrics.map((line, i) => {
          const isActive = i === activeIndex

          return (
            <div 
              key={i}
              style={{
                color: 'var(--vf-text)',
                fontSize: isActive ? '28px' : '20px',
                fontWeight: isActive ? 700 : 400,
                opacity: isActive ? 1 : 0.3,
                marginBottom: '16px',
                transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                textShadow: isActive ? '0 0 20px var(--vf-glow)' : 'none',
                transform: isActive ? 'scale(1)' : 'scale(0.95)',
                transformOrigin: 'right center'
              }}
            >
              {line.text}
            </div>
          )
        })}
        
        <div style={{ height: '50%' }} />
      </div>
    </div>
  )
}

export default LyricsDisplay
