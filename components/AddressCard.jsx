// src/pages/Checkout/components/AddressCard.jsx

import React, { useState, useRef, useEffect, memo } from "react";

const ICONS = { Home: "🏠", Office: "🏢", Other: "📍" };

const AddressCard = memo(function AddressCard({
  address, isSelected,
  onSelect, onEdit, onDelete, onSetDefault,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const esc = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [menuOpen]);

  // Resolve bus_stop — fallback to landmark for old data
  const busStop = address.bus_stop || address.landmark || null;

  return (
    <div
      className={`adc ${isSelected ? "adc--on" : ""}`}
      onClick={() => onSelect(address)}
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(address);
      }}
    >
      {/* Radio */}
      <div className="adc-radio" aria-hidden="true">
        <div className={`adc-dot ${isSelected ? "adc-dot--on" : ""}`}>
          {isSelected && <span className="adc-dot-inner" />}
        </div>
      </div>

      {/* Info */}
      <div className="adc-body">
        <div className="adc-row1">
          <span className="adc-label">
            {ICONS[address.label] ?? "📍"} {address.label}
          </span>
          {address.is_default && (
            <span className="adc-tag adc-tag--default">Default</span>
          )}
          {address.call_before_delivery && (
            <span className="adc-tag adc-tag--call">📞 Call first</span>
          )}
        </div>

        <p className="adc-name">
          {address.recipient_name}
          <span className="adc-sep">·</span>
          {address.phone}
        </p>

        <p className="adc-street">{address.address_line}</p>

        {/* Bus stop — highlighted prominently */}
        {busStop && (
          <p className="adc-busstop">
            🚏 <strong>{busStop}</strong>
          </p>
        )}

        <p className="adc-city">{address.city}, {address.state}</p>

        {isSelected && (
          <span className="adc-deliver-tag">✓ Deliver Here</span>
        )}
      </div>

      {/* Menu */}
      <div
        className="adc-menu-area"
        ref={menuRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="adc-menu-trigger"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Options"
          aria-expanded={menuOpen}
          type="button"
        >
          ⋮
        </button>

        {menuOpen && (
          <div className="adc-dropdown" role="menu">
            <button
              className="adc-drop-item"
              onClick={() => { setMenuOpen(false); onEdit(address); }}
              role="menuitem"
            >
              ✏️ Edit
            </button>
            {!address.is_default && (
              <button
                className="adc-drop-item"
                onClick={() => { setMenuOpen(false); onSetDefault(address.id); }}
                role="menuitem"
              >
                ⭐ Set Default
              </button>
            )}
            <button
              className="adc-drop-item adc-drop-item--red"
              onClick={() => { setMenuOpen(false); onDelete(address); }}
              role="menuitem"
            >
              🗑️ Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default AddressCard;