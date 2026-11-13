/** Easing curves (input and output 0..1, back/elastic overshoot past 1). */

export const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3)

export const easeOutExpo = (p: number) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p))

export const easeOutBack = (p: number) => {
  const c1 = 2.2
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2)
}

export const easeOutBounce = (x: number) => {
  const n1 = 7.5625
  const d1 = 2.75
  if (x < 1 / d1) return n1 * x * x
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375
  return n1 * (x -= 2.625 / d1) * x + 0.984375
}

export const easeOutElastic = (x: number) => {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const c4 = (2 * Math.PI) / 3
  return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1
}
