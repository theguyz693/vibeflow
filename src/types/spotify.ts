export interface SpotifyImage {
  url: string
  height: number
  width: number
}

export interface SpotifyArtist {
  name: string
  id: string
}

export interface SpotifyAlbum {
  name: string
  images: SpotifyImage[]
  id: string
}

export interface SpotifyTrack {
  name: string
  artists: SpotifyArtist[]
  album: SpotifyAlbum
  duration_ms: number
  id: string
  uri: string
}

export interface SpotifyPlaybackState {
  is_playing: boolean
  progress_ms: number
  item: SpotifyTrack | null
  currently_playing_type: 'track' | 'episode' | 'ad' | 'unknown'
}

export interface SpotifyAuthTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export interface ColorPalette {
  primary: string
  secondary: string
  accent: string
  glow: string
  text: string
  raw: [number, number, number][]
}

export interface SceneProps {
  colors: ColorPalette
  albumArtUrl?: string
  width: number
  height: number
}

export interface SceneDefinition {
  id: string
  name: string
  icon: string
  component: React.ComponentType<SceneProps>
  thumbnail?: string
}
