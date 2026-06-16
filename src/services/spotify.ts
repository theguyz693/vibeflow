import { SpotifyAuthTokens, SpotifyPlaybackState } from '../types/spotify'

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize'
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1'
const CLIENT_ID = '081d840b10ff4a1fad0f1c39396ac79a'

// Dynamic redirect URI — works in dev, Electron, and deployed
function getRedirectUri(): string {
  const origin = window.location.origin
  // In Electron, the page loads from file:// — use the dev server URL
  if (origin === 'null' || origin.startsWith('file://')) {
    return 'http://127.0.0.1:5173/callback'
  }
  return `${origin}/callback`
}

const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-modify-playback-state'
].join(' ')

// ── PKCE Helpers ──────────────────────────────────────────────

function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(values, (v) => possible[v % possible.length]).join('')
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  return crypto.subtle.digest('SHA-256', data)
}

function base64urlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let str = ''
  bytes.forEach((b) => (str += String.fromCharCode(b)))
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateRandomString(128)
  const hashed = await sha256(verifier)
  const challenge = base64urlEncode(hashed)
  return { verifier, challenge }
}

// ── Auth Flow ─────────────────────────────────────────────────

export async function redirectToSpotifyAuth(): Promise<void> {
  const { verifier, challenge } = await generatePKCE()
  localStorage.setItem('pkce_verifier', verifier)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES
  })

  window.location.href = `${SPOTIFY_AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForTokens(code: string): Promise<SpotifyAuthTokens> {
  const verifier = localStorage.getItem('pkce_verifier')
  if (!verifier) throw new Error('No PKCE verifier found')

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      code_verifier: verifier
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  const data = await response.json()
  localStorage.removeItem('pkce_verifier')
  return data as SpotifyAuthTokens
}

export async function refreshAccessToken(refreshToken: string): Promise<SpotifyAuthTokens> {
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  })

  if (!response.ok) {
    throw new Error('Token refresh failed')
  }

  return (await response.json()) as SpotifyAuthTokens
}

// ── API ───────────────────────────────────────────────────────

export async function getCurrentlyPlaying(
  accessToken: string
): Promise<SpotifyPlaybackState | null> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player/currently-playing`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })

  // 204 = nothing playing
  if (response.status === 204) return null
  if (!response.ok) {
    if (response.status === 401) throw new Error('TOKEN_EXPIRED')
    throw new Error(`API error: ${response.status}`)
  }

  return (await response.json()) as SpotifyPlaybackState
}

export async function getPlaybackState(
  accessToken: string
): Promise<any | null> {
  const response = await fetch(`${SPOTIFY_API_BASE}/me/player`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })

  if (response.status === 204) return null
  if (!response.ok) {
    if (response.status === 401) throw new Error('TOKEN_EXPIRED')
    return null
  }

  return await response.json()
}

// ── Token Storage ─────────────────────────────────────────────

const TOKEN_KEY = 'vf_tokens'
const EXPIRY_KEY = 'vf_token_expiry'
const SCOPE_VERSION_KEY = 'vf_scope_version'
// Bump this number whenever you change SCOPES above to force re-auth
const CURRENT_SCOPE_VERSION = 2

export function saveTokens(tokens: SpotifyAuthTokens): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
  const expiryTime = Date.now() + tokens.expires_in * 1000
  localStorage.setItem(EXPIRY_KEY, expiryTime.toString())
  localStorage.setItem(SCOPE_VERSION_KEY, CURRENT_SCOPE_VERSION.toString())
}

export function getStoredTokens(): SpotifyAuthTokens | null {
  // Check if scope version matches — force re-auth if scopes changed
  const storedVersion = localStorage.getItem(SCOPE_VERSION_KEY)
  if (storedVersion !== CURRENT_SCOPE_VERSION.toString()) {
    // Scopes changed since last login, clear everything
    clearTokens()
    return null
  }
  const stored = localStorage.getItem(TOKEN_KEY)
  if (!stored) return null
  return JSON.parse(stored) as SpotifyAuthTokens
}

export function isTokenExpired(): boolean {
  const expiry = localStorage.getItem(EXPIRY_KEY)
  if (!expiry) return true
  return Date.now() > parseInt(expiry) - 60000 // refresh 1 min before expiry
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EXPIRY_KEY)
  localStorage.removeItem(SCOPE_VERSION_KEY)
  localStorage.removeItem('pkce_verifier')
}

// ── Playback Controls ─────────────────────────────────────────

export async function playTrack(accessToken: string): Promise<void> {
  await fetch(`${SPOTIFY_API_BASE}/me/player/play`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` }
  })
}

export async function pauseTrack(accessToken: string): Promise<void> {
  await fetch(`${SPOTIFY_API_BASE}/me/player/pause`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` }
  })
}

export async function nextTrack(accessToken: string): Promise<void> {
  await fetch(`${SPOTIFY_API_BASE}/me/player/next`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` }
  })
}

export async function previousTrack(accessToken: string): Promise<void> {
  await fetch(`${SPOTIFY_API_BASE}/me/player/previous`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` }
  })
}

export async function seekToPosition(accessToken: string, positionMs: number): Promise<void> {
  await fetch(`${SPOTIFY_API_BASE}/me/player/seek?position_ms=${Math.round(positionMs)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` }
  })
}

export async function setVolume(accessToken: string, volumePercent: number): Promise<void> {
  const clamped = Math.max(0, Math.min(100, Math.round(volumePercent)))
  await fetch(`${SPOTIFY_API_BASE}/me/player/volume?volume_percent=${clamped}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` }
  })
}
