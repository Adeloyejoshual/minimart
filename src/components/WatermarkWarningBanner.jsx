/**
 * src/components/WatermarkWarningBanner.jsx
 *
 * Renders a yellow (warn) or red (block) banner for watermark
 * detection results returned by the backend.
 *
 * warn  → OCR found competitor text, listing was accepted,
 *          seller is encouraged to replace photos
 * block → screenshot or heavily branded image, listing rejected,
 *          seller must replace photos before resubmitting
 */

export default function WatermarkWarningBanner({
  warnings  = [],
  notice    = "",
  onDismiss,          // undefined → no dismiss button (block verdict)
}) {
  if (!warnings.length) return null;

  const hasBlocked = warnings.some((w) => w.isBlocked);

  return (
    <div
      className={`wm-banner ${hasBlocked ? "wm-banner--block" : "wm-banner--warn"}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="wm-banner__icon" aria-hidden="true">
        {hasBlocked ? "🚫" : "⚠️"}
      </div>

      <div className="wm-banner__body">
        <p className="wm-banner__title">
          {hasBlocked
            ? "Photo rejected — please use original photos"
            : "Photo tip — improve your listing visibility"}
        </p>

        <ul className="wm-banner__list">
          {warnings.map((w, i) => (
            <li key={i}>
              {w.imageIndex !== null && w.imageIndex !== undefined
                ? <strong>Photo {w.imageIndex + 1}</strong>
                : <strong>Image</strong>
              }
              {w.competitor
                ? ` — ${w.competitor} watermark detected`
                : w.isBlocked
                ? " — rejected"
                : " — watermark detected"
              }
              {w.message ? `: ${w.message}` : ""}
            </li>
          ))}
        </ul>

        {notice && (
          <p className="wm-banner__notice">{notice}</p>
        )}
      </div>

      {/* Dismiss only available on warn — not on block */}
      {onDismiss && !hasBlocked && (
        <button
          className="wm-banner__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss watermark warning"
          type="button"
        >
          ✕
        </button>
      )}
    </div>
  );
}