import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Skilled Crafting app render error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="sc-recovery-screen">
        <div className="sc-recovery-card">
          <h1>Application Display Error</h1>
          <p>The app loaded, but one page component caused a display error. This recovery screen prevents a blank white page.</p>
          <pre>{String(this.state.error?.message || this.state.error || 'Unknown error')}</pre>
          <button type="button" onClick={() => window.location.assign('/')}>Return Home</button>
        </div>
      </div>
    );
  }
}
