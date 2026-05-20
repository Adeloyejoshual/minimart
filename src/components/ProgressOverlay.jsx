import { useState, useEffect, useRef } from "react";
import "../styles/ProgressOverlay.css";

const STEPS = [
  { key: "compressing", label: "Compressing images…",      icon: "🗜️",  range: [0, 15]  },
  { key: "uploading",   label: "Uploading images…",        icon: "📤",  range: [15, 50] },
  { key: "saving",      label: "Saving product details…",  icon: "💾",  range: [50, 70] },
  { key: "activating",  label: "Activating listing…",      icon: "🚀",  range: [70, 85] },
  { key: "payment",     label: "Setting up payment…",      icon: "💳",  range: [85, 95] },
  { key: "finalizing",  label: "Almost done…",             icon: "✨",  range: [95, 100]},
];

export default function ProgressOverlay({
  visible = false,
  step    = "compressing",  // current step key
  isPaid  = false,          // whether this is a paid listing
}) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const animRef = useRef(null);

  // Find the current step config
  const currentStepIndex = STEPS.findIndex((s) => s.key === step);
  const currentStep      = STEPS[currentStepIndex] ?? STEPS[0];

  // Animate progress bar smoothly toward the step target
  useEffect(() => {
    if (!visible) {
      setDisplayProgress(0);
      return;
    }

    const target = currentStep.range[1];

    // Clear any running animation
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const animate = () => {
      setDisplayProgress((prev) => {
        const diff = target - prev;
        if (Math.abs(diff) < 0.5) return target;
        const next = prev + diff * 0.08; // ease-out
        animRef.current = requestAnimationFrame(animate);
        return next;
      });
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [visible, currentStep]);

  if (!visible) return null;

  // Filter out payment step for free listings
  const visibleSteps = isPaid
    ? STEPS
    : STEPS.filter((s) => s.key !== "payment");

  return (
    <div className="progress-overlay" aria-live="polite" role="alert">
      <div className="progress-overlay-backdrop" />

      <div className="progress-overlay-card">
        {/* Animated icon */}
        <div className="progress-overlay-icon" key={currentStep.key}>
          {currentStep.icon}
        </div>

        {/* Status label */}
        <h3 className="progress-overlay-label">
          {currentStep.label}
        </h3>

        {/* Progress bar */}
        <div className="progress-overlay-bar-track">
          <div
            className="progress-overlay-bar-fill"
            style={{ width: `${Math.min(displayProgress, 100)}%` }}
          />
        </div>

        {/* Percentage */}
        <span className="progress-overlay-percent">
          {Math.round(displayProgress)}%
        </span>

        {/* Step dots */}
        <div className="progress-overlay-steps">
          {visibleSteps.map((s, i) => {
            const stepIdx   = STEPS.indexOf(s);
            const isActive  = stepIdx === currentStepIndex;
            const isDone    = stepIdx < currentStepIndex;
            return (
              <div
                key={s.key}
                className={
                  "progress-step-dot" +
                  (isDone   ? " done"   : "") +
                  (isActive ? " active" : "")
                }
                title={s.label}
              >
                {isDone ? "✓" : i + 1}
              </div>
            );
          })}
        </div>

        {/* Helper text */}
        <p className="progress-overlay-hint">
          Please don&apos;t close this page
        </p>
      </div>
    </div>
  );
}