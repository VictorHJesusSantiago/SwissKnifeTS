import { getSeed, mulberry32 } from '../utils/seed'

// Dados auxiliares exclusivos para features extras da LogsPage (live tail simulado).
const rand = mulberry32(getSeed() * 1103 + 7)

export const liveServices = ['gateway', 'checkout-api', 'payments-worker', 'auth-service', 'inventory-api', 'notifications-svc']

export const liveLevels: Array<'ERROR' | 'WARN' | 'INFO' | 'DEBUG'> = ['ERROR', 'WARN', 'INFO', 'DEBUG']

export const liveMessageTemplates = [
  'Requisição concluída em {ms}ms',
  'Timeout ao conectar no serviço downstream após {ms}ms',
  'Circuito aberto para dependência externa',
  'Cache miss para chave de sessão',
  'Retry agendado (tentativa {n})',
  'Payload de webhook processado com sucesso',
  'Falha de validação no corpo da requisição',
  'Conexão com banco de dados restabelecida',
  'Fila de mensagens com atraso de {ms}ms',
  'Certificado TLS renovado automaticamente',
  'Rate limit atingido para cliente',
  'Health check respondeu 200 OK',
]

export function randomTraceId() {
  return `trc-${Math.floor(rand() * 0xffffff).toString(16).padStart(6, '0')}`
}

export function buildLiveMessage() {
  const template = liveMessageTemplates[Math.floor(rand() * liveMessageTemplates.length)]
  return template.replace('{ms}', String(Math.floor(rand() * 900) + 20)).replace('{n}', String(Math.floor(rand() * 3) + 1))
}
