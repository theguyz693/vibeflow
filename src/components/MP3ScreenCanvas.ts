import * as THREE from 'three'

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
  volume: 0
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

  /** Redraws only when something visible changed, to avoid needless texture uploads. */
  public render(d: ScreenData) {
    const art = this.getArt(d.artUrl)
    const key = [
      d.connected, d.hasTrack, d.title, d.artist, d.album, d.artUrl, !!art,
      Math.floor(d.progressMs / 1000), d.durationMs, d.isPlaying, d.volume
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
    ctx.roundRect(0, 0, w, h, 34) // rounded screen corners (alpha-tested on the mesh)
    ctx.clip()

    const bg = ctx.createLinearGradient(0, 0, 0, h)
    bg.addColorStop(0, '#0b1220')
    bg.addColorStop(1, '#16213a')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    // Header
    ctx.fillStyle = '#1e2a47'
    ctx.fillRect(0, 0, w, 64)
    ctx.textBaseline = 'middle'
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
    ctx.fillStyle = '#e2e8f0'
    ctx.font = '700 28px "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Now Playing', pad + 36, 33)
    ctx.textAlign = 'right'
    ctx.fillStyle = d.isPlaying ? '#34d399' : '#fbbf24'
    ctx.fillText(d.hasTrack ? (d.isPlaying ? 'PLAYING' : 'PAUSED') : 'IDLE', w - pad, 33)

    if (!d.hasTrack) {
      ctx.textAlign = 'center'
      ctx.fillStyle = '#e2e8f0'
      ctx.font = '700 40px "Segoe UI", Roboto, sans-serif'
      ctx.fillText(d.connected ? 'Nothing playing' : 'Spotify not connected', w / 2, h / 2 - 20)
      ctx.fillStyle = '#94a3b8'
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

    // Artwork
    const ax = pad
    const ay = 100
    const as = 250
    ctx.fillStyle = '#334155'
    ctx.beginPath()
    ctx.roundRect(ax, ay, as, as, 16)
    ctx.fill()
    if (art) {
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(ax, ay, as, as, 16)
      ctx.clip()
      ctx.drawImage(art, ax, ay, as, as)
      ctx.restore()
    } else {
      ctx.fillStyle = '#94a3b8'
      ctx.font = '700 90px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('♪', ax + as / 2, ay + as / 2)
    }

    // Metadata
    const tx = ax + as + 32
    const tw = w - tx - pad
    ctx.textAlign = 'left'
    ctx.fillStyle = '#f8fafc'
    ctx.font = '700 40px "Segoe UI", Roboto, sans-serif'
    ctx.fillText(this.fit(d.title, tw), tx, ay + 48)
    ctx.fillStyle = '#93c5fd'
    ctx.font = '600 31px "Segoe UI", Roboto, sans-serif'
    ctx.fillText(this.fit(d.artist, tw), tx, ay + 108)
    ctx.fillStyle = '#94a3b8'
    ctx.font = '26px "Segoe UI", Roboto, sans-serif'
    ctx.fillText(this.fit(d.album, tw), tx, ay + 158)
    ctx.fillStyle = '#64748b'
    ctx.font = '600 24px "Segoe UI", Roboto, sans-serif'
    ctx.fillText(`VOL ${Math.round(d.volume)}%`, tx, ay + 218)

    // Progress bar
    const py = 420
    const pw = w - pad * 2
    ctx.fillStyle = '#334155'
    ctx.beginPath()
    ctx.roundRect(pad, py, pw, 14, 7)
    ctx.fill()
    const pct = d.durationMs > 0 ? Math.min(1, d.progressMs / d.durationMs) : 0
    if (pct > 0) {
      ctx.fillStyle = '#38bdf8'
      ctx.beginPath()
      ctx.roundRect(pad, py, Math.max(14, pw * pct), 14, 7)
      ctx.fill()
    }
    ctx.font = '700 30px Consolas, "Courier New", monospace'
    ctx.fillStyle = '#e2e8f0'
    ctx.textAlign = 'left'
    ctx.fillText(fmt(d.progressMs), pad, py + 50)
    ctx.textAlign = 'right'
    ctx.fillText(fmt(d.durationMs), w - pad, py + 50)

    // Footer
    ctx.textAlign = 'center'
    ctx.fillStyle = '#64748b'
    ctx.font = '24px "Segoe UI", Roboto, sans-serif'
    ctx.fillText('Spotify', w / 2, h - 50)

    ctx.restore()
    this.texture.needsUpdate = true
  }

  public dispose() {
    this.texture.dispose()
    this.artCache.clear()
  }
}
