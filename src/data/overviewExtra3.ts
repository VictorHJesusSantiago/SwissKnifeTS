import { initialTickets, pipelines } from './mockData'
import { getHistoryFor } from './pipelinesExtra'

// --- Item 1: construtor de widget customizado ---
export type CustomMetricId =
  | 'ticketsOpen' | 'criticalVulns' | 'pipelinesRunning' | 'monthlyCost'
  | 'deploysToday' | 'failingPipelines' | 'availability' | 'leadTime'

export type CustomVizType = 'number' | 'bar' | 'sparkline'

export interface CustomMetricDef {
  id: CustomMetricId
  label: string
  unit?: string
  max: number
  getValue: () => number
  trend: number[]
}

function trendAround(base: number, seed: number): number[] {
  let s = seed
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
  return Array.from({ length: 10 }, () => Math.max(0, Math.round(base * (0.75 + rand() * 0.5))))
}

export function buildCustomMetricCatalog(): CustomMetricDef[] {
  const ticketsOpen = initialTickets.filter(t => t.status !== 'Concluído').length
  const criticalVulnsCount = 3
  const running = pipelines.filter(p => p.status === 'running').length
  const failing = pipelines.filter(p => p.status === 'failed').length
  return [
    { id: 'ticketsOpen', label: 'Tickets abertos', max: 20, getValue: () => ticketsOpen, trend: trendAround(ticketsOpen || 3, 11) },
    { id: 'criticalVulns', label: 'Vulnerabilidades críticas', max: 10, getValue: () => criticalVulnsCount, trend: trendAround(criticalVulnsCount, 23) },
    { id: 'pipelinesRunning', label: 'Pipelines rodando', max: 8, getValue: () => running, trend: trendAround(running || 1, 37) },
    { id: 'failingPipelines', label: 'Pipelines com falha', max: 8, getValue: () => failing, trend: trendAround(failing || 1, 41) },
    { id: 'monthlyCost', label: 'Custo mensal (R$ mil)', unit: 'k', max: 300, getValue: () => 184, trend: trendAround(184, 53) },
    { id: 'deploysToday', label: 'Deploys hoje', max: 80, getValue: () => 47, trend: trendAround(47, 61) },
    { id: 'availability', label: 'Disponibilidade (%)', unit: '%', max: 100, getValue: () => 99.97, trend: trendAround(99, 71) },
    { id: 'leadTime', label: 'Lead time médio (min)', unit: 'min', max: 30, getValue: () => 8.7, trend: trendAround(9, 83) },
  ]
}

export interface CustomWidget {
  id: string
  metricId: CustomMetricId
  viz: CustomVizType
  createdAt: number
}

// --- Item 3: principais contribuidores da semana ---
export interface Contributor {
  name: string
  score: number
}

export function computeTopContributors(): Contributor[] {
  const counts: Record<string, number> = {}
  const bump = (name: string, amount: number) => { counts[name] = (counts[name] ?? 0) + amount }

  initialTickets.forEach(tk => { if (tk.status === 'Concluído') bump(tk.assignee, 4) })

  pipelines.forEach(p => {
    const history = getHistoryFor(p.id)
    const successCount = history.filter(r => r.status === 'success').length
    bump(p.owner, successCount)
  })

  return Object.entries(counts)
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

// --- Item 4: mudanças desde a última visita ---
export interface VisitSnapshot {
  timestamp: number
  ticketsOpen: number
  criticalVulns: number
  runningPipelines: number
  failingPipelines: number
}

export function buildVisitSnapshot(): VisitSnapshot {
  return {
    timestamp: Date.now(),
    ticketsOpen: initialTickets.filter(t => t.status !== 'Concluído').length,
    criticalVulns: 3,
    runningPipelines: pipelines.filter(p => p.status === 'running').length,
    failingPipelines: pipelines.filter(p => p.status === 'failed').length,
  }
}

export interface VisitDiff {
  ticketsDelta: number
  vulnsDelta: number
  runningDelta: number
  failingDelta: number
  sinceMinutes: number
}

export function diffVisitSnapshots(previous: VisitSnapshot, current: VisitSnapshot): VisitDiff {
  return {
    ticketsDelta: current.ticketsOpen - previous.ticketsOpen,
    vulnsDelta: current.criticalVulns - previous.criticalVulns,
    runningDelta: current.runningPipelines - previous.runningPipelines,
    failingDelta: current.failingPipelines - previous.failingPipelines,
    sinceMinutes: Math.max(0, Math.round((current.timestamp - previous.timestamp) / 60000)),
  }
}
