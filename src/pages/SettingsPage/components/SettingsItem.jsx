/**
 * Generic row inside a SettingsSection card.
 *
 * Props:
 *   icon      — emoji or SVG element
 *   label     — main text
 *   sublabel  — secondary text (optional)
 *   badge     — small pill (e.g. "Coming Soon")
 *   onClick   — makes the row a button
 *   href      — makes the row a link
 *   control   — right-side control (toggle, select, etc.)
 *   danger    — red styling
 *   disabled  — greyed out + non-interactive
 *   last      — suppresses the bottom divider
 */
import { Link } from "react-router-dom";

export default function SettingsItem({
  icon,
  label,
  sublabel,
  badge,
  onClick,
  href,
  to,
  control,
  danger    = false,
  disabled  = false,
  last      = false,
}) {
  const cls = [
    "settings-item",
    danger   && "settings-item--danger",
    disabled && "settings-item--disabled",
    last     && "settings-item--last",
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      {icon && (
        <span className="settings-item__icon" aria-hidden="true">
          {icon}
        </span>
      )}

      <div className="settings-item__body">
        <span className="settings-item__label">{label}</span>
        {sublabel && (
          <span className="settings-item__sublabel">{sublabel}</span>
        )}
      </div>

      {badge && (
        <span className="settings-item__badge">{badge}</span>
      )}

      {control && (
        <div className="settings-item__control" onClick={(e) => e.stopPropagation()}>
          {control}
        </div>
      )}

      {!control && (onClick || href || to) && !disabled && (
        <span className="settings-item__chevron" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      )}
    </>
  );

  /* External link */
  if (href) {
    return (
      <a
        className={cls}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {inner}
      </a>
    );
  }

  /* Internal router link */
  if (to) {
    return (
      <Link className={cls} to={to}>
        {inner}
      </Link>
    );
  }

  /* Button */
  if (onClick) {
    return (
      <button
        type="button"
        className={cls}
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
      >
        {inner}
      </button>
    );
  }

  /* Static row (has a control but no tap action) */
  return <div className={cls}>{inner}</div>;
}