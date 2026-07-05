export function Sparkline({ values, color = '#6ce5c4' }: { values: number[]; color?: string }) {
  const max = Math.max(...values), min = Math.min(...values)
  const points = values.map((v, i) => `${(i/(values.length-1))*100},${36-((v-min)/(max-min||1))*30}`).join(' ')
  return <svg className="sparkline" viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true">
    <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke"/>
  </svg>
}
