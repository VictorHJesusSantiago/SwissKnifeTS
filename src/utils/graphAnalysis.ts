import type { GraphLink, GraphNode } from '../types'

type LinkEnd = string | { id: string }
const idOf = (v: LinkEnd) => typeof v === 'string' ? v : v.id

export interface CycleResult {
  hasCycle: boolean
  cycleNodes: Set<string>
  cycleLinks: Set<string>
}

export const linkKey = (source: string, target: string) => `${source}=>${target}`

/** DFS-based cycle detection over a directed graph. Returns the node ids and link keys
 * that participate in at least one cycle (enough to highlight/warn, not exhaustive). */
export function detectCycle(nodes: GraphNode[], links: GraphLink[]): CycleResult {
  const adjacency = new Map<string, string[]>()
  nodes.forEach(n => adjacency.set(n.id, []))
  links.forEach(l => {
    const s = idOf(l.source as LinkEnd), t = idOf(l.target as LinkEnd)
    if (!adjacency.has(s)) adjacency.set(s, [])
    adjacency.get(s)!.push(t)
  })

  const visited = new Set<string>()
  const onStack = new Set<string>()
  const path: string[] = []
  const cycleNodes = new Set<string>()
  const cycleLinks = new Set<string>()

  function dfs(node: string): boolean {
    visited.add(node)
    onStack.add(node)
    path.push(node)
    for (const next of adjacency.get(node) || []) {
      if (onStack.has(next)) {
        const idx = path.indexOf(next)
        const cyclePath = path.slice(idx)
        cyclePath.forEach(n => cycleNodes.add(n))
        for (let i = 0; i < cyclePath.length; i++) {
          cycleLinks.add(linkKey(cyclePath[i], cyclePath[(i + 1) % cyclePath.length]))
        }
        return true
      }
      if (!visited.has(next) && dfs(next)) return true
    }
    onStack.delete(node)
    path.pop()
    return false
  }

  for (const n of nodes) {
    if (!visited.has(n.id)) dfs(n.id)
  }

  return { hasCycle: cycleNodes.size > 0, cycleNodes, cycleLinks }
}

/** Reverse BFS: given a node, find every node that transitively depends on it
 * (i.e. would be affected if this node went down). Edges are read as source -> target
 * meaning "source depends on target". */
export function blastRadius(nodeId: string, links: GraphLink[]): Set<string> {
  const reverse = new Map<string, string[]>()
  links.forEach(l => {
    const s = idOf(l.source as LinkEnd), t = idOf(l.target as LinkEnd)
    if (!reverse.has(t)) reverse.set(t, [])
    reverse.get(t)!.push(s)
  })
  const visited = new Set<string>()
  const queue = [nodeId]
  while (queue.length) {
    const current = queue.shift()!
    for (const dependent of reverse.get(current) || []) {
      if (!visited.has(dependent)) {
        visited.add(dependent)
        queue.push(dependent)
      }
    }
  }
  return visited
}
