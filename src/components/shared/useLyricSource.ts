import { useEffect, useMemo, useState } from 'react'
import { fetchLyrics, LyricLine } from '../../services/lyrics'
import { buildLines, DEMO_LYRICS, Line } from '../../services/lyricAnalysis'
import type { SpotifyDeviceSource } from '../MP3Player3D'

export interface LyricSource {
  item: NonNullable<SpotifyDeviceSource['currentTrack']>['item'] | null
  /** true when nothing is playing: visuals fall back to the sample lyrics */
  demo: boolean
  lines: Line[]
  art: HTMLImageElement | null
  /** bumps when the art finishes loading, so textures can redraw */
  artVersion: number
}

/** Fetches synced lyrics + album art for the current track (shared by the 3D visuals). */
export function useLyricSource(spotify: SpotifyDeviceSource, albumArtUrl?: string): LyricSource {
  const item = spotify.currentTrack?.item ?? null
  const demo = !item

  const [raw, setRaw] = useState<LyricLine[] | null>(null)
  useEffect(() => {
    let alive = true
    setRaw(null)
    if (!item) return
    fetchLyrics(item.artists?.[0]?.name || '', item.name || '', item.album?.name || '', item.duration_ms || 0)
      .then((r) => alive && setRaw(r))
      .catch(() => alive && setRaw(null))
    return () => {
      alive = false
    }
  }, [item?.id])
  const lines = useMemo(() => buildLines(demo ? DEMO_LYRICS : raw || []), [demo, raw])

  const [art, setArt] = useState<HTMLImageElement | null>(null)
  const [artVersion, setArtVersion] = useState(0)
  useEffect(() => {
    if (!albumArtUrl) {
      setArt(null)
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => setArtVersion((v) => v + 1)
    img.src = albumArtUrl
    setArt(img)
  }, [albumArtUrl])

  return { item, demo, lines, art, artVersion }
}
