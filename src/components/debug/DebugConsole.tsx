import { useEffect, useRef, useState } from 'react'
import { Terminal } from 'lucide-react'
import { useUIPrefs } from '../../context/UIPrefsContext'
import { APP_VERSION } from '../../data/changelog'
import '../../styles/debug-console.css'

export function DebugConsole() {
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<string[]>([`OpsPhere debug console v${APP_VERSION}. Digite "help" para comandos.`])
  const [input, setInput] = useState('')
  const { verbose, toggleVerbose } = useUIPrefs()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') { e.preventDefault(); setOpen(v => !v) }
      if (e.key === 'Escape' && open) setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 10) }, [open])

  const run = (cmdRaw: string) => {
    const cmd = cmdRaw.trim()
    if (!cmd) return
    const out: string[] = [`> ${cmd}`]
    if (cmd === 'help') out.push('Comandos: help, --version, --verbose, --reset-tour, --clear-cache, --list-keys, clear')
    else if (cmd === '--version') out.push(`OpsPhere v${APP_VERSION}`)
    else if (cmd === '--verbose') { toggleVerbose(); out.push(`Modo verbose ${!verbose ? 'ativado' : 'desativado'}.`) }
    else if (cmd === '--reset-tour') { localStorage.setItem('opsphere-tour-seen', 'false'); out.push('Tour guiado será reexibido na próxima visão geral.') }
    else if (cmd === '--clear-cache') { Object.keys(localStorage).filter(k => k.startsWith('opsphere-')).forEach(k => localStorage.removeItem(k)); out.push('Cache local limpo. Recarregue a página.') }
    else if (cmd === '--list-keys') out.push(...Object.keys(localStorage).filter(k => k.startsWith('opsphere-')))
    else if (cmd === 'clear') { setHistory([]); setInput(''); return }
    else out.push(`Comando não encontrado: "${cmd}". Digite "help".`)
    setHistory(h => [...h, ...out])
    setInput('')
  }

  if (!open) return null

  return <div className="debug-console">
    <header><Terminal size={14}/> <span>Console de depuração</span><button onClick={() => setOpen(false)}>×</button></header>
    <div className="debug-console__log">{history.map((line, i) => <div key={i}>{line}</div>)}</div>
    <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && run(input)} placeholder="Digite um comando (--verbose, --reset-tour...)"/>
  </div>
}
