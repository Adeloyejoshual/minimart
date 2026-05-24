import { FiInfo } from "react-icons/fi";

export default function PricingStep({
  basePrice,     setBasePrice,
  originalPrice, setOriginalPrice,
  scheduledAt,   setScheduledAt,
  discountPct,
}) {
  return (
    <>
      <p className="ap-section-title">Pricing</p>
      <p className="ap-section-sub">
        Set your selling price. Adding an original price creates a discount
        badge that increases conversions.
      </p>

      {/* ── Selling price ── */}
      <div className="ap-field">
        <label className="ap-label">Selling Price (₦) *</label>
        <div className="ap-price-wrap">
          <span className="ap-price-symbol">₦</span>
          <input
            className="ap-price-input"
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={basePrice ? Number(basePrice).toLocaleString() : ""}
            onChange={(e) => setBasePrice(e.target.value.replace(/\D/g, ""))}
          />
        </div>
      </div>

      {/* ── Strike-through price ── */}
      <div className="ap-field">
        <label className="ap-label">
          Original / Strike-through Price (₦)
          <span className="ap-label-hint">Shows discount badge to buyers</span>
        </label>
        <div className="ap-price-wrap">
          <span className="ap-price-symbol ap-price-symbol--muted">₦</span>
          <input
            className="ap-price-input ap-price-input--secondary"
            type="text"
            inputMode="numeric"
            placeholder="0"
            value={originalPrice ? Number(originalPrice).toLocaleString() : ""}
            onChange={(e) =>
              setOriginalPrice(e.target.value.replace(/\D/g, ""))
            }
          />
        </div>

        {discountPct > 0 && (
          <div className="ap-discount-preview">
            <span className="ap-discount-badge">-{discountPct}%</span>
            <span>
              Buyers save ₦
              {(Number(originalPrice) - Number(basePrice)).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* ── Schedule ── */}
      <div className="ap-field">
        <label className="ap-label">
          Schedule Publish (optional)
          <span className="ap-label-hint">
            Leave empty to publish immediately after approval
          </span>
        </label>
        <input
          type="datetime-local"
          className="ap-input"
          value={scheduledAt}
          min={new Date().toISOString().slice(0, 16)}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
        {scheduledAt && (
          <p className="ap-scheduled-note">
            📅 Will go live on{" "}
            {new Date(scheduledAt).toLocaleString("en-NG", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        )}
      </div>

      {/* ── Info box ── */}
      <div className="ap-info-box">
        <FiInfo size={14} />
        <span>
          <strong>Delivery fees</strong> are calculated at checkout based on
          the buyer's location and preferred courier.
        </span>
      </div>
    </>
  );
}