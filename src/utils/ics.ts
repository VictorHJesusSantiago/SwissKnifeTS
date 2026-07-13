export interface IcsEvent {
  title: string
  date: string // YYYY-MM-DD
  description?: string
}

function toIcsDate(date: string) {
  return date.replace(/-/g, '')
}

export function exportIcs(filename: string, events: IcsEvent[]) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//OpsPhere//PT-BR//EN']
  events.forEach((ev, i) => {
    lines.push(
      'BEGIN:VEVENT',
      `UID:opsphere-${Date.now()}-${i}@local`,
      `DTSTART;VALUE=DATE:${toIcsDate(ev.date)}`,
      `SUMMARY:${ev.title}`,
      ev.description ? `DESCRIPTION:${ev.description}` : '',
      'END:VEVENT',
    )
  })
  lines.push('END:VCALENDAR')
  const blob = new Blob([lines.filter(Boolean).join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`
  a.click()
  URL.revokeObjectURL(url)
}
