import { Component, type ReactNode } from 'react'

function appendErrorToStorage(message: string, stack?: string) {
  try {
    const key = 'opsphere-error-log'
    const list = JSON.parse(localStorage.getItem(key) || '[]')
    const entry = { id: `e${Date.now()}${Math.random().toString(36).slice(2, 6)}`, message, stack, time: new Date().toLocaleString('pt-BR') }
    localStorage.setItem(key, JSON.stringify([entry, ...list].slice(0, 100)))
  } catch { /* ignore */ }
}

interface State { hasError: boolean }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    appendErrorToStorage(error.message, error.stack)
  }

  render() {
    if (this.state.hasError) {
      return <div className="page-loader">
        <span>Algo deu errado ao renderizar este módulo. O erro foi registrado em Configurações → Saúde do app.</span>
        <button className="button button--primary" onClick={() => this.setState({ hasError: false })}>Tentar novamente</button>
      </div>
    }
    return this.props.children
  }
}
