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

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface CommentReaction {
  [emoji: string]: number
}

// Normaliza um título para comparação simples de similaridade (palavras em comum).
export function normalizeTitle(title: string): string[] {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
}

// Retorna candidatos a duplicado com base em palavras em comum (similaridade >= 0.5).
export function findDuplicateCandidates(title: string, existing: { id: string; title: string }[]) {
  const words = new Set(normalizeTitle(title))
  if (words.size === 0) return []
  return existing
    .map(ticket => {
      const otherWords = new Set(normalizeTitle(ticket.title))
      if (otherWords.size === 0) return { ticket, score: 0 }
      const common = [...words].filter(w => otherWords.has(w)).length
      const score = common / Math.max(words.size, otherWords.size)
      return { ticket, score }
    })
    .filter(entry => entry.score >= 0.5)
    .sort((a, b) => b.score - a.score)
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
