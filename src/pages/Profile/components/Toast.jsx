// src/pages/Profile/components/Toast.jsx
import "./Toast.css";
import { Ic } from "./icons";

export default function Toast({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}`}>
          <span className="toast-icon">
            {t.type === "success" ? (
              <Ic.Check />
            ) : t.type === "error" ? (
              <Ic.X />
            ) : (
              <Ic.Info />
            )}
          </span>
          <span className="toast-msg">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}