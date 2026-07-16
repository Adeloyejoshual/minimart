// src/pages/Profile/components/EmptyState.jsx
import "./EmptyState.css";

export default function EmptyState({
  icon,
  title,
  description,
  action,
  onAction,
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{icon}</div>
      <h3 className="empty-state__title">{title}</h3>
      <p className="empty-state__desc">{description}</p>
      {action && (
        <button className="btn btn--primary" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}