import React, { useState } from 'react'
import { useSpotify } from './hooks/useSpotify'
import { useTheme } from './hooks/useTheme'
import SceneManager from './scenes/SceneManager'
import OverlayUI from './components/OverlayUI'
import BackgroundPicker from './components/BackgroundPicker'
import LyricsMenu from './components/LyricsMenu'
import LoginScreen from './components/LoginScreen'
import LyricsDisplay from './components/LyricsDisplay'
import MP3Player3D from './components/MP3Player3D'
import LyricVoid from './components/LyricVoid'
import LyricReel from './components/lyric-reel/LyricReel'
import LyricScreens from './components/lyric-screens/LyricScreens'

type LyricMode = 'void' | 'list' | 'single' | 'bounce' | 'off'
type AppMode = 'mp3-3d' | 'lyric-void' | 'lyric-reel' | 'lyric-screens' | 'spotify'

/** The standalone lyric visuals, grouped under one picker in the header. */
const VISUALS: { id: AppMode; label: string; desc: string }[] = [
  { id: 'lyric-void', label: 'Editorial', desc: 'Spinning disc + clean synced lyrics' },
  { id: 'lyric-reel', label: 'Reel 3D', desc: 'Disc + glass 3D lyric stack' },
  { id: 'lyric-screens', label: 'Floating Screens', desc: 'The original glowing screens' }
]

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('mp3-3d')

  const {
    isLoggedIn, isLoading, currentTrack, volume,
    login, logout, error,
    togglePlay, skipNext, skipPrev, seek, changeVolume
  } = useSpotify()
  
  const [visualsOpen, setVisualsOpen] = useState(false)
  const [lyricMode, setLyricMode] = useState<LyricMode>('list')

  const albumArtUrl =
    currentTrack?.item?.album?.images?.[0]?.url ||
    currentTrack?.item?.album?.images?.[1]?.url

  const colors = useTheme(albumArtUrl)

  const isVisual = VISUALS.some((v) => v.id === appMode)

  // Mode Switcher Header
  const renderModeHeader = () => (
    <div
      style={{
        position: 'absolute',
        top: 20,
        left: 24,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(16px)',
        padding: '6px 14px',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.4)'
      }}
    >
      <button
        style={{
          background: appMode === 'mp3-3d' ? '#38bdf8' : 'transparent',
          color: appMode === 'mp3-3d' ? '#0f172a' : '#94a3b8',
          border: 'none',
          padding: '6px 14px',
          borderRadius: '16px',
          fontWeight: 700,
          fontSize: '13px',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
        onClick={() => setAppMode('mp3-3d')}
      >
        📼 3D MP3 Player
      </button>
      <div style={{ position: 'relative' }}>
        <button
          style={{
            background: isVisual ? '#facc15' : 'transparent',
            color: isVisual ? '#0f172a' : '#94a3b8',
            border: 'none',
            padding: '6px 14px',
            borderRadius: '16px',
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onClick={() => setVisualsOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={visualsOpen}
        >
          🌌 Lyric Visuals {isVisual ? `· ${VISUALS.find((v) => v.id === appMode)?.label} ` : ''}▾
        </button>
        {visualsOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setVisualsOpen(false)} />
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 12px)',
                left: 0,
                zIndex: 9999,
                minWidth: 250,
                padding: 6,
                borderRadius: 16,
                background: 'rgba(15, 23, 42, 0.92)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: '0 12px 36px rgba(0,0,0,0.5)'
              }}
            >
              {VISUALS.map((v) => (
                <button
                  key={v.id}
                  role="menuitem"
                  onClick={() => {
                    setAppMode(v.id)
                    setVisualsOpen(false)
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '9px 12px',
                    borderRadius: 12,
                    border: 'none',
                    cursor: 'pointer',
                    background: appMode === v.id ? 'rgba(250, 204, 21, 0.16)' : 'transparent',
                    color: '#e2e8f0'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{v.label}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{v.desc}</div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <button
        style={{
          background: appMode === 'spotify' ? '#10b981' : 'transparent',
          color: appMode === 'spotify' ? '#ffffff' : '#94a3b8',
          border: 'none',
          padding: '6px 14px',
          borderRadius: '16px',
          fontWeight: 700,
          fontSize: '13px',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
        onClick={() => setAppMode('spotify')}
      >
        🎧 Spotify Companion
      </button>
    </div>
  )

  const logoutButton = (
    <button
      className="corner-logout-btn"
      onClick={logout}
      title="Logout & Re-authenticate"
      id="btn-logout"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </svg>
    </button>
  )

  if (appMode === 'mp3-3d') {
    return (
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
        {renderModeHeader()}
        <MP3Player3D
          spotify={{ isLoggedIn, currentTrack, volume, togglePlay, skipNext, skipPrev, changeVolume }}
        />
      </div>
    )
  }

  if (appMode === 'lyric-void') {
    return (
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
        {renderModeHeader()}
        <LyricVoid
          spotify={{ isLoggedIn, currentTrack, volume, togglePlay, skipNext, skipPrev, changeVolume }}
          colors={colors}
          albumArtUrl={albumArtUrl}
        />
      </div>
    )
  }

  if (appMode === 'lyric-reel') {
    return (
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
        {renderModeHeader()}
        <LyricReel
          spotify={{ isLoggedIn, currentTrack, volume, togglePlay, skipNext, skipPrev, changeVolume }}
          colors={colors}
          albumArtUrl={albumArtUrl}
        />
      </div>
    )
  }

  if (appMode === 'lyric-screens') {
    return (
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
        {renderModeHeader()}
        <LyricScreens
          spotify={{ isLoggedIn, currentTrack, volume, togglePlay, skipNext, skipPrev, changeVolume }}
          colors={colors}
          albumArtUrl={albumArtUrl}
        />
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="loading-screen">
        {renderModeHeader()}
        <div className="loading-spinner" />
      </div>
    )
  }

  // Not logged in
  if (!isLoggedIn) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {renderModeHeader()}
        <LoginScreen onLogin={login} error={error} />
      </div>
    )
  }

  // Companion with the editorial Lyric Void view (disc + lyrics, no background scene)
  if (lyricMode === 'void') {
    return (
      <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
        {renderModeHeader()}
        <LyricVoid
          spotify={{ isLoggedIn, currentTrack, volume, togglePlay, skipNext, skipPrev, changeVolume }}
          colors={colors}
          albumArtUrl={albumArtUrl}
        />
        <div className="corner-menus" id="corner-menus">
          {logoutButton}
          <LyricsMenu currentMode={lyricMode} onModeChange={setLyricMode} />
        </div>
      </div>
    )
  }

  // Main experience
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {renderModeHeader()}
      <SceneManager colors={colors} albumArtUrl={albumArtUrl}>
        <OverlayUI
          track={currentTrack}
          volume={volume}
          onTogglePlay={togglePlay}
          onSkipNext={skipNext}
          onSkipPrev={skipPrev}
          onSeek={seek}
          onVolumeChange={changeVolume}
        />
        {lyricMode !== 'off' && (
          <LyricsDisplay track={currentTrack} mode={lyricMode as 'list' | 'single' | 'bounce'} />
        )}
        {/* Corner menus — top right */}
        <div className="corner-menus" id="corner-menus">
          {logoutButton}
          <LyricsMenu currentMode={lyricMode} onModeChange={setLyricMode} />
          <BackgroundPicker />
        </div>
      </SceneManager>
    </div>
  )
}

export default App
