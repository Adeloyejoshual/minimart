/**
 * Floating toast notification.
 */
export default function Toast({ type = "success", message }) {
  if (!message) return null;

  return (
    <div
      className={`settings-toast settings-toast--${type}`}
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
    >
      <span className="settings-toast__icon" aria-hidden="true">
        {type === "success" ? "✓" : "✕"}
      </span>
      {message}
    </div>
  );
}