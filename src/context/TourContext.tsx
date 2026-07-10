import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'

export interface TourStep {
  target: string
  title: string
  body: string
}

export const tourSteps: TourStep[] = [
  {
    target: '[data-tour="sidebar-nav"]',
    title: 'Navegação principal',
    body: 'Use o menu lateral para acessar todos os módulos do OpsPhere: pipelines, kubernetes, tickets, e muito mais.',
  },
  {
    target: '[data-tour="global-search"]',
    title: 'Busca global',
    body: 'Pressione ⌘K (ou Ctrl+K) a qualquer momento para abrir a busca global e navegar rapidamente entre módulos e ações.',
  },
  {
    target: '[data-tour="notifications"]',
    title: 'Notificações',
    body: 'Fique de olho nos alertas e eventos importantes da plataforma através do centro de notificações.',
  },
  {
    target: '[data-tour="user-switcher"]',
    title: 'Perfil e troca de usuário',
    body: 'Clique no avatar para ver o usuário atual ou alternar entre diferentes perfis de demonstração.',
  },
  {
    target: '[data-tour="settings-link"]',
    title: 'Favoritos e configurações',
    body: 'Acesse as configurações para gerenciar favoritos, aparência, idioma, backups e muito mais.',
  },
  {
    target: '[data-tour="overview-content"]',
    title: 'Visão geral',
    body: 'Esta página resume a saúde da plataforma: pipelines, incidentes, capacidade e principais indicadores em tempo real.',
  },
]

interface TourContextValue {
  active: boolean
  stepIndex: number
  steps: TourStep[]
  currentStep: TourStep | null
  start: () => void
  stop: () => void
  next: () => void
  prev: () => void
  hasSeenTour: boolean
}

const TourContext = createContext<TourContextValue | null>(null)

export function TourProvider({ children }: { children: ReactNode }) {
  const [hasSeenTour, setHasSeenTour] = useLocalStorage('opsphere-tour-seen', false)
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)

  const start = useCallback(() => {
    setStepIndex(0)
    setActive(true)
  }, [])

  const finish = useCallback(() => {
    setActive(false)
    setHasSeenTour(true)
  }, [setHasSeenTour])

  const stop = useCallback(() => {
    finish()
  }, [finish])

  const next = useCallback(() => {
    setStepIndex(i => {
      if (i >= tourSteps.length - 1) {
        finish()
        return i
      }
      return i + 1
    })
  }, [finish])

  const prev = useCallback(() => {
    setStepIndex(i => Math.max(0, i - 1))
  }, [])

  const currentStep = active ? tourSteps[stepIndex] ?? null : null

  const value = useMemo<TourContextValue>(() => ({
    active,
    stepIndex,
    steps: tourSteps,
    currentStep,
    start,
    stop,
    next,
    prev,
    hasSeenTour,
  }), [active, stepIndex, currentStep, start, stop, next, prev, hasSeenTour])

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}

export function useTour() {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour must be used within a TourProvider')
  return ctx
}
