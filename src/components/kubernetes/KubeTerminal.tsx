import { TerminalSquare } from 'lucide-react'
import { useRef, useState } from 'react'
import { kubectlResponses } from '../../data/kubernetesExtra'

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

export function KubeTerminal() {
  const [history, setHistory] = useState<HistoryLine[]>([
    { command: 'kubectl get nodes', output: kubectlResponses['kubectl get nodes'] },
  ])
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const run = () => {
    if (!input.trim()) return
    const output = resolve(input)
    setHistory(list => [...list, { command: input.trim(), output }])
    setInput('')
    requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight })
  }

  return (
    <div className="kube-terminal">
      <div className="kube-terminal__head"><TerminalSquare size={14}/> kubectl-shell</div>
      <div className="kube-terminal__body" ref={scrollRef}>
        {history.map((line, i) => (
          <div className="kube-terminal__entry" key={i}>
            <div className="kube-terminal__prompt"><span>$</span> {line.command}</div>
            <pre>{line.output}</pre>
          </div>
        ))}
      </div>
      <div className="kube-terminal__input">
        <span>$</span>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') run() }}
          placeholder="kubectl get pods"
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    </div>
  )
}
