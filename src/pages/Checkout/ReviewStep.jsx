/**
 * src/pages/Checkout/ReviewStep.jsx
 *
 * Step 2 of checkout — order review before payment.
 *
 * v7 — Dynamic delivery dates
 * ──────────────────────────────────────────────────────────────
 * ✓ Dynamic delivery date range (e.g. "5 August — 11 August")
 * ✓ Auto-skips Sundays (non-delivery days)
 * ✓ 3pm cutoff — post-cutoff orders count from next day
 * ✓ Loemart Express note shows delivery window prominently
 * ✓ Order summary ETA row also shows the date range
 * ✓ All v6 features: flat design, coupon picker, free shipping,
 *   memoisation, debounced notes, seller grouping, skeletons
 */

import {
  useState, useEffect, useMemo, useCallback, useRef, memo,
} from "react";
import "./styles/ReviewStep.css";
import { getDeliveryRange } from "./utils/deliveryDates";

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const fmt = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

const toNumber = (v) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

function groupBySeller(items) {
  const groups = new Map();
  items.forEach((item) => {
    const key  = item.sellerId   ?? "unknown";
    const name = item.sellerName ?? "Seller";
    if (!groups.has(key)) {
      groups.set(key, { sellerId: key, sellerName: name, items: [] });
    }
    groups.get(key).items.push(item);
  });
  return [...groups.values()];
}

function itemKey(item, idx) {
  return (
    item.id ??
    `${item.product_id ?? "p"}-${item.variant?.id ?? "v"}-${idx}`
  );
}

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const NOTES_MAX         = 300;
const NOTES_DEBOUNCE_MS = 300;

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS  (transparent — currentColor)
═══════════════════════════════════════════════════════════════ */
const Icon = {
  Package: ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),

  BusStop: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 6v6M15 6v6M2 12h19.6" />
      <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" />
      <circle cx="7" cy="18" r="2" />
      <path d="M9 18h5" />
      <circle cx="16" cy="18" r="2" />
    </svg>
  ),

  Info: ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),

  Phone: ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),

  Store: ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l1-5h16l1 5" />
      <path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9" />
      <path d="M3 9c0 1.66 1.34 3 3 3s3-1.34 3-3M9 9c0 1.66 1.34 3 3 3s3-1.34 3-3M15 9c0 1.66 1.34 3 3 3s3-1.34 3-3" />
    </svg>
  ),

  Calendar: ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),

  Bookmark: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ),

  Check: ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="3"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),

  Truck: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="3" width="15" height="13" rx="1" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),

  Home: ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),

  Ticket: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
      <line x1="13" y1="5" x2="13" y2="19" strokeDasharray="2 2" />
    </svg>
  ),

  ChevronRight: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),

  ArrowLeft: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   STATIC CONTENT
═══════════════════════════════════════════════════════════════ */
const WHAT_HAPPENS_NEXT = [
  { icon: Icon.Check,   text: "Order confirmed + tracking ID generated" },
  { icon: Icon.Package, text: "Seller notified and begins preparing"    },
  { icon: Icon.Truck,   text: "Loemart Express picks up and delivers"   },
  { icon: Icon.Home,    text: "Delivered to your bus stop"              },
];

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENT — Address block
═══════════════════════════════════════════════════════════════ */
const AddressBlock = memo(function AddressBlock({ address, onChange }) {
  const busStop = useMemo(
    () => address?.bus_stop || address?.landmark || null,
    [address]
  );

  if (!address) return null;

  return (
    <>
      <div className="rs-section-header">
        <h3 className="rs-section-header__title">Delivering To</h3>
        {onChange && (
          <button
            type="button"
            className="rs-section-header__action"
            onClick={onChange}
          >
            Change
          </button>
        )}
      </div>

      <div className="rs-section-body">
        <p className="rs-addr__name">
          {address.recipient_name}
          <span className="rs-addr__phone"> · {address.phone}</span>
        </p>
        <p className="rs-addr__line">{address.address_line}</p>

        {busStop && (
          <div className="rs-addr__busstop">
            <Icon.BusStop size={12} />
            {busStop}
          </div>
        )}

        {address.additional_directions && (
          <p className="rs-addr__directions">
            <Icon.Info /> {address.additional_directions}
          </p>
        )}

        <p className="rs-addr__location">
          {address.city}, {address.state}
        </p>

        {address.call_before_delivery && (
          <p className="rs-addr__call">
            <Icon.Phone /> Rider will call before delivery
          </p>
        )}
      </div>
    </>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENT — Loemart Express delivery note
   ─────────────────────────────────────────────────────────────
   Shows dynamic delivery date range instead of static "1-3 days".
═══════════════════════════════════════════════════════════════ */
const DeliveryNote = memo(function DeliveryNote({ deliveryRange }) {
  return (
    <div className="rs-delivery-note">
      <span className="rs-delivery-note__icon">
        <Icon.Truck />
      </span>
      <div className="rs-delivery-note__body">
        <p className="rs-delivery-note__title">
          Delivered by Loemart Express
        </p>
        <p className="rs-delivery-note__sub">
          {deliveryRange.isSameDay ? (
            <>
              Arriving <strong>{deliveryRange.startFormatted}</strong>
            </>
          ) : (
            <>
              Delivery between{" "}
              <strong>{deliveryRange.startFormatted}</strong>
              {" "}and{" "}
              <strong>{deliveryRange.endFormatted}</strong>
            </>
          )}
        </p>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENT — Cart item row
═══════════════════════════════════════════════════════════════ */
const CartItem = memo(function CartItem({ item }) {
  const qty       = toNumber(item.qty);
  const price     = toNumber(item.price);
  const lineTotal = qty * price;

  return (
    <div className="rs-item">
      <div className="rs-item__img">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <Icon.Package size={22} />
        )}
      </div>

      <div className="rs-item__info">
        <p className="rs-item__name">{item.name}</p>
        {item.variant && (
          <p className="rs-item__variant">
            {item.variant.name}
            {item.variant.sku && (
              <span className="rs-item__sku"> · {item.variant.sku}</span>
            )}
          </p>
        )}
        <p className="rs-item__qty">
          {qty} × {fmt(price)}
        </p>
      </div>

      <p className="rs-item__price">{fmt(lineTotal)}</p>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENT — Notes with debounce
═══════════════════════════════════════════════════════════════ */
const NotesInput = memo(function NotesInput({ value, onChange }) {
  const [localValue, setLocalValue] = useState(value ?? "");
  const timerRef   = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
    clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    setLocalValue(value ?? "");
  }, [value]);

  const handleChange = useCallback((e) => {
    const v = e.target.value.slice(0, NOTES_MAX);
    setLocalValue(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (mountedRef.current) onChange?.(v);
    }, NOTES_DEBOUNCE_MS);
  }, [onChange]);

  return (
    <>
      <textarea
        className="rs-textarea"
        placeholder="Any special instructions for your order…"
        value={localValue}
        onChange={handleChange}
        rows={2}
        maxLength={NOTES_MAX}
      />
      <span
        className="rs-textarea-count"
        data-empty={localValue.length === 0}
      >
        {localValue.length}/{NOTES_MAX}
      </span>
    </>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENT — Coupon section
═══════════════════════════════════════════════════════════════ */
const CouponSection = memo(function CouponSection({
  couponCode,
  discount,
  freeShipping,
  couponMessage,
  onOpenPicker,
  onRemove,
}) {
  const isApplied = !!couponCode && (discount > 0 || freeShipping);

  if (isApplied) {
    return (
      <div className="rs-coupon-applied">
        <div className="rs-coupon-applied__info">
          <span className="rs-coupon-applied__code">
            <Icon.Check /> {couponCode}
          </span>
          <span className="rs-coupon-applied__save">
            {freeShipping
              ? "Free delivery applied"
              : `You save ${fmt(discount)}`
            }
          </span>
          {couponMessage && (
            <p className="rs-coupon-applied__msg">{couponMessage}</p>
          )}
        </div>
        <button
          type="button"
          className="rs-coupon-remove"
          onClick={onRemove}
          aria-label="Remove coupon"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="rs-coupon-toggle"
      onClick={onOpenPicker}
    >
      <span className="rs-coupon-toggle__left">
        <Icon.Ticket />
        Choose a coupon
      </span>
      <span className="rs-coupon-toggle__arrow">
        <Icon.ChevronRight />
      </span>
    </button>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENT — Price summary skeleton
═══════════════════════════════════════════════════════════════ */
function PriceSummarySkeleton() {
  return (
    <div className="rs-section-body">
      <div className="rs-skel-row" />
      <div className="rs-skel-row" />
      <div className="rs-skel-row" />
      <div className="rs-price-divider" />
      <div className="rs-skel-row rs-skel-row--total" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENT — Price summary
═══════════════════════════════════════════════════════════════ */
const PriceSummary = memo(function PriceSummary({
  calculation,
  cartItemCount,
  discount,
  couponCode,
  freeShipping,
  deliveryRange,
}) {
  const originalDelivery  = toNumber(calculation.deliveryFee);
  const effectiveDelivery = freeShipping ? 0 : originalDelivery;
  const grandTotal        = toNumber(calculation.subtotal)
                          - toNumber(discount)
                          + effectiveDelivery;

  return (
    <div className="rs-section-body">
      <div className="rs-price-row">
        <span>Item's total ({cartItemCount})</span>
        <span>{fmt(calculation.subtotal)}</span>
      </div>

      {discount > 0 && (
        <div className="rs-price-row rs-price-row--discount">
          <span>Discount{couponCode ? ` (${couponCode})` : ""}</span>
          <span>− {fmt(discount)}</span>
        </div>
      )}

      <div className={`rs-price-row ${freeShipping ? "rs-price-row--free" : ""}`}>
        <span>Delivery fees</span>
        <span>
          {freeShipping ? (
            <>
              <s className="rs-price-strike">{fmt(originalDelivery)}</s>
              <span className="rs-price-free-tag">FREE</span>
            </>
          ) : (
            fmt(originalDelivery)
          )}
        </span>
      </div>

      {/* Delivery ETA badge — always shown */}
      <div className="rs-price-eta-row">
        <span className="rs-price-eta">
          <Icon.Calendar />
          {deliveryRange.short}
        </span>
      </div>

      <div className="rs-price-divider" />

      <div className="rs-price-row rs-price-row--total">
        <span>Total</span>
        <span>{fmt(grandTotal)}</span>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
const ReviewStep = memo(function ReviewStep({
  cartItems,
  calculation,
  address,
  notes,
  onNotesChange,

  /* Coupon */
  couponCode,
  discount,
  freeShipping   = false,
  couponMessage  = null,
  onOpenCouponPicker,
  onCouponRemove,

  /* Navigation */
  onBack,
  onNext,
}) {
  const sellerGroups = useMemo(
    () => groupBySeller(cartItems),
    [cartItems]
  );

  const cartCount   = cartItems.length;
  const canContinue = cartCount > 0 && !!calculation;

  /*
   * Compute delivery range once for the whole review screen.
   * Recalculates only when address state changes (in case we
   * add zone-based SLAs later). Currently uses default rules
   * from utils/deliveryDates.js.
   */
  const deliveryRange = useMemo(
    () => getDeliveryRange(),
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
    [address?.state]
  );

  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    onNext?.();
  }, [canContinue, onNext]);

  return (
    <div className="rs-root">

      {/* ══ DELIVERY ADDRESS ══ */}
      <AddressBlock address={address} onChange={onBack} />

      {/* ══ LOEMART EXPRESS NOTE — with dynamic dates ══ */}
      <DeliveryNote deliveryRange={deliveryRange} />

      {/* ══ ITEMS ══ */}
      <div className="rs-section-header">
        <h3 className="rs-section-header__title">
          Order Items ({cartCount})
        </h3>
      </div>
      <div className="rs-section-body">
        {sellerGroups.map((group) => (
          <div key={group.sellerId} className="rs-seller-group">
            <div className="rs-seller-header">
              <div className="rs-seller-dot">
                {group.sellerName?.[0]?.toUpperCase() ?? "S"}
              </div>
              <span className="rs-seller-name">{group.sellerName}</span>
              <span className="rs-seller-badge">
                <Icon.Store /> Minimart
              </span>
            </div>

            {group.items.map((item, idx) => (
              <CartItem key={itemKey(item, idx)} item={item} />
            ))}
          </div>
        ))}
      </div>

      {/* ══ ORDER NOTES ══ */}
      <div className="rs-section-header">
        <h3 className="rs-section-header__title">
          Order Notes
          <span className="rs-section-header__optional">(optional)</span>
        </h3>
      </div>
      <div className="rs-section-body">
        <NotesInput value={notes} onChange={onNotesChange} />
      </div>

      {/* ══ COUPON ══ */}
      <div className="rs-section-header">
        <h3 className="rs-section-header__title">Coupon</h3>
      </div>
      <div className="rs-section-body">
        <CouponSection
          couponCode={couponCode}
          discount={discount}
          freeShipping={freeShipping}
          couponMessage={couponMessage}
          onOpenPicker={onOpenCouponPicker}
          onRemove={onCouponRemove}
        />
      </div>

      {/* ══ PRICE SUMMARY ══ */}
      <div className="rs-section-header">
        <h3 className="rs-section-header__title">Order Summary</h3>
      </div>
      {calculation ? (
        <PriceSummary
          calculation={calculation}
          cartItemCount={cartCount}
          discount={discount}
          couponCode={couponCode}
          freeShipping={freeShipping}
          deliveryRange={deliveryRange}
        />
      ) : (
        <PriceSummarySkeleton />
      )}

      {/* ══ TRACKING NOTICE ══ */}
      <div className="rs-tracking">
        <span className="rs-tracking__icon">
          <Icon.Bookmark />
        </span>
        <div className="rs-tracking__body">
          <p className="rs-tracking__title">
            Tracking ID generated after payment
          </p>
          <p className="rs-tracking__sub">
            Format: <strong>ORD-XXXXXXXX</strong>
          </p>
        </div>
      </div>

      {/* ══ WHAT HAPPENS NEXT ══ */}
      <div className="rs-section-header">
        <h3 className="rs-section-header__title">What Happens Next</h3>
      </div>
      <div className="rs-section-body">
        <ol className="rs-next-steps">
          {WHAT_HAPPENS_NEXT.map(({ icon: StepIcon, text }, idx) => (
            <li key={text} className="rs-next-step">
              <span className="rs-next-step__num">{idx + 1}</span>
              <span className="rs-next-step__icon">
                <StepIcon size={13} />
              </span>
              <span className="rs-next-step__text">{text}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* ══ NAVIGATION ══ */}
      <div className="rs-nav">
        <button
          type="button"
          className="rs-btn-back"
          onClick={onBack}
        >
          <Icon.ArrowLeft /> Back
        </button>
        <button
          type="button"
          className="rs-btn-next"
          onClick={handleContinue}
          disabled={!canContinue}
          title={
            !calculation
              ? "Calculating totals…"
              : cartCount === 0
                ? "Your cart is empty"
                : ""
          }
        >
          {!calculation ? "Calculating…" : "Choose Payment"}
        </button>
      </div>

    </div>
  );
});

export default ReviewStep;