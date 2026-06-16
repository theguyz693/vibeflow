import React, { useState, useEffect, useRef } from 'react'
import { useScene } from '../scenes/SceneManager'

const SceneSelector: React.FC = () => {
  const { currentScene, scenes, setScene } = useScene()
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showSelector = () => {
    setVisible(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      if (!expanded) setVisible(false)
    }, 3000)
  }

  useEffect(() => {
    const handleMouseMove = () => showSelector()
    window.addEventListener('mousemove', handleMouseMove)
    showSelector() // Show initially
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [expanded])

  const handleSceneClick = (id: string) => {
    setScene(id)
    setExpanded(false)
  }

  return (
    <div
      className={`scene-selector ${visible ? 'visible' : ''}`}
      id="scene-selector"
      onMouseEnter={() => {
        setVisible(true)
        setExpanded(true)
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      }}
      onMouseLeave={() => {
        setExpanded(false)
        hideTimerRef.current = setTimeout(() => setVisible(false), 1500)
      }}
    >
      {expanded ? (
        <div className="scene-selector-expanded">
          {scenes.map((scene) => (
            <button
              key={scene.id}
              className={`scene-btn ${scene.id === currentScene.id ? 'active' : ''}`}
              onClick={() => handleSceneClick(scene.id)}
              title={scene.name}
              id={`scene-btn-${scene.id}`}
            >
              <span className="scene-btn-icon">{scene.icon}</span>
              <span className="scene-btn-name">{scene.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="scene-selector-dots">
          {scenes.map((scene) => (
            <div
              key={scene.id}
              className={`scene-dot ${scene.id === currentScene.id ? 'active' : ''}`}
              title={scene.name}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default SceneSelector
