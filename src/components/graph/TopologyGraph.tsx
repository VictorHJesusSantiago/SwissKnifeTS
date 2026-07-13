import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as d3 from 'd3'
import type { GraphLink, GraphNode } from '../../types'
import { linkKey } from '../../utils/graphAnalysis'

export interface TopologyGraphHandle {
  /** Animates a marker across a chain of connected node ids (a "packet trace"). */
  playTrace: (path: string[], onDone?: () => void) => void
  /** Serializes the current SVG to a PNG and triggers a browser download. */
  exportPng: (filename?: string) => void
}

type SimulationNode = GraphNode & d3.SimulationNodeDatum
type SimulationLink = d3.SimulationLinkDatum<SimulationNode> & { value?: number }

interface Props {
  nodes: GraphNode[]
  links: GraphLink[]
  onSelect?: (node: GraphNode) => void
  hiddenGroups?: Set<string>
  blastNodeIds?: Set<string>
  cycleNodeIds?: Set<string>
  cycleLinkKeys?: Set<string>
  selectedId?: string
  /** Node ids whose health changed since the last saved snapshot (diff mode). */
  diffNodeIds?: Set<string>
  /** Node ids that have a persisted annotation/post-it; rendered with a small marker. */
  annotatedNodeIds?: Set<string>
  /** When true, links are colored/thickened by traffic `value` (heatmap mode). */
  heatmap?: boolean
  /** Node ids that belong to a highlighted critical path; all others are dimmed. */
  pathNodeIds?: Set<string>
  /** Extra per-node CSS class, e.g. to show cascading-failure state. */
  extraNodeClass?: (id: string) => string
  /** Selected pair of node ids for side-by-side comparison mode. */
  compareNodeIds?: Set<string>
}

const endId = (v: string | { id: string }) => typeof v === 'string' ? v : v.id

export const TopologyGraph = forwardRef<TopologyGraphHandle, Props>(function TopologyGraph(
  { nodes, links, onSelect, hiddenGroups, blastNodeIds, cycleNodeIds, cycleLinkKeys, selectedId, diffNodeIds, annotatedNodeIds, heatmap, pathNodeIds, extraNodeClass, compareNodeIds }, ref,
) {
  const svgRef = useRef<SVGSVGElement>(null)
  const posRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const markerRef = useRef<SVGCircleElement | null>(null)
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    const width = svgRef.current.clientWidth || 800, height = 440

    const visible = nodes.filter(n => !hiddenGroups?.has(n.group))
    const visibleIds = new Set(visible.map(n => n.id))
    const visibleLinks = links.filter(l => visibleIds.has(endId(l.source as any)) && visibleIds.has(endId(l.target as any)))

    const nodeData: SimulationNode[] = visible.map(n => ({ ...n }))
    const linkData: SimulationLink[] = visibleLinks.map(l => ({ ...l }))

    const root = svg.attr('viewBox', `0 0 ${width} ${height}`).append('g')
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([.6, 2.5]).on('zoom', e => root.attr('transform', e.transform))
    svg.call(zoom)

    const simulation = d3.forceSimulation(nodeData)
      .force('link', d3.forceLink<SimulationNode, SimulationLink>(linkData).id(d => d.id).distance(105))
      .force('charge', d3.forceManyBody().strength(-360))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(38))

    const maxValue = Math.max(1, ...linkData.map(d => d.value || 0))
    const link = root.append('g').attr('class', 'graph-links').selectAll('line').data(linkData).join('line')
      .attr('stroke-width', d => heatmap ? 1.5 + ((d.value || 0) / maxValue) * 7 : 1 + (d.value || 20) / 35)
      .attr('stroke', d => heatmap ? d3.interpolateRgb('#3a6fd8', '#ff5a3c')((d.value || 0) / maxValue) : null)
      .attr('class', d => {
        const s = endId(d.source as any), t = endId(d.target as any)
        const classes = [cycleLinkKeys?.has(linkKey(s, t)) ? 'graph-link--cycle' : '']
        if (pathNodeIds && pathNodeIds.size > 0 && !(pathNodeIds.has(s) && pathNodeIds.has(t))) classes.push('graph-link--dim')
        return classes.filter(Boolean).join(' ')
      })

    const group = root.append('g').selectAll<SVGGElement, SimulationNode>('g').data(nodeData).join('g')
      .attr('class', d => [
        'graph-node',
        blastNodeIds?.has(d.id) ? 'graph-node--blast' : '',
        cycleNodeIds?.has(d.id) ? 'graph-node--cycle' : '',
        selectedId === d.id ? 'graph-node--selected' : '',
        diffNodeIds?.has(d.id) ? 'graph-node--diff' : '',
        compareNodeIds?.has(d.id) ? 'graph-node--compare' : '',
        pathNodeIds && pathNodeIds.size > 0 && !pathNodeIds.has(d.id) ? 'graph-node--dim' : '',
        extraNodeClass ? extraNodeClass(d.id) : '',
      ].filter(Boolean).join(' '))
      .on('click', (_, d) => onSelect?.(d))

    group.append('circle').attr('r', 23).attr('class', d => `graph-node__circle graph-node__circle--${d.health || d.group}`)
    group.append('text').attr('y', 39).attr('text-anchor', 'middle').text(d => d.id)
    group.append('text').attr('text-anchor', 'middle').attr('dy', '.35em').attr('class', 'graph-node__initial').text(d => d.id.slice(0, 2).toUpperCase())
    group.filter(d => !!annotatedNodeIds?.has(d.id)).append('text')
      .attr('x', 16).attr('y', -14).attr('class', 'graph-node__note').attr('text-anchor', 'middle').text('📝')

    const drag = d3.drag<SVGGElement, SimulationNode>()
      .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(.3).restart(); d.fx = d.x; d.fy = d.y })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
      .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null })
    group.call(drag)

    const marker = root.append('circle').attr('r', 7).attr('class', 'graph-trace-marker').attr('opacity', 0)
    markerRef.current = marker.node()

    simulation.on('tick', () => {
      link.attr('x1', d => (d.source as SimulationNode).x || 0).attr('y1', d => (d.source as SimulationNode).y || 0)
        .attr('x2', d => (d.target as SimulationNode).x || 0).attr('y2', d => (d.target as SimulationNode).y || 0)
      group.attr('transform', d => `translate(${d.x},${d.y})`)
      posRef.current.clear()
      nodeData.forEach(d => posRef.current.set(d.id, { x: d.x || 0, y: d.y || 0 }))
    })

    return () => { simulation.stop(); if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [nodes, links, onSelect, hiddenGroups, blastNodeIds, cycleNodeIds, cycleLinkKeys, selectedId, diffNodeIds, annotatedNodeIds, heatmap, pathNodeIds, extraNodeClass, compareNodeIds])

  useImperativeHandle(ref, () => ({
    playTrace(path, onDone) {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      const marker = markerRef.current
      if (!marker || path.length < 2) { onDone?.(); return }
      d3.select(marker).attr('opacity', 1)
      const segmentMs = 550
      let seg = 0
      const runSegment = (start: number) => {
        const from = posRef.current.get(path[seg])
        const to = posRef.current.get(path[seg + 1])
        if (!from || !to) { finish(); return }
        const frame = (ts: number) => {
          const t = Math.min(1, (ts - start) / segmentMs)
          marker.setAttribute('cx', String(from.x + (to.x - from.x) * t))
          marker.setAttribute('cy', String(from.y + (to.y - from.y) * t))
          if (t < 1) { animRef.current = requestAnimationFrame(frame) }
          else {
            seg += 1
            if (seg >= path.length - 1) finish()
            else animRef.current = requestAnimationFrame(ts2 => runSegment(ts2))
          }
        }
        animRef.current = requestAnimationFrame(frame)
      }
      const finish = () => { d3.select(marker).attr('opacity', 0); onDone?.() }
      animRef.current = requestAnimationFrame(ts => runSegment(ts))
    },
    exportPng(filename = 'topologia.png') {
      const svgEl = svgRef.current
      if (!svgEl) return
      const width = svgEl.clientWidth || 800, height = 440
      const clone = svgEl.cloneNode(true) as SVGSVGElement
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      clone.setAttribute('width', String(width))
      clone.setAttribute('height', String(height))
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%'); bg.setAttribute('fill', '#0c1420')
      clone.insertBefore(bg, clone.firstChild)
      const svgString = new XMLSerializer().serializeToString(clone)
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          canvas.toBlob(pngBlob => {
            if (!pngBlob) return
            const a = document.createElement('a')
            a.href = URL.createObjectURL(pngBlob)
            a.download = filename
            a.click()
            URL.revokeObjectURL(a.href)
          })
        }
        URL.revokeObjectURL(url)
      }
      img.src = url
    },
  }))

  return <svg ref={svgRef} className="force-graph" role="img" aria-label="Grafo interativo; arraste os nós e use o scroll para zoom" />
})
