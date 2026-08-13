/**
 * src/pages/Checkout/CouponPicker.jsx
 *
 * Bottom-sheet modal showing the user's available coupons.
 * Opens when user taps "Have a coupon?" — user picks one to
 * auto-apply, or types a code manually.
 *
 * Props:
 *   isOpen      boolean  — controls visibility
 *   subtotal    number   — cart total for preview discounts
 *   onClose     fn       — close without picking
 *   onApply     async fn — (code) => { ok, message } — same
 *                          contract as ReviewStep.onCouponApply
 */

import {
  useState, useEffect, useCallback, useRef, useMemo, memo,
} from "react";
import axios from "axios";
import "./styles/CouponPicker.css";

const API = `${import.meta.env.VITE_API_BASE_URL}/api`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const authHeader = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const fmt = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS
═══════════════════════════════════════════════════════════════ */
const Icon = {
  X: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Ticket: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
      <line x1="13" y1="5" x2="13" y2="19" strokeDasharray="2 2" />
    </svg>
  ),
  Check: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="3"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Clock: ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
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
  Percent: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="5" x2="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  ),
  Alert: ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Search: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   COUPON CARD (memoised sub-component)
═══════════════════════════════════════════════════════════════ */
const CouponCard = memo(function CouponCard({
  coupon,
  onSelect,
  isApplying,
}) {
  const typeIcon = useMemo(() => {
    if (coupon.type === "free_shipping") return <Icon.Truck />;
    if (coupon.type === "percentage")    return <Icon.Percent />;
    return <Icon.Ticket />;
  }, [coupon.type]);

  return (
    <button
      type="button"
      className={`cp-card ${coupon.usable ? "cp-card--usable" : "cp-card--disabled"}`}
      onClick={() => coupon.usable && !isApplying && onSelect(coupon)}
      disabled={!coupon.usable || isApplying}
      aria-label={
        coupon.usable
          ? `Apply coupon ${coupon.code}, ${coupon.preview_label}`
          : `${coupon.code} — ${coupon.unusable_reason}`
      }
    >
      {/* Left — icon + type */}
      <div className="cp-card__left">
        <div className="cp-card__icon">{typeIcon}</div>
        <div className="cp-card__preview">
          {coupon.preview_label}
        </div>
      </div>

      {/* Middle — code + description */}
      <div className="cp-card__body">
        <div className="cp-card__code">{coupon.code}</div>

        {coupon.description && (
          <p className="cp-card__desc">{coupon.description}</p>
        )}

        <div className="cp-card__meta">
          {coupon.min_purchase > 0 && (
            <span className="cp-card__meta-item">
              Min. {fmt(coupon.min_purchase)}
            </span>
          )}
          {coupon.days_left !== null && coupon.days_left <= 7 && (
            <span className="cp-card__meta-item cp-card__meta-item--warn">
              <Icon.Clock />
              {coupon.days_left === 0
                ? "Expires today"
                : `${coupon.days_left} day${coupon.days_left > 1 ? "s" : ""} left`
              }
            </span>
          )}
        </div>

        {!coupon.usable && coupon.unusable_reason && (
          <p className="cp-card__unusable">
            <Icon.Alert /> {coupon.unusable_reason}
          </p>
        )}
      </div>

      {/* Right — CTA */}
      {coupon.usable && (
        <div className="cp-card__cta">
          {isApplying ? (
            <span className="cp-spinner" />
          ) : (
            "APPLY"
          )}
        </div>
      )}
    </button>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
const CouponPicker = memo(function CouponPicker({
  isOpen,
  subtotal,
  onClose,
  onApply,
}) {
  const [coupons,      setCoupons]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [applyingCode, setApplyingCode] = useState(null);

  /* Manual code entry */
  const [manualCode,   setManualCode]   = useState("");
  const [manualError,  setManualError]  = useState(null);
  const [manualBusy,   setManualBusy]   = useState(false);

  /* Filter */
  const [search, setSearch] = useState("");

  const sheetRef = useRef(null);

  /* ── Fetch coupons when opened ── */
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    axios
      .get(`${API}/checkout/coupons`, {
        headers: authHeader(),
        params : { subtotal },
      })
      .then(({ data }) => {
        if (cancelled) return;
        setCoupons(data.coupons ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[CouponPicker] load failed:", err.message);
        setError(
          err.response?.data?.message ??
          "Could not load your coupons."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, subtotal]);

  /* ── Escape to close ── */
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  /* ── Lock body scroll while open ── */
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  /* ── Filtered list ── */
  const filteredCoupons = useMemo(() => {
    if (!search.trim()) return coupons;
    const q = search.trim().toUpperCase();
    return coupons.filter((c) =>
      c.code.toUpperCase().includes(q) ||
      (c.description ?? "").toUpperCase().includes(q)
    );
  }, [coupons, search]);

  const usableCount   = coupons.filter((c) => c.usable).length;
  const unusableCount = coupons.length - usableCount;

  /* ── Apply from card click ── */
  const handleSelect = useCallback(async (coupon) => {
    setApplyingCode(coupon.code);
    setManualError(null);

    const result = await onApply(coupon.code);

    setApplyingCode(null);

    if (result?.ok) {
      onClose();
    } else {
      setError(result?.message ?? "Failed to apply coupon.");
    }
  }, [onApply, onClose]);

  /* ── Apply from manual entry ── */
  const handleManualApply = useCallback(async () => {
    const code = manualCode.trim().toUpperCase();
    if (!code) {
      setManualError("Please enter a code");
      return;
    }

    setManualBusy(true);
    setManualError(null);

    const result = await onApply(code);

    setManualBusy(false);

    if (result?.ok) {
      onClose();
    } else {
      setManualError(result?.message ?? "Invalid coupon code");
    }
  }, [manualCode, onApply, onClose]);

  const handleManualKey = useCallback((e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleManualApply();
    }
  }, [handleManualApply]);

  if (!isOpen) return null;

  return (
    <div
      className="cp-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Choose a coupon"
    >
      <div
        ref={sheetRef}
        className="cp-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (visual only) */}
        <div className="cp-handle" aria-hidden="true" />

        {/* Header */}
        <div className="cp-header">
          <div className="cp-header__title-row">
            <h2 className="cp-header__title">
              <Icon.Ticket /> Your Coupons
            </h2>
            <button
              type="button"
              className="cp-header__close"
              onClick={onClose}
              aria-label="Close"
            >
              <Icon.X />
            </button>
          </div>

          {!loading && !error && (
            <p className="cp-header__sub">
              {usableCount > 0
                ? `${usableCount} available for this order`
                : "No coupons available for this cart amount"}
              {unusableCount > 0 && ` · ${unusableCount} unavailable`}
            </p>
          )}
        </div>

        {/* Manual code entry */}
        <div className="cp-manual">
          <p className="cp-manual__label">Have a code?</p>
          <div className="cp-manual__row">
            <input
              type="text"
              className={`cp-manual__input ${manualError ? "cp-manual__input--error" : ""}`}
              placeholder="Enter code"
              value={manualCode}
              onChange={(e) => {
                setManualCode(e.target.value.toUpperCase().slice(0, 50));
                setManualError(null);
              }}
              onKeyDown={handleManualKey}
              disabled={manualBusy}
              aria-invalid={!!manualError}
            />
            <button
              type="button"
              className="cp-manual__btn"
              onClick={handleManualApply}
              disabled={manualBusy || !manualCode.trim()}
            >
              {manualBusy ? "…" : "APPLY"}
            </button>
          </div>
          {manualError && (
            <p className="cp-manual__error" role="alert">
              <Icon.Alert /> {manualError}
            </p>
          )}
        </div>

        {/* Search coupons (only shown if user has 5+ coupons) */}
        {coupons.length >= 5 && (
          <div className="cp-search">
            <span className="cp-search__icon">
              <Icon.Search />
            </span>
            <input
              type="text"
              className="cp-search__input"
              placeholder="Search coupons"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}

        {/* Coupon list */}
        <div className="cp-list" role="list">
          {loading && (
            <div className="cp-loading">
              <span className="cp-spinner cp-spinner--lg" />
              <p>Loading your coupons…</p>
            </div>
          )}

          {!loading && error && (
            <div className="cp-empty">
              <Icon.Alert size={32} />
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && filteredCoupons.length === 0 && (
            <div className="cp-empty">
              <Icon.Ticket size={32} />
              {search ? (
                <p>No coupons match "{search}"</p>
              ) : (
                <>
                  <p><strong>No coupons yet</strong></p>
                  <p className="cp-empty__sub">
                    Play Spin & Win or check back later for offers.
                  </p>
                </>
              )}
            </div>
          )}

          {!loading && !error && filteredCoupons.map((coupon) => (
            <CouponCard
              key={coupon.id}
              coupon={coupon}
              onSelect={handleSelect}
              isApplying={applyingCode === coupon.code}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

export default CouponPicker;