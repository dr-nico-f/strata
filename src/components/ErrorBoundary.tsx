import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0e1116",
          color: "#e6e8ec",
          fontFamily: "system-ui, sans-serif",
          padding: 32,
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Something went wrong</h1>
        <p style={{ color: "#9aa3b2", maxWidth: 480, lineHeight: 1.6 }}>
          Strata encountered an unexpected error. Try reloading the page.
        </p>
        <pre
          style={{
            marginTop: 16,
            padding: 16,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 8,
            fontSize: 12,
            maxWidth: 600,
            overflow: "auto",
            color: "#ff7a90",
          }}
        >
          {this.state.error.message}
        </pre>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 20,
            padding: "10px 24px",
            fontSize: 14,
            background: "#f5b942",
            color: "#0e1116",
            border: "none",
            borderRadius: 6,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
