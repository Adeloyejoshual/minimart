// src/components/homepage/HeroSection.jsx
import { memo } from "react";
import { useNavigate } from "react-router-dom";

const HeroSection = memo(function HeroSection({
  loading,
  total,
  heroLoc,
}) {
  const navigate = useNavigate();

  return (
    <section className="hm-hero" aria-label="Welcome to Loemart">
      {/* Decorative blobs */}
      <div className="hm-hero-blob hm-hero-blob--1" aria-hidden="true" />
      <div className="hm-hero-blob hm-hero-blob--2" aria-hidden="true" />
      <div className="hm-hero-blob hm-hero-blob--3" aria-hidden="true" />

      {/* Top row */}
      <div className="hm-hero-top">
        <div className="hm-hero-copy">
          <span className="hm-hero-kicker">
            🛒 Loemart Marketplace
          </span>
          <h1 className="hm-hero-h1">
            Buy &amp; Sell
            <br />
            <em className="hm-hero-em">Near You</em>
          </h1>
          <p className="hm-hero-sub">
            Thousands of verified listings from sellers
            across Nigeria.
          </p>
        </div>

        <button
          className="hm-notif-btn"
          aria-label="Notifications"
          onClick={() => navigate("/notifications")}
        >
          <svg
            viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2}
            strokeLinecap="round" width={22} height={22}
            aria-hidden="true"
          >
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          <span className="hm-notif-dot" aria-hidden="true" />
        </button>
      </div>

      {/* GPS location pill */}
      {heroLoc && (
        <button
          className="hm-hero-loc"
          onClick={() => navigate("/nearby")}
          aria-label="View nearby listings"
        >
          <span className="hm-loc-pip-lg" aria-hidden="true" />
          <span>{heroLoc}</span>
          <svg
            width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Stats row */}
      <div className="hm-hero-stats">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="hm-hero-stat">
              <div
                className="hm-sk hm-shimmer"
                style={{ width: 48, height: 22, borderRadius: 6 }}
              />
              <div
                className="hm-sk hm-shimmer"
                style={{ width: 56, height: 12,
                         borderRadius: 4, marginTop: 4 }}
              />
            </div>
          ))
        ) : (
          [
            { val: `${(total + 1_000).toLocaleString()}+`, label: "Listings"    },
            { val: "24/7",  label: "Live market" },
            { val: "Free",  label: "To list"     },
          ].map((s) => (
            <div key={s.label} className="hm-hero-stat">
              <span className="hm-hero-stat-val">{s.val}</span>
              <span className="hm-hero-stat-label">{s.label}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
});

export default HeroSection;