import React, { useState } from 'react'

interface LoginScreenProps {
  onLogin: () => Promise<void>
  error?: string | null
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, error }) => {
  const [hovering, setHovering] = useState(false)

  return (
    <div className="login-screen" id="login-screen">
      {/* Animated background */}
      <div className="login-bg">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />
      </div>

      <div className="login-content">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="url(#logoGrad)" strokeWidth="2" />
              <path
                d="M18 16 L32 24 L18 32Z"
                fill="url(#logoGrad)"
                opacity="0.9"
              />
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="0" x2="48" y2="48">
                  <stop offset="0%" stopColor="#7b2ff7" />
                  <stop offset="100%" stopColor="#c77dff" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="login-title">VibeFlow</h1>
          <p className="login-subtitle">Immersive visual companion for your music</p>
        </div>

        {/* CTA */}
        <button
          className={`login-btn ${hovering ? 'hover' : ''}`}
          onClick={onLogin}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          id="spotify-login-btn"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          <span>Connect with Spotify</span>
        </button>

        {error && <p className="login-error">{error}</p>}

        <p className="login-note">
          Your music keeps playing in Spotify. VibeFlow is a visual companion.
        </p>
      </div>

      {/* Escape hint */}
      <div className="login-escape-hint">
        Press <kbd>Esc</kbd> to exit fullscreen · Press <kbd>F11</kbd> to toggle
      </div>
    </div>
  )
}

export default LoginScreen
