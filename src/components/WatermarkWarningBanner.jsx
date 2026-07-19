/**
 * src/components/WatermarkWarningBanner.jsx
 *
 * Renders a contextual banner when the backend watermark detector
 * returns warnings or blocks on uploaded images.
 *
 * Two variants:
 *
 *   warn  (yellow) — OCR found a competitor watermark but coverage
 *                    was below the block threshold. Listing was
 *                    accepted. Seller is encouraged to replace
 *                    the photo. Banner is dismissible.
 *
 *   block (red)    — Screenshot detected OR competitor branding
 *                    covers >80% of the image. Listing was
 *                    rejected. Seller must replace photo(s) before
 *                    resubmitting. Banner is NOT dismissible.
 *
 * Props:
 *   warnings  — array of:
 *               {
 *                 imageIndex : number | null,
 *                 competitor : string | null,
 *                 message    : string,
 *                 isBlocked ?: boolean,
 *               }
 *   notice    — optional string shown below the list
 *   onDismiss — optional callback; omit for block variant
 */

export default function WatermarkWarningBanner({
  warnings  = [],
  notice    = "",
  onDismiss,
}) {
  if (!warnings.length) return null;

  const hasBlocked = warnings.some((w) => w.isBlocked);

  return (
    <div
      className={`wm-banner ${hasBlocked ? "wm-banner--block" : "wm-banner--warn"}`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      {/* Icon */}
      <div className="wm-banner__icon" aria-hidden="true">
        {hasBlocked ? "🚫" : "⚠️"}
      </div>

      {/* Body */}
      <div className="wm-banner__body">

        <p className="wm-banner__title">
          {hasBlocked
            ? "Photo rejected — please use original photos"
            : "Photo tip — improve your listing visibility"}
        </p>

        <ul className="wm-banner__list">
          {warnings.map((w, i) => {
            const photoLabel =
              w.imageIndex !== null && w.imageIndex !== undefined
                ? `Photo ${w.imageIndex + 1}`
                : "Photo";

            const competitorTag =
              w.competitor
                ? ` — ${w.competitor} watermark detected`
                : w.isBlocked
                ? " — rejected"
                : " — watermark detected";

            return (
              <li key={i}>
                <strong>{photoLabel}</strong>
                {competitorTag}
                {w.message ? `: ${w.message}` : ""}
              </li>
            );
          })}
        </ul>

        {/* What to do next */}
        {hasBlocked ? (
          <p className="wm-banner__notice">
            Replace the flagged photo(s) with your own original images
            and resubmit your listing.
          </p>
        ) : (
          notice && (
            <p className="wm-banner__notice">{notice}</p>
          )
        )}

        {/* What counts as original — shown on both variants */}
        <p className="wm-banner__hint">
          ✅ Your own photos &nbsp;·&nbsp;
          ✅ Photos with a Loemart watermark &nbsp;·&nbsp;
          ❌ Screenshots &nbsp;·&nbsp;
          ❌ Photos from other marketplaces
        </p>

      </div>

      {/* Dismiss button — warn only, not shown on block */}
      {onDismiss && !hasBlocked && (
        <button
          type="button"
          className="wm-banner__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss watermark warning"
        >
          ✕
        </button>
      )}
    </div>
  );
}