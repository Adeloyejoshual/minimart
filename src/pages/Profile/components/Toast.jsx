// src/pages/Profile/components/Toast.jsx
import { memo } from "react";
import "./Toast.css";

const ICONS = {
  success: "✓",
  error  : "✕",
  warning: "⚠",
  info   : "ℹ",
};

const Toast = memo(({ toasts = [] }) => {
  if (!toasts.length) return null;

  return (
    <div className="toast-container" role="region" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast--${t.type || "info"}${
            t.onClick ? " toast--clickable" : ""
          }`}
          onClick={t.onClick}
          role={t.type === "error" ? "alert" : "status"}
        >
          <span className="toast__icon" aria-hidden="true">
            {ICONS[t.type] || ICONS.info}
          </span>
          <span className="toast__message">{t.message}</span>
        </div>
      ))}
    </div>
  );
});

Toast.displayName = "Toast";
export default Toast;