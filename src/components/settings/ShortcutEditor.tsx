import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { defaultBindings, formatKeyEvent, useShortcutBindings } from '../../hooks/useKeyboardShortcuts'

export function ShortcutEditor() {
  const [bindings, setBindings] = useShortcutBindings()
  const [listening, setListening] = useState<string | null>(null)

  const startCapture = (action: string) => {
    setListening(action)
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      if (['Control', 'Meta', 'Shift', 'Alt'].includes(e.key)) return
      const combo = e.key === '?' ? '?' : formatKeyEvent(e)
      setBindings(list => list.map(b => b.action === action ? { ...b, keys: combo } : b))
      setListening(null)
      window.removeEventListener('keydown', handler, true)
    }
    window.addEventListener('keydown', handler, true)
  }

  const resetAll = () => setBindings(defaultBindings)

  return <div className="shortcut-list">
    {bindings.map(b => <div key={b.action}>
      <button className="button button--tiny shortcut-rebind" onClick={() => startCapture(b.action)}>
        {listening === b.action ? 'Pressione uma tecla…' : b.keys}
      </button>
      <span>{b.description}</span>
    </div>)}
    <button className="link-button" style={{ marginTop: 10 }} onClick={resetAll}><RotateCcw size={12}/> Restaurar padrões</button>
  </div>
}
