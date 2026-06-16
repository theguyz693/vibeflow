import { useState, useEffect, useRef } from 'react'
import { ColorPalette } from '../types/spotify'
import { extractColors, defaultPalette } from '../services/themeEngine'

export function useTheme(albumArtUrl?: string): ColorPalette {
  const [colors, setColors] = useState<ColorPalette>(defaultPalette())
  const lastUrlRef = useRef<string>('')

  useEffect(() => {
    if (!albumArtUrl || albumArtUrl === lastUrlRef.current) return
    lastUrlRef.current = albumArtUrl

    extractColors(albumArtUrl).then((palette) => {
      setColors(palette)

      // Apply to CSS custom properties with smooth transition
      const root = document.documentElement
      root.style.setProperty('--vf-primary', palette.primary)
      root.style.setProperty('--vf-secondary', palette.secondary)
      root.style.setProperty('--vf-accent', palette.accent)
      root.style.setProperty('--vf-glow', palette.glow)
      root.style.setProperty('--vf-text', palette.text)
    })
  }, [albumArtUrl])

  return colors
}
