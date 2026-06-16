import React, { useRef, useEffect, useCallback } from 'react'
import { SceneProps } from '../types/spotify'

interface Star {
  x: number
  y: number
  z: number
  prevX: number
  prevY: number
  speed: number
}

interface Nebula {
  x: number
  y: number
  radius: number
  color: [number, number, number]
  opacity: number
  vx: number
  vy: number
  phase: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  life: number
}

const SpaceFlight: React.FC<SceneProps> = ({ colors, width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const starsRef = useRef<Star[]>([])
  const nebulaeRef = useRef<Nebula[]>([])
  const particlesRef = useRef<Particle[]>([])
  const rotationRef = useRef(0)

  const hexToRgb = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
  ]

  // Initialize
  useEffect(() => {
    const cx = width / 2
    const cy = height / 2

    starsRef.current = Array.from({ length: 600 }, () => {
      const angle = Math.random() * Math.PI * 2
      const dist = Math.random() * Math.max(width, height)
      return {
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        z: Math.random() * 1500 + 1,
        prevX: cx,
        prevY: cy,
        speed: 0.5 + Math.random() * 2
      }
    })

    const accentRgb = hexToRgb(colors.accent)
    const glowRgb = hexToRgb(colors.glow)
    const primaryRgb = hexToRgb(colors.primary)
    const secondaryRgb = hexToRgb(colors.secondary)

    nebulaeRef.current = Array.from({ length: 8 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 150 + Math.random() * 300,
      color: [accentRgb, glowRgb, primaryRgb, secondaryRgb][Math.floor(Math.random() * 4)],
      opacity: 0.03 + Math.random() * 0.06,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      phase: Math.random() * Math.PI * 2
    }))

    particlesRef.current = Array.from({ length: 80 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: 0.5 + Math.random() * 2,
      opacity: 0.1 + Math.random() * 0.4,
      life: Math.random() * Math.PI * 2
    }))
  }, [width, height, colors])

  const draw = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!

      const cx = width / 2
      const cy = height / 2
      const accentRgb = hexToRgb(colors.accent)
      const glowRgb = hexToRgb(colors.glow)

      // Slow rotation
      rotationRef.current += 0.00003
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(rotationRef.current)
      ctx.translate(-cx, -cy)

      // ── Deep space background ──
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.7)
      bgGrad.addColorStop(0, '#05050f')
      bgGrad.addColorStop(0.5, '#030308')
      bgGrad.addColorStop(1, '#010103')
      ctx.fillStyle = bgGrad
      ctx.fillRect(-100, -100, width + 200, height + 200)

      // ── Nebulae ──
      for (const n of nebulaeRef.current) {
        n.x += n.vx
        n.y += n.vy
        if (n.x < -n.radius) n.x = width + n.radius
        if (n.x > width + n.radius) n.x = -n.radius
        if (n.y < -n.radius) n.y = height + n.radius
        if (n.y > height + n.radius) n.y = -n.radius

        const pulse = Math.sin(timestamp * 0.0003 + n.phase) * 0.3 + 0.7
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius)
        grad.addColorStop(0, `rgba(${n.color[0]}, ${n.color[1]}, ${n.color[2]}, ${n.opacity * pulse})`)
        grad.addColorStop(0.4, `rgba(${n.color[0]}, ${n.color[1]}, ${n.color[2]}, ${n.opacity * pulse * 0.4})`)
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── Starfield (warp effect) ──
      for (const star of starsRef.current) {
        star.prevX = (star.x - cx) / star.z * 300 + cx
        star.prevY = (star.y - cy) / star.z * 300 + cy

        star.z -= star.speed * 1.5

        if (star.z <= 1) {
          const angle = Math.random() * Math.PI * 2
          const dist = Math.random() * Math.max(width, height) * 0.8
          star.x = cx + Math.cos(angle) * dist
          star.y = cy + Math.sin(angle) * dist
          star.z = 1500
          star.prevX = cx
          star.prevY = cy
          continue
        }

        const sx = (star.x - cx) / star.z * 300 + cx
        const sy = (star.y - cy) / star.z * 300 + cy

        // Only draw if on screen
        if (sx < -50 || sx > width + 50 || sy < -50 || sy > height + 50) {
          star.z = 1500
          continue
        }

        const brightness = 1 - star.z / 1500
        const size = brightness * 2.5

        // Star trail
        const trailAlpha = brightness * 0.6
        ctx.strokeStyle = `rgba(${200 + Math.floor(accentRgb[0] * 0.2)}, ${200 + Math.floor(accentRgb[1] * 0.2)}, 255, ${trailAlpha})`
        ctx.lineWidth = size * 0.5
        ctx.beginPath()
        ctx.moveTo(star.prevX, star.prevY)
        ctx.lineTo(sx, sy)
        ctx.stroke()

        // Star point
        ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`
        ctx.beginPath()
        ctx.arc(sx, sy, size, 0, Math.PI * 2)
        ctx.fill()

        // Bright star glow
        if (brightness > 0.7) {
          ctx.fillStyle = `rgba(${glowRgb[0]}, ${glowRgb[1]}, ${glowRgb[2]}, ${(brightness - 0.7) * 0.5})`
          ctx.beginPath()
          ctx.arc(sx, sy, size * 3, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // ── Floating particles ──
      for (const p of particlesRef.current) {
        p.x += p.vx
        p.y += p.vy
        p.life += 0.005

        if (p.x < 0) p.x = width
        if (p.x > width) p.x = 0
        if (p.y < 0) p.y = height
        if (p.y > height) p.y = 0

        const alpha = p.opacity * (Math.sin(p.life) * 0.5 + 0.5)
        ctx.fillStyle = `rgba(${glowRgb[0]}, ${glowRgb[1]}, ${glowRgb[2]}, ${alpha})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── Central glow (engine exhaust feel) ──
      const centerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 200)
      centerGlow.addColorStop(0, `rgba(${accentRgb[0]}, ${accentRgb[1]}, ${accentRgb[2]}, 0.03)`)
      centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = centerGlow
      ctx.fillRect(cx - 200, cy - 200, 400, 400)

      ctx.restore()

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

export default SpaceFlight
