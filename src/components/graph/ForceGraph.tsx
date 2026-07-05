import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import type { GraphLink, GraphNode } from '../../types'

type SimulationNode = GraphNode & d3.SimulationNodeDatum
type SimulationLink = d3.SimulationLinkDatum<SimulationNode> & { value?: number }

export function ForceGraph({ nodes, links, onSelect }: { nodes: GraphNode[]; links: GraphLink[]; onSelect?: (node: GraphNode) => void }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const svg = d3.select(ref.current)
    svg.selectAll('*').remove()
    const width = ref.current?.clientWidth || 800, height = 440
    const nodeData: SimulationNode[] = nodes.map(n => ({...n}))
    const linkData: SimulationLink[] = links.map(l => ({...l}))
    const root = svg.attr('viewBox', `0 0 ${width} ${height}`).append('g')
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([.6, 2.5]).on('zoom', e => root.attr('transform', e.transform))
    svg.call(zoom)
    const simulation = d3.forceSimulation(nodeData)
      .force('link', d3.forceLink<SimulationNode, SimulationLink>(linkData).id(d => d.id).distance(105))
      .force('charge', d3.forceManyBody().strength(-360))
      .force('center', d3.forceCenter(width/2, height/2))
      .force('collision', d3.forceCollide(38))
    const link = root.append('g').attr('class','graph-links').selectAll('line').data(linkData).join('line').attr('stroke-width', d => 1 + (d.value || 20)/35)
    const group = root.append('g').selectAll<SVGGElement, SimulationNode>('g').data(nodeData).join('g').attr('class','graph-node').on('click', (_, d) => onSelect?.(d))
    group.append('circle').attr('r', 23).attr('class', d => `graph-node__circle graph-node__circle--${d.health || d.group}`)
    group.append('text').attr('y', 39).attr('text-anchor','middle').text(d => d.id)
    group.append('text').attr('text-anchor','middle').attr('dy','.35em').attr('class','graph-node__initial').text(d => d.id.slice(0,2).toUpperCase())
    const drag = d3.drag<SVGGElement, SimulationNode>()
      .on('start', (e,d) => { if (!e.active) simulation.alphaTarget(.3).restart(); d.fx=d.x; d.fy=d.y })
      .on('drag', (e,d) => { d.fx=e.x; d.fy=e.y })
      .on('end', (e,d) => { if (!e.active) simulation.alphaTarget(0); d.fx=null; d.fy=null })
    group.call(drag)
    simulation.on('tick', () => {
      link.attr('x1', d => (d.source as SimulationNode).x || 0).attr('y1', d => (d.source as SimulationNode).y || 0).attr('x2', d => (d.target as SimulationNode).x || 0).attr('y2', d => (d.target as SimulationNode).y || 0)
      group.attr('transform', d => `translate(${d.x},${d.y})`)
    })
    return () => { simulation.stop() }
  }, [nodes, links, onSelect])
  return <svg ref={ref} className="force-graph" role="img" aria-label="Grafo interativo; arraste os nós e use o scroll para zoom"/>
}
