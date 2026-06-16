import { app, BrowserWindow } from 'electron'
import { join } from 'path'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: false,
    fullscreenable: true,
    frame: true,
    backgroundColor: '#000000',
    title: 'VibeFlow',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false
    }
  })

  mainWindow.setMenuBarVisibility(false)
  mainWindow.maximize()

  // Handle F11 for fullscreen toggle
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen())
    }
  })

  // Open DevTools
  mainWindow.webContents.openDevTools({ mode: 'detach' })

  // Intercept Spotify OAuth redirect
  mainWindow.webContents.on('will-navigate', (event, url) => {
    console.log('[VibeFlow Main] Intercepted navigation to:', url)
    if (url.startsWith('http://localhost:5173/callback') || url.startsWith('http://127.0.0.1:5173/callback')) {
      event.preventDefault()
      const search = new URL(url).search
      console.log('[VibeFlow Main] Redirecting back to local file with query:', search)
      mainWindow.loadFile(join(__dirname, '../renderer/index.html'), { search })
    }
  })

  // Load the renderer directly from the file system (bypasses ALL dev server issues)
  mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
