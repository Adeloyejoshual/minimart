// src/components/nearby/NearbyLocationBanner.jsx
import { memo } from "react";

const NearbyLocationBanner = memo(function NearbyLocationBanner({
  label,
  gpsStatus,
  count,
}) {
  if (!label) return null;

  return (
    <div className="nb-loc-banner" role="status" aria-live="polite">
      <div className="nb-loc-left">
        <span className="nb-loc-icon" aria-hidden="true">
          {gpsStatus === "gps" ? "📡" : "📍"}
        </span>
        <div className="nb-loc-text">
          <span className="nb-loc-label">
            Showing listings near
          </span>
          <strong className="nb-loc-place">{label}</strong>
        </div>
      </div>

      {count > 0 && (
        <span className="nb-loc-count">
          {count.toLocaleString()} listing{count !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
});

export default NearbyLocationBanner;