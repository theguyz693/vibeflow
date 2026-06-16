import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { SceneDefinition, SceneProps, ColorPalette } from '../types/spotify'
import { defaultPalette } from '../services/themeEngine'
import { VIDEOS } from '../config/videoConfig'
import AuraLoop from './AuraLoop'
import NightDrive from './NightDrive'
import RainyWindow from './RainyWindow'
import SpaceFlight from './SpaceFlight'
import { createVideoScene } from './createVideoScene'

// Built-in animated scenes
const BUILTIN_SCENES: SceneDefinition[] = [
  { id: 'aura-loop', name: 'Aura Loop', icon: '✨', component: AuraLoop },
  { id: 'night-drive', name: 'Night Drive', icon: '🌃', component: NightDrive },
  { id: 'rainy-window', name: 'Rainy Window', icon: '🌧️', component: RainyWindow },
  { id: 'space-flight', name: 'Space Flight', icon: '🚀', component: SpaceFlight }
]

// Auto-generate video scenes from config
const VIDEO_SCENES: SceneDefinition[] = VIDEOS.map((v) => ({
  id: v.id,
  name: v.name,
  icon: v.icon,
  component: createVideoScene(v.src),
  thumbnail: v.thumbnail
}))

const ALL_SCENES: SceneDefinition[] = [...BUILTIN_SCENES, ...VIDEO_SCENES]

interface SceneContextType {
  currentScene: SceneDefinition
  scenes: SceneDefinition[]
  setScene: (id: string) => void
}

const SceneContext = createContext<SceneContextType>({
  currentScene: ALL_SCENES[0],
  scenes: ALL_SCENES,
  setScene: () => {}
})

export const useScene = () => useContext(SceneContext)

interface SceneManagerProps {
  colors: ColorPalette
  albumArtUrl?: string
  children?: React.ReactNode
}

const SceneManager: React.FC<SceneManagerProps> = ({ colors, albumArtUrl, children }) => {
  const [currentId, setCurrentId] = useState(ALL_SCENES[0].id)
  const [prevId, setPrevId] = useState<string | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight })
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const setScene = (id: string) => {
    if (id === currentId || transitioning) return
    setPrevId(currentId)
    setCurrentId(id)
    setTransitioning(true)

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setPrevId(null)
      setTransitioning(false)
    }, 1200)
  }

  const currentScene = ALL_SCENES.find((s) => s.id === currentId) || ALL_SCENES[0]
  const prevScene = prevId ? ALL_SCENES.find((s) => s.id === prevId) : null

  const sceneProps: SceneProps = {
    colors: colors || defaultPalette(),
    albumArtUrl,
    width: dimensions.width,
    height: dimensions.height
  }

  return (
    <SceneContext.Provider value={{ currentScene, scenes: ALL_SCENES, setScene }}>
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#000' }}>
        {/* Previous scene (fading out) */}
        {prevScene && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0,
              transition: 'opacity 1.2s ease-out',
              zIndex: 1
            }}
          >
            <prevScene.component {...sceneProps} />
          </div>
        )}

        {/* Current scene (fading in) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: transitioning ? 0 : 1,
            transition: 'opacity 1.2s ease-in',
            animation: transitioning ? 'none' : undefined,
            zIndex: 2
          }}
          onTransitionEnd={() => {
            // Cleanup handled by timeout
          }}
        >
          <currentScene.component {...sceneProps} />
        </div>

        {/* UI Layer */}
        <div style={{ position: 'relative', zIndex: 10, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto' }}>{children}</div>
        </div>
      </div>
    </SceneContext.Provider>
  )
}

export default SceneManager
