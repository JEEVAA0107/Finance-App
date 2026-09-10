import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'var(--bg-app, #f8fafc)',
          color: 'var(--text-primary, #0f172a)',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
            borderRadius: '16px',
            padding: '32px 24px',
            maxWidth: '440px',
            width: '100%',
            boxShadow: '0 10px 25px rgba(0,0,0,0.08)'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 8px 0' }}>Something went wrong</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)', margin: '0 0 20px 0' }}>
              A temporary display error occurred. Click below to reload and restore the screen.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/';
                }}
                style={{
                  background: 'var(--primary-600, #4f46e5)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Reload Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
