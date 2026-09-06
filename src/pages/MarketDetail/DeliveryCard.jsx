import { useState, useEffect, useMemo, useCallback, memo } from "react";

const LOCAL_DELIVERY_ZONES = {
  Osun: { label: "Osun State", cities: ["Osogbo", "Ile-Ife", "Ilesa", "Ede", "Iwo", "Ikirun", "Ikire", "Erin-Osun", "Gbongan", "Inisa", "Okuku", "Ifon-Osun"] },
  Ondo: { label: "Ondo State", cities: ["Ondo Town"] }
};

const DEFAULT_LOCATION = { state: "Osun", city: "Osogbo", minDays: 2, maxDays: 4 };

const addBusinessDays = (startDate, numDays) => {
  const result = new Date(startDate);
  let added = 0;
  while (added < numDays) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
};

function DeliveryCard() {
  const [zones, setZones] = useState(LOCAL_DELIVERY_ZONES);
  const [location, setLocation] = useState(() => {
    try {
      const saved = localStorage.getItem("lm_delivery_location");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (LOCAL_DELIVERY_ZONES[parsed.state]?.cities.includes(parsed.city)) return parsed;
      }
      return DEFAULT_LOCATION;
    } catch { return DEFAULT_LOCATION; }
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempState, setTempState] = useState(location.state);
  const [tempCity, setTempCity] = useState(location.city);

  useEffect(() => {
    fetch("/api/checkout/address/zones")
      .then((res) => res.json())
      .then((resJson) => { if (resJson.success && resJson.data) setZones(resJson.data); })
      .catch(() => {});
  }, []);

  const allowedStates = useMemo(() => Object.keys(zones), [zones]);
  const currentCities = useMemo(() => zones[tempState]?.cities || [], [zones, tempState]);

  const handleSaveLocation = useCallback(() => {
    const savedCity = currentCities.includes(tempCity) ? tempCity : currentCities[0];
    const newLoc = { state: tempState, city: savedCity, minDays: 2, maxDays: 4 };
    setLocation(newLoc);
    localStorage.setItem("lm_delivery_location", JSON.stringify(newLoc));
    setIsModalOpen(false);
  }, [tempState, tempCity, zones, currentCities]);

  const estimatedDates = useMemo(() => {
    const min = addBusinessDays(new Date(), location.minDays);
    const max = addBusinessDays(new Date(), location.maxDays);
    const fmt = (d) => d.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
    return `${fmt(min)} – ${fmt(max)}`;
  }, [location]);

  return (
    <>
      <div className="mdp-delivery-box">
        <div className="mdp-delivery-row">
          <div className="mdp-delivery-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={18} height={18}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
          </div>
          <div className="mdp-delivery-info">
            <div className="mdp-delivery-header">
              <span className="mdp-delivery-label">Deliver to:</span>
              <button type="button" className="mdp-delivery-change-btn" onClick={() => setIsModalOpen(true)}>Change &gt;</button>
            </div>
            <p className="mdp-delivery-address">{location.city}, {location.state}</p>
          </div>
        </div>

        <div className="mdp-delivery-row mdp-delivery-row--last">
          <div className="mdp-delivery-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={18} height={18}><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
          </div>
          <div className="mdp-delivery-info">
            <span className="mdp-delivery-label">Estimated Delivery:</span>
            <p className="mdp-delivery-address" style={{ color: "var(--ink)" }}>{estimatedDates}</p>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="mdp-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="mdp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mdp-modal-header">
              <h3 style={{ fontSize: "14px", margin: 0 }}>Select Destination</h3>
              <button className="mdp-modal-x" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            <div className="mdp-modal-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <select className="mdp-form-select" value={tempState} onChange={(e) => setTempState(e.target.value)}>
                {allowedStates.map((st) => <option key={st} value={st}>{st}</option>)}
              </select>
              <select className="mdp-form-select" value={tempCity} onChange={(e) => setTempCity(e.target.value)}>
                {currentCities.map((ct) => <option key={ct} value={ct}>{ct}</option>)}
              </select>
            </div>
            <div className="mdp-modal-footer">
              <button className="mdp-modal-submit" style={{ width: "100%", padding: "12px", background: "var(--o)", color: "var(--wh)", border: "none", borderRadius: "6px", fontWeight: "bold" }} onClick={handleSaveLocation}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default memo(DeliveryCard);