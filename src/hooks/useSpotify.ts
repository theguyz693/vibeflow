import { useState, useEffect, useCallback, useRef } from 'react'
import { SpotifyPlaybackState } from '../types/spotify'
import {
  getStoredTokens,
  saveTokens,
  isTokenExpired,
  refreshAccessToken,
  exchangeCodeForTokens,
  getCurrentlyPlaying,
  getPlaybackState,
  redirectToSpotifyAuth,
  playTrack,
  pauseTrack,
  nextTrack,
  previousTrack,
  seekToPosition,
  setVolume as setVolumeApi,
  clearTokens
} from '../services/spotify'

interface UseSpotifyReturn {
  isLoggedIn: boolean
  isLoading: boolean
  currentTrack: SpotifyPlaybackState | null
  volume: number
  login: () => Promise<void>
  logout: () => void
  error: string | null
  // Playback controls
  togglePlay: () => Promise<void>
  skipNext: () => Promise<void>
  skipPrev: () => Promise<void>
  seek: (positionMs: number) => Promise<void>
  changeVolume: (percent: number) => Promise<void>
}

export function useSpotify(): UseSpotifyReturn {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentTrack, setCurrentTrack] = useState<SpotifyPlaybackState | null>(null)
  const [volume, setVolume] = useState(50)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const accessTokenRef = useRef<string | null>(null)

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')

    if (code) {
      // Clear URL params
      window.history.replaceState({}, '', '/')
      handleAuthCallback(code)
    } else {
      // Check for existing tokens
      const tokens = getStoredTokens()
      if (tokens) {
        accessTokenRef.current = tokens.access_token
        setIsLoggedIn(true)
      }
      setIsLoading(false)
    }
  }, [])

  const handleAuthCallback = async (code: string) => {
    try {
      const tokens = await exchangeCodeForTokens(code)
      saveTokens(tokens)
      accessTokenRef.current = tokens.access_token
      setIsLoggedIn(true)
      setError(null)
    } catch (err) {
      setError('Authentication failed. Please try again.')
      console.error('Auth error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const ensureValidToken = useCallback(async (): Promise<string | null> => {
    if (!isTokenExpired() && accessTokenRef.current) {
      return accessTokenRef.current
    }

    const tokens = getStoredTokens()
    if (!tokens?.refresh_token) {
      setIsLoggedIn(false)
      return null
    }

    try {
      const newTokens = await refreshAccessToken(tokens.refresh_token)
      // Preserve refresh_token if not returned
      if (!newTokens.refresh_token) {
        newTokens.refresh_token = tokens.refresh_token
      }
      saveTokens(newTokens)
      accessTokenRef.current = newTokens.access_token
      return newTokens.access_token
    } catch {
      setIsLoggedIn(false)
      clearTokens()
      return null
    }
  }, [])

  const fetchCurrentlyPlaying = useCallback(async () => {
    const token = await ensureValidToken()
    if (!token) return

    try {
      const state = await getCurrentlyPlaying(token)
      setCurrentTrack(state)
      setError(null)

      // Also fetch full playback state for volume
      try {
        const fullState = await getPlaybackState(token)
        if (fullState?.device?.volume_percent != null) {
          setVolume(fullState.device.volume_percent)
        }
      } catch {
        // Non-critical, ignore
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'TOKEN_EXPIRED') {
        accessTokenRef.current = null // Force refresh on next poll
      } else {
        console.error('Playback fetch error:', err)
      }
    }
  }, [ensureValidToken])

  // Poll every 3 seconds when logged in
  useEffect(() => {
    if (!isLoggedIn) return

    fetchCurrentlyPlaying() // Fetch immediately

    pollRef.current = setInterval(fetchCurrentlyPlaying, 3000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [isLoggedIn, fetchCurrentlyPlaying])

  const login = async () => {
    await redirectToSpotifyAuth()
  }

  const logout = () => {
    clearTokens()
    setIsLoggedIn(false)
    setCurrentTrack(null)
    accessTokenRef.current = null
  }

  // ── Playback Controls ──────────────────────────────────

  const togglePlay = useCallback(async () => {
    const token = await ensureValidToken()
    if (!token) return
    try {
      if (currentTrack?.is_playing) {
        await pauseTrack(token)
        setCurrentTrack(prev => prev ? { ...prev, is_playing: false } : null)
      } else {
        await playTrack(token)
        setCurrentTrack(prev => prev ? { ...prev, is_playing: true } : null)
      }
    } catch (err) {
      console.error('Toggle play error:', err)
    }
  }, [ensureValidToken, currentTrack?.is_playing])

  const skipNext = useCallback(async () => {
    const token = await ensureValidToken()
    if (!token) return
    try {
      await nextTrack(token)
      // Quick poll to get new track
      setTimeout(fetchCurrentlyPlaying, 500)
    } catch (err) {
      console.error('Skip next error:', err)
    }
  }, [ensureValidToken, fetchCurrentlyPlaying])

  const skipPrev = useCallback(async () => {
    const token = await ensureValidToken()
    if (!token) return
    try {
      await previousTrack(token)
      setTimeout(fetchCurrentlyPlaying, 500)
    } catch (err) {
      console.error('Skip prev error:', err)
    }
  }, [ensureValidToken, fetchCurrentlyPlaying])

  const seek = useCallback(async (positionMs: number) => {
    const token = await ensureValidToken()
    if (!token) return
    try {
      await seekToPosition(token, positionMs)
      setCurrentTrack(prev => prev ? { ...prev, progress_ms: positionMs } : null)
    } catch (err) {
      console.error('Seek error:', err)
    }
  }, [ensureValidToken])

  const changeVolume = useCallback(async (percent: number) => {
    const token = await ensureValidToken()
    if (!token) return
    try {
      await setVolumeApi(token, percent)
      setVolume(percent)
    } catch (err) {
      console.error('Volume error:', err)
    }
  }, [ensureValidToken])

  return {
    isLoggedIn, isLoading, currentTrack, volume,
    login, logout, error,
    togglePlay, skipNext, skipPrev, seek, changeVolume
  }
}
