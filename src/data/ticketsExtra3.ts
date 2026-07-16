// Dados auxiliares exclusivos para features extras (rodada 3) da TicketsPage:
// pós-mortem, votos de priorização, detecção de recorrência e histograma de idade.
import type { Ticket } from '../types'

export interface PostmortemDraft {
  causaRaiz: string
  acaoCorretiva: string
}

export const ageBuckets = ['0-4h', '4-12h', '12-24h', '24h+'] as const
export type AgeBucket = typeof ageBuckets[number]

export function ageBucketFor(hours: number): AgeBucket {
  if (hours < 4) return '0-4h'
  if (hours < 12) return '4-12h'
  if (hours < 24) return '12-24h'
  return '24h+'
}

export function buildPostmortemMarkdown(ticket: Ticket, slaHours: number, elapsedHours: number, draft: PostmortemDraft): string {
  const overBy = Math.max(0, elapsedHours - slaHours)
  return `# Pós-mortem: ${ticket.id} · ${ticket.title}

## Resumo
- **Ticket:** ${ticket.id}
- **Título:** ${ticket.title}
- **Prioridade:** ${ticket.priority}
- **Responsável:** ${ticket.assignee}
- **Status atual:** ${ticket.status}

## SLA
- **SLA definido:** ${slaHours}h
- **Tempo decorrido:** ${elapsedHours.toFixed(1)}h
- **Estourado por:** ${overBy.toFixed(1)}h

## Impacto
_Descreva aqui o impacto observado (usuários afetados, downtime, perda de receita, etc.)._

## Causa raiz
${draft.causaRaiz || '_A preencher._'}

## Ação corretiva
${draft.acaoCorretiva || '_A preencher._'}

---
Gerado automaticamente pelo OpsPhere.
`
}
