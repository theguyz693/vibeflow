import React, { useState } from 'react'
import { useSpotify } from './hooks/useSpotify'
import { useTheme } from './hooks/useTheme'
import SceneManager from './scenes/SceneManager'
import OverlayUI from './components/OverlayUI'
import BackgroundPicker from './components/BackgroundPicker'
import LyricsMenu from './components/LyricsMenu'
import LoginScreen from './components/LoginScreen'
import LyricsDisplay from './components/LyricsDisplay'

type LyricMode = 'list' | 'single' | 'bounce' | 'off'

const App: React.FC = () => {
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

  // Loading state
  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    )
  }

  // Not logged in
  if (!isLoggedIn) {
    return <LoginScreen onLogin={login} error={error} />
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
