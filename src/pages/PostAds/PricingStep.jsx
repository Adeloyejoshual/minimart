/**
 * src/pages/PostAds/PricingStep.jsx
 *
 * Step 4 — Pricing
 * - Base price input with Nigerian Naira symbol
 * - Original / strike-through price
 * - Discount summary
 * - Earnings breakdown
 * - Price level indicator
 * - Pricing tips
 */

import { useMemo } from "react";

/* ══════════════════════════════════════════════════════════════
   SVG ICONS
══════════════════════════════════════════════════════════════ */
const IconAlertCircle = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8"  x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const IconCheckCircle = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const IconTrendingUp = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const IconInfo = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8"  x2="12.01" y2="8" />
  </svg>
);

const IconTag = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const IconTruck = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <rect x="1" y="3" width="15" height="13" rx="1" />
    <path d="M16 8h4l3 3v5h-7V8z" />
    <circle cx="5.5"  cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const IconBarChart = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4"  />
    <line x1="6"  y1="20" x2="6"  y2="14" />
  </svg>
);

const IconCamera = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8
             a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const IconPercent = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <line x1="19" y1="5" x2="5" y2="19" />
    <circle cx="6.5"  cy="6.5"  r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </svg>
);

const IconShield = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════
   PRICE LEVEL CONFIG
══════════════════════════════════════════════════════════════ */
const PRICE_LEVELS = [
  { max: 500,    label: "Very low price",  modifier: "level--verylow"  },
  { max: 2000,   label: "Budget-friendly", modifier: "level--budget"   },
  { max: 50000,  label: "Good price range",modifier: "level--good"     },
  { max: 500000, label: "Premium pricing", modifier: "level--premium"  },
  { max: Infinity,label:"Luxury tier",     modifier: "level--luxury"   },
];

function getPriceLevel(price) {
  if (!price) return null;
  return PRICE_LEVELS.find((l) => price < l.max) ?? null;
}

/* ══════════════════════════════════════════════════════════════
   TIP ROW
══════════════════════════════════════════════════════════════ */
function Tip({ icon: Icon, text, modifier = "" }) {
  return (
    <div className={`ps-tip ${modifier}`}>
      <span className="ps-tip-icon">
        <Icon size={15} />
      </span>
      <span className="ps-tip-text">{text}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STAT BOX
══════════════════════════════════════════════════════════════ */
function StatBox({ label, value, sub, modifier = "" }) {
  return (
    <div className={`ps-stat ${modifier}`}>
      <p className="ps-stat-label">{label}</p>
      <p className="ps-stat-value">{value}</p>
      {sub && <p className="ps-stat-sub">{sub}</p>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PRICE INPUT
══════════════════════════════════════════════════════════════ */
function PriceInput({
  id,
  label,
  value,
  onChange,
  onBlur,
  placeholder = "0",
  hint,
  error,
  touched,
  required = false,
  large = false,
}) {
  const hasError = error && touched;
  const isValid  = value && Number(value) > 0 && !error;

  return (
    <div className="pa-field">
      <label className="pa-label" htmlFor={id}>
        {label}
        {required && (
          <span className="pa-label-required" aria-hidden="true"> *</span>
        )}
      </label>

      <div className={`ps-input-wrap${large ? " ps-input-wrap--large" : ""}${hasError ? " ps-input-wrap--error" : ""}`}>
        {/* Naira symbol */}
        <span className="ps-input-symbol" aria-hidden="true">
          ₦
        </span>

        <input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          className={`ps-input${large ? " ps-input--large" : ""}`}
          value={value ? Number(value).toLocaleString("en-NG") : ""}
          aria-required={required}
          aria-invalid={hasError ? "true" : undefined}
          aria-describedby={[
            hasError  ? `${id}-error` : null,
            hint      ? `${id}-hint`  : null,
          ].filter(Boolean).join(" ") || undefined}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          onBlur={onBlur}
        />

        {/* Valid indicator */}
        {isValid && (
          <span className="ps-input-valid" aria-hidden="true">
            <IconCheckCircle size={16} />
          </span>
        )}
      </div>

      {/* Error */}
      {hasError && (
        <div id={`${id}-error`} className="pa-field-error" role="alert">
          <IconAlertCircle size={13} />
          <span>{error}</span>
        </div>
      )}

      {/* Hint */}
      {hint && !hasError && (
        <p id={`${id}-hint`} className="pa-field-hint">
          {hint}
        </p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PRICING STEP
══════════════════════════════════════════════════════════════ */
export default function PricingStep({
  basePrice,
  setBasePrice,
  originalPrice,
  setOriginalPrice,
  discountPct,
  errors  = {},
  touched = {},
  onBlur,
}) {
  const base     = Number(basePrice)     || 0;
  const original = Number(originalPrice) || 0;
  const savings  = original > base ? original - base : 0;

  const platformFee = useMemo(() => Math.round(base * 0.05), [base]);
  const youReceive  = useMemo(() => base - platformFee,      [base, platformFee]);
  const priceLevel  = useMemo(() => getPriceLevel(base),     [base]);

  return (
    <div className="ps-wrap">

      {/* ── Delivery note ── */}
      <div className="ps-delivery-note" role="note">
        <span className="ps-delivery-icon">
          <IconTruck size={15} />
        </span>
        <div className="ps-delivery-text">
          <strong>Delivery is handled at checkout.</strong>
          {" "}Buyers choose their delivery method when ordering. Focus on the price.
        </div>
      </div>

      {/* ── Base price ── */}
      <PriceInput
        id="ps-base-price"
        label="Base Price (NGN)"
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
        <div
          className={`ps-price-level ${priceLevel.modifier}`}
          role="status"
          aria-live="polite"
        >
          <IconShield size={14} />
          <span>{priceLevel.label}</span>
          <span className="ps-price-level-value" aria-label="at price">
            ₦{base.toLocaleString("en-NG")}
          </span>
        </div>
      )}

      {/* ── Original price ── */}
      <PriceInput
        id="ps-original-price"
        label="Original Price (NGN) — optional"
        value={originalPrice}
        onChange={setOriginalPrice}
        onBlur={() => onBlur?.("originalPrice")}
        error={errors.originalPrice}
        touched={touched.originalPrice}
        hint="Show a crossed-out price to highlight your discount."
      />

      {/* ── Discount summary ── */}
      {discountPct > 0 && savings > 0 && (
        <div className="ps-discount" role="status" aria-live="polite">
          <span className="ps-discount-icon">
            <IconTag size={18} />
          </span>
          <div className="ps-discount-body">
            <p className="ps-discount-title">
              Buyer saves ₦{savings.toLocaleString("en-NG")}
            </p>
            <p className="ps-discount-sub">
              Shown as{" "}
              <span className="ps-discount-original">
                ₦{original.toLocaleString("en-NG")}
              </span>
              {" "}&rarr;{" "}
              <strong className="ps-discount-final">
                ₦{base.toLocaleString("en-NG")}
              </strong>
            </p>
          </div>
          <span className="ps-discount-badge" aria-label={`${discountPct} percent off`}>
            -{discountPct}%
          </span>
        </div>
      )}

      {/* ── Earnings breakdown ── */}
      {base > 0 && (
        <div className="ps-earnings">
          <p className="ps-earnings-title">
            <IconTrendingUp size={14} />
            <span>Earnings Breakdown</span>
          </p>

          <div className="ps-stat-row">
            <StatBox
              label="Your Price"
              value={`₦${base.toLocaleString("en-NG")}`}
            />
            <StatBox
              label="Platform Fee (5%)"
              value={`-₦${platformFee.toLocaleString("en-NG")}`}
              modifier="ps-stat--fee"
            />
            <StatBox
              label="You Receive"
              value={`₦${youReceive.toLocaleString("en-NG")}`}
              sub="after platform fee"
              modifier="ps-stat--receive"
            />
          </div>

          <p className="ps-earnings-note">
            <IconInfo size={11} />
            <span>Platform fee is illustrative. Actual fees may vary.</span>
          </p>
        </div>
      )}

      {/* ── Pricing tips ── */}
      <div className="ps-tips">
        <Tip
          icon={IconBarChart}
          text="Check similar listings before setting your price to stay competitive."
          modifier="ps-tip--indigo"
        />
        <Tip
          icon={IconCamera}
          text="Listings with 3 or more photos sell significantly faster regardless of price."
          modifier="ps-tip--blue"
        />
        <Tip
          icon={IconPercent}
          text="A crossed-out original price draws attention and increases buyer trust."
          modifier="ps-tip--orange"
        />
      </div>

    </div>
  );
}