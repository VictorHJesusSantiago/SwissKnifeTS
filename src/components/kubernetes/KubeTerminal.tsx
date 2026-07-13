import { Star, TerminalSquare } from 'lucide-react'
import { useRef, useState } from 'react'
import { kubectlResponses } from '../../data/kubernetesExtra'
import { useLocalStorage } from '../../hooks/useLocalStorage'

interface HistoryLine { command: string; output: string }

const resolve = (raw: string): string => {
  const command = raw.trim().replace(/\s+/g, ' ')
  if (!command) return ''
  if (kubectlResponses[command]) return kubectlResponses[command]
  const describeMatch = command.match(/^kubectl describe pod (\S+)/)
  if (describeMatch) {
    return [
      `Name:         ${describeMatch[1]}`,
      'Namespace:    default',
      'Status:       Running',
      'IP:           10.28.9.31',
      'Containers:',
      `  ${describeMatch[1].split('-')[0]}:`,
      '    State:      Running',
      '    Restarts:   0',
      'Events:       <nenhum evento recente>',
    ].join('\n')
  }
  if (!command.startsWith('kubectl')) return `bash: ${command}: comando não reconhecido neste terminal (use comandos kubectl)`
  return `error: comando não encontrado ou não suportado por esta simulação: "${command}"\nTente: kubectl get pods | kubectl get nodes | kubectl describe pod <nome>`
}

interface Props {
  /** Optional namespace/context label shown in the header; purely cosmetic, used for the multi-terminal tabs feature. */
  contextLabel?: string
  /** Storage key suffix so multiple terminal instances can keep independent command history. */
  storageKey?: string
}

export function KubeTerminal({ contextLabel, storageKey = 'default' }: Props) {
  const [history, setHistory] = useState<HistoryLine[]>([
    { command: 'kubectl get nodes', output: kubectlResponses['kubectl get nodes'] },
  ])
  const [input, setInput] = useState('')
  const [commandHistory, setCommandHistory] = useLocalStorage<string[]>(`opsphere-kube-cmdhistory-${storageKey}`, [])
  const [favorites, setFavorites] = useLocalStorage<string[]>('opsphere-kube-favorite-commands', [])
  const [historyCursor, setHistoryCursor] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const execute = (raw: string) => {
    if (!raw.trim()) return
    const command = raw.trim()
    const output = resolve(command)
    setHistory(list => [...list, { command, output }])
    setCommandHistory(list => [command, ...list.filter(c => c !== command)].slice(0, 30))
    setHistoryCursor(null)
    requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight })
  }

  const run = () => { execute(input); setInput('') }

  const navigateHistory = (dir: -1 | 1) => {
    if (commandHistory.length === 0) return
    setHistoryCursor(prev => {
      const next = prev === null ? 0 : prev + dir
      if (next < 0) return prev
      if (next >= commandHistory.length) { setInput(''); return null }
      setInput(commandHistory[next])
      return next
    })
  }

  const toggleFavorite = (command: string) => {
    setFavorites(list => list.includes(command) ? list.filter(c => c !== command) : [command, ...list].slice(0, 15))
  }

  return (
    <div className="kube-terminal">
      <div className="kube-terminal__head"><TerminalSquare size={14}/> kubectl-shell{contextLabel ? <span style={{ marginLeft: 6, opacity: .75 }}>· contexto: {contextLabel}</span> : null}</div>
      {favorites.length > 0 && (
        <div className="kube-terminal__favorites" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
          {favorites.map(f => (
            <button key={f} className="button" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => execute(f)} title="Reexecutar comando favorito">
              <Star size={11} fill="currentColor"/> {f}
            </button>
          ))}
        </div>
      )}
      <div className="kube-terminal__body" ref={scrollRef}>
        {history.map((line, i) => (
          <div className="kube-terminal__entry" key={i}>
            <div className="kube-terminal__prompt" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span><span>$</span> {line.command}</span>
              <button className="icon-button" title="Favoritar comando" onClick={() => toggleFavorite(line.command)}>
                <Star size={13} fill={favorites.includes(line.command) ? 'currentColor' : 'none'}/>
              </button>
            </div>
            <pre>{line.output}</pre>
          </div>
        ))}
      </div>
      <div className="kube-terminal__input">
        <span>$</span>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') run()
            else if (e.key === 'ArrowUp') { e.preventDefault(); navigateHistory(1) }
            else if (e.key === 'ArrowDown') { e.preventDefault(); navigateHistory(-1) }
          }}
          placeholder="kubectl get pods"
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    </div>
  )
}
