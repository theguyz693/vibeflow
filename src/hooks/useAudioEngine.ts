import { useState, useEffect, useRef, useCallback } from 'react'
import { TrackItem, SAMPLE_TRACKS } from '../types/device'

export interface AudioEngineState {
  currentTrack: TrackItem
  isPlaying: boolean
  progress: number // in seconds
  duration: number // in seconds
  volume: number // 0 to 1
  frequencies: Uint8Array
  togglePlay: () => void
  play: () => void
  pause: () => void
  nextTrack: () => void
  prevTrack: () => void
  setVolume: (v: number) => void
  seek: (t: number) => void
}

export function useAudioEngine(initialTracks: TrackItem[] = SAMPLE_TRACKS): AudioEngineState {
  const [trackIndex, setTrackIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.8)
  const [freqData, setFreqData] = useState<Uint8Array>(new Uint8Array(32))

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const animFrameRef = useRef<number | null>(null)

  const currentTrack = initialTracks[trackIndex] || initialTracks[0]

  // Setup audio element
  useEffect(() => {
    const audio = new Audio()
    audio.crossOrigin = 'anonymous'
    audio.src = currentTrack.audioUrl
    audio.volume = volume
    audioRef.current = audio

    const updateTime = () => setProgress(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration || currentTrack.duration)
    const onEnded = () => {
      setTrackIndex((prev) => (prev + 1) % initialTracks.length)
    }

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  // Handle track changing
  useEffect(() => {
    if (!audioRef.current) return
    const audio = audioRef.current
    const wasPlaying = isPlaying
    audio.src = currentTrack.audioUrl
    audio.currentTime = 0
    setProgress(0)
    setDuration(currentTrack.duration)

    if (wasPlaying) {
      audio.play().catch(() => setIsPlaying(false))
    }
  }, [trackIndex, currentTrack])

  // Setup Web Audio analyser
  const setupAnalyser = useCallback(() => {
    if (!audioRef.current || audioCtxRef.current) return
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AudioCtx()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      analyser.smoothingTimeConstant = 0.8

      const src = ctx.createMediaElementSource(audioRef.current)
      src.connect(analyser)
      analyser.connect(ctx.destination)

      audioCtxRef.current = ctx
      analyserRef.current = analyser
      sourceRef.current = src
    } catch (e) {
      console.warn('Web Audio API init failed:', e)
    }
  }, [])

  // Frequency polling loop
  useEffect(() => {
    const dataArray = new Uint8Array(32)
    const tick = () => {
      if (analyserRef.current && isPlaying) {
        analyserRef.current.getByteFrequencyData(dataArray)
        setFreqData(new Uint8Array(dataArray))
      } else if (!isPlaying) {
        // smooth decay
        let hasValue = false
        for (let i = 0; i < dataArray.length; i++) {
          dataArray[i] = Math.max(0, dataArray[i] - 12)
          if (dataArray[i] > 0) hasValue = true
        }
        if (hasValue) setFreqData(new Uint8Array(dataArray))
      }
      animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [isPlaying])

  const play = useCallback(() => {
    setupAnalyser()
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume()
    }
    if (audioRef.current) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error)
    }
  }, [setupAnalyser])

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }, [])

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }, [isPlaying, play, pause])

  const nextTrack = useCallback(() => {
    setTrackIndex((prev) => (prev + 1) % initialTracks.length)
  }, [initialTracks.length])

  const prevTrack = useCallback(() => {
    if (audioRef.current && audioRef.current.currentTime > 2) {
      audioRef.current.currentTime = 0
      setProgress(0)
    } else {
      setTrackIndex((prev) => (prev - 1 + initialTracks.length) % initialTracks.length)
    }
  }, [initialTracks.length])

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v))
    setVolumeState(clamped)
    if (audioRef.current) {
      audioRef.current.volume = clamped
    }
  }, [])

  const seek = useCallback((t: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = t
      setProgress(t)
    }
  }, [])

  return {
    currentTrack,
    isPlaying,
    progress,
    duration,
    volume,
    frequencies: freqData,
    togglePlay,
    play,
    pause,
    nextTrack,
    prevTrack,
    setVolume,
    seek
  }
}
