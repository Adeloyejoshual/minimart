import React, { useEffect, useState, useCallback } from "react";
import { Icon } from "./icons";
import { truncate } from "./constants";

function LocationModal({ onSend, onClose }) {
  const [st,     setSt]     = useState("idle");
  const [coords, setCoords] = useState(null);
  const [addr,   setAddr]   = useState("");

  useEffect(() => {
    if (!navigator.geolocation) { setSt("error"); return; }
    setSt("detecting");
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCoords({ lat, lng });
        setSt("ready");
        fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
        )
          .then(r => r.json())
          .then(d => setAddr(d.display_name || ""))
          .catch(() => {});
      },
      () => setSt("error"),
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, []);

  const handleSend = useCallback(() => {
    if (!coords) return;
    onSend(coords, addr);
    onClose();
  }, [coords, addr, onSend, onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="modal-header">
          <div className="modal-title-group">
            <div>
              <div className="modal-title">Share Location</div>
              <div className="modal-subtitle">Send your current location</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>{Icon.close}</button>
        </div>

        {st === "detecting" && (
          <div className="location-detecting">
            <div className="mini-spinner"/>
            Detecting location…
          </div>
        )}
        {st === "ready" && coords && (
          <>
            <div className="location-map-preview">
              <img alt="Map preview"
                src={`https://staticmap.openstreetmap.de/staticmap.php?center=${coords.lat},${coords.lng}&zoom=15&size=400x200&markers=${coords.lat},${coords.lng},red`}
                onError={e => { e.target.style.display = "none"; }}/>
            </div>
            <div className="location-coords">
              {addr
                ? truncate(addr, 80)
                : `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`}
            </div>
          </>
        )}
        {st === "error" && (
          <div className="location-error">
            Could not get your location.<br/>
            Please allow location access and try again.
          </div>
        )}

        <div className="modal-actions">
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-send"
            onClick={handleSend}
            disabled={st !== "ready"}>
            Send Location
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(LocationModal);