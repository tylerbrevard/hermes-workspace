import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { RouteErrorFallback } from '@/components/route-error-fallback'
import { recordDiagnosticEvent } from '@/lib/page-diagnostics'
import { cn } from '@/lib/utils'

type ErrorBoundaryProps = {
  children: ReactNode
  className?: string
  title?: string
  description?: string
}

type ErrorBoundaryState = {
  error: Error | null
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    error: null,
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled UI error', error, errorInfo)
    recordDiagnosticEvent({
      type: 'error',
      name: error.name,
      message: `${error.message}\n${errorInfo.componentStack}`,
    })
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children

    const title = this.props.title ?? 'Something went wrong'
    const description =
      this.props.description ??
      'The chat encountered an unexpected issue. Reload to try again.'

    return (
      <RouteErrorFallback
        className={cn('min-h-0', this.props.className)}
        title={title}
        description={description}
        error={this.state.error}
        reset={this.reset}
      />
    )
  }
}
