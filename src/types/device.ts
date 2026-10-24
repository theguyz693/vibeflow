export interface TrackItem {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  audioUrl: string
  artColor: string
}

export const SAMPLE_TRACKS: TrackItem[] = [
  {
    id: 'track-1',
    title: 'Neon Drift',
    artist: 'VibeFlow Synth',
    album: 'Retro Horizons',
    duration: 41,
    audioUrl: '/audio/neon-drift.wav',
    artColor: '#a855f7'
  },
  {
    id: 'track-2',
    title: 'Velvet Static',
    artist: 'Lo-Fi Chillers',
    album: 'Tape Memories',
    duration: 37,
    audioUrl: '/audio/velvet-static.wav',
    artColor: '#3b82f6'
  },
  {
    id: 'track-3',
    title: 'Glass Horizon',
    artist: 'Pulsewave',
    album: 'Deep Reflections',
    duration: 38,
    audioUrl: '/audio/glass-horizon.wav',
    artColor: '#06b6d4'
  },
  {
    id: 'track-4',
    title: 'Midnight Arcade',
    artist: '8-Bit Dreams',
    album: 'Pixel Paradise',
    duration: 36,
    audioUrl: '/audio/midnight-arcade.wav',
    artColor: '#f43f5e'
  }
]
