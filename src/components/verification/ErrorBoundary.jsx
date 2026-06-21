import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="v-error-page">
        <div className="v-error-page-card">
          <AlertTriangle size={40} className="v-error-page-icon" />
          <h2>Something went wrong</h2>
          <p>{this.state.error.message}</p>
          <button
            className="v-btn v-btn--primary"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={14} /> Reload Page
          </button>
        </div>
      </div>
    );
  }
}