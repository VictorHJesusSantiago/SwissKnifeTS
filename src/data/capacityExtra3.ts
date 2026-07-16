import { peopleAllocation, sprintHistory } from './capacityExtra'

// --- Item 1: taxa/hora mock por pessoa (editável na UI, valor inicial aqui) ---
export const defaultHourlyRates: Record<string, number> = {
  'Ana Lima': 145,
  'Caio Nunes': 130,
  'Bia Reis': 160,
  'Davi Souza': 138,
  'Ellen Costa': 120,
  'Felipe Rocha': 110,
  'Gabi Martins': 150,
}

export const SPRINT_HOURS = 80 // horas úteis num sprint de 2 semanas por pessoa em tempo integral

export function totalAllocationPct(person: typeof peopleAllocation[number]) {
  return Object.values(person.allocations).reduce((s, v) => s + v, 0)
}

// --- Item 2: previsão linear simples com base no histórico de sprints ---
export interface ForecastPoint { sprint: string; utilization: number; isForecast: boolean }

export function linearForecast(history: typeof sprintHistory, stepsAhead: number): ForecastPoint[] {
  const n = history.length
  const xs = history.map((_, i) => i)
  const ys = history.map(d => d.utilization)
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY)
    den += (xs[i] - meanX) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  const intercept = meanY - slope * meanX

  const lastSprintNumberMatch = /(\d+)/.exec(history[n - 1].sprint)
  const lastSprintNumber = lastSprintNumberMatch ? parseInt(lastSprintNumberMatch[1], 10) : n

  const forecastPoints: ForecastPoint[] = []
  for (let i = 1; i <= stepsAhead; i++) {
    const x = n - 1 + i
    const predicted = Math.max(0, Math.min(130, Math.round(slope * x + intercept)))
    forecastPoints.push({ sprint: `Sprint ${lastSprintNumber + i}`, utilization: predicted, isForecast: true })
  }
  return forecastPoints
}

// --- Item 3: organograma simples do time (mock, reaproveitando nomes já usados no projeto) ---
export interface OrgNode { name: string; role: string; children?: OrgNode[] }

export const orgChart: OrgNode = {
  name: 'Victor Lima',
  role: 'Head de Engenharia',
  children: [
    {
      name: 'Ana Lima', role: 'Tech Lead · Platform Core',
      children: [
        { name: 'Gabi Martins', role: 'Engenheira de Plataforma' },
      ],
    },
    {
      name: 'Caio Nunes', role: 'Tech Lead · Commerce',
      children: [
        { name: 'Felipe Rocha', role: 'Engenheiro de Software' },
      ],
    },
    {
      name: 'Bia Reis', role: 'Tech Lead · IAM & Security',
    },
    {
      name: 'Davi Souza', role: 'Tech Lead · Data Platform',
    },
    {
      name: 'Ellen Costa', role: 'Tech Lead · Developer Experience',
    },
  ],
}
