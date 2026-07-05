import { X } from 'lucide-react'
import type { ReactNode } from 'react'

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="modal" onMouseDown={event => event.stopPropagation()}>
      <header><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={19}/></button></header>
      {children}
    </section>
  </div>
}
