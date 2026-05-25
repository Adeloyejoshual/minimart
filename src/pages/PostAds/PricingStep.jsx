import React from "react";

export default function PricingStep({
  basePrice,
  setBasePrice,
  originalPrice,
  setOriginalPrice,
  discountPct,
}) {
  return (
    <>
      <p className="pa-section-title">Base Price</p>
      <p className="pa-section-sub">
        Set the default price. Individual variants can have their own.
      </p>

      <div className="pa-delivery-note">
        🚚{" "}
        <strong>Delivery handled at checkout</strong> — buyers choose their
        method when ordering.
      </div>

      {/* Base price */}
      <div className="pa-field">
        <label className="pa-label">Base Price (₦) *</label>
        <div className="pa-price-wrap">
          <span className="pa-price-symbol">₦</span>
          <input
            className="pa-price-input"
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={basePrice ? Number(basePrice).toLocaleString() : ""}
            onChange={(e) => setBasePrice(e.target.value.replace(/\D/g, ""))}
          />
        </div>
      </div>

      {/* Original / strike-through price */}
      <div className="pa-field">
        <label className="pa-label">Original Price (₦) — optional</label>
        <div className="pa-price-wrap">
          <span className="pa-price-symbol" style={{ color: "#bbb" }}>₦</span>
          <input
            className="pa-price-input"
            type="text"
            inputMode="numeric"
            placeholder="0"
            style={{ fontSize: 16, fontWeight: 600 }}
            value={originalPrice ? Number(originalPrice).toLocaleString() : ""}
            onChange={(e) => setOriginalPrice(e.target.value.replace(/\D/g, ""))}
          />
        </div>

        {discountPct > 0 && (
          <p style={{ fontSize: 12, color: "#16a34a", fontWeight: 600, marginTop: 6 }}>
            🏷️ Buyer saves ₦
            {(Number(originalPrice) - Number(basePrice)).toLocaleString()}
            <span className="pa-discount-badge">-{discountPct}%</span>
          </p>
        )}
      </div>
    </>
  );
}
