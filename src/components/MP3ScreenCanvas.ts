import * as THREE from 'three'

export interface ScreenLyrics {
  prev?: string
  current: string
  next?: string
}

/** Everything the physical screen needs to know; derived from the existing useSpotify state. */
export interface ScreenData {
  connected: boolean
  hasTrack: boolean
  title: string
  artist: string
  album: string
  artUrl?: string
  progressMs: number
  durationMs: number
  isPlaying: boolean
  volume: number // 0-100
  mode: 'now-playing' | 'lyrics'
  lyrics?: ScreenLyrics | null
  lyricsLoading?: boolean
}

export const EMPTY_SCREEN_DATA: ScreenData = {
  connected: false,
  hasTrack: false,
  title: '',
  artist: '',
  album: '',
  progressMs: 0,
  durationMs: 0,
  isPlaying: false,
  volume: 0,
  mode: 'now-playing'
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

/**
 * Draws the iPod display into a canvas whose aspect ratio equals the physical
 * screen glass (2.372 x 2.025 model units), so it maps 1:1 without distortion.
 */
export class MP3ScreenCanvas {
  public canvas: HTMLCanvasElement
  public ctx: CanvasRenderingContext2D
  public texture: THREE.CanvasTexture

  private artCache = new Map<string, HTMLImageElement>()
  private lastKey = ''
  private onArtLoaded = () => {
    this.lastKey = ''
  }

  constructor(aspect: number, height = 656) {
    this.canvas = document.createElement('canvas')
    this.canvas.height = height
    this.canvas.width = Math.round(height * aspect)
    this.ctx = this.canvas.getContext('2d')!
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.generateMipmaps = true
    this.texture.minFilter = THREE.LinearMipmapLinearFilter
    this.texture.magFilter = THREE.LinearFilter
  }

  private getArt(url?: string): HTMLImageElement | null {
    if (!url) return null
    let img = this.artCache.get(url)
    if (!img) {
      img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = this.onArtLoaded
      img.src = url
      this.artCache.set(url, img)
      if (this.artCache.size > 8) {
        const first = this.artCache.keys().next().value
        if (first) this.artCache.delete(first)
      }
    }
    return img.complete && img.naturalWidth > 0 ? img : null
  }

  private fit(text: string, maxW: number): string {
    const { ctx } = this
    if (ctx.measureText(text).width <= maxW) return text
    let t = text
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
    return t + '…'
  }

  private wrapText(text: string, maxW: number): string[] {
    const { ctx } = this
    const words = text.split(' ')
    const lines: string[] = []
    let cur = words[0] || ''
    for (let i = 1; i < words.length; i++) {
      const w = words[i]
      if (ctx.measureText(cur + ' ' + w).width <= maxW) {
        cur += ' ' + w
      } else {
        lines.push(cur)
        cur = w
      }
    }
    if (cur) lines.push(cur)
    return lines
  }

  /** Redraws only when something visible changed, to avoid needless texture uploads. */
  public render(d: ScreenData) {
    const art = this.getArt(d.artUrl)
    const key = [
      d.mode,
      d.connected,
      d.hasTrack,
      d.title,
      d.artist,
      d.album,
      d.artUrl,
      !!art,
      Math.floor(d.progressMs / 1000),
      d.durationMs,
      d.isPlaying,
      d.volume,
      d.lyrics?.current,
      d.lyrics?.prev,
      d.lyrics?.next,
      d.lyricsLoading
    ].join('|')
    if (key === this.lastKey) return
    this.lastKey = key

    const { ctx, canvas } = this
    const w = canvas.width
    const h = canvas.height
    const pad = 36

    ctx.clearRect(0, 0, w, h)
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, 34) // rounded screen corners
    ctx.clip()

    // 1. Fully Pitch Black Screen Background
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, w, h)

    // 2. Top Header Bar (Realistic subtle dark charcoal with fine divider)
    ctx.fillStyle = '#080808'
    ctx.fillRect(0, 0, w, 64)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, 64)
    ctx.lineTo(w, 64)
    ctx.stroke()
    ctx.textBaseline = 'middle'

    // Status indicator dot / play state
    ctx.fillStyle = d.isPlaying ? '#34d399' : '#fbbf24'
    if (d.isPlaying) {
      ctx.beginPath()
      ctx.moveTo(pad, 20)
      ctx.lineTo(pad + 20, 32)
      ctx.lineTo(pad, 44)
      ctx.fill()
    } else {
      ctx.fillRect(pad, 20, 7, 24)
      ctx.fillRect(pad + 14, 20, 7, 24)
    }

    ctx.font = '700 26px "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = '#f4f4f5'

    if (d.mode === 'lyrics') {
      ctx.fillText('Synced Lyrics', pad + 36, 33)
      ctx.textAlign = 'right'
      ctx.fillStyle = '#38bdf8'
      ctx.font = '600 20px "Segoe UI", Roboto, sans-serif'
      ctx.fillText('MENU: Art', w - pad, 33)
    } else {
      ctx.fillText('Now Playing', pad + 36, 33)
      ctx.textAlign = 'right'
      ctx.fillStyle = d.isPlaying ? '#34d399' : '#fbbf24'
      ctx.fillText(d.hasTrack ? (d.isPlaying ? 'PLAYING' : 'PAUSED') : 'IDLE', w - pad, 33)
    }

    // Unconnected / No track state
    if (!d.hasTrack) {
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffffff'
      ctx.font = '700 40px "Segoe UI", Roboto, sans-serif'
      ctx.fillText(d.connected ? 'Nothing playing' : 'Spotify not connected', w / 2, h / 2 - 20)
      ctx.fillStyle = '#a1a1aa'
      ctx.font = '28px "Segoe UI", Roboto, sans-serif'
      ctx.fillText(
        d.connected ? 'Start playback in Spotify' : 'Log in from Spotify Companion',
        w / 2,
        h / 2 + 34
      )
      ctx.restore()
      this.texture.needsUpdate = true
      return
    }

    // ── LYRICS MODE DISPLAY ────────────────────────────
    if (d.mode === 'lyrics') {
      const areaTop = 84
      const areaH = 320
      const contentW = w - pad * 2

      if (d.lyricsLoading) {
        ctx.textAlign = 'center'
        ctx.fillStyle = '#38bdf8'
        ctx.font = '600 28px "Segoe UI", Roboto, sans-serif'
        ctx.fillText('Searching synced lyrics...', w / 2, areaTop + areaH / 2 - 10)
        ctx.fillStyle = '#71717a'
        ctx.font = '22px "Segoe UI", Roboto, sans-serif'
        ctx.fillText('Connecting to lrclib database', w / 2, areaTop + areaH / 2 + 28)
      } else if (!d.lyrics || (!d.lyrics.current && !d.lyrics.prev && !d.lyrics.next)) {
        ctx.textAlign = 'center'
        ctx.fillStyle = '#ffffff'
        ctx.font = '700 32px "Segoe UI", Roboto, sans-serif'
        ctx.fillText('No synced lyrics found', w / 2, areaTop + areaH / 2 - 20)
        ctx.fillStyle = '#a1a1aa'
        ctx.font = '24px "Segoe UI", Roboto, sans-serif'
        ctx.fillText('Enjoy the track instrumental vibe', w / 2, areaTop + areaH / 2 + 20)
        ctx.fillStyle = '#38bdf8'
        ctx.font = '600 20px "Segoe UI", Roboto, sans-serif'
        ctx.fillText('Press MENU to return to Album Art', w / 2, areaTop + areaH / 2 + 60)
      } else {
        // Render 3-line synced lyrics card
        const midY = areaTop + areaH / 2

        // Previous Line
        if (d.lyrics.prev) {
          ctx.textAlign = 'center'
          ctx.fillStyle = 'rgba(161, 161, 170, 0.45)'
          ctx.font = '500 24px "Segoe UI", Roboto, sans-serif'
          ctx.fillText(this.fit(d.lyrics.prev, contentW), w / 2, midY - 76)
        }

        // Active Line Highlight Pill
        ctx.textAlign = 'center'
        ctx.font = 'bold 34px "Segoe UI", Roboto, sans-serif'
        const currentLines = this.wrapText(d.lyrics.current || '♪ ♪ ♪', contentW - 40)

        // Pill background
        const pillH = Math.max(56, currentLines.length * 42 + 18)
        ctx.fillStyle = '#0d0d0d'
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.roundRect(pad + 10, midY - pillH / 2, contentW - 20, pillH, 16)
        ctx.fill()
        ctx.stroke()

        // Active text in vibrant cyan
        ctx.fillStyle = '#38bdf8'
        const lineStart = midY - ((currentLines.length - 1) * 38) / 2
        currentLines.forEach((line, idx) => {
          ctx.fillText(line, w / 2, lineStart + idx * 38)
        })

        // Next Line
        if (d.lyrics.next) {
          ctx.textAlign = 'center'
          ctx.fillStyle = 'rgba(161, 161, 170, 0.65)'
          ctx.font = '500 24px "Segoe UI", Roboto, sans-serif'
          ctx.fillText(this.fit(d.lyrics.next, contentW), w / 2, midY + 84)
        }
      }
    } else {
      // ── NOW PLAYING MODE DISPLAY (Original Album Art) ───
      const ax = pad
      const ay = 100
      const as = 250

      // Art container on pitch black
      ctx.fillStyle = '#0c0c0c'
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.roundRect(ax, ay, as, as, 18)
      ctx.fill()
      ctx.stroke()

      if (art) {
        ctx.save()
        ctx.beginPath()
        ctx.roundRect(ax, ay, as, as, 18)
        ctx.clip()
        ctx.drawImage(art, ax, ay, as, as)
        ctx.restore()
      } else {
        ctx.fillStyle = '#71717a'
        ctx.font = '700 90px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('♪', ax + as / 2, ay + as / 2)
      }

      // Metadata Details
      const tx = ax + as + 32
      const tw = w - tx - pad
      ctx.textAlign = 'left'

      // Title
      ctx.fillStyle = '#ffffff'
      ctx.font = '700 38px "Segoe UI", Roboto, sans-serif'
      ctx.fillText(this.fit(d.title, tw), tx, ay + 46)

      // Artist
      ctx.fillStyle = '#e4e4e7'
      ctx.font = '600 30px "Segoe UI", Roboto, sans-serif'
      ctx.fillText(this.fit(d.artist, tw), tx, ay + 104)

      // Album
      ctx.fillStyle = '#a1a1aa'
      ctx.font = '26px "Segoe UI", Roboto, sans-serif'
      ctx.fillText(this.fit(d.album, tw), tx, ay + 154)

      // Volume & Hint Pill
      ctx.fillStyle = '#71717a'
      ctx.font = '600 22px "Segoe UI", Roboto, sans-serif'
      ctx.fillText(`VOL ${Math.round(d.volume)}%  •  MENU for Lyrics`, tx, ay + 214)
    }

    // ── PROGRESS BAR (Both Modes) ──────────────────────
    const py = 430
    const pw = w - pad * 2
    ctx.fillStyle = '#18181b'
    ctx.beginPath()
    ctx.roundRect(pad, py, pw, 14, 7)
    ctx.fill()

    const pct = d.durationMs > 0 ? Math.min(1, d.progressMs / d.durationMs) : 0
    if (pct > 0) {
      const grad = ctx.createLinearGradient(pad, 0, pad + pw, 0)
      grad.addColorStop(0, '#0284c7')
      grad.addColorStop(1, '#38bdf8')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.roundRect(pad, py, Math.max(14, pw * pct), 14, 7)
      ctx.fill()
    }

    // Timestamps
    ctx.font = '700 28px Consolas, "Courier New", monospace'
    ctx.fillStyle = '#f4f4f5'
    ctx.textAlign = 'left'
    ctx.fillText(fmt(d.progressMs), pad, py + 48)
    ctx.textAlign = 'right'
    ctx.fillText(fmt(d.durationMs), w - pad, py + 48)

    // Footer info
    ctx.textAlign = 'center'
    ctx.fillStyle = '#71717a'
    ctx.font = '22px "Segoe UI", Roboto, sans-serif'
    ctx.fillText(
      d.mode === 'lyrics' ? 'Spotify • Click MENU to view Art' : 'Spotify • Click MENU for Lyrics',
      w / 2,
      h - 44
    )

    ctx.restore()
    this.texture.needsUpdate = true
  }

  public dispose() {
    this.texture.dispose()
    this.artCache.clear()
  }
}
