import React, { useRef, useEffect, useCallback } from 'react'
import { SceneProps } from '../types/spotify'

interface Orb {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  colorIndex: number
}

const AuraLoop: React.FC<SceneProps> = ({ colors, albumArtUrl, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const albumImgRef = useRef<HTMLImageElement | null>(null)
  const orbsRef = useRef<Orb[]>([])

  // Load album art
  useEffect(() => {
    if (!albumArtUrl) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = albumArtUrl
    img.onload = () => {
      albumImgRef.current = img
    }
  }, [albumArtUrl])

  // Initialize orbs for the aura
  useEffect(() => {
    orbsRef.current = Array.from({ length: 6 }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: Math.min(width, height) * (0.6 + Math.random() * 0.4),
      colorIndex: i % 4
    }))
  }, [width, height])

  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const draw = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!

      // Extract colors
      const palette = [colors.primary, colors.secondary, colors.accent, colors.glow]

      // ── Background Base ──
      ctx.fillStyle = '#05050a'
      ctx.fillRect(0, 0, width, height)

      // ── Aura / Plasma Orbs ──
      ctx.globalCompositeOperation = 'screen'
      
      const orbs = orbsRef.current
      for (const orb of orbs) {
        // Slowly drift
        orb.x += orb.vx
        orb.y += orb.vy

        // Gentle bounce off screen edges
        if (orb.x < -orb.radius || orb.x > width + orb.radius) orb.vx *= -1
        if (orb.y < -orb.radius || orb.y > height + orb.radius) orb.vy *= -1

        // Pulsing radius
        const currentRadius = orb.radius + Math.sin(timestamp * 0.001 + orb.colorIndex) * 100
        const color = palette[orb.colorIndex]

        const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, currentRadius)
        grad.addColorStop(0, hexToRgba(color, 0.4))
        grad.addColorStop(0.5, hexToRgba(color, 0.1))
        grad.addColorStop(1, 'rgba(0,0,0,0)')

        ctx.fillStyle = grad
        ctx.fillRect(orb.x - currentRadius, orb.y - currentRadius, currentRadius * 2, currentRadius * 2)
      }

      ctx.globalCompositeOperation = 'source-over'

      // ── Dark vignette to focus center ──
      const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.2, width / 2, height / 2, width * 0.7)
      vignette.addColorStop(0, 'rgba(0,0,0,0)')
      vignette.addColorStop(1, 'rgba(0,0,0,0.8)')
      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, width, height)

      // ── Massive Album Cover ──
      if (albumImgRef.current) {
        const coverSize = Math.min(width, height) * 0.55
        const cx = width / 2
        const cy = height / 2
        const float = Math.sin(timestamp * 0.0015) * 15

        ctx.save()
        ctx.translate(cx, cy + float)

        // Massive glow behind cover
        ctx.shadowColor = hexToRgba(colors.glow, 0.8)
        ctx.shadowBlur = 100

        // Subtle rotation
        ctx.rotate(Math.sin(timestamp * 0.0005) * 0.02)

        // Draw cover with rounded corners
        const r = 24
        const x = -coverSize / 2
        const y = -coverSize / 2
        
        ctx.beginPath()
        ctx.moveTo(x + r, y)
        ctx.lineTo(x + coverSize - r, y)
        ctx.quadraticCurveTo(x + coverSize, y, x + coverSize, y + r)
        ctx.lineTo(x + coverSize, y + coverSize - r)
        ctx.quadraticCurveTo(x + coverSize, y + coverSize, x + coverSize - r, y + coverSize)
        ctx.lineTo(x + r, y + coverSize)
        ctx.quadraticCurveTo(x, y + coverSize, x, y + coverSize - r)
        ctx.lineTo(x, y + r)
        ctx.quadraticCurveTo(x, y, x + r, y)
        ctx.closePath()
        
        // Fill shadow first
        ctx.fillStyle = 'black'
        ctx.fill()
        
        // Then clip and draw image
        ctx.clip()
        ctx.drawImage(albumImgRef.current, x, y, coverSize, coverSize)

        ctx.restore()
      }

      animRef.current = requestAnimationFrame(draw)
    },
    [colors, width, height]
  )

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
    />
  )
}

export default AuraLoop
