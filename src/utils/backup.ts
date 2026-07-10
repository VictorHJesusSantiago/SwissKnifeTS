const PREFIX = 'opsphere-'

export function exportBackup() {
  const data: Record<string, unknown> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith(PREFIX)) continue
    try { data[key] = JSON.parse(localStorage.getItem(key)!) } catch { /* ignore */ }
  }
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `opsphere-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importBackup(file: File): Promise<void> {
  return file.text().then(text => {
    const parsed = JSON.parse(text) as { data?: Record<string, unknown> }
    if (!parsed.data) throw new Error('Arquivo de backup inválido')
    Object.entries(parsed.data).forEach(([key, value]) => {
      if (key.startsWith(PREFIX)) localStorage.setItem(key, JSON.stringify(value))
    })
  })
}

export function clearAllData() {
  Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k))
}
