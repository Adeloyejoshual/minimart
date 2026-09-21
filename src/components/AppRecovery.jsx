/**
 * src/components/AppRecovery.jsx
 * Prevents Blank Screen when returning to Chrome after hours
 * Handles Offline / No-Data mode gracefully
 */

import React, { useState, useEffect } from "react";

/* ════════════════════════════════════════════════════════════
   1. REACT ERROR BOUNDARY
════════════════════════════════════════════════════════════ */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("App Crash Caught:", error);

    // Auto-reload only if online AND it's a chunk/script load error
    if (
      navigator.onLine &&
      (error?.name === "ChunkLoadError" ||
        error?.message?.includes("dynamically imported module") ||
        error?.message?.includes("Loading chunk") ||
        error?.message?.includes("Failed to fetch"))
    ) {
      window.location.reload();
    }
  }

  handleReload = () => {
    if (navigator.onLine) {
      window.location.reload();
    } else {
      alert("Please turn on Mobile Data or Wi-Fi and try again.");
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.icon}>📡</div>
            <h3 style={styles.title}>
              {navigator.onLine ? "Session Needs Refresh" : "You Are Offline"}
            </h3>
            <p style={styles.sub}>
              {navigator.onLine
                ? "Tap below to reload the latest version of the app."
                : "Please turn on Mobile Data or Wi-Fi, then tap Retry."}
            </p>
            <button type="button" style={styles.btn} onClick={this.handleReload}>
              {navigator.onLine ? "Refresh Page" : "Retry Connection"}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/* ════════════════════════════════════════════════════════════
   2. TAB-WAKE + OFFLINE LISTENER HOOK
════════════════════════════════════════════════════════════ */
export function useTabWakeListener() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  useEffect(() => {
    let lastActive = Date.now();

    const handleOffline = () => setIsOffline(true);

    const handleOnline = () => {
      setIsOffline(false);
      // Soft re-sync without full reload when data comes back
      window.dispatchEvent(new Event("tab-wake"));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const inactiveMins = (Date.now() - lastActive) / (1000 * 60);

        // Away > 45 min AND online → hard reload to clear dead JS state
        if (inactiveMins > 45 && navigator.onLine) {
          window.location.reload();
        } else if (navigator.onLine) {
          // Soft wake — let components re-fetch stale data
          window.dispatchEvent(new Event("tab-wake"));
        }
      } else {
        lastActive = Date.now();
      }
    };

    // BFCache recovery (mobile Chrome back/forward freeze)
    const handlePageShow = (e) => {
      if (e.persisted && navigator.onLine) {
        window.location.reload();
      }
    };

    // Global chunk-load failure catcher
    const handleGlobalError = (e) => {
      const msg = e?.message || "";
      if (
        navigator.onLine &&
        (msg.includes("dynamically imported module") ||
          msg.includes("Loading chunk") ||
          msg.includes("Failed to fetch dynamically imported module"))
      ) {
        window.location.reload();
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("error", handleGlobalError, true);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("error", handleGlobalError, true);
    };
  }, []);

  return { isOffline };
}

/* ════════════════════════════════════════════════════════════
   3. FLOATING OFFLINE BANNER
════════════════════════════════════════════════════════════ */
export function OfflineBanner() {
  const { isOffline } = useTabWakeListener();

  if (!isOffline) return null;

  return (
    <div style={styles.offlineBanner} role="status" aria-live="polite">
      <span>⚡ You are offline — check Mobile Data or Wi-Fi</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   STYLES
════════════════════════════════════════════════════════════ */
const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    backgroundColor: "#f8f9fa",
    padding: "20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, Roboto, sans-serif",
  },
  card: {
    background: "#ffffff",
    padding: "28px 20px",
    borderRadius: "18px",
    textAlign: "center",
    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
    maxWidth: "340px",
    width: "100%",
  },
  icon: {
    fontSize: "40px",
    marginBottom: "12px",
  },
  title: {
    margin: "0 0 8px",
    fontSize: "18px",
    fontWeight: "800",
    color: "#111111",
  },
  sub: {
    margin: "0 0 20px",
    fontSize: "13px",
    color: "#666666",
    lineHeight: "1.45",
  },
  btn: {
    background: "#ff6000",
    color: "#ffffff",
    border: "none",
    padding: "12px 24px",
    borderRadius: "999px",
    fontWeight: "700",
    fontSize: "14px",
    cursor: "pointer",
    width: "100%",
    fontFamily: "inherit",
  },
  offlineBanner: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99999,
    backgroundColor: "#18181b",
    color: "#ffffff",
    textAlign: "center",
    padding: "10px 16px",
    paddingTop: "max(10px, env(safe-area-inset-top, 10px))",
    fontSize: "13px",
    fontWeight: "600",
    boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};