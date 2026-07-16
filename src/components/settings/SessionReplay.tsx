import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { useAudit } from '../../context/AuditContext'

export function SessionReplay() {
  const { entries } = useAudit()
  const ordered = [...entries].reverse()
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!playing) { if (timer.current) window.clearInterval(timer.current); return }
    timer.current = window.setInterval(() => {
      setIndex(i => {
        if (i >= ordered.length - 1) { setPlaying(false); return i }
        return i + 1
      })
    }, 1200)
    return () => { if (timer.current) window.clearInterval(timer.current) }
  }, [playing, ordered.length])

  if (ordered.length === 0) return <div className="empty-compact"><span>Nenhuma atividade registrada nesta sessão para reproduzir.</span></div>

  return <div className="session-replay">
    <div className="session-replay__controls">
      <button className="button button--tiny" onClick={() => setPlaying(v => !v)}>{playing ? <Pause size={13}/> : <Play size={13}/>} {playing ? 'Pausar' : 'Reproduzir'}</button>
      <button className="button button--tiny" onClick={() => { setIndex(0); setPlaying(false) }}><RotateCcw size={13}/> Reiniciar</button>
      <span>{index + 1} / {ordered.length}</span>
    </div>
    <div className="session-replay__track">
      <input type="range" min={0} max={ordered.length - 1} value={index} onChange={e => { setIndex(Number(e.target.value)); setPlaying(false) }}/>
    </div>
    <div className="session-replay__timeline">
      {ordered.slice(0, index + 1).map((entry, i) => <div key={entry.id} className={i === index ? 'session-replay__item is-current' : 'session-replay__item'}>
        <time>{entry.time}</time>
        <strong>{entry.action}{entry.actor ? ` · ${entry.actor}` : ''}</strong>
        <span>{entry.detail}</span>
      </div>)}
    </div>
  </div>
}
