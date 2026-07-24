// src/pages/Profile/components/ErrorBoundary.jsx
import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { error: null, info: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] Caught:", error, info);
    this.setState({ info });
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding      : "12px 16px",
            border       : "1.5px solid #f87171",
            borderRadius : 8,
            background   : "#fff1f1",
            marginBottom : 8,
            fontSize     : 13,
          }}
        >
          <strong style={{ color: "#991b1b" }}>
            ⚠️ Render error — {this.props.label ?? "component"}
          </strong>
          {/* Shows the REAL error message */}
          <pre
            style={{
              marginTop  : 6,
              padding    : "8px 10px",
              background : "#fef2f2",
              borderRadius: 4,
              fontSize   : 11,
              color      : "#7f1d1d",
              whiteSpace : "pre-wrap",
              wordBreak  : "break-all",
            }}
          >
            {this.state.error?.message}
            {"\n\n"}
            {this.state.info?.componentStack}
          </pre>
          <button
            style={{
              marginTop    : 8,
              padding      : "4px 12px",
              background   : "#ef4444",
              color        : "#fff",
              border       : "none",
              borderRadius : 4,
              cursor       : "pointer",
              fontSize     : 12,
            }}
            onClick={() => this.setState({ error: null, info: null })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}