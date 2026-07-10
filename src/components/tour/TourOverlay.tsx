import { useEffect, useState } from 'react'
import { useTour } from '../../context/TourContext'
import '../../styles/tour.css'

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

function measure(target: string): Rect | null {
  const el = document.querySelector(target)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

export function TourOverlay() {
  const { active, currentStep, stepIndex, steps, next, prev, stop } = useTour()
  const [rect, setRect] = useState<Rect | null>(null)

  useEffect(() => {
    if (!active || !currentStep) {
      setRect(null)
      return
    }
    const update = () => setRect(measure(currentStep.target))
    update()
    const raf = requestAnimationFrame(update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [active, currentStep, stepIndex])

  if (!active || !currentStep) return null

  const padding = 8
  const highlightStyle = rect ? {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  } : { top: -9999, left: -9999, width: 0, height: 0 }

  const cardWidth = 320
  const gap = 14
  let cardTop = rect ? rect.top + rect.height + gap : window.innerHeight / 2 - 80
  let cardLeft = rect ? Math.min(Math.max(rect.left, 12), window.innerWidth - cardWidth - 12) : window.innerWidth / 2 - cardWidth / 2

  if (rect && cardTop + 220 > window.innerHeight) {
    cardTop = Math.max(rect.top - 220 - gap, 12)
  }

  const isLast = stepIndex === steps.length - 1

  return <div className="tour-backdrop">
    <div className="tour-highlight" style={highlightStyle}/>
    <div className="tour-card" style={{ top: cardTop, left: cardLeft }}>
      <div className="tour-card__step">Passo {stepIndex + 1} de {steps.length}</div>
      <h3 className="tour-card__title">{currentStep.title}</h3>
      <p className="tour-card__body">{currentStep.body}</p>
      <div className="tour-card__actions">
        <button className="tour-card__skip" onClick={stop}>Pular tour</button>
        <div className="tour-card__actions-right">
          <button className="tour-btn" onClick={prev} disabled={stepIndex === 0}>Anterior</button>
          <button className="tour-btn tour-btn--primary" onClick={next}>{isLast ? 'Concluir' : 'Próximo'}</button>
        </div>
      </div>
    </div>
  </div>
}
