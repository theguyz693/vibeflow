import { ColorPalette } from '../types/spotify'

/**
 * Extract a 5-color palette from an album art image URL.
 * Uses an offscreen canvas and pixel sampling — no external dependencies.
 */
export async function extractColors(imageUrl: string): Promise<ColorPalette> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const SIZE = 50
      canvas.width = SIZE
      canvas.height = SIZE
      ctx.drawImage(img, 0, 0, SIZE, SIZE)

      const imageData = ctx.getImageData(0, 0, SIZE, SIZE).data
      const pixels: [number, number, number][] = []

      for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i]
        const g = imageData[i + 1]
        const b = imageData[i + 2]
        // skip near-black and near-white
        if (r + g + b > 30 && r + g + b < 720) {
          pixels.push([r, g, b])
        }
      }

      const palette = kMeansClusters(pixels, 5)
      const sorted = palette.sort((a, b) => luminance(b) - luminance(a))

      resolve({
        primary: rgbToHex(sorted[0] || [40, 40, 60]),
        secondary: rgbToHex(sorted[1] || [60, 40, 80]),
        accent: rgbToHex(sorted[2] || [120, 80, 200]),
        glow: rgbToHex(sorted[3] || [180, 120, 255]),
        text: ensureReadable(sorted[0] || [220, 220, 240]),
        raw: sorted
      })
    }

    img.onerror = () => {
      resolve(defaultPalette())
    }

    img.src = imageUrl
  })
}

/** Simple k-means clustering for color quantization */
function kMeansClusters(
  pixels: [number, number, number][],
  k: number
): [number, number, number][] {
  if (pixels.length === 0) return Array(k).fill([80, 60, 120]) as [number, number, number][]

  // Initialize centroids with evenly spaced samples
  let centroids: [number, number, number][] = []
  const step = Math.max(1, Math.floor(pixels.length / k))
  for (let i = 0; i < k; i++) {
    centroids.push([...pixels[Math.min(i * step, pixels.length - 1)]])
  }

  for (let iter = 0; iter < 10; iter++) {
    const clusters: [number, number, number][][] = Array.from({ length: k }, () => [])

    // Assign each pixel to nearest centroid
    for (const px of pixels) {
      let minDist = Infinity
      let nearest = 0
      for (let c = 0; c < k; c++) {
        const d =
          (px[0] - centroids[c][0]) ** 2 +
          (px[1] - centroids[c][1]) ** 2 +
          (px[2] - centroids[c][2]) ** 2
        if (d < minDist) {
          minDist = d
          nearest = c
        }
      }
      clusters[nearest].push(px)
    }

    // Recalculate centroids
    centroids = clusters.map((cluster, i) => {
      if (cluster.length === 0) return centroids[i]
      const sum = cluster.reduce(
        (acc, px) => [acc[0] + px[0], acc[1] + px[1], acc[2] + px[2]] as [number, number, number],
        [0, 0, 0] as [number, number, number]
      )
      return [
        Math.round(sum[0] / cluster.length),
        Math.round(sum[1] / cluster.length),
        Math.round(sum[2] / cluster.length)
      ] as [number, number, number]
    })
  }

  return centroids
}

function luminance(rgb: [number, number, number]): number {
  return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
}

function rgbToHex(rgb: [number, number, number]): string {
  return (
    '#' +
    rgb
      .map((c) =>
        Math.max(0, Math.min(255, c))
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  )
}

function ensureReadable(dominantColor: [number, number, number]): string {
  const lum = luminance(dominantColor)
  if (lum > 128) {
    return '#ffffff'
  }
  // Lighten the dominant color for text
  const lightened: [number, number, number] = [
    Math.min(255, dominantColor[0] + 140),
    Math.min(255, dominantColor[1] + 140),
    Math.min(255, dominantColor[2] + 140)
  ]
  return rgbToHex(lightened)
}

export function defaultPalette(): ColorPalette {
  return {
    primary: '#1a1a2e',
    secondary: '#16213e',
    accent: '#7b2ff7',
    glow: '#c77dff',
    text: '#e0e0f0',
    raw: [
      [26, 26, 46],
      [22, 33, 62],
      [123, 47, 247],
      [199, 125, 255],
      [224, 224, 240]
    ]
  }
}
