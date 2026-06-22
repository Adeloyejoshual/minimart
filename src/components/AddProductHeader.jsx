// src/components/AddProductHeader.jsx
import React, { useState, useEffect } from "react";
import { useNavigate }                 from "react-router-dom";
import "./AddProductHeader.css";

/* ── Error boundary for the rightAction slot ─────────────────── */
class ActionBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) {
    console.error("[AddProductHeader] rightAction crashed:", err);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/* ── Component ───────────────────────────────────────────────── */
export default function AddProductHeader({
  title       = "Add Product",
  rightAction = null,
  onClearDraft,
}) {
  const navigate      = useNavigate();
  const [confirmClear, setConfirmClear] = useState(false);

  /* ── Safe title ── */
  const safeTitle =
    typeof title === "string" ? title.slice(0, 80).trim() : "Add Product";

  /* ── Scroll-driven shadow ── */
  useEffect(() => {
    const el = document.querySelector(".aph");
    if (!el) return;
    const onScroll = () => {
      el.style.setProperty("--aph-scrolled", window.scrollY > 4 ? "1" : "0");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Back navigation with empty-history guard ── */
  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  };

  /* ── Two-tap clear draft ── */
  const handleClearDraft = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 4_000);
      return;
    }
    setConfirmClear(false);
    onClearDraft();
  };

  return (
    <header
      className="aph"
      role="banner"
      aria-label="Add product navigation"
    >
      {/* Back */}
      <button
        className="aph-back"
        onClick={handleBack}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleBack();
          }
        }}
        aria-label="Go back"
        type="button"
      >
        <svg viewBox="0 0 20 20" width="18" height="18" fill="none"
             aria-hidden="true" focusable="false">
          <path d="M13 4L7 10L13 16"
                stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="aph-back-label">Back</span>
      </button>

      {/* Title */}
      <h2 className="aph-title" title={safeTitle}>
        {safeTitle}
      </h2>

      {/* Right slot */}
      <div className="aph-right">
        <ActionBoundary>
          {rightAction}
        </ActionBoundary>

        {onClearDraft && (
          <button
            className={`aph-clear${confirmClear ? " aph-clear--confirm" : ""}`}
            onClick={handleClearDraft}
            aria-label={
              confirmClear
                ? "Tap again to confirm clearing draft"
                : "Clear saved draft"
            }
            aria-live="polite"
            type="button"
          >
            {confirmClear ? "Sure?" : "Clear draft"}
          </button>
        )}
      </div>
    </header>
  );
}