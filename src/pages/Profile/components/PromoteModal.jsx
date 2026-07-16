// src/pages/Profile/components/PromoteModal.jsx
import { useState } from "react";
import { Ic } from "./icons";
import { API, authH } from "./helpers";
import "./PromoteModal.css";

export default function PromoteModal({ product, plans, onClose }) {
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePromote = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/payment/initiate`, {
        method: "POST",
        headers: authH(),
        body: JSON.stringify({
          product_id: product.id,
          plan_id: selected.id,
          email: localStorage.getItem("user_email") || "",
        }),
      });
      const d = await res.json();
      if (res.ok && d.authorization_url) {
        window.location.href = d.authorization_url;
      } else {
        setError(d.message || "Could not initiate payment");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const price = Number(selected?.effective_price || selected?.price || 0);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="promote-modal" onClick={(e) => e.stopPropagation()}>
        <div className="promote-modal__header">
          <div>
            <h2 className="promote-modal__title">
              <Ic.Zap /> Promote Listing
            </h2>
            <p className="promote-modal__subtitle">"{product.title}"</p>
          </div>
          <button className="promote-modal__close" onClick={onClose}>
            <Ic.X />
          </button>
        </div>

        <div className="promote-modal__plans">
          {plans.map((plan) => {
            const planPrice = Number(
              plan.effective_price || plan.price || 0
            );
            const isFree = planPrice === 0;
            const isSelected = selected?.id === plan.id;
            return (
              <div
                key={plan.id}
                className={`plan-card${isSelected ? " plan-card--active" : ""}${
                  isFree ? " plan-card--free" : ""
                }`}
                onClick={() => setSelected(plan)}
              >
                {isFree && (
                  <span className="plan-card__ribbon">FREE</span>
                )}
                {plan.discount_percent > 0 && (
                  <span className="plan-card__discount">
                    -{plan.discount_percent}%
                  </span>
                )}
                <h4 className="plan-card__name">{plan.name}</h4>
                <p className="plan-card__price">
                  {isFree
                    ? "Free"
                    : `₦${planPrice.toLocaleString("en-NG")}`}
                </p>
                <p className="plan-card__duration">{plan.duration}</p>
                <p className="plan-card__desc">{plan.description}</p>
                {Array.isArray(plan.features) &&
                  plan.features.length > 0 && (
                    <ul className="plan-card__features">
                      {plan.features.map((f, i) => (
                        <li key={i}>
                          <span className="plan-card__check">
                            <Ic.Check />
                          </span>{" "}
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                {isSelected && (
                  <div className="plan-card__selected-ring" />
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="promote-modal__error">{error}</p>}

        <div className="promote-modal__footer">
          <button className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn--primary"
            onClick={handlePromote}
            disabled={!selected || loading}
          >
            {loading
              ? "Processing…"
              : selected
              ? price === 0
                ? "Activate Free Boost"
                : `Pay ₦${price.toLocaleString("en-NG")}`
              : "Select a Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}