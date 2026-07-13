import { Download } from 'lucide-react'
import { exportCsv } from '../../utils/exportCsv'

export function ExportCsvButton({ filename, rows, label = 'Exportar CSV' }: { filename: string; rows: Record<string, unknown>[]; label?: string }) {
  return <button className="button button--tiny" onClick={() => exportCsv(filename, rows)} disabled={rows.length === 0}>
    <Download size={12}/> {label}
  </button>
}
