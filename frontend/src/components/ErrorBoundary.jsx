/**
 * ErrorBoundary — wraps each Cesium layer so a crash in one layer
 * doesn't take down the entire globe UI.
 */
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', this.props.name || 'Layer', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      // Silent fallback — don't render anything visible for map layers;
      // just log and recover gracefully.
      if (this.props.silent) return null;

      return (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50
                     bg-red-900/80 border border-red-500/70 text-red-300
                     text-xs font-mono px-4 py-2 rounded max-w-xs text-center"
        >
          &#x26A0; {this.props.name || 'Layer'} error — reload to retry
          <br />
          <span className="text-red-400/70 text-[10px]">{this.state.error.message}</span>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
