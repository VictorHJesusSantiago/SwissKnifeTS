import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

type Theme = 'dark' | 'light'
type Density = 'comfortable' | 'compact'

interface ThemeCtx {
  theme: Theme
  toggleTheme: () => void
  density: Density
  setDensity: (d: Density) => void
}

const Ctx = createContext<ThemeCtx | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useLocalStorage<Theme>('opsphere-theme', 'dark')
  const [density, setDensity] = useLocalStorage<Density>('opsphere-density', 'comfortable')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.setAttribute('data-density', density)
  }, [theme, density])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return <Ctx.Provider value={{ theme, toggleTheme, density, setDensity }}>{children}</Ctx.Provider>
}

export function useTheme() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme deve ser usado dentro de ThemeProvider')
  return ctx
}
