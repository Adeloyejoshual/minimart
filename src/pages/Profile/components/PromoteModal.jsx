// src/pages/Profile/components/PromoteModal.jsx
import { useState, useCallback, useMemo } from "react";
import { Ic } from "./icons";
import { API, authH } from "./helpers";
import "./PromoteModal.css";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const PLAIN_EMAIL_KEYS = [
  "user_email",
  "userEmail",
  "email",
  "marketplace_email",
];

const JSON_USER_KEYS = [
  "user",
  "userData",
  "marketplace_user",
  "auth_user",
  "currentUser",
];

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const isValidEmail = (v) =>
  typeof v === "string" &&
  v.includes("@") &&
  v.includes(".") &&
  v.length > 5;

const resolveEmail = (propEmail) => {
  /* 1. Prop — from Dashboard: user?.email */
  if (isValidEmail(propEmail)) return propEmail;

  /* 2. Plain localStorage string keys */
  for (const key of PLAIN_EMAIL_KEYS) {
    const val = localStorage.getItem(key);
    if (isValidEmail(val)) return val;
  }

  /* 3. JSON user objects in localStorage */
  for (const key of JSON_USER_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const email  =
        parsed?.email       ||
        parsed?.user?.email ||
        null;
      if (isValidEmail(email)) return email;
    } catch {
      /* skip invalid JSON */
    }
  }

  return null;
};

const formatNaira = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num)) return "₦0";
  return `₦${num.toLocaleString("en-NG")}`;
};

/* ═══════════════════════════════════════════════════════════════
   PLAN CARD
═══════════════════════════════════════════════════════════════ */
function PlanCard({ plan, isSelected, onSelect }) {
  const planPrice = Number(plan.effective_price ?? plan.price ?? 0);
  const isFree    = planPrice === 0;

  return (
    <div
      className={[
        "plan-card",
        isSelected ? "plan-card--active" : "",
        isFree     ? "plan-card--free"   : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={() => onSelect(plan)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(plan);
        }
      }}
    >
      {/* ── Badges ── */}
      {isFree && (
        <span className="plan-card__ribbon">FREE</span>
      )}
      {Number(plan.discount_percent) > 0 && (
        <span className="plan-card__discount">
          -{plan.discount_percent}%
        </span>
      )}

      {/* ── Info ── */}
      <h4 className="plan-card__name">{plan.name}</h4>

      <p className="plan-card__price">
        {isFree ? "Free" : formatNaira(planPrice)}
      </p>

      {plan.duration && (
        <p className="plan-card__duration">{plan.duration}</p>
      )}

      {plan.description && (
        <p className="plan-card__desc">{plan.description}</p>
      )}

      {/* ── Features ── */}
      {Array.isArray(plan.features) && plan.features.length > 0 && (
        <ul className="plan-card__features">
          {plan.features.map((f, i) => (
            <li key={i}>
              <span className="plan-card__check">
                <Ic.Check />
              </span>
              {f}
            </li>
          ))}
        </ul>
      )}

      {/* ── Selected ring ── */}
      {isSelected && <div className="plan-card__selected-ring" />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EMPTY STATE
═══════════════════════════════════════════════════════════════ */
function EmptyPlans() {
  return (
    <div className="promote-modal__empty">
      <Ic.Package />
      <p>No promotion plans available</p>
      <span>Please check back later.</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROMOTE MODAL
═══════════════════════════════════════════════════════════════ */
export default function PromoteModal({
  product,
  plans    = [],
  onClose,
  userEmail,
}) {
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  /* Resolved email — computed once on mount */
  const email = useMemo(() => resolveEmail(userEmail), [userEmail]);

  /* Price of selected plan */
  const price = useMemo(
    () => Number(selected?.effective_price ?? selected?.price ?? 0),
    [selected]
  );

  /* CTA button label */
  const btnLabel = useMemo(() => {
    if (loading)     return "Processing…";
    if (!selected)   return "Select a Plan";
    if (price === 0) return "Activate Free Boost";
    return `Pay ${formatNaira(price)}`;
  }, [loading, selected, price]);

  /* ── Handle promote ── */
  const handlePromote = useCallback(async () => {
    if (!selected || loading) return;

    /* Email guard */
    if (!email) {
      setError(
        "Your account email could not be found. " +
        "Please log out and log back in, then try again."
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("[PromoteModal] initiating promotion:", {
        product_id : product.id,
        plan_id    : selected.id,
        email,
        endpoint   : `${API}/promoteplans/initiate`,
      });

      const res = await fetch(`${API}/promoteplans/initiate`, {
        method  : "POST",
        headers : authH(),
        body    : JSON.stringify({
          product_id : product.id,
          plan_id    : String(selected.id),
          email,
        }),
      });

      const d = await res.json();

      console.log("[PromoteModal] response:", res.status, d);

      if (res.ok && d.authorization_url) {
        window.location.href = d.authorization_url;
        return;
      }

      setError(d.message || "Could not initiate payment. Please try again.");

    } catch (err) {
      console.error("[PromoteModal] network error:", err);
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [selected, loading, email, product.id]);

  /* ── Close on Escape ── */
  const handleOverlayKeyDown = useCallback(
    (e) => { if (e.key === "Escape") onClose(); },
    [onClose]
  );

  /* ── Render ── */
  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Promote listing"
      onClick={onClose}
      onKeyDown={handleOverlayKeyDown}
    >
      <div
        className="promote-modal"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ════════════════════════════════
            HEADER
        ════════════════════════════════ */}
        <div className="promote-modal__header">
          <div className="promote-modal__header-text">
            <h2 className="promote-modal__title">
              <Ic.Zap />
              Promote Listing
            </h2>
            <p className="promote-modal__subtitle" title={product.title}>
              &ldquo;{product.title}&rdquo;
            </p>
          </div>
          <button
            className="promote-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <Ic.X />
          </button>
        </div>

        {/* ════════════════════════════════
            EMAIL WARNING
        ════════════════════════════════ */}
        {!email && (
          <div className="promote-modal__warn" role="alert">
            <Ic.AlertTriangle />
            <div>
              <strong>Email not found</strong>
              <p>
                Please <strong>log out and log back in</strong> before
                promoting your listing.
              </p>
            </div>
          </div>
        )}

        {/* ════════════════════════════════
            PLANS
        ════════════════════════════════ */}
        <div className="promote-modal__plans">
          {plans.length === 0 ? (
            <EmptyPlans />
          ) : (
            plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isSelected={selected?.id === plan.id}
                onSelect={setSelected}
              />
            ))
          )}
        </div>

        {/* ════════════════════════════════
            SELECTED PLAN SUMMARY
        ════════════════════════════════ */}
        {selected && (
          <div className="promote-modal__summary">
            <div className="promote-modal__summary-row">
              <span>Plan</span>
              <strong>{selected.name}</strong>
            </div>
            {selected.duration && (
              <div className="promote-modal__summary-row">
                <span>Duration</span>
                <strong>{selected.duration}</strong>
              </div>
            )}
            <div className="promote-modal__summary-row">
              <span>Total</span>
              <strong className="promote-modal__summary-price">
                {price === 0 ? "Free" : formatNaira(price)}
              </strong>
            </div>
          </div>
        )}

        {/* ════════════════════════════════
            ERROR
        ════════════════════════════════ */}
        {error && (
          <div className="promote-modal__error" role="alert">
            <Ic.AlertTriangle />
            <span>{error}</span>
          </div>
        )}

        {/* ════════════════════════════════
            FOOTER
        ════════════════════════════════ */}
        <div className="promote-modal__footer">
          <button
            className="btn btn--ghost"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn btn--primary"
            onClick={handlePromote}
            disabled={!selected || loading || !email}
            aria-busy={loading}
          >
            {loading && <span className="promote-modal__spinner" />}
            {btnLabel}
          </button>
        </div>

      </div>
    </div>
  );
}