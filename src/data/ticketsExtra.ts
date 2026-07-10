// Dados auxiliares exclusivos para features extras da TicketsPage.
import type { Ticket } from '../types'

export const assigneeOptions = [
  'Victor Lima',
  'Ana Ferreira',
  'Bruno Costa',
  'Carla Souza',
  'Diego Alves',
  'Não atribuído',
]

export interface TicketTemplate {
  id: string
  name: string
  description: string
  title: string
  priority: Ticket['priority']
  tags: string[]
}

export const ticketTemplates: TicketTemplate[] = [
  {
    id: 'incident',
    name: 'Incidente de produção',
    description: 'Falha ativa impactando usuários',
    title: 'Incidente: ',
    priority: 'P0',
    tags: ['incidente', 'produção'],
  },
  {
    id: 'tech-debt',
    name: 'Débito técnico',
    description: 'Melhoria interna sem urgência',
    title: 'Débito técnico: ',
    priority: 'P2',
    tags: ['débito-técnico'],
  },
  {
    id: 'access',
    name: 'Solicitação de acesso',
    description: 'Pedido de permissão ou credencial',
    title: 'Acesso: ',
    priority: 'P3',
    tags: ['acesso'],
  },
]

// Limite de horas por prioridade para cálculo de SLA.
export const slaHoursByPriority: Record<Ticket['priority'], number> = {
  P0: 4,
  P1: 8,
  P2: 24,
  P3: 72,
}

export interface TicketComment {
  id: string
  author: string
  text: string
  time: string
}

export interface AttachmentMeta {
  id: string
  name: string
  size: number
  type: string
  previewUrl?: string
}

export interface SavedView {
  id: string
  name: string
  query: string
  priority: string
  tag: string
}

// Converte o texto aproximado de "idade" do ticket (ex: "há 2 h", "agora", "há 3 dias") em horas decorridas.
export function parseAgeToHours(age: string): number {
  const normalized = age.toLowerCase().trim()
  if (normalized === 'agora') return 0
  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(min|minuto|h|hora|dia|d)/)
  if (!match) return 0
  const value = parseFloat(match[1].replace(',', '.'))
  const unit = match[2]
  if (unit.startsWith('min')) return value / 60
  if (unit.startsWith('h')) return value
  if (unit.startsWith('dia') || unit === 'd') return value * 24
  return 0
}
