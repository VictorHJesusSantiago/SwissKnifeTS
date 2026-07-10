import { pipelines, initialTickets, vulnerabilities, assets } from '../data/mockData'
import type { ModuleId } from '../types'

export type SearchEntityType = 'pipeline' | 'ticket' | 'vulnerability' | 'asset'

export interface SearchEntity {
  id: string
  type: SearchEntityType
  label: string
  sublabel: string
  module: ModuleId
}

const MAX_PER_TYPE = 8

export function searchEntities(query: string): SearchEntity[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const results: SearchEntity[] = []

  const matchedPipelines = pipelines
    .filter(p => p.name.toLowerCase().includes(q) || p.branch.toLowerCase().includes(q) || p.owner.toLowerCase().includes(q) || String(p.id).toLowerCase().includes(q))
    .slice(0, MAX_PER_TYPE)
    .map(p => ({ id: `pipeline-${p.id}`, type: 'pipeline' as const, label: p.name, sublabel: `${p.branch} · ${p.owner}`, module: 'pipelines' as ModuleId }))
  results.push(...matchedPipelines)

  const matchedTickets = initialTickets
    .filter(t => t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || t.assignee.toLowerCase().includes(q))
    .slice(0, MAX_PER_TYPE)
    .map(t => ({ id: `ticket-${t.id}`, type: 'ticket' as const, label: t.title, sublabel: `${t.id} · ${t.priority}`, module: 'tickets' as ModuleId }))
  results.push(...matchedTickets)

  const matchedVulnerabilities = vulnerabilities
    .filter(v => v.cve.toLowerCase().includes(q) || v.package.toLowerCase().includes(q) || v.asset.toLowerCase().includes(q))
    .slice(0, MAX_PER_TYPE)
    .map(v => ({ id: `vulnerability-${v.id}`, type: 'vulnerability' as const, label: v.cve, sublabel: `${v.package} · ${v.severity}`, module: 'vulnerabilities' as ModuleId }))
  results.push(...matchedVulnerabilities)

  const matchedAssets = assets
    .filter(a => a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q) || a.owner.toLowerCase().includes(q) || a.type.toLowerCase().includes(q))
    .slice(0, MAX_PER_TYPE)
    .map(a => ({ id: `asset-${a.id}`, type: 'asset' as const, label: a.name, sublabel: `${a.id} · ${a.type}`, module: 'assets' as ModuleId }))
  results.push(...matchedAssets)

  return results
}
