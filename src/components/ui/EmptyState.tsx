import { SearchX } from 'lucide-react'

export function EmptyState({ message = 'Nenhum resultado encontrado.' }: { message?: string }) {
  return <div className="empty-state"><SearchX size={32}/><strong>{message}</strong><span>Tente ajustar os filtros selecionados.</span></div>
}
