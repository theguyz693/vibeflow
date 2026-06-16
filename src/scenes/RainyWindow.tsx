import React, { useRef, useEffect, useCallback } from 'react'
import { SceneProps } from '../types/spotify'

interface Raindrop {
  x: number
  y: number
  speed: number
  length: number
  thickness: number
  opacity: number
  drift: number
}

interface Bokeh {
  x: number
  y: number
  radius: number
  color: [number, number, number]
  opacity: number
  pulseSpeed: number
  pulsePhase: number
}

interface DropletOnGlass {
  x: number
  y: number
  radius: number
  opacity: number
  vx: number
  vy: number
  trail: { x: number; y: number }[]
}

const RainyWindow: React.FC<SceneProps> = ({ colors, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const rainRef = useRef<Raindrop[]>([])
  const bokehRef = useRef<Bokeh[]>([])
  const dropletsRef = useRef<DropletOnGlass[]>([])

  const hexToRgb = (hex: string): [number, number, number] => {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16)
    ]
  }

  useEffect(() => {
    const accentRgb = hexToRgb(colors.accent)
    const glowRgb = hexToRgb(colors.glow)
    const primaryRgb = hexToRgb(colors.primary)
    const secondaryRgb = hexToRgb(colors.secondary)

    // Rain
    rainRef.current = Array.from({ length: 200 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      speed: 4 + Math.random() * 8,
      length: 15 + Math.random() * 30,
      thickness: 0.5 + Math.random() * 1.5,
      opacity: 0.1 + Math.random() * 0.4,
      drift: -0.5 + Math.random() * 0.3
    }))

    // Bokeh lights (blurred city lights behind the window)
    const bokehColors = [accentRgb, glowRgb, primaryRgb, secondaryRgb]
    bokehRef.current = Array.from({ length: 30 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 20 + Math.random() * 80,
      color: bokehColors[Math.floor(Math.random() * bokehColors.length)],
      opacity: 0.06 + Math.random() * 0.12,
      pulseSpeed: 0.3 + Math.random() * 1.5,
      pulsePhase: Math.random() * Math.PI * 2
    }))

    // Glass droplets (slow dripping)
    dropletsRef.current = Array.from({ length: 40 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 2 + Math.random() * 5,
      opacity: 0.3 + Math.random() * 0.5,
      vx: (Math.random() - 0.5) * 0.1,
      vy: 0.1 + Math.random() * 0.4,
      trail: []
    }))
  }, [width, height, colors])

  const draw = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!

      const accentRgb = hexToRgb(colors.accent)
      const glowRgb = hexToRgb(colors.glow)

      // ── Background ──
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height)
      bgGrad.addColorStop(0, '#0a0a12')
      bgGrad.addColorStop(0.5, '#0d0d18')
      bgGrad.addColorStop(1, '#080810')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, width, height)

      // ── Bokeh lights ──
      for (const b of bokehRef.current) {
        const pulse = Math.sin(timestamp * 0.001 * b.pulseSpeed + b.pulsePhase) * 0.3 + 0.7
        const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius)
        grad.addColorStop(0, `rgba(${b.color[0]}, ${b.color[1]}, ${b.color[2]}, ${b.opacity * pulse})`)
        grad.addColorStop(0.5, `rgba(${b.color[0]}, ${b.color[1]}, ${b.color[2]}, ${b.opacity * pulse * 0.3})`)
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = grad
        ctx.fillRect(b.x - b.radius, b.y - b.radius, b.radius * 2, b.radius * 2)
      }

      // ── Glass surface ──
      ctx.fillStyle = 'rgba(100, 120, 140, 0.02)'
      ctx.fillRect(0, 0, width, height)

      // ── Glass droplets (slow drip) ──
      for (const d of dropletsRef.current) {
        d.y += d.vy
        d.x += d.vx

        // Trail
        d.trail.push({ x: d.x, y: d.y })
        if (d.trail.length > 15) d.trail.shift()

        // Reset when off screen
        if (d.y > height + 20) {
          d.y = -10
          d.x = Math.random() * width
          d.trail = []
        }

        // Draw trail
        for (let t = 0; t < d.trail.length; t++) {
          const tp = d.trail[t]
          const alpha = (t / d.trail.length) * d.opacity * 0.3
          ctx.fillStyle = `rgba(180, 200, 220, ${alpha})`
          const trailR = d.radius * 0.3 * (t / d.trail.length)
          ctx.beginPath()
          ctx.arc(tp.x, tp.y, trailR, 0, Math.PI * 2)
          ctx.fill()
        }

        // Draw droplet with lens effect
        const dGrad = ctx.createRadialGradient(
          d.x - d.radius * 0.3,
          d.y - d.radius * 0.3,
          0,
          d.x,
          d.y,
          d.radius
        )
        dGrad.addColorStop(0, `rgba(220, 230, 240, ${d.opacity * 0.8})`)
        dGrad.addColorStop(0.5, `rgba(180, 200, 220, ${d.opacity * 0.4})`)
        dGrad.addColorStop(1, `rgba(100, 120, 140, ${d.opacity * 0.1})`)
        ctx.fillStyle = dGrad
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2)
        ctx.fill()

        // Highlight
        ctx.fillStyle = `rgba(255, 255, 255, ${d.opacity * 0.6})`
        ctx.beginPath()
        ctx.arc(d.x - d.radius * 0.25, d.y - d.radius * 0.25, d.radius * 0.25, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── Rain streaks ──
      for (const r of rainRef.current) {
        r.y += r.speed
        r.x += r.drift

        if (r.y > height + r.length) {
          r.y = -r.length
          r.x = Math.random() * width
        }

        const grad = ctx.createLinearGradient(r.x, r.y, r.x + r.drift * r.length * 0.3, r.y + r.length)
        grad.addColorStop(0, `rgba(180, 200, 230, 0)`)
        grad.addColorStop(0.3, `rgba(180, 200, 230, ${r.opacity})`)
        grad.addColorStop(1, `rgba(180, 200, 230, 0)`)
        ctx.strokeStyle = grad
        ctx.lineWidth = r.thickness
        ctx.beginPath()
        ctx.moveTo(r.x, r.y)
        ctx.lineTo(r.x + r.drift * r.length * 0.3, r.y + r.length)
        ctx.stroke()
      }

      // ── Ambient glow at bottom (street reflection) ──
      const ambientGrad = ctx.createLinearGradient(0, height * 0.7, 0, height)
      ambientGrad.addColorStop(0, 'rgba(0, 0, 0, 0)')
      ambientGrad.addColorStop(1, `rgba(${accentRgb[0]}, ${accentRgb[1]}, ${accentRgb[2]}, 0.04)`)
      ctx.fillStyle = ambientGrad
      ctx.fillRect(0, height * 0.7, width, height * 0.3)

      // ── Vignette ──
      const vignette = ctx.createRadialGradient(
        width / 2, height / 2, height * 0.3,
        width / 2, height / 2, height * 0.9
      )
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.4)')
      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, width, height)

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

export default RainyWindow
