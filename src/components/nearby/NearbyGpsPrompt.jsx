// src/components/nearby/NearbyGpsPrompt.jsx
import { memo } from "react";

const NearbyGpsPrompt = memo(function NearbyGpsPrompt({
  onAllow,
  onDismiss,
}) {
  return (
    <div className="nb-gps-prompt" role="dialog"
         aria-label="Enable location for better results">
      <div className="nb-gps-prompt-icon" aria-hidden="true">
        📍
      </div>

      <div className="nb-gps-prompt-body">
        <h3 className="nb-gps-prompt-title">
          See listings near you
        </h3>
        <p className="nb-gps-prompt-sub">
          Allow location access to find deals closest to you
          first.
        </p>
      </div>

      <div className="nb-gps-prompt-actions">
        <button
          className="nb-gps-prompt-allow"
          onClick={onAllow}
        >
          Allow Location
        </button>
        <button
          className="nb-gps-prompt-skip"
          onClick={onDismiss}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
});

export default NearbyGpsPrompt;