import React, { useState, useEffect } from 'react'
import { usePreferences } from '../hooks/usePreferences'

const Dashboard: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const { preferences, updatePreferences } = usePreferences()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div style={overlayStyle} onClick={() => setIsOpen(false)}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2>VibeFlow Settings</h2>
          <button onClick={() => setIsOpen(false)} style={closeBtnStyle}>✕</button>
        </div>

        <div style={sectionStyle}>
          <h3>Color Engine</h3>
          <div style={rowStyle}>
            <label>Mode:</label>
            <select 
              value={preferences.colorMode} 
              onChange={e => updatePreferences({ colorMode: e.target.value as 'auto' | 'manual' })}
              style={selectStyle}
            >
              <option value="auto">Auto (Album Art)</option>
              <option value="manual">Manual Override</option>
            </select>
          </div>
          
          {preferences.colorMode === 'manual' && (
            <div style={colorGridStyle}>
              {Object.entries(preferences.manualColors).map(([key, value]) => (
                <div key={key} style={colorRowStyle}>
                  <label style={{ textTransform: 'capitalize' }}>{key}:</label>
                  <input 
                    type="color" 
                    value={value}
                    onChange={e => updatePreferences({ 
                      manualColors: { ...preferences.manualColors, [key]: e.target.value } 
                    })}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={sectionStyle}>
          <h3>Lyrics Engine</h3>
          <div style={rowStyle}>
            <label>Alignment:</label>
            <select 
              value={preferences.lyricAlignment} 
              onChange={e => updatePreferences({ lyricAlignment: e.target.value as 'left' | 'center' | 'right' })}
              style={selectStyle}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div style={rowStyle}>
            <label>Mode:</label>
            <select 
              value={preferences.lyricMode} 
              onChange={e => updatePreferences({ lyricMode: e.target.value as 'list' | 'single' | 'bounce' })}
              style={selectStyle}
            >
              <option value="list">Scrolling List</option>
              <option value="single">Single Line (Huge)</option>
              <option value="bounce">Karaoke Bounce</option>
            </select>
          </div>
        </div>

      </div>
    </div>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(10px)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 9999,
  color: 'white',
  fontFamily: 'Inter, sans-serif'
}

const modalStyle: React.CSSProperties = {
  background: 'rgba(20, 20, 30, 0.8)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '24px',
  padding: '32px',
  width: '400px',
  boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '24px',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  paddingBottom: '16px'
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'white',
  fontSize: '20px',
  cursor: 'pointer',
  opacity: 0.5
}

const sectionStyle: React.CSSProperties = {
  marginBottom: '24px'
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: '12px'
}

const colorGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
  marginTop: '16px',
  background: 'rgba(0,0,0,0.3)',
  padding: '16px',
  borderRadius: '12px'
}

const colorRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px'
}

const selectStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.1)',
  color: 'white',
  border: '1px solid rgba(255,255,255,0.2)',
  padding: '8px 12px',
  borderRadius: '8px',
  outline: 'none',
  cursor: 'pointer'
}

export default Dashboard
