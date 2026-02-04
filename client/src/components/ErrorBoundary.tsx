import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="max-w-2xl mx-auto p-8 rounded-xl border-2 border-red-500/50 bg-red-950/30 text-red-200">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Something went wrong</h2>
          <pre className="text-sm whitespace-pre-wrap break-words mb-4 font-mono bg-black/30 p-4 rounded">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-medium"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
