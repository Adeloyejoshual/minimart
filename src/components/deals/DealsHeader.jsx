// src/components/deals/DealsHeader.jsx
import { memo } from "react";
import { useNavigate } from "react-router-dom";

const DealsHeader = memo(function DealsHeader({ onBack }) {
  const navigate = useNavigate();

  return (
    <div className="dh-wrap">
      <button
        className="dh-back"
        onClick={onBack ?? (() => navigate(-1))}
        aria-label="Go back"
      >
        <svg width="20" height="20" viewBox="0 0 24 24"
             fill="currentColor" aria-hidden="true">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
      </button>

      <div className="dh-title-wrap">
        <h1 className="dh-title">Cheap Deals</h1>
        <span className="dh-chip">
          <span className="dh-chip-dot" aria-hidden="true" />
          Under ₦50k
        </span>
      </div>

      <button
        className="dh-share"
        aria-label="Share deals page"
        onClick={() => {
          navigator.share?.({
            title : "Loemart Deals",
            text  : "Check out cheap deals on Loemart!",
            url   : window.location.href,
          }).catch(() => {});
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" strokeWidth={2}
             strokeLinecap="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
        </svg>
      </button>
    </div>
  );
});

export default DealsHeader;