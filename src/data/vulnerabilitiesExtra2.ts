// Dados mock exclusivos para a segunda leva de funcionalidades extras da VulnerabilitiesPage.
// Não editar src/data/mockData.ts nem src/data/vulnerabilitiesExtra.ts — arquivo auto-contido.
import type { Vulnerability } from '../types'

export interface WeeklyTrendPoint { week: string; opened: number; closed: number }

// Vulnerabilidades abertas/fechadas por semana nas últimas 6 semanas (mock).
export const weeklyTrend: WeeklyTrendPoint[] = [
  { week: 'S22', opened: 4, closed: 2 },
  { week: 'S23', opened: 3, closed: 3 },
  { week: 'S24', opened: 6, closed: 4 },
  { week: 'S25', opened: 2, closed: 5 },
  { week: 'S26', opened: 5, closed: 3 },
  { week: 'S27', opened: 3, closed: 4 },
]

// Sugestão fixa de runbook de remediação por severidade (apenas informativo no modal de detalhe).
export const runbookSuggestionBySeverity: Record<Vulnerability['severity'], string> = {
  'Crítica': 'Segurança · Resposta a incidente crítico',
  'Alta': 'Segurança · Patch prioritário',
  'Média': 'Segurança · Ciclo de patch mensal',
  'Baixa': 'Segurança · Backlog de hardening',
}

// Catálogo mockado de vulnerabilidades adicionais que um "novo scan" pode encontrar.
export const scanCandidates: Omit<Vulnerability, 'id'>[] = [
  { cve: 'CVE-2026-4410', package: 'openssh 9.6', asset: 'edge-proxy', severity: 'Alta', cvss: 8.4, status: 'Aberta', due: '7 dias' },
  { cve: 'CVE-2026-4477', package: 'curl 8.4.0', asset: 'checkout-api', severity: 'Média', cvss: 5.9, status: 'Aberta', due: '30 dias' },
  { cve: 'CVE-2026-4502', package: 'libxml2 2.11', asset: 'web-storefront', severity: 'Baixa', cvss: 3.7, status: 'Aberta', due: '90 dias' },
  { cve: 'CVE-2026-4559', package: 'python 3.12.1', asset: 'ledger-worker', severity: 'Crítica', cvss: 9.1, status: 'Aberta', due: '2 dias' },
]
