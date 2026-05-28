// src/components/terms/ProgressBar.jsx
import { TERMS_CONFIG } from "../../constants/termsConfig";

export default function ProgressBar({ progress }) {
  const safeProgress = Math.min(progress, 100);
  const isDone       = safeProgress >= TERMS_CONFIG.readThreshold;

  return (
    <div
      className="progress-bar"
      role="progressbar"
      aria-valuenow={safeProgress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Terms reading progress"
    >
      {/* Separate track element for cleaner styling */}
      <div className="progress-bar__track">
        <div
          className="progress-bar__fill"
          style={{ width: `${safeProgress}%` }}
        />
      </div>

      <span className="progress-bar__label">
        {isDone
          ? "You have read the terms"
          : `${safeProgress}% — scroll to continue`}
      </span>
    </div>
  );
}