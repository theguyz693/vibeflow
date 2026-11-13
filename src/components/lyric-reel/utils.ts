import * as THREE from 'three'

/** Small canvas-texture and colour helpers for the 3D reel. */

export function makeCanvasTex(w: number, h: number) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return { canvas, ctx: canvas.getContext('2d')!, tex }
}

/** Soft white radial falloff, tinted by the material colour. Shared, created once. */
export const radialTexture = (() => {
  let tex: THREE.CanvasTexture | null = null
  return () => {
    if (tex) return tex
    const c = makeCanvasTex(256, 256)
    const g = c.ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.4, 'rgba(255,255,255,0.35)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    c.ctx.fillStyle = g
    c.ctx.fillRect(0, 0, 256, 256)
    c.tex.needsUpdate = true
    tex = c.tex
    return tex
  }
})()

export const safeColor = (c: string, fallback: string) => {
  try {
    return new THREE.Color(c)
  } catch {
    return new THREE.Color(fallback)
  }
}
