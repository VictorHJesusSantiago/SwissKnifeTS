export function BarChart({ data, suffix = '' }: { data: { label: string; value: number; color?: string }[]; suffix?: string }) {
  const max = Math.max(...data.map(item => item.value))
  return <div className="bar-chart">{data.map(item => <div className="bar-chart__row" key={item.label}>
    <span>{item.label}</span><div className="bar-chart__track"><i style={{width:`${item.value/max*100}%`, background:item.color}}/></div><strong>{item.value}{suffix}</strong>
  </div>)}</div>
}
