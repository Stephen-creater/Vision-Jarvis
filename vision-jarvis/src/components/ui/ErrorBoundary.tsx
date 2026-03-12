import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex items-center justify-center min-h-[200px] p-8">
          <div className="text-center">
            <div className="text-2xl mb-3 opacity-20">⚠</div>
            <h3 className="text-sm font-medium text-primary mb-1">组件加载出错</h3>
            <p className="text-xs text-muted mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 text-xs bg-secondary border border-primary rounded-lg text-secondary hover:text-primary hover:border-active transition-all"
            >
              重试
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
