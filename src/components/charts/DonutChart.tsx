export function DonutChart({ value, label, color = '#6ce5c4' }: { value: number; label: string; color?: string }) {
  const circumference = 2 * Math.PI * 44
  return <div className="donut-wrap">
    <svg viewBox="0 0 104 104" className="donut">
      <circle cx="52" cy="52" r="44" className="donut__track"/>
      <circle cx="52" cy="52" r="44" className="donut__value" style={{stroke:color, strokeDasharray:`${circumference * value/100} ${circumference}`}}/>
    </svg>
    <div><strong>{value}%</strong><span>{label}</span></div>
  </div>
}
