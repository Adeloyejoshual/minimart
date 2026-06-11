import React, { useState, memo } from "react";

const fmt = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

/* ── Seller grouping helper ── */
function groupBySeller(items) {
  const groups = new Map();
  items.forEach((item) => {
    const key  = item.sellerId   ?? "unknown";
    const name = item.sellerName ?? "Seller";
    if (!groups.has(key)) groups.set(key, { sellerName: name, items: [] });
    groups.get(key).items.push(item);
  });
  return [...groups.values()];
}

/* ════════════════════════════════════════════════════════════
   REVIEW STEP
════════════════════════════════════════════════════════════ */
const ReviewStep = memo(function ReviewStep({
  cartItems,
  calculation,
  address,
  notes,
  onNotesChange,
  couponCode,
  onCouponChange,
  discount,
  onBack,
  onNext,
}) {
  const [showCoupon,  setShowCoupon]  = useState(false);
  const [couponInput, setCouponInput] = useState(couponCode ?? "");

  const sellerGroups = groupBySeller(cartItems);

  return (
    <div className="ck-section">
      <h2 className="ck-section-title">📋 Review Your Order</h2>

      {/* ── Delivery address ── */}
      {address && (
        <div className="ck-review-block">
          <div className="ck-review-block-header">
            <span className="ck-review-block-icon">📍</span>
            <span className="ck-review-block-title">Delivering to</span>
          </div>
          <div className="ck-review-address-body">
            <p className="ck-review-name">
              {address.recipient_name}
              <span className="ck-review-phone"> · {address.phone}</span>
            </p>
            <p className="ck-review-addr">{address.address_line}</p>
            {address.landmark && (
              <p className="ck-review-landmark">📍 {address.landmark}</p>
            )}
            {address.additional_directions && (
              <p className="ck-review-directions">
                ℹ️ {address.additional_directions}
              </p>
            )}
            <p className="ck-review-location">
              {address.city}, {address.state}
            </p>
            {address.call_before_delivery && (
              <div className="ck-review-call-badge">
                📞 Rider will call before delivery
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Items grouped by seller ── */}
      <div className="ck-review-block">
        <div className="ck-review-block-header">
          <span className="ck-review-block-icon">📦</span>
          <span className="ck-review-block-title">
            Items ({cartItems.length})
          </span>
        </div>

        {sellerGroups.map((group, gi) => (
          <div key={gi} className="ck-review-seller-group">
            {/* Seller header */}
            {sellerGroups.length > 1 && (
              <div className="ck-review-seller-header">
                <div className="ck-review-seller-dot">
                  {group.sellerName?.[0]?.toUpperCase() ?? "S"}
                </div>
                <span className="ck-review-seller-name">
                  {group.sellerName}
                </span>
                <span className="ck-review-seller-badge">
                  🏪 Minimart Managed
                </span>
              </div>
            )}

            {/* Items */}
            {group.items.map((item) => (
              <div key={item.id} className="ck-review-item">
                <div className="ck-review-item-img">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      loading="lazy"
                    />
                  ) : (
                    <span>📦</span>
                  )}
                </div>

                <div className="ck-review-item-info">
                  <p className="ck-review-item-name">{item.name}</p>
                  {item.variant && (
                    <p className="ck-review-item-variant">
                      {item.variant.name}
                      {item.variant.sku && (
                        <span className="ck-review-item-sku">
                          {" "}· {item.variant.sku}
                        </span>
                      )}
                    </p>
                  )}
                  <p className="ck-review-item-qty">
                    {item.qty} × {fmt(item.price)}
                  </p>
                </div>

                <p className="ck-review-item-price">
                  {fmt(Number(item.price) * item.qty)}
                </p>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ── Order notes ── */}
      <div className="ck-review-block">
        <div className="ck-review-block-header">
          <span className="ck-review-block-icon">📝</span>
          <span className="ck-review-block-title">
            Order Notes
            <span className="ck-optional"> (optional)</span>
          </span>
        </div>
        <textarea
          className="ck-input ck-textarea"
          placeholder="Any special instructions for your order…"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={2}
          maxLength={300}
        />
        {notes.length > 0 && (
          <span className="ck-field-hint" style={{ textAlign: "right" }}>
            {notes.length}/300
          </span>
        )}
      </div>

      {/* ── Coupon code ── */}
      <div className="ck-review-block">
        <div className="ck-review-block-header">
          <span className="ck-review-block-icon">🏷️</span>
          <span className="ck-review-block-title">Coupon Code</span>
        </div>

        {discount > 0 ? (
          <div className="ck-coupon-applied">
            <div>
              <span className="ck-coupon-code">{couponCode}</span>
              <span className="ck-coupon-savings">
                — You save {fmt(discount)}
              </span>
            </div>
            <button
              className="ck-coupon-remove"
              onClick={() => {
                onCouponChange?.("");
                setCouponInput("");
              }}
            >
              Remove
            </button>
          </div>
        ) : showCoupon ? (
          <div className="ck-coupon-input-row">
            <input
              className="ck-input ck-coupon-input"
              type="text"
              placeholder="Enter coupon code"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") onCouponChange?.(couponInput);
              }}
              autoFocus
            />
            <button
              className="ck-coupon-apply-btn"
              onClick={() => onCouponChange?.(couponInput)}
            >
              Apply
            </button>
            <button
              className="ck-coupon-cancel-btn"
              onClick={() => {
                setShowCoupon(false);
                setCouponInput("");
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            className="ck-coupon-toggle"
            onClick={() => setShowCoupon(true)}
          >
            + Have a coupon code?
          </button>
        )}
      </div>

      {/* ── Price summary ── */}
      {calculation && (
        <div className="ck-review-block">
          <div className="ck-review-block-header">
            <span className="ck-review-block-icon">💰</span>
            <span className="ck-review-block-title">Price Summary</span>
          </div>

          <div className="ck-price-summary">
            <div className="ck-price-row">
              <span>Subtotal ({cartItems.length} item{cartItems.length !== 1 ? "s" : ""})</span>
              <span>{fmt(calculation.subtotal)}</span>
            </div>

            {discount > 0 && (
              <div className="ck-price-row ck-price-row--discount">
                <span>
                  Discount
                  {couponCode ? ` (${couponCode})` : ""}
                </span>
                <span>- {fmt(discount)}</span>
              </div>
            )}

            <div className="ck-price-row">
              <span>Delivery Fee</span>
              <span>{fmt(calculation.deliveryFee)}</span>
            </div>

            {calculation.deliveryEta && (
              <div className="ck-price-row ck-price-row--eta">
                <span />
                <span className="ck-eta">
                  🕐 {calculation.deliveryEta}
                </span>
              </div>
            )}

            <div className="ck-price-divider" />

            <div className="ck-price-row ck-price-row--total">
              <span>Total</span>
              <span>{fmt(calculation.grandTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Tracking ID notice ── */}
      <div className="ck-tracking-notice">
        <div className="ck-tracking-notice-icon">🔖</div>
        <div className="ck-tracking-notice-body">
          <p className="ck-tracking-notice-title">
            Your tracking ID will be generated after payment
          </p>
          <p className="ck-tracking-notice-sub">
            Format: <strong>ORD-XXXXXXXX</strong> — shown on your order
            confirmation page and sent to your account.
          </p>
        </div>
      </div>

      {/* ── What happens next ── */}
      <div className="ck-what-next">
        <p className="ck-what-next-title">After you place your order:</p>
        <div className="ck-what-next-steps">
          {[
            { icon: "✅", text: "Order confirmed + tracking ID generated" },
            { icon: "📦", text: "Seller notified and begins preparing"    },
            { icon: "🚚", text: "Minimart picks up and delivers to you"   },
            { icon: "🏠", text: "Delivered to your address"               },
          ].map((s) => (
            <div key={s.text} className="ck-what-next-step">
              <span>{s.icon}</span>
              <span>{s.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Navigation ── */}
      <div className="ck-nav-btns">
        <button className="ck-btn-back" onClick={onBack}>
          ← Back
        </button>
        <button className="ck-next-btn" onClick={onNext}>
          Choose Payment →
        </button>
      </div>
    </div>
  );
});

export default ReviewStep;