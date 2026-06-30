// src/components/nearby/NearbyHeader.jsx
import { memo } from "react";
import { useNavigate } from "react-router-dom";

const GPS_LABELS = {
  pending : { text: "Locating…",  cls: "nb-chip--pending" },
  gps     : { text: "📍 GPS Live", cls: "nb-chip--gps"    },
  denied  : { text: "📍 Manual",  cls: "nb-chip--manual"  },
};

const NearbyHeader = memo(function NearbyHeader({
  gpsStatus,
  onBack,
  onRequestGps,
}) {
  const navigate = useNavigate();
  const chip     = GPS_LABELS[gpsStatus] ?? GPS_LABELS.pending;

  return (
    <div className="nb-header">
      {/* Back */}
      <button
        className="nb-back"
        onClick={onBack ?? (() => navigate(-1))}
        aria-label="Go back"
      >
        <svg width="18" height="18" viewBox="0 0 24 24"
             fill="currentColor" aria-hidden="true">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8
                   8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
      </button>

      {/* Title */}
      <div className="nb-title-wrap">
        <h1 className="nb-title">Near You</h1>
        <span className={`nb-chip ${chip.cls}`}>
          {gpsStatus === "pending" && (
            <span className="nb-chip-spin" aria-hidden="true" />
          )}
          {gpsStatus === "gps" && (
            <span className="nb-chip-dot" aria-hidden="true" />
          )}
          {chip.text}
        </span>
      </div>

      {/* Re-request GPS if denied */}
      {gpsStatus === "denied" && (
        <button
          className="nb-gps-btn"
          onClick={onRequestGps}
          aria-label="Enable GPS location"
        >
          <svg width="15" height="15" viewBox="0 0 24 24"
               fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round"
               aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            <path d="M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12
                     M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
          </svg>
          Enable GPS
        </button>
      )}
    </div>
  );
});

export default NearbyHeader;