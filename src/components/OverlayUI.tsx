import React, { useState, useEffect, useRef, useCallback } from 'react'
import { SpotifyPlaybackState } from '../types/spotify'

interface OverlayUIProps {
  track: SpotifyPlaybackState | null
  volume: number
  onTogglePlay?: () => void
  onSkipNext?: () => void
  onSkipPrev?: () => void
  onSeek?: (positionMs: number) => void
  onVolumeChange?: (percent: number) => void
}

const OverlayUI: React.FC<OverlayUIProps> = ({
  track,
  volume,
  onTogglePlay,
  onSkipNext,
  onSkipPrev,
  onSeek,
  onVolumeChange
}) => {
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showVolume, setShowVolume] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const volumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (track?.item && track.is_playing) {
      setVisible(true)
      if (!isDragging) setProgress(track.progress_ms)

      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => {
        if (!isDragging) {
          setProgress((p) => Math.min(p + 100, track.item!.duration_ms))
        }
      }, 100)
    } else if (track?.item && !track.is_playing) {
      setVisible(true)
      if (!isDragging) setProgress(track.progress_ms)
      if (intervalRef.current) clearInterval(intervalRef.current)
    } else {
      setVisible(false)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [track, isDragging])

  // Seek by clicking on progress bar
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !track?.item) return
    const rect = progressBarRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const percent = x / rect.width
    const seekMs = percent * track.item.duration_ms
    setProgress(seekMs)
    onSeek?.(seekMs)
  }, [track?.item, onSeek])

  // Drag seek
  const handleProgressDragStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true)
    handleProgressClick(e)

    const handleMove = (me: MouseEvent) => {
      if (!progressBarRef.current || !track?.item) return
      const rect = progressBarRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(me.clientX - rect.left, rect.width))
      const percent = x / rect.width
      setProgress(percent * track.item.duration_ms)
    }

    const handleUp = (me: MouseEvent) => {
      if (progressBarRef.current && track?.item) {
        const rect = progressBarRef.current.getBoundingClientRect()
        const x = Math.max(0, Math.min(me.clientX - rect.left, rect.width))
        const percent = x / rect.width
        const seekMs = percent * track.item.duration_ms
        onSeek?.(seekMs)
      }
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
  }, [track?.item, onSeek, handleProgressClick])

  if (!visible || !track?.item) return null

  const { item } = track
  const albumArt = item.album.images[0]?.url || item.album.images[1]?.url
  const duration = item.duration_ms
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const min = Math.floor(s / 60)
    const sec = s % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  // Volume icon based on level
  const VolumeIcon = () => {
    if (volume === 0) return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
    )
    if (volume < 50) return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>
    )
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
    )
  }

  return (
    <div className="overlay-ui" id="now-playing-overlay">
      <div className="overlay-card">
        {/* Album Art */}
        {albumArt && (
          <div className="overlay-art-container">
            <img
              src={albumArt}
              alt={item.album.name}
              className="overlay-art"
              crossOrigin="anonymous"
            />
            <div className="overlay-art-glow" />
          </div>
        )}

        {/* Track Info + Controls */}
        <div className="overlay-info">
          <div className="overlay-title" title={item.name}>
            {item.name}
          </div>
          <div className="overlay-artist" title={item.artists.map((a) => a.name).join(', ')}>
            {item.artists.map((a) => a.name).join(', ')}
          </div>

          {/* Playback Controls */}
          <div className="overlay-controls" id="playback-controls">
            <button
              className="overlay-ctrl-btn"
              onClick={onSkipPrev}
              title="Previous"
              id="btn-prev"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
            </button>

            <button
              className="overlay-ctrl-btn overlay-ctrl-play"
              onClick={onTogglePlay}
              title={track.is_playing ? 'Pause' : 'Play'}
              id="btn-play-pause"
            >
              {track.is_playing ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>

            <button
              className="overlay-ctrl-btn"
              onClick={onSkipNext}
              title="Next"
              id="btn-next"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>

            {/* Volume */}
            <div
              className="overlay-volume-wrap"
              onMouseEnter={() => {
                setShowVolume(true)
                if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current)
              }}
              onMouseLeave={() => {
                volumeTimerRef.current = setTimeout(() => setShowVolume(false), 1500)
              }}
            >
              <button
                className="overlay-ctrl-btn overlay-ctrl-vol"
                title={`Volume: ${volume}%`}
                id="btn-volume"
                onClick={() => {
                  // Mute/unmute toggle
                  onVolumeChange?.(volume === 0 ? 50 : 0)
                }}
              >
                <VolumeIcon />
              </button>
              {showVolume && (
                <div className="overlay-volume-slider-wrap">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => onVolumeChange?.(parseInt(e.target.value))}
                    className="overlay-volume-slider"
                    id="volume-slider"
                    title={`${volume}%`}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="overlay-progress-container" style={{ marginTop: '4px' }}>
            <div
              className="overlay-progress-bar"
              ref={progressBarRef}
              onMouseDown={handleProgressDragStart}
              style={{ cursor: 'pointer', height: '4px' }}
            >
              <div
                className="overlay-progress-fill"
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              />
              <div
                className="overlay-progress-dot"
                style={{ left: `${Math.min(progressPercent, 100)}%`, opacity: 1 }}
              />
            </div>
            <div className="overlay-time">
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OverlayUI
