// src/components/ProgressOverlay.jsx
import { useState, useEffect, useRef } from "react";
import "../styles/ProgressOverlay.css";

/* ── Step definitions with SVG icons ─────────────────────────── */
const STEPS = [
  {
    key   : "compressing",
    label : "Compressing images…",
    range : [0, 15],
    icon  : (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3"/>
        <path d="M8 12h8M12 8v8"/>
        <circle cx="12" cy="12" r="3" fill="currentColor" opacity=".15"/>
      </svg>
    ),
  },
  {
    key   : "uploading",
    label : "Uploading images…",
    range : [15, 50],
    icon  : (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    ),
  },
  {
    key   : "saving",
    label : "Saving product details…",
    range : [50, 70],
    icon  : (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
    ),
  },
  {
    key   : "activating",
    label : "Activating listing…",
    range : [70, 85],
    icon  : (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
  },
  {
    key   : "payment",
    label : "Setting up payment…",
    range : [85, 95],
    icon  : (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2"/>
        <line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    ),
  },
  {
    key   : "finalizing",
    label : "Almost done…",
    range : [95, 100],
    icon  : (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    ),
  },
];

/* ── Dot check SVG ────────────────────────────────────────────── */
const CheckIcon = () => (
  <svg viewBox="0 0 12 10" width="10" height="10" fill="none"
       stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 5 4.5 8.5 11 1"/>
  </svg>
);

/* ── Component ────────────────────────────────────────────────── */
export default function ProgressOverlay({
  visible = false,
  step    = "compressing",
  isPaid  = false,
}) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const animRef = useRef(null);

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);
  const currentStep      = STEPS[currentStepIndex] ?? STEPS[0];

  /* ── Smooth progress animation ── */
  useEffect(() => {
    if (!visible) {
      setDisplayProgress(0);
      return;
    }

    const target = currentStep.range[1];
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const animate = () => {
      setDisplayProgress((prev) => {
        const diff = target - prev;
        if (Math.abs(diff) < 0.5) return target;
        animRef.current = requestAnimationFrame(animate);
        return prev + diff * 0.08;
      });
    };

    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [visible, currentStep]);

  /* ── Lock body scroll while overlay is open ── */
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [visible]);

  if (!visible) return null;

  const visibleSteps = isPaid
    ? STEPS
    : STEPS.filter((s) => s.key !== "payment");

  const percent = Math.min(Math.round(displayProgress), 100);

  return (
    <div
      className="po"
      role="dialog"
      aria-modal="true"
      aria-label="Uploading product"
      aria-live="polite"
    >
      <div className="po-backdrop" aria-hidden="true"/>

      <div className="po-card">
        {/* Animated step icon */}
        <div className="po-icon" key={currentStep.key} aria-hidden="true">
          {currentStep.icon}
        </div>

        {/* Status label */}
        <h3 className="po-label">{currentStep.label}</h3>

        {/* Progress bar */}
        <div
          className="po-bar-track"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Upload progress"
        >
          <div
            className="po-bar-fill"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Percentage */}
        <span className="po-percent" aria-hidden="true">
          {percent}%
        </span>

        {/* Step dots */}
        <div className="po-steps" role="list" aria-label="Steps">
          {visibleSteps.map((s) => {
            const stepIdx  = STEPS.indexOf(s);
            const isActive = stepIdx === currentStepIndex;
            const isDone   = stepIdx <  currentStepIndex;
            return (
              <div
                key={s.key}
                role="listitem"
                className={[
                  "po-dot",
                  isDone   ? "po-dot--done"   : "",
                  isActive ? "po-dot--active" : "",
                ].filter(Boolean).join(" ")}
                aria-label={`${s.label} ${isDone ? "(done)" : isActive ? "(in progress)" : ""}`}
                title={s.label}
              >
                {isDone ? <CheckIcon /> : (
                  <svg viewBox="0 0 8 8" width="6" height="6" aria-hidden="true">
                    <circle cx="4" cy="4" r="3" fill="currentColor"/>
                  </svg>
                )}
              </div>
            );
          })}
        </div>

        {/* Hint */}
        <p className="po-hint">
          <svg viewBox="0 0 20 20" width="13" height="13" fill="none"
               stroke="currentColor" strokeWidth="1.6"
               strokeLinecap="round" strokeLinejoin="round"
               aria-hidden="true">
            <circle cx="10" cy="10" r="8"/>
            <line x1="10" y1="9" x2="10" y2="14"/>
            <circle cx="10" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
          </svg>
          Please don&apos;t close this page
        </p>
      </div>
    </div>
  );
}