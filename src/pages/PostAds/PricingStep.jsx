import React, { useMemo } from "react";
import {
  FiAlertCircle,
  FiTrendingUp,
  FiInfo,
  FiCheckCircle,
} from "react-icons/fi";

/* ─── Quick tip pill ─── */
function Tip({ icon, text, color = "#6b7280", bg = "rgba(0,0,0,0.04)" }) {
  return (
    <div style={{
      display:      "flex",
      alignItems:   "center",
      gap:          "8px",
      padding:      "10px 14px",
      borderRadius: "12px",
      background:   bg,
      fontSize:     "12px",
      fontWeight:   600,
      color,
      lineHeight:   1.5,
    }}>
      <span style={{ fontSize: "16px", flexShrink: 0 }}>{icon}</span>
      {text}
    </div>
  );
}

/* ─── Stat box ─── */
function StatBox({ label, value, sub, color = "#1a1a1a", bg = "rgba(255,255,255,0.6)" }) {
  return (
    <div style={{
      flex:          1,
      minWidth:      0,
      padding:       "14px",
      borderRadius:  "14px",
      background:    bg,
      border:        "1.5px solid rgba(0,0,0,0.06)",
      backdropFilter:"blur(8px)",
      display:       "flex",
      flexDirection: "column",
      gap:           "4px",
    }}>
      <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: "18px", fontWeight: 900, color }}>
        {value}
      </p>
      {sub && (
        <p style={{ margin: 0, fontSize: "11px", color: "#9ca3af", fontWeight: 600 }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/* ─── Price input ─── */
function PriceInput({
  label,
  value,
  onChange,
  onBlur,
  placeholder = "0",
  hint,
  error,
  touched,
  required,
  symbolColor = "#ff5722",
  large = false,
}) {
  return (
    <div className="pa-field">
      <label className="pa-label">
        {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
      </label>

      <div style={{ position: "relative" }}>
        {/* ₦ symbol */}
        <span style={{
          position:  "absolute",
          left:      "14px",
          top:       "50%",
          transform: "translateY(-50%)",
          fontSize:  large ? "18px" : "15px",
          fontWeight: 800,
          color:     symbolColor,
          pointerEvents: "none",
          zIndex:    1,
        }}>
          ₦
        </span>

        <input
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          value={value ? Number(value).toLocaleString("en-NG") : ""}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          onBlur={onBlur}
          style={{
            width:          "100%",
            height:         large ? "58px" : "50px",
            border:         `1.5px solid ${
              error && touched
                ? "#ef4444"
                : "rgba(0,0,0,0.08)"
            }`,
            borderRadius:   "14px",
            padding:        "0 14px 0 38px",
            fontSize:       large ? "22px" : "17px",
            fontWeight:     large ? 900 : 700,
            color:          "#1a1a1a",
            background:     "rgba(255,255,255,0.65)",
            backdropFilter: "blur(8px)",
            outline:        "none",
            transition:     "border-color 0.15s, box-shadow 0.15s",
            boxSizing:      "border-box",
            fontFamily:     "inherit",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "#ff5722";
            e.target.style.boxShadow  = "0 0 0 3px rgba(255,87,34,0.08)";
          }}
          onBlurCapture={(e) => {
            e.target.style.borderColor = error && touched ? "#ef4444" : "rgba(0,0,0,0.08)";
            e.target.style.boxShadow  = "none";
          }}
        />

        {/* Valid check */}
        {value && Number(value) > 0 && !error && (
          <FiCheckCircle
            size={16}
            style={{
              position:  "absolute",
              right:     "14px",
              top:       "50%",
              transform: "translateY(-50%)",
              color:     "#16a34a",
            }}
          />
        )}
      </div>

      {/* Error */}
      {error && touched && (
        <div style={{
          display:    "flex",
          alignItems: "center",
          gap:        "5px",
          marginTop:  "5px",
          color:      "#ef4444",
          fontSize:   "12px",
          fontWeight: 700,
        }}>
          <FiAlertCircle size={13} /> {error}
        </div>
      )}

      {/* Hint */}
      {hint && !error && (
        <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#9ca3af", fontWeight: 600 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   PRICING STEP
═══════════════════════════════════════════════ */
export default function PricingStep({
  basePrice,
  setBasePrice,
  originalPrice,
  setOriginalPrice,
  discountPct,
  /* optional field-level validation props */
  errors = {},
  touched = {},
  onBlur,
}) {
  const base     = Number(basePrice)     || 0;
  const original = Number(originalPrice) || 0;

  /* live calcs */
  const savings    = original > base ? original - base : 0;
  const platformFee = useMemo(() => Math.round(base * 0.05), [base]);   // 5% example
  const youReceive  = useMemo(() => base - platformFee, [base, platformFee]);

  const priceLevel = useMemo(() => {
    if (!base) return null;
    if (base < 500)    return { label: "Very low price", color: "#ef4444", icon: "⚠️" };
    if (base < 2000)   return { label: "Budget-friendly",color: "#f59e0b", icon: "💛" };
    if (base < 50000)  return { label: "Good price range",color: "#10b981", icon: "✅" };
    if (base < 500000) return { label: "Premium pricing", color: "#6366f1", icon: "💎" };
    return               { label: "Luxury tier",        color: "#8b5cf6", icon: "👑" };
  }, [base]);

  return (
    <>
      {/* ── Header ── */}
      <div style={{ marginBottom: "20px" }}>
        <p className="pa-section-title">💰 Set Your Price</p>
        <p className="pa-section-sub">
          Competitive pricing gets more buyers. Variants can override this.
        </p>
      </div>

      {/* ── Delivery note ── */}
      <div className="pa-delivery-note" style={{ marginBottom: "20px" }}>
        🚚{" "}
        <div>
          <strong>Delivery handled at checkout</strong> — buyers choose their
          method when ordering. You focus on the price.
        </div>
      </div>

      {/* ── Base Price ── */}
      <PriceInput
        label="Base Price (₦)"
        value={basePrice}
        onChange={setBasePrice}
        onBlur={() => onBlur?.("basePrice")}
        required
        large
        error={errors.basePrice}
        touched={touched.basePrice}
        hint="This is the default price buyers will see."
      />

      {/* ── Price level indicator ── */}
      {priceLevel && (
        <div style={{
          display:       "flex",
          alignItems:    "center",
          gap:           "8px",
          marginBottom:  "18px",
          padding:       "10px 14px",
          borderRadius:  "12px",
          background:    `${priceLevel.color}12`,
          border:        `1px solid ${priceLevel.color}30`,
          fontSize:      "13px",
          fontWeight:    700,
          color:         priceLevel.color,
        }}>
          <span>{priceLevel.icon}</span>
          {priceLevel.label} · ₦{base.toLocaleString("en-NG")}
        </div>
      )}

      {/* ── Original / Strike-through Price ── */}
      <PriceInput
        label="Original Price (₦) — optional"
        value={originalPrice}
        onChange={setOriginalPrice}
        onBlur={() => onBlur?.("originalPrice")}
        symbolColor="#d1d5db"
        error={errors.originalPrice}
        touched={touched.originalPrice}
        hint="Show a crossed-out price to highlight your deal."
      />

      {/* ── Discount summary ── */}
      {discountPct > 0 && savings > 0 && (
        <div style={{
          padding:       "14px 16px",
          borderRadius:  "14px",
          background:    "rgba(16,185,129,0.08)",
          border:        "1.5px solid rgba(16,185,129,0.2)",
          marginBottom:  "20px",
          display:       "flex",
          alignItems:    "center",
          gap:           "12px",
          flexWrap:      "wrap",
        }}>
          <span style={{ fontSize: "22px" }}>🏷️</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 800, color: "#065f46", fontSize: "14px" }}>
              Buyer saves ₦{savings.toLocaleString("en-NG")}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6b7280", fontWeight: 600 }}>
              Showing as{" "}
              <span style={{ textDecoration: "line-through" }}>
                ₦{original.toLocaleString("en-NG")}
              </span>{" "}
              →{" "}
              <strong style={{ color: "#ff5722" }}>
                ₦{base.toLocaleString("en-NG")}
              </strong>
            </p>
          </div>
          <span style={{
            background:   "#dc2626",
            color:        "#fff",
            fontSize:     "13px",
            fontWeight:   900,
            padding:      "5px 11px",
            borderRadius: "8px",
            flexShrink:   0,
          }}>
            -{discountPct}%
          </span>
        </div>
      )}

      {/* ── Earnings breakdown ── */}
      {base > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <p style={{
            margin:        "0 0 10px",
            fontSize:      "12px",
            fontWeight:    800,
            color:         "#9ca3af",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            display:       "flex",
            alignItems:    "center",
            gap:           "6px",
          }}>
            <FiTrendingUp size={14} /> Earnings Breakdown
          </p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <StatBox
              label="Your Price"
              value={`₦${base.toLocaleString("en-NG")}`}
              color="#1a1a1a"
            />
            <StatBox
              label="Platform Fee (5%)"
              value={`-₦${platformFee.toLocaleString("en-NG")}`}
              color="#ef4444"
              bg="rgba(239,68,68,0.06)"
            />
            <StatBox
              label="You Receive"
              value={`₦${youReceive.toLocaleString("en-NG")}`}
              color="#16a34a"
              bg="rgba(16,185,129,0.07)"
              sub="after platform fee"
            />
          </div>
          <p style={{
            margin:     "8px 0 0",
            fontSize:   "11px",
            color:      "#9ca3af",
            fontWeight: 600,
            display:    "flex",
            alignItems: "center",
            gap:        "4px",
          }}>
            <FiInfo size={11} />
            Platform fee is illustrative. Actual fees may vary.
          </p>
        </div>
      )}

      {/* ── Pricing tips ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <Tip
          icon="📊"
          text="Check similar listings before setting your price to stay competitive."
          color="#4f46e5"
          bg="rgba(99,102,241,0.06)"
        />
        <Tip
          icon="📸"
          text="Listings with 3+ photos sell 60% faster regardless of price."
          color="#0369a1"
          bg="rgba(3,105,161,0.06)"
        />
        <Tip
          icon="🔥"
          text='Use a struck-through "Original Price" to make your deal look unmissable.'
          color="#c2410c"
          bg="rgba(194,65,12,0.06)"
        />
      </div>
    </>
  );
}