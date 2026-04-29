'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: (err: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class AdminErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error('[AdminErrorBoundary]', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return (
        <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={22} />
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-red-900">Something went wrong on this page</h2>
              <p className="mt-1 text-sm text-red-800">
                The page couldn’t finish loading. This is usually temporary — try again or refresh.
              </p>
              {process.env.NODE_ENV !== 'production' && (
                <pre className="mt-3 text-xs text-red-900 bg-red-100 p-2 rounded overflow-x-auto">
                  {this.state.error.message}
                </pre>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={this.reset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700"
                >
                  <RefreshCw size={14} /> Try again
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-white border border-red-300 text-red-700 hover:bg-red-50"
                >
                  Reload page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
