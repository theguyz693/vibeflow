export interface LyricLine {
  timeMs: number
  text: string
}

export async function fetchLyrics(
  artist: string,
  track: string,
  album: string,
  durationMs: number
): Promise<LyricLine[] | null> {
  try {
    const params = new URLSearchParams({
      artist_name: artist,
      track_name: track,
      album_name: album,
      duration: Math.round(durationMs / 1000).toString()
    })

    const response = await fetch(`https://lrclib.net/api/get?${params.toString()}`)
    if (!response.ok) return null

    const data = await response.json()
    if (!data.syncedLyrics) return null

    return parseLrc(data.syncedLyrics)
  } catch (error) {
    console.error('Error fetching lyrics:', error)
    return null
  }
}

function parseLrc(lrc: string): LyricLine[] {
  const lines = lrc.split('\n')
  const parsed: LyricLine[] = []

  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/

  for (const line of lines) {
    const match = line.match(timeRegex)
    if (match) {
      const minutes = parseInt(match[1], 10)
      const seconds = parseInt(match[2], 10)
      const ms = parseInt(match[3].padEnd(3, '0'), 10) // handle .xx and .xxx
      
      const timeMs = minutes * 60000 + seconds * 1000 + ms
      const text = line.replace(timeRegex, '').trim()
      
      if (text) {
        parsed.push({ timeMs, text })
      }
    }
  }

  return parsed.sort((a, b) => a.timeMs - b.timeMs)
}
