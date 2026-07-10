import type { Asset } from '../types'

// Ativos adicionais (mock exclusivo desta feature) com garantias vencendo em breve,
// usados para demonstrar o painel de alertas de garantia.
export const extraAssets: Asset[] = [
  { id: 'AT-1024', name: 'Lenovo ThinkPad X1 Carbon', type: 'Notebook', owner: 'Rafael Tavares', status: 'Ativo', location: 'Rio de Janeiro', value: 8700, warranty: '08/2026' },
  { id: 'AT-1023', name: 'Switch Ubiquiti 24P', type: 'Rede', owner: 'Infra Core', status: 'Ativo', location: 'DC SP-01', value: 5400, warranty: '09/2026' },
  { id: 'AT-1022', name: 'Samsung Galaxy Tab', type: 'Mobile', owner: 'Bia Reis', status: 'Ativo', location: 'São Paulo', value: 3200, warranty: '07/2026' },
]

export const TODAY = new Date(2026, 6, 7) // 07/07/2026 — data de referência dos dados mock
export const DEPRECIATION_RATE_PER_YEAR = 0.2
export const WARRANTY_ASSUMED_YEARS = 3

export function parseWarranty(warranty: string): Date | null {
  const match = /^(\d{2})\/(\d{4})$/.exec(warranty)
  if (!match) return null
  return new Date(Number(match[2]), Number(match[1]) - 1, 1)
}

export function daysUntil(date: Date): number {
  return Math.round((date.getTime() - TODAY.getTime()) / 86400000)
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export function fmtDate(date: Date): string {
  return date.toLocaleDateString('pt-BR')
}
