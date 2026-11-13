import type { LyricLine } from './lyrics'

/** A lyric line plus what we know about it. `dots` marks the instrumental intro. */
export interface Line {
  timeMs: number
  text: string
  chorus: boolean
  dots?: boolean
}

const DEMO_RAW = [
  'girl you look beautiful tonight',
  'stars on the ceiling',
  'all of the lights down low',
  'stay in the glow',
  'never let it fade away',
  'stay in the glow',
  'never let it fade away',
  'we are the only ones awake in this city',
  'music like this makes the whole room move',
  'hold on to the feeling',
  'stay in the glow',
  'never let it fade away'
]

/** Sample lyrics used when Spotify isn't connected, so every visual mode has something to show. */
export const DEMO_LYRICS: LyricLine[] = DEMO_RAW.map((text, i) => ({ timeMs: 3500 + i * 3300, text }))

export const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()

/** Chorus = a substantial line that repeats. Cheap, language-agnostic, works surprisingly well. */
export function buildLines(raw: LyricLine[]): Line[] {
  const counts = new Map<string, number>()
  raw.forEach((l) => counts.set(norm(l.text), (counts.get(norm(l.text)) || 0) + 1))
  let lines: Line[] = raw.map((l) => {
    const n = norm(l.text)
    return { timeMs: l.timeMs, text: l.text, chorus: (counts.get(n) || 0) >= 2 && n.split(' ').length >= 3 }
  })
  // if nearly everything "repeats" (loops, chants) the signal is useless: turn it off
  if (lines.filter((l) => l.chorus).length > lines.length * 0.6) lines = lines.map((l) => ({ ...l, chorus: false }))
  if (lines.length && lines[0].timeMs > 2500) lines.unshift({ timeMs: 0, text: '', chorus: false, dots: true })
  return lines
}

export const fmtTime = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}
