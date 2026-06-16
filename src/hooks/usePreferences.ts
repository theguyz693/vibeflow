import { useState, useEffect, createContext, useContext } from 'react'

export type ColorMode = 'auto' | 'manual'
export type LyricAlignment = 'left' | 'center' | 'right'
export type LyricMode = 'list' | 'single' | 'bounce'

export interface ManualColors {
  primary: string
  secondary: string
  accent: string
  glow: string
}

export interface Preferences {
  colorMode: ColorMode
  manualColors: ManualColors
  lyricAlignment: LyricAlignment
  lyricMode: LyricMode
  customVideoPath: string | null
}

const DEFAULT_PREFERENCES: Preferences = {
  colorMode: 'auto',
  manualColors: {
    primary: '#ff0000',
    secondary: '#00ff00',
    accent: '#0000ff',
    glow: '#ff00ff'
  },
  lyricAlignment: 'right',
  lyricMode: 'list',
  customVideoPath: null
}

interface PreferencesContextType {
  preferences: Preferences
  updatePreferences: (updates: Partial<Preferences>) => void
}

export const PreferencesContext = createContext<PreferencesContextType>({
  preferences: DEFAULT_PREFERENCES,
  updatePreferences: () => {}
})

export const usePreferencesProvider = () => {
  const [preferences, setPreferences] = useState<Preferences>(() => {
    const stored = localStorage.getItem('vf_prefs')
    if (stored) {
      try {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) }
      } catch (e) {}
    }
    return DEFAULT_PREFERENCES
  })

  useEffect(() => {
    localStorage.setItem('vf_prefs', JSON.stringify(preferences))
  }, [preferences])

  const updatePreferences = (updates: Partial<Preferences>) => {
    setPreferences(prev => ({ ...prev, ...updates }))
  }

  return { preferences, updatePreferences }
}

export const usePreferences = () => useContext(PreferencesContext)
