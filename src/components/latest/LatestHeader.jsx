// src/components/latest/LatestHeader.jsx
import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/* ── Live clock ──────────────────────────────────────────────── */
function LiveClock() {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("en-NG", {
      hour  : "2-digit",
      minute: "2-digit",
    })
  );

  useEffect(() => {
    const t = setInterval(() => {
      setTime(new Date().toLocaleTimeString("en-NG", {
        hour  : "2-digit",
        minute: "2-digit",
      }));
    }, 30_000); // update every 30s
    return () => clearInterval(t);
  }, []);

  return (
    <span className="lt-clock" aria-label="Current time">
      {time}
    </span>
  );
}

/* ── Component ───────────────────────────────────────────────── */
const LatestHeader = memo(function LatestHeader({ onBack, total }) {
  const navigate = useNavigate();

  return (
    <div className="lt-header">
      {/* Back */}
      <button
        className="lt-back"
        onClick={onBack ?? (() => navigate(-1))}
        aria-label="Go back"
      >
        <svg
          width="18" height="18" viewBox="0 0 24 24"
          fill="currentColor" aria-hidden="true"
        >
          <path d="M20 11H7.83l5.59-5.59L12 4l-8
                   8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
      </button>

      {/* Title */}
      <div className="lt-title-wrap">
        <h1 className="lt-title">New Arrivals</h1>
        <span className="lt-chip">
          <span className="lt-chip-dot" aria-hidden="true" />
          Live Feed
        </span>
      </div>

      {/* Right — clock + share */}
      <div className="lt-header-right">
        <LiveClock />
        <button
          className="lt-share"
          aria-label="Share new arrivals"
          onClick={() => {
            navigator.share?.({
              title: "Loemart New Arrivals",
              text : "See the latest listings on Loemart!",
              url  : window.location.href,
            }).catch(() => {});
          }}
        >
          <svg
            width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="18" cy="5"  r="3" />
            <circle cx="6"  cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.59 13.51l6.83 3.98
                     M15.41 6.51l-6.82 3.98" />
          </svg>
        </button>
      </div>
    </div>
  );
});

export default LatestHeader;