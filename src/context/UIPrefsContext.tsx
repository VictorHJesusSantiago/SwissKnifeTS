import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

export type AccentColor = 'teal' | 'blue' | 'violet' | 'amber' | 'rose'

interface UIPrefsCtx {
  highContrast: boolean
  toggleHighContrast: () => void
  presentationMode: boolean
  togglePresentationMode: () => void
  readingMode: boolean
  toggleReadingMode: () => void
  uiScale: number
  setUiScale: (n: number) => void
  accentColor: AccentColor
  setAccentColor: (c: AccentColor) => void
  keyboardOnly: boolean
  toggleKeyboardOnly: () => void
  verbose: boolean
  toggleVerbose: () => void
}

const Ctx = createContext<UIPrefsCtx | null>(null)

export const accentColors: Record<AccentColor, string> = {
  teal: '#6ce5c4',
  blue: '#8097ff',
  violet: '#b98aff',
  amber: '#f8c56a',
  rose: '#ff8fa3',
}

export function UIPrefsProvider({ children }: { children: ReactNode }) {
  const [highContrast, setHighContrast] = useLocalStorage('opsphere-high-contrast', false)
  const [presentationMode, setPresentationMode] = useLocalStorage('opsphere-presentation-mode', false)
  const [readingMode, setReadingMode] = useLocalStorage('opsphere-reading-mode', false)
  const [uiScale, setUiScale] = useLocalStorage('opsphere-ui-scale', 100)
  const [accentColor, setAccentColor] = useLocalStorage<AccentColor>('opsphere-accent-color', 'teal')
  const [keyboardOnly, setKeyboardOnly] = useLocalStorage('opsphere-keyboard-only', false)
  const [verbose, setVerbose] = useLocalStorage('opsphere-verbose', false)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('high-contrast', highContrast)
    root.classList.toggle('presentation-mode', presentationMode)
    root.classList.toggle('reading-mode', readingMode)
    root.classList.toggle('keyboard-only', keyboardOnly)
    root.style.setProperty('--ui-scale', String(uiScale / 100))
    root.style.setProperty('--accent', accentColors[accentColor])
  }, [highContrast, presentationMode, readingMode, uiScale, accentColor, keyboardOnly])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); setPresentationMode(v => !v) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setPresentationMode])

  return <Ctx.Provider value={{
    highContrast, toggleHighContrast: () => setHighContrast(v => !v),
    presentationMode, togglePresentationMode: () => setPresentationMode(v => !v),
    readingMode, toggleReadingMode: () => setReadingMode(v => !v),
    uiScale, setUiScale,
    accentColor, setAccentColor,
    keyboardOnly, toggleKeyboardOnly: () => setKeyboardOnly(v => !v),
    verbose, toggleVerbose: () => setVerbose(v => !v),
  }}>{children}</Ctx.Provider>
}

export function useUIPrefs() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useUIPrefs deve ser usado dentro de UIPrefsProvider')
  return ctx
}
