// Dados e tipos auxiliares para o módulo de Runbooks (mock, apenas leitura/consumo pela RunbooksPage).
// Mantido em arquivo próprio para não editar src/data/mockData.ts nem src/types/index.ts.

export interface RunbookVersion { version: number; steps: string[]; savedAt: string }

export interface ExecutionRecord {
  id: string
  runbookId: string
  startedAt: string
  finishedAt: string
  totalMs: number
  stepDurationsMs: number[]
  executedBy: string
  rating?: number
  feedback?: string
}

export interface StepMeta {
  branchCondition?: string
  branchTargetStep?: number // 1-indexed destino do "pular para"
  imageName?: string
  imageType?: string
}

export interface Runbook {
  id: string
  title: string
  category: string
  steps: string[]
  duration: string
  runs: number
  incidentType: string
  versions: RunbookVersion[]
  serviceId?: string
  lastEditedAt: string // ISO date
  stepMeta?: Record<number, StepMeta>
}

export const incidentTypes = ['Latência', 'Outage', 'Segurança', 'Banco de dados', 'Geral']

export const STALE_THRESHOLD_DAYS = 90

export function daysSince(isoDate: string) {
  const then = new Date(isoDate).getTime()
  const now = Date.now()
  return Math.floor((now - then) / (1000 * 60 * 60 * 24))
}

export function isStale(isoDate: string, thresholdDays = STALE_THRESHOLD_DAYS) {
  return daysSince(isoDate) > thresholdDays
}

export const initialRunbooks: Runbook[] = [
  {
    id: 'rb1', title: 'Failover do PostgreSQL primário', category: 'Banco de dados', incidentType: 'Outage', versions: [],
    duration: '12 min', runs: 18, serviceId: 'ledger', lastEditedAt: '2026-01-14T10:00:00Z',
    steps: ['Confirmar indisponibilidade do primary', 'Verificar lag das réplicas', 'Promover réplica mais atual', 'Atualizar endpoint no secrets manager', 'Validar queries e latência', 'Registrar timeline do incidente'],
    stepMeta: { 1: { branchCondition: 'lag das réplicas > 30s', branchTargetStep: 6 } },
  },
  {
    id: 'rb2', title: 'Mitigação de latência no checkout', category: 'Incidente', incidentType: 'Latência', versions: [],
    duration: '8 min', runs: 31, serviceId: 'checkout', lastEditedAt: '2026-06-02T10:00:00Z',
    steps: ['Validar métricas RED', 'Identificar dependência degradada', 'Ativar circuit breaker', 'Escalar réplicas do checkout', 'Validar taxa de erros'],
  },
  {
    id: 'rb3', title: 'Rotação de credenciais de produção', category: 'Segurança', incidentType: 'Segurança', versions: [],
    duration: '20 min', runs: 9, serviceId: 'identity', lastEditedAt: '2025-09-20T10:00:00Z',
    steps: ['Gerar novas credenciais', 'Atualizar secrets manager', 'Reiniciar workloads gradualmente', 'Revogar credenciais anteriores', 'Validar auditoria'],
  },
]
