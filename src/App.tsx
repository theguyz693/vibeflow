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

type LyricMode = 'list' | 'single' | 'bounce' | 'off'
type AppMode = 'mp3-3d' | 'spotify'

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('mp3-3d')

  const {
    isLoggedIn, isLoading, currentTrack, volume,
    login, logout, error,
    togglePlay, skipNext, skipPrev, seek, changeVolume
  } = useSpotify()
  
  const [lyricMode, setLyricMode] = useState<LyricMode>('list')

  const albumArtUrl =
    currentTrack?.item?.album?.images?.[0]?.url ||
    currentTrack?.item?.album?.images?.[1]?.url

  const colors = useTheme(albumArtUrl)

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

  // Main experience
  return (
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
        <LyricsMenu currentMode={lyricMode} onModeChange={setLyricMode} />
        <BackgroundPicker />
      </div>
    </SceneManager>
  )
}

export default App
