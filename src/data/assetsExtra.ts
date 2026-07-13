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

// --- Extensões: posse, criticidade, checklist, reserva, TCO, alertas de auditoria ---

function hashSeed(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Data mock (determinística) em que um ativo entrou em estoque, usada para o alerta de auditoria. */
export function stockSinceDate(assetId: string): Date {
  const daysAgo = 10 + (hashSeed(assetId) % 200) // entre 10 e 210 dias atrás
  return new Date(TODAY.getTime() - daysAgo * 86400000)
}

export function daysInStock(assetId: string): number {
  return Math.round((TODAY.getTime() - stockSinceDate(assetId).getTime()) / 86400000)
}

/** Limite (mock) a partir do qual um ativo em estoque é sinalizado como parado há muito tempo. */
export const STOCK_ALERT_DAYS_THRESHOLD = 60

/** Custo de manutenção estimado (mock), usado no relatório de TCO. */
export function estimateMaintenanceCost(value: number): number {
  return Math.round(value * 0.08)
}

export const CRITICALITY_LEVELS = ['Crítico', 'Normal', 'Baixo'] as const
export type Criticality = typeof CRITICALITY_LEVELS[number]

export type OwnershipProcess = 'entrega' | 'devolucao'

export const DEFAULT_CHECKLIST_ITEMS: Record<OwnershipProcess, string[]> = {
  entrega: ['Termo de responsabilidade assinado', 'Conferir acessórios (carregador, mouse, case)', 'Configurar conta e VPN do usuário', 'Registrar número de série no inventário'],
  devolucao: ['Verificar dados apagados (wipe)', 'Conferir acessórios (carregador, mouse, case)', 'Inspecionar avarias físicas', 'Revogar acessos e VPN'],
}
