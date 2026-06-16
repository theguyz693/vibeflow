# VibeFlow 🌌

**Immersive visual companion for Spotify**

VibeFlow is not a music player — it connects to your Spotify account and creates a stunning fullscreen visual experience that reacts to whatever you're listening to.

![Night Drive Scene](https://img.shields.io/badge/Scene-Night%20Drive-7b2ff7?style=for-the-badge)
![Rainy Window Scene](https://img.shields.io/badge/Scene-Rainy%20Window-4a90d9?style=for-the-badge)
![Space Flight Scene](https://img.shields.io/badge/Scene-Space%20Flight-c77dff?style=for-the-badge)

## Features

- 🎵 **Spotify Integration** — Real-time currently playing track info via OAuth PKCE
- 🌃 **Night Drive** — Infinite road with parallax streetlights and city skyline
- 🌧️ **Rainy Window** — Animated rain drops, glass droplets, and bokeh city lights
- 🚀 **Space Flight** — Warp-speed starfield with nebulae and floating particles
- 🎨 **Dynamic Colors** — Album art colors flow into scene lighting, glows, and UI accents
- 💎 **Glassmorphism UI** — Minimal now-playing overlay (< 15% of screen)
- ⚡ **60 FPS** — GPU-accelerated canvas animations

## Quick Start

### Prerequisites
- Node.js 18+
- A **Spotify Premium** account
- A Spotify Developer App (see below)

### 1. Spotify Developer Setup

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Set the **Redirect URI** to: `http://localhost:5173/callback`
4. Copy your **Client ID**
5. Open `src/services/spotify.ts` and set `CLIENT_ID` to your value

### 2. Install & Run

```bash
# Install dependencies
npm install

# Run in Electron (fullscreen desktop app)
npm run dev

# Or run in browser (for development)
npm run dev:web
```

### 3. Connect Spotify

1. The app opens fullscreen with the VibeFlow login screen
2. Click **"Connect with Spotify"**
3. Authorize the app in your browser
4. Start playing music in Spotify — VibeFlow will display it!

## Controls

| Key | Action |
|-----|--------|
| `Esc` | Exit fullscreen |
| `F11` | Toggle fullscreen |
| Mouse bottom-right | Scene selector |

## Architecture

```
src/
├── services/
│   ├── spotify.ts       # OAuth PKCE + API
│   └── themeEngine.ts   # Color extraction (k-means)
├── hooks/
│   ├── useSpotify.ts    # Auth state + polling
│   └── useTheme.ts      # Dynamic CSS variables
├── scenes/
│   ├── SceneManager.tsx # Scene registry + crossfade
│   ├── NightDrive.tsx   # Canvas scene
│   ├── RainyWindow.tsx  # Canvas scene
│   └── SpaceFlight.tsx  # Canvas scene
├── components/
│   ├── OverlayUI.tsx    # Now playing card
│   ├── SceneSelector.tsx
│   └── LoginScreen.tsx
└── styles/
    └── global.css       # Design system
```

## Tech Stack

- **Electron** + **electron-vite** — Desktop shell
- **React 19** + **TypeScript** — UI framework
- **HTML5 Canvas** — Scene rendering (60 FPS)
- **Spotify Web API** — OAuth PKCE, currently playing endpoint
- **Custom k-means** — Album art color extraction (zero deps)

## Future Roadmap

- 🎤 Lyrics overlay
- 📊 Listening statistics
- 🎁 Spotify Wrapped-style analytics
- 🎵 YouTube Music / Apple Music support
- 🎨 User-created scenes
- 🏪 Scene marketplace

## License

ISC
