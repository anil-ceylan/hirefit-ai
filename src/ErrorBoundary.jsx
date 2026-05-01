import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[AppError]", error?.message || error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "50vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            color: "#e2e8f0",
            background: "#0f172a",
            fontFamily: "system-ui,sans-serif",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800 }}>Something went wrong.</div>
          <div style={{ fontSize: 14, color: "#94a3b8", textAlign: "center", maxWidth: 420 }}>
            Refresh the page. If it keeps happening, try again in a few minutes.
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              padding: "10px 16px",
              borderRadius: 10,
              border: "none",
              background: "#6366f1",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
