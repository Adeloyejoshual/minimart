/**
 * src/pages/MarketDetail/DeliveryCard.jsx
 * Location-Aware Delivery Destination Component
 * Configured strictly for Osun & Ondo (Ondo Town ONLY) coverage rules.
 */

import { useState, useEffect, useMemo, useCallback, memo } from "react";

// Source-of-truth matching backend service/location.js exactly
const LOCAL_DELIVERY_ZONES = {
  Osun: {
    label: "Osun State",
    cities: [
      "Osogbo",
      "Ile-Ife",
      "Ilesa",
      "Ede",
      "Iwo",
      "Ikirun",
      "Ikire",
      "Erin-Osun",
      "Gbongan",
      "Inisa",
      "Okuku",
      "Ifon-Osun"
    ]
  },
  Ondo: {
    label: "Ondo State",
    cities: ["Ondo Town"]
  }
};

const DEFAULT_LOCATION = {
  state: "Osun",
  city: "Osogbo",
  minDays: 2,
  maxDays: 4,
};

// Helper: Add Business Days (skipping weekends)
const addBusinessDays = (startDate, numDays) => {
  const result = new Date(startDate);
  let added = 0;
  while (added < numDays) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++; // 0 = Sun, 6 = Sat
  }
  return result;
};

function DeliveryCard() {
  const [zones, setZones] = useState(LOCAL_DELIVERY_ZONES);

  // Read saved location or default to Osogbo, Osun
  const [location, setLocation] = useState(() => {
    try {
      const saved = localStorage.getItem("lm_delivery_location");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate against backend-supported states (Osun/Ondo)
        if (LOCAL_DELIVERY_ZONES[parsed.state]) {
          const allowedCities = LOCAL_DELIVERY_ZONES[parsed.state].cities;
          if (allowedCities.includes(parsed.city)) {
            return parsed;
          }
        }
      }
      return DEFAULT_LOCATION;
    } catch {
      return DEFAULT_LOCATION;
    }
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempState, setTempState] = useState(location.state);
  const [tempCity, setTempCity] = useState(location.city);

  // Fetch real-time allowed zones from backend public endpoint
  useEffect(() => {
    let active = true;
    fetch("/api/checkout/address/zones")
      .then((res) => res.json())
      .then((resJson) => {
        if (active && resJson.success && resJson.data && typeof resJson.data === "object") {
          setZones(resJson.data);
        }
      })
      .catch(() => {
        // Fallback silently to LOCAL_DELIVERY_ZONES
      });

    return () => {
      active = false;
    };
  }, []);

  // Handle modal actions
  const handleOpenModal = () => {
    setTempState(location.state);
    setTempCity(location.city);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => setIsModalOpen(false);

  // Close modal on 'Escape' and manage background scroll locking
  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") handleCloseModal();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isModalOpen]);

  // Extract keys and selected cities list
  const allowedStates = useMemo(() => Object.keys(zones), [zones]);
  const currentCities = useMemo(() => zones[tempState]?.cities || [], [zones, tempState]);

  // Handle Changing State Dropdown
  const handleStateChange = (newState) => {
    setTempState(newState);
    const citiesList = zones[newState]?.cities || [];
    setTempCity(citiesList[0] || "");
  };

  // Commit selected state and city to localStorage
  const handleSaveLocation = useCallback(() => {
    const selectedCities = zones[tempState]?.cities || [];
    const savedCity = selectedCities.includes(tempCity) ? tempCity : selectedCities[0];

    const newLoc = {
      state: tempState,
      city: savedCity,
      minDays: 2,
      maxDays: 4,
    };

    setLocation(newLoc);
    localStorage.setItem("lm_delivery_location", JSON.stringify(newLoc));
    setIsModalOpen(false);
  }, [tempState, tempCity, zones]);

  // Calculated dynamic arrival delivery timeline range
  const estimatedDates = useMemo(() => {
    const now = new Date();
    const minDate = addBusinessDays(now, location.minDays || 2);
    const maxDate = addBusinessDays(now, location.maxDays || 4);
    const fmt = (d) =>
      d.toLocaleDateString("en-NG", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    return `${fmt(minDate)} – ${fmt(maxDate)}`;
  }, [location]);

  return (
    <>
      <div className="mdp-delivery-box">
        {/* Row 1: Destination Info */}
        <div className="mdp-delivery-row">
          <div className="mdp-delivery-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={18} height={18}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div className="mdp-delivery-info">
            <div className="mdp-delivery-header">
              <span className="mdp-delivery-label">Deliver to:</span>
              <button
                type="button"
                className="mdp-delivery-change-btn"
                onClick={handleOpenModal}
              >
                Change &gt;
              </button>
            </div>
            {/* Clean presentation format: "Osogbo, Osun" */}
            <p className="mdp-delivery-address">
              <strong>{location.city}, {location.state}</strong>
            </p>
          </div>
        </div>

        {/* Row 2: Dynamic Estimated Timeline */}
        <div className="mdp-delivery-row mdp-delivery-row--last">
          <div className="mdp-delivery-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={18} height={18}>
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <div className="mdp-delivery-info">
            <span className="mdp-delivery-label">Estimated Delivery:</span>
            <p className="mdp-delivery-value">
              <strong>{estimatedDates}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* ── LOCATION SELECTOR MODAL ── */}
      {isModalOpen && (
        <div
          className="mdp-modal-overlay"
          onClick={handleCloseModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="mdp-modal mdp-modal--location"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mdp-modal-header">
              <h3>Select Delivery Destination</h3>
              <button
                type="button"
                className="mdp-modal-x"
                onClick={handleCloseModal}
              >
                ✕
              </button>
            </div>

            <div className="mdp-modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: 12, color: "var(--ink2)", margin: 0 }}>
                We deliver to Osun State &amp; Ondo State (Ondo Town only).
              </p>

              {/* State Dropdown Selection */}
              <div className="mdp-form-group">
                <label className="mdp-form-label">State</label>
                <select
                  className="mdp-form-select"
                  value={tempState}
                  onChange={(e) => handleStateChange(e.target.value)}
                >
                  {allowedStates.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* City Dropdown Selection (Ondo strictly filters to 'Ondo Town' only) */}
              <div className="mdp-form-group">
                <label className="mdp-form-label">City / Town</label>
                <select
                  className="mdp-form-select"
                  value={tempCity}
                  onChange={(e) => setTempCity(e.target.value)}
                >
                  {currentCities.map((ct) => (
                    <option key={ct} value={ct}>
                      {ct}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mdp-modal-footer">
              <button
                type="button"
                className="mdp-modal-cancel"
                onClick={handleCloseModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="mdp-modal-submit"
                onClick={handleSaveLocation}
                style={{ background: "var(--o)" }}
              >
                Apply Location
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default memo(DeliveryCard);