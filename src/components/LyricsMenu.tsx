import React, { useState, useRef, useEffect } from 'react'

type LyricMode = 'list' | 'single' | 'bounce' | 'off'

interface LyricsMenuProps {
  currentMode: LyricMode
  onModeChange: (mode: LyricMode) => void
}

const MODES: { id: LyricMode; label: string; icon: string; desc: string }[] = [
  { id: 'list', label: 'Scroll', icon: '📜', desc: 'Scrolling lyrics list' },
  { id: 'single', label: 'Single', icon: '💬', desc: 'One line at a time' },
  { id: 'bounce', label: 'Bounce', icon: '🎤', desc: 'Bouncy karaoke style' },
  { id: 'off', label: 'Off', icon: '🚫', desc: 'Hide lyrics' }
]

const LyricsMenu: React.FC<LyricsMenuProps> = ({ currentMode, onModeChange }) => {
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

  // Auto-hide
  useEffect(() => {
    if (open) {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setOpen(false), 6000)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [open])

  const handleSelect = (mode: LyricMode) => {
    onModeChange(mode)
    setOpen(false)
  }

  return (
    <div className="lyrics-menu" ref={panelRef} id="lyrics-menu">
      {/* Toggle Button */}
      <button
        className={`lyrics-menu-toggle ${open ? 'active' : ''}`}
        onClick={() => setOpen(!open)}
        title="Lyrics Mode"
        id="lyrics-menu-toggle"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </button>

      {/* Panel */}
      {open && (
        <div className="lyrics-menu-panel" onMouseEnter={() => {
          if (timerRef.current) clearTimeout(timerRef.current)
        }} onMouseLeave={() => {
          timerRef.current = setTimeout(() => setOpen(false), 2000)
        }}>
          <div className="lyrics-menu-header">Lyrics Mode</div>
          {MODES.map((mode) => (
            <button
              key={mode.id}
              className={`lyrics-menu-item ${currentMode === mode.id ? 'active' : ''}`}
              onClick={() => handleSelect(mode.id)}
              id={`lyrics-mode-${mode.id}`}
            >
              <span className="lyrics-menu-item-icon">{mode.icon}</span>
              <div className="lyrics-menu-item-info">
                <span className="lyrics-menu-item-label">{mode.label}</span>
                <span className="lyrics-menu-item-desc">{mode.desc}</span>
              </div>
              {currentMode === mode.id && (
                <div className="lyrics-menu-item-check">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default LyricsMenu
