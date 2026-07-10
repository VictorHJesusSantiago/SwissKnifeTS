import { createContext, useContext, type ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import type { FavoriteItem, ModuleId } from '../types'

interface FavoritesCtx {
  favorites: FavoriteItem[]
  isFavorite: (module: ModuleId, id: string) => boolean
  toggleFavorite: (item: FavoriteItem) => void
}

const Ctx = createContext<FavoritesCtx | null>(null)

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useLocalStorage<FavoriteItem[]>('opsphere-favorites', [])

  const isFavorite = (module: ModuleId, id: string) => favorites.some(f => f.module === module && f.id === id)
  const toggleFavorite = (item: FavoriteItem) => setFavorites(list =>
    list.some(f => f.module === item.module && f.id === item.id)
      ? list.filter(f => !(f.module === item.module && f.id === item.id))
      : [item, ...list].slice(0, 30))

  return <Ctx.Provider value={{ favorites, isFavorite, toggleFavorite }}>{children}</Ctx.Provider>
}

export function useFavorites() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useFavorites deve ser usado dentro de FavoritesProvider')
  return ctx
}
