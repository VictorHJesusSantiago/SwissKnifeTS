export type Severity = 'critical' | 'warning' | 'healthy' | 'info'
export type Status = 'success' | 'failed' | 'running' | 'pending'

export interface Metric {
  label: string
  value: string
  delta?: string
  tone?: Severity
  hint?: string
}

export interface Pipeline {
  id: number
  name: string
  branch: string
  owner: string
  status: Status
  duration: string
  updated: string
  stages: { name: string; status: Status; duration: string }[]
}

export interface LogEntry {
  id: number
  timestamp: string
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'
  service: string
  message: string
  trace: string
}

export interface Ticket {
  id: string
  title: string
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  status: 'Backlog' | 'Em andamento' | 'Revisão' | 'Concluído'
  assignee: string
  tags: string[]
  age: string
}

export interface GraphNode { id: string; group: string; health?: Severity; x?: number; y?: number }
export interface GraphLink { source: string; target: string; value?: number }

export interface Vulnerability {
  id: string
  cve: string
  package: string
  asset: string
  severity: 'Crítica' | 'Alta' | 'Média' | 'Baixa'
  cvss: number
  status: 'Aberta' | 'Em correção' | 'Aceita' | 'Resolvida'
  due: string
}

export interface Asset {
  id: string
  name: string
  type: string
  owner: string
  status: 'Ativo' | 'Manutenção' | 'Estoque'
  location: string
  value: number
  warranty: string
}

export type ModuleId =
  | 'overview' | 'pipelines' | 'logs' | 'tickets' | 'network'
  | 'terraform' | 'kubernetes' | 'namespaces' | 'services'
  | 'vulnerabilities' | 'capacity' | 'runbooks' | 'assets' | 'settings' | 'comparator' | 'help'

export interface NotificationItem {
  id: string
  title: string
  message: string
  tone: Severity
  time: string
  read: boolean
}

export interface AuditEntry {
  id: string
  action: string
  detail: string
  time: string
  actor?: string
}

export interface FavoriteItem {
  id: string
  module: ModuleId
  label: string
}
