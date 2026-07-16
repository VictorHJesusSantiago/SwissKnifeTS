// Dados auxiliares exclusivos para features extras (rodada 3) da LogsPage:
// dashboards salvos (combinação de filtros), histórico de buscas e simulador de retenção.
import type { LogEntry } from '../types'

export interface LogDashboard {
  id: string
  name: string
  query: string
  regex: string
  level: string
  tagFilter: string
  createdAt: number
}

export const logLevelOrder: LogEntry['level'][] = ['ERROR', 'WARN', 'INFO', 'DEBUG']

export const logLevelColors: Record<LogEntry['level'], string> = {
  ERROR: '#ef6a6a',
  WARN: '#e7c873',
  INFO: '#6ce5c4',
  DEBUG: '#7fa8e0',
}

// Gera uma "idade simulada em dias" determinística a partir do id do log, para o simulador de
// retenção (não há timestamps reais com data, então derivamos um valor estável e reprodutível).
export function simulateLogAgeDays(id: number): number {
  const hash = Math.abs((id * 2654435761) % 2 ** 31)
  return hash % 45
}
