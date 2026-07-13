import { Printer } from 'lucide-react'

export function PrintButton({ label = 'Exportar PDF / Imprimir' }: { label?: string }) {
  return <button className="button button--compact print-only-toolbar" onClick={() => window.print()}>
    <Printer size={14}/> {label}
  </button>
}
