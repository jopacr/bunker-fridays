import { Component } from "react";

// React error boundaries must be class components. This catches any render-time
// error anywhere below it (including browser autofill / extension conflicts that
// can throw during reconciliation) and shows a recoverable message instead of a
// blank white screen.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // Surfaced in the browser console for debugging; never sent anywhere.
    console.error("UI error caught by boundary:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center", background: "#120f0d", color: "#f4ece1", fontFamily: "'Karla', system-ui, sans-serif" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 4, color: "#e0a449" }}>BUNKER</div>
          <div style={{ fontSize: 15, maxWidth: 360, lineHeight: 1.5 }}>Something hiccuped on screen. Your data is safe on the server. Reload to pick up where you left off.</div>
          <button onClick={() => window.location.reload()} style={{ background: "#e0a449", color: "#120f0d", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}
