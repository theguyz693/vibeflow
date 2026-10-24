#!/usr/bin/env node
/**
 * VibeFlow sample-track generator.
 *
 * Synthesizes four short, original, royalty-free music loops and writes them as
 * 16-bit PCM WAV files into public/audio/. They exist so the device prototypes
 * have real audio to play without any network access or licensing concerns.
 *
 * Usage: npm run generate:tracks
 *
 * Everything is deterministic (seeded PRNG) so re-running produces identical files.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SR = 32000
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio')
const TAU = Math.PI * 2

// ─── Utilities ──────────────────────────────────────────────────────────────
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function polyBlep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1 }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1 }
  return 0
}
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 }
/** "A3" -> midi */
const n = (s) => { const m = s.match(/^([A-G][#b]?)(-?\d)$/); return NOTE[m[1]] + (parseInt(m[2]) + 1) * 12 }

class Track {
  constructor(seconds) {
    this.len = Math.ceil(seconds * SR)
    this.dry = new Float32Array(this.len)
    this.send = new Float32Array(this.len) // reverb send
    this.echo = new Float32Array(this.len) // delay send
  }
  add(buf, start, data, gain = 1) {
    const s0 = Math.floor(start * SR)
    for (let i = 0; i < data.length; i++) {
      const j = s0 + i
      if (j >= 0 && j < this.len) buf[j] += data[i] * gain
    }
  }
  /** Write a voice into dry + optional sends. */
  voice(start, data, { gain = 1, rev = 0, dly = 0, pan = 0 } = {}) {
    this.add(this.dry, start, data, gain)
    if (rev) this.add(this.send, start, data, gain * rev)
    if (dly) this.add(this.echo, start, data, gain * dly)
  }
}

// ─── Instruments (each returns a Float32Array of samples) ──────────────────
function env(i, len, a, r) {
  const t = i / SR, rel = (len - i) / SR
  return Math.min(1, t / a) * Math.min(1, rel / r)
}
function kick({ dur = 0.42, punch = 1 } = {}) {
  const len = Math.floor(dur * SR), out = new Float32Array(len)
  let ph = 0
  for (let i = 0; i < len; i++) {
    const t = i / SR
    const f = 46 + 120 * Math.exp(-t * 28) * punch
    ph += f / SR
    out[i] = Math.sin(TAU * ph) * Math.exp(-t * 7.5) + (t < 0.004 ? (Math.random() * 2 - 1) * 0.15 : 0)
  }
  return out
}
function noiseHit({ dur, decay, hp = 0.6, tone = 0, toneF = 190, seed = 1 }) {
  const r = rng(seed), len = Math.floor(dur * SR), out = new Float32Array(len)
  let prev = 0, lp = 0
  for (let i = 0; i < len; i++) {
    const t = i / SR, w = r() * 2 - 1
    const h = w - prev * hp; prev = w // simple high-pass
    lp += 0.5 * (h - lp)
    out[i] = (lp * Math.exp(-t * decay)) + tone * Math.sin(TAU * toneF * t) * Math.exp(-t * 30)
  }
  return out
}
const snare = (seed) => noiseHit({ dur: 0.28, decay: 16, hp: 0.3, tone: 0.55, toneF: 185, seed })
const clap = (seed) => {
  const a = noiseHit({ dur: 0.3, decay: 14, hp: 0.85, seed })
  for (let i = 0; i < a.length; i++) { const t = i / SR; if (t < 0.03) a[i] *= (Math.floor(t / 0.01) % 2 ? 0.4 : 1) }
  return a
}
const hat = (open, seed) => noiseHit({ dur: open ? 0.3 : 0.07, decay: open ? 10 : 70, hp: 0.98, seed })

/** Band-limited oscillator voice with 2-pole filter + ADSR-ish envelope. */
function synth({ freq, dur, wave = 'saw', cutoff = 2000, cutEnv = 0, cutDecay = 8, a = 0.005, r = 0.08, detune = 0, voices = 1, pw = 0.5, vib = 0, decay = 0 }) {
  const len = Math.floor((dur + r) * SR), out = new Float32Array(len)
  const phs = Array.from({ length: voices }, (_, k) => k / voices)
  let y1 = 0, y2 = 0
  for (let i = 0; i < len; i++) {
    const t = i / SR
    let s = 0
    for (let v = 0; v < voices; v++) {
      const spread = voices > 1 ? (v / (voices - 1) - 0.5) * 2 * detune : 0
      const f = freq * Math.pow(2, spread / 1200) * (1 + vib * Math.sin(TAU * 5.5 * t) * Math.min(1, t * 3))
      const dt = f / SR
      phs[v] = (phs[v] + dt) % 1
      const p = phs[v]
      if (wave === 'saw') s += (2 * p - 1) - polyBlep(p, dt)
      else if (wave === 'square') {
        let q = p < pw ? 1 : -1
        q += polyBlep(p, dt); q -= polyBlep((p + 1 - pw) % 1, dt)
        s += q
      } else if (wave === 'tri') s += 1 - 4 * Math.abs(p - 0.5)
      else s += Math.sin(TAU * p)
    }
    s /= voices
    const fc = Math.min(12000, cutoff + cutEnv * Math.exp(-t * cutDecay))
    const k = 1 - Math.exp(-TAU * fc / SR)
    y1 += k * (s - y1); y2 += k * (y1 - y2)
    const sustain = decay ? Math.exp(-t * decay) : 1
    const e = Math.min(1, t / a) * (i < dur * SR ? 1 : Math.max(0, 1 - (t - dur) / r)) * sustain
    out[i] = y2 * e
  }
  return out
}
/** Two-operator FM electric piano. */
function epiano({ freq, dur, r = 0.4 }) {
  const len = Math.floor((dur + r) * SR), out = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    const t = i / SR
    const idx = 1.6 * Math.exp(-t * 6)
    const m = Math.sin(TAU * freq * t) * idx
    const e = Math.min(1, t / 0.003) * Math.exp(-t * 1.6) * (i < dur * SR ? 1 : Math.max(0, 1 - (t - dur) / r))
    out[i] = (Math.sin(TAU * freq * t + m) + 0.25 * Math.sin(TAU * freq * 2 * t) * Math.exp(-t * 9)) * e
  }
  return out
}

// ─── Effects & master ──────────────────────────────────────────────────────
function applyDelay(src, time, fb, mix) {
  const d = Math.floor(time * SR), out = new Float32Array(src.length)
  const line = new Float32Array(src.length)
  let lp = 0
  for (let i = 0; i < src.length; i++) {
    const del = i >= d ? line[i - d] : 0
    lp += 0.35 * (del - lp)
    line[i] = src[i] + lp * fb
    out[i] = lp * mix
  }
  return out
}
function applyReverb(src, mix) {
  // Small Schroeder reverb: 4 parallel combs + 2 allpasses.
  const combs = [1116, 1188, 1277, 1356].map((x) => Math.floor(x * SR / 44100))
  const aps = [556, 341].map((x) => Math.floor(x * SR / 44100))
  const out = new Float32Array(src.length)
  for (const c of combs) {
    const buf = new Float32Array(c); let idx = 0, lp = 0
    for (let i = 0; i < src.length; i++) {
      const y = buf[idx]; lp = y * 0.6 + lp * 0.4
      buf[idx] = src[i] + lp * 0.82; idx = (idx + 1) % c
      out[i] += y * 0.25
    }
  }
  for (const a of aps) {
    const buf = new Float32Array(a); let idx = 0
    for (let i = 0; i < out.length; i++) {
      const b = buf[idx], x = out[i]
      buf[idx] = x + b * 0.5; out[i] = b - x * 0.5; idx = (idx + 1) % a
    }
  }
  for (let i = 0; i < out.length; i++) out[i] *= mix
  return out
}
function master(track, { delayTime = 0.3, fadeIn = 0.6, fadeOut = 2.4, drive = 1.25, sidechain = null } = {}) {
  const rev = applyReverb(track.send, 1)
  const dly = applyDelay(track.echo, delayTime, 0.45, 1)
  const mix = new Float32Array(track.len)
  let peak = 0
  for (let i = 0; i < track.len; i++) {
    const sc = sidechain ? sidechain[i] : 1
    mix[i] = track.dry[i] + (rev[i] + dly[i]) * sc
  }
  for (let i = 0; i < track.len; i++) {
    const t = i / SR, rem = (track.len - i) / SR
    mix[i] = Math.tanh(mix[i] * drive) * Math.min(1, t / fadeIn) * Math.min(1, rem / fadeOut)
    peak = Math.max(peak, Math.abs(mix[i]))
  }
  const g = 0.89 / (peak || 1)
  for (let i = 0; i < track.len; i++) mix[i] *= g
  return mix
}
function writeWav(path, data) {
  const buf = Buffer.alloc(44 + data.length * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + data.length * 2, 4); buf.write('WAVE', 8)
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(data.length * 2, 40)
  for (let i = 0; i < data.length; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(data[i] * 32767))), 44 + i * 2)
  writeFileSync(path, buf)
  console.log(`  wrote ${path} (${(buf.length / 1048576).toFixed(2)} MB, ${(data.length / SR).toFixed(1)}s)`)
}
/** Gain envelope that ducks after each kick (sidechain pump). */
function pump(len, kicks, depth = 0.55, rel = 0.22) {
  const g = new Float32Array(len).fill(1)
  for (const k of kicks) {
    const s = Math.floor(k * SR)
    for (let i = 0; i < rel * SR && s + i < len; i++) g[s + i] = Math.min(g[s + i], 1 - depth * (1 - i / (rel * SR)))
  }
  return g
}

// ─── Track 1: Neon Drift — synthwave, 100 BPM, A minor ────────────────────
function neonDrift() {
  const bpm = 100, beat = 60 / bpm, bar = beat * 4, bars = 16
  const T = new Track(bars * bar + 2.5), r = rng(11)
  const prog = [['A2', ['A3', 'C4', 'E4']], ['F2', ['F3', 'A3', 'C4']], ['C3', ['G3', 'C4', 'E4']], ['G2', ['G3', 'B3', 'D4']]]
  const lead = ['E5', 'D5', 'C5', 'E5', 'G5', 'E5', 'D5', 'C5', 'A4', 'C5', 'D5', 'E5', 'D5', 'B4', 'G4', 'B4']
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar, [root, chord] = prog[b % 4]
    // Pads
    for (const c of chord) T.voice(t0, synth({ freq: mtof(n(c)), dur: bar * 0.98, wave: 'saw', voices: 3, detune: 14, cutoff: 900, a: 0.4, r: 0.6 }), { gain: 0.11, rev: 0.6 })
    // Driving 8th-note bass
    for (let k = 0; k < 8; k++) {
      const oct = k % 2 ? 12 : 0
      T.voice(t0 + k * beat / 2, synth({ freq: mtof(n(root) + oct), dur: beat / 2 * 0.8, wave: 'saw', cutoff: 300, cutEnv: 1800, cutDecay: 18, r: 0.03 }), { gain: 0.32 })
    }
    if (b >= 2) {
      for (let k = 0; k < 4; k++) T.voice(t0 + k * beat, kick(), { gain: 0.9 })
      for (const k of [1, 3]) T.voice(t0 + k * beat, snare(b * 7 + k), { gain: 0.5, rev: 0.8 })
      for (let k = 0; k < 8; k++) T.voice(t0 + k * beat / 2, hat(k % 2 === 1, b * 31 + k), { gain: 0.12 + 0.05 * (k % 2) })
    }
    // Lead melody: 16th-note arpeggio first half, held melody second half
    if (b >= 4 && b < bars - 1) {
      for (let k = 0; k < 4; k++) {
        const note = lead[(b * 4 + k) % lead.length]
        T.voice(t0 + k * beat, synth({ freq: mtof(n(note)), dur: beat * 0.85, wave: 'square', pw: 0.3, cutoff: 2600, a: 0.01, r: 0.15, vib: 0.004 }), { gain: 0.1, dly: 0.5, rev: 0.3 })
      }
    }
    // Sparkle arps
    for (let k = 0; k < 16; k++) {
      if (r() < 0.55) continue
      const c = chord[k % 3]
      T.voice(t0 + k * beat / 4, synth({ freq: mtof(n(c) + 12), dur: 0.08, wave: 'tri', a: 0.002, r: 0.12, decay: 10 }), { gain: 0.07, dly: 0.7 })
    }
  }
  return master(T, { delayTime: beat * 0.75 })
}

// ─── Track 2: Velvet Static — lo-fi hip hop, 84 BPM, swing ────────────────
function velvetStatic() {
  const bpm = 84, beat = 60 / bpm, bar = beat * 4, bars = 12
  const T = new Track(bars * bar + 3), r = rng(29)
  const prog = [
    ['D2', ['F3', 'A3', 'C4', 'E4']], // Dm9
    ['G2', ['F3', 'B3', 'E4', 'A4']], // G13
    ['C2', ['E3', 'G3', 'B3', 'D4']], // Cmaj9
    ['A2', ['G3', 'C#4', 'F4', 'Bb4']] // A7b9
  ]
  const swing = (k) => (k % 2 ? beat / 2 * 1.16 : 0) + Math.floor(k / 2) * beat
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar, [root, chord] = prog[b % 4]
    chord.forEach((c, i) => T.voice(t0 + i * 0.018, epiano({ freq: mtof(n(c)), dur: bar * 0.9 }), { gain: 0.16, rev: 0.5 }))
    if (b % 2 === 1) chord.slice(1).forEach((c, i) => T.voice(t0 + beat * 2.5 + i * 0.02, epiano({ freq: mtof(n(c) + 12), dur: beat }), { gain: 0.07, rev: 0.6, dly: 0.3 }))
    T.voice(t0, synth({ freq: mtof(n(root)), dur: beat * 1.5, wave: 'sine', a: 0.01, r: 0.2 }), { gain: 0.55 })
    T.voice(t0 + beat * 2.5, synth({ freq: mtof(n(root) + 7), dur: beat * 0.9, wave: 'sine', a: 0.01, r: 0.2 }), { gain: 0.45 })
    if (b >= 1) {
      T.voice(t0, kick({ punch: 0.7 }), { gain: 0.85 })
      T.voice(t0 + swing(5), kick({ punch: 0.7 }), { gain: 0.6 })
      T.voice(t0 + beat, snare(b * 3), { gain: 0.42, rev: 0.4 })
      T.voice(t0 + beat * 3, snare(b * 5 + 1), { gain: 0.42, rev: 0.4 })
      for (let k = 0; k < 8; k++) T.voice(t0 + swing(k), hat(false, b * 13 + k), { gain: 0.07 + r() * 0.05 })
    }
  }
  // Vinyl crackle bed
  const crackle = new Float32Array(T.len)
  for (let i = 0; i < T.len; i++) if (r() < 0.0009) crackle[i] = (r() * 2 - 1) * 0.6
  let hum = 0
  for (let i = 0; i < T.len; i++) { hum += 0.02 * ((r() * 2 - 1) - hum); crackle[i] += hum * 0.15 }
  T.voice(0, crackle, { gain: 0.25 })
  return master(T, { delayTime: beat * 0.5, drive: 1.1, fadeOut: 3 })
}

// ─── Track 3: Glass Horizon — melodic house, 120 BPM, F minor ─────────────
function glassHorizon() {
  const bpm = 120, beat = 60 / bpm, bar = beat * 4, bars = 18
  const T = new Track(bars * bar + 2.5), r = rng(47)
  const prog = [['F2', ['Ab3', 'C4', 'F4']], ['Db2', ['Ab3', 'Db4', 'F4']], ['Ab2', ['Ab3', 'C4', 'Eb4']], ['Eb2', ['G3', 'Bb3', 'Eb4']]]
  const kicks = []
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar, [root, chord] = prog[b % 4]
    const full = b >= 2 && b < bars - 1
    if (b >= 1) for (let k = 0; k < 4; k++) { T.voice(t0 + k * beat, kick({ punch: 1.1 }), { gain: 0.95 }); kicks.push(t0 + k * beat) }
    if (full) {
      for (const k of [1, 3]) T.voice(t0 + k * beat, clap(b * 9 + k), { gain: 0.38, rev: 0.6 })
      for (let k = 0; k < 4; k++) T.voice(t0 + k * beat + beat / 2, hat(true, b * 17 + k), { gain: 0.11 })
      for (let k = 0; k < 16; k++) T.voice(t0 + k * beat / 4, hat(false, b * 19 + k), { gain: 0.04 + (k % 4 === 2 ? 0.04 : 0) })
    }
    // Offbeat bass
    for (let k = 0; k < 4; k++) T.voice(t0 + k * beat + beat / 2, synth({ freq: mtof(n(root)), dur: beat * 0.4, wave: 'saw', cutoff: 220, cutEnv: 900, cutDecay: 14, r: 0.04 }), { gain: 0.42 })
    // Pluck chords on a syncopated rhythm
    for (const pos of [0, 0.75, 1.5, 2.5, 3.25]) {
      for (const c of chord) T.voice(t0 + pos * beat, synth({ freq: mtof(n(c) + 12), dur: 0.12, wave: 'saw', voices: 2, detune: 10, cutoff: 600, cutEnv: 4200, cutDecay: 16, decay: 7, r: 0.25 }), { gain: 0.07, rev: 0.5, dly: 0.35 })
    }
    // Airy pad
    for (const c of chord) T.voice(t0, synth({ freq: mtof(n(c)), dur: bar, wave: 'saw', voices: 3, detune: 18, cutoff: 1400, a: 0.8, r: 0.8 }), { gain: 0.05, rev: 0.9 })
    // Top melody
    if (b >= 6 && b < bars - 2) {
      const scale = ['C5', 'Eb5', 'F5', 'Ab5', 'Bb5', 'C6']
      for (let k = 0; k < 4; k++) if (r() > 0.3) T.voice(t0 + k * beat + (r() > 0.6 ? beat / 2 : 0), synth({ freq: mtof(n(scale[Math.floor(r() * scale.length)])), dur: beat * 0.4, wave: 'sine', a: 0.005, r: 0.3, decay: 3 }), { gain: 0.12, dly: 0.6, rev: 0.4 })
    }
  }
  const sc = pump(T.len, kicks)
  return master(T, { delayTime: beat * 0.75, sidechain: sc })
}

// ─── Track 4: Midnight Arcade — chiptune, 140 BPM, C major ────────────────
function midnightArcade() {
  const bpm = 140, beat = 60 / bpm, bar = beat * 4, bars = 20
  const T = new Track(bars * bar + 2), r = rng(83)
  const prog = [['C3', [0, 4, 7]], ['G2', [7, 11, 14]], ['A2', [9, 12, 16]], ['F2', [5, 9, 12]]]
  const melody = [
    'E5', 'G5', 'C6', 'G5', 'D5', 'G5', 'B5', 'G5', 'C5', 'E5', 'A5', 'E5', 'F5', 'A5', 'C6', 'A5',
    'G5', 'E5', 'C5', 'E5', 'B4', 'D5', 'G5', 'D5', 'A4', 'C5', 'E5', 'G5', 'A5', 'G5', 'F5', 'E5'
  ]
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar, [root, chord] = prog[b % 4]
    // Triangle bass, octave bounce
    for (let k = 0; k < 8; k++) T.voice(t0 + k * beat / 2, synth({ freq: mtof(n(root) + (k % 2 ? 12 : 0)), dur: beat / 2 * 0.7, wave: 'tri', a: 0.002, r: 0.02 }), { gain: 0.45 })
    // Fast arpeggio (classic chip "chord")
    for (let k = 0; k < 16; k++) T.voice(t0 + k * beat / 4, synth({ freq: mtof(60 + chord[k % 3]), dur: beat / 4 * 0.9, wave: 'square', pw: 0.25, cutoff: 6000, a: 0.001, r: 0.01 }), { gain: 0.06 })
    if (b >= 2) {
      for (const k of [0, 2]) T.voice(t0 + k * beat, kick({ punch: 1.3, dur: 0.2 }), { gain: 0.7 })
      for (const k of [1, 3]) T.voice(t0 + k * beat, noiseHit({ dur: 0.15, decay: 22, hp: 0.1, seed: b * 4 + k }), { gain: 0.35 })
      for (let k = 0; k < 8; k++) T.voice(t0 + k * beat / 2, hat(false, b * 23 + k), { gain: 0.07 })
    }
    if (b >= 4 && b < bars - 1) {
      for (let k = 0; k < 8; k++) {
        const note = melody[((b - 4) * 8 + k) % melody.length]
        if (r() < 0.12) continue
        T.voice(t0 + k * beat / 2, synth({ freq: mtof(n(note)), dur: beat / 2 * 0.85, wave: 'square', pw: 0.5, cutoff: 5000, a: 0.002, r: 0.04, vib: b % 4 === 3 ? 0.008 : 0 }), { gain: 0.11, dly: 0.25 })
      }
    }
  }
  return master(T, { delayTime: beat * 0.5, drive: 1.15 })
}

// ─── Main ──────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true })
const tracks = [
  ['neon-drift.wav', neonDrift],
  ['velvet-static.wav', velvetStatic],
  ['glass-horizon.wav', glassHorizon],
  ['midnight-arcade.wav', midnightArcade]
]
console.log('Generating VibeFlow sample tracks…')
for (const [file, fn] of tracks) writeWav(resolve(OUT_DIR, file), fn())
console.log('Done.')
