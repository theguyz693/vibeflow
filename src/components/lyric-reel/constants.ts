import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import helvetikerBold from 'three/examples/fonts/helvetiker_bold.typeface.json'
import type { LyricLine } from '../../services/lyrics'

/** Shared constants and types for the 3D "Lyric Reel" mode. */

export const FLOOR_Y = -3.4
export const DISC_R = 2.4
export const BG_SCREEN_R = 14
export const FONT = new FontLoader().parse(helvetikerBold)
export const FONT_RES: number = (FONT as any).data.resolution || 1000

export const DEMO_LYRICS: LyricLine[] = [
  'girl you look beautiful tonight',
  'stars on the ceiling',
  'all VVS',
  'music like this',
  'stay in the glow',
  'one more time',
  'never let it fade',
  'spin it back again',
  'hold on',
  'we are the only ones awake in this city'
].map((text, i) => ({ timeMs: 3200 + i * 2800, text }))

export type Kind = 'ring' | 'front'
export type Style = 'slam' | 'slide' | 'stretch' | 'drop'

export interface LineState {
  idx: number
  text: string
  startedAt: number
  stagger: number
  kind: Kind
  style: Style
  dir: 1 | -1
}

export interface GlassMats {
  normal: import('three').Material
  emph: import('three').Material
}
