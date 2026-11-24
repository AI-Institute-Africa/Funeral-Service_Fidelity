import { Component, type ErrorInfo, type ReactNode } from 'react'

type State = {
  hasError: boolean
  error?: Error | null
}

/** Last-resort guard so a render error shows a recovery screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack)
  }

  resetError = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const errorMessage = this.state.error?.message

    return (
      <main className="status-page container" role="alert" style={{ maxWidth: '640px', margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
        <p className="eyebrow" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: '#c0392b', fontWeight: 600 }}>
          System Recovery
        </p>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: '0.75rem 0' }}>We encountered an issue loading this view.</h1>
        <p className="muted" style={{ color: '#666', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          Our services remain safe and operational. You can reload this view or navigate directly to your portal or home page.
        </p>

        {errorMessage && (
          <details style={{ textAlign: 'left', background: '#f8f9fa', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#4a5568' }}>Technical details</summary>
            <pre style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#c0392b', fontSize: '0.75rem' }}>
              {errorMessage}
            </pre>
          </details>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn--primary"
            onClick={this.resetError}
            style={{ padding: '0.625rem 1.25rem', borderRadius: '6px', background: '#b91c1c', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: '0.625rem 1.25rem', borderRadius: '6px', background: '#005a36', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            Refresh page
          </button>
          <a
            href="/provider-portal"
            style={{ padding: '0.625rem 1.25rem', borderRadius: '6px', background: '#eef3ef', color: '#005a36', textDecoration: 'none', fontWeight: 600, display: 'inline-block' }}
          >
            Fidelity Management Portal
          </a>
          <a
            href="/"
            style={{ padding: '0.625rem 1.25rem', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#334155', textDecoration: 'none', fontWeight: 600, display: 'inline-block' }}
          >
            Customer Home
          </a>
        </div>
      </main>
    )
  }
}
