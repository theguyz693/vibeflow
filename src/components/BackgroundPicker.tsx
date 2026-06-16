import React, { useState, useRef, useEffect } from 'react'
import { useScene } from '../scenes/SceneManager'

const BackgroundPicker: React.FC = () => {
  const { currentScene, scenes, setScene } = useScene()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Auto-hide after inactivity
  useEffect(() => {
    if (open) {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setOpen(false), 8000)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [open])

  const handleSelect = (id: string) => {
    setScene(id)
    setOpen(false)
  }

  return (
    <div className="bg-picker" ref={panelRef} id="bg-picker">
      {/* Toggle Button */}
      <button
        className={`bg-picker-toggle ${open ? 'active' : ''}`}
        onClick={() => setOpen(!open)}
        title="Change Background"
        id="bg-picker-toggle"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
          <line x1="7" y1="2" x2="7" y2="22" />
          <line x1="17" y1="2" x2="17" y2="22" />
          <line x1="2" y1="12" x2="22" y2="12" />
        </svg>
      </button>

      {/* Panel */}
      {open && (
        <div className="bg-picker-panel" onMouseEnter={() => {
          if (timerRef.current) clearTimeout(timerRef.current)
        }} onMouseLeave={() => {
          timerRef.current = setTimeout(() => setOpen(false), 3000)
        }}>
          <div className="bg-picker-header">Backgrounds</div>
          <div className="bg-picker-grid">
            {scenes.map((scene) => (
              <button
                key={scene.id}
                className={`bg-picker-item ${scene.id === currentScene.id ? 'active' : ''}`}
                onClick={() => handleSelect(scene.id)}
                title={scene.name}
                id={`bg-item-${scene.id}`}
              >
                {scene.thumbnail ? (
                  <img
                    src={scene.thumbnail}
                    alt={scene.name}
                    className="bg-picker-thumb"
                    loading="lazy"
                  />
                ) : (
                  <div className="bg-picker-thumb-placeholder">
                    <span>{scene.icon}</span>
                  </div>
                )}
                <div className="bg-picker-item-label">{scene.name}</div>
                {scene.id === currentScene.id && (
                  <div className="bg-picker-item-active-dot" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default BackgroundPicker
