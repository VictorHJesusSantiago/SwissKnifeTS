import { assets, initialTickets, pipelines, vulnerabilities } from './mockData'

export interface UpcomingEvent {
  id: string
  title: string
  date: string
  kind: 'maintenance' | 'deploy' | 'release'
}

export const upcomingEvents: UpcomingEvent[] = [
  { id: 'ev1', title: 'Janela de manutenção - banco principal', date: '12/07 · 02h00', kind: 'maintenance' },
  { id: 'ev2', title: 'Deploy agendado - checkout-api v2.4', date: '14/07 · 10h00', kind: 'deploy' },
  { id: 'ev3', title: 'Release trimestral - plataforma de pagamentos', date: '18/07 · 09h00', kind: 'release' },
  { id: 'ev4', title: 'Janela de manutenção - rede DC SP-01', date: '22/07 · 01h00', kind: 'maintenance' },
]

// Data mock fixa do último incidente crítico já resolvido, usada apenas quando não há
// nenhum P0/vulnerabilidade crítica em aberto no momento (caso contrário o contador zera).
export const lastResolvedCriticalIncidentDate = '2026-05-02'

export function daysSince(dateStr: string): number {
  const past = new Date(dateStr).getTime()
  const now = Date.now()
  return Math.max(0, Math.floor((now - past) / 86_400_000))
}

export function computeTopIncidentServices(): { name: string; score: number }[] {
  const counts: Record<string, number> = {}
  const bump = (key: string, weight: number) => { counts[key] = (counts[key] ?? 0) + weight }

  vulnerabilities.forEach(v => bump(v.asset, v.severity === 'Crítica' ? 3 : v.severity === 'Alta' ? 2 : 1))
  pipelines.forEach(p => { if (p.status === 'failed') bump(p.name, 2) })
  initialTickets.forEach(tk => {
    const service = tk.tags[0]
    if (service) bump(service, tk.priority === 'P0' ? 3 : tk.priority === 'P1' ? 2 : 1)
  })

  return Object.entries(counts)
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

export function computeCostByEnv(totalCost = 184_000): { label: string; value: number }[] {
  const distribution = [
    { label: 'Produção', pct: 0.62 },
    { label: 'Staging', pct: 0.19 },
    { label: 'Dev', pct: 0.13 },
    { label: 'Sandbox', pct: 0.06 },
  ]
  return distribution.map(d => ({ label: d.label, value: Math.round(totalCost * d.pct) }))
}

export function computeWarrantyAlerts(monthsThreshold = 8) {
  const now = new Date()
  return assets.filter(a => {
    if (a.warranty === '—') return false
    const [mm, yyyy] = a.warranty.split('/').map(Number)
    if (!mm || !yyyy) return false
    const target = new Date(yyyy, mm - 1, 1)
    const diffMonths = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth())
    return diffMonths <= monthsThreshold
  })
}

export interface DailySnapshot {
  date: string
  availability: number
  deploysToday: number
  incidents: number
  costK: number
}
