/**
 * src/pages/product/PromotionSection.jsx
 */
import { useMemo } from "react";
import { SpinnerIcon, WarningIcon, CheckIcon, ShieldIcon } from "./atoms.jsx";

const safeStr = (v) => (typeof v === "string" ? v : String(v ?? ""));

const ChevronRightIcon = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none"
       stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 3 11 8 6 13"/>
  </svg>
);

export default function PromotionSection({
  promotionPlans    = [],
  plansLoading      = false,
  selectedPlan      = null,
  isVerifiedSeller  = false,
  setSelectedPlan,
  displayPrice,
  onUpsellClick,
}) {
  /* Best value = highest discount */
  const bestValuePlanId = useMemo(() => {
    if (!promotionPlans.length) return null;
    let best = null, bestDiscount = 0;
    for (const p of promotionPlans) {
      const d = Number(p.discount_percent ?? 0);
      if (d > bestDiscount) { bestDiscount = d; best = p.id; }
    }
    return bestDiscount > 0 ? best : null;
  }, [promotionPlans]);

  const planPriceLabel = (plan) => {
    const price    = Number(plan.price ?? 0);
    const discount = Number(plan.discount_percent ?? 0);
    if (price === 0) return "Free";
    if (discount > 0) {
      const apiEffective  = Number(plan.effective_price);
      const calcEffective = price * (1 - discount / 100);
      const effective     = Number.isFinite(apiEffective) && apiEffective > 0
        ? apiEffective : calcEffective;
      return (
        <>
          <span className="plan-price-original">&#8358;{displayPrice(price)}</span>{" "}
          <span className="plan-price-effective">&#8358;{displayPrice(effective.toFixed(2))}</span>{" "}
          <span className="plan-price-badge">-{discount}%</span>
        </>
      );
    }
    return <>&#8358;{displayPrice(price)}</>;
  };

  return (
    <section className="section form-card">
      <h3 className="section-title">Promotion Plan</h3>

      {plansLoading && (
        <div className="plans-loading" aria-live="polite">
          <SpinnerIcon /> Loading plans&#8230;
        </div>
      )}

      {!plansLoading && promotionPlans.length === 0 && (
        <div className="form-error" role="alert">
          <WarningIcon /> Could not load promotion plans. Please refresh the page.
        </div>
      )}

      {!plansLoading && promotionPlans.length > 0 && (
        <div className="plans-grid" role="radiogroup" aria-label="Promotion plan">
          {promotionPlans.map((plan) => {
            const isSelected  = String(selectedPlan?.id) === String(plan.id);
            const isBestValue = String(plan.id) === String(bestValuePlanId);
            return (
              <div
                key={plan.id}
                className={[
                  "plan-card",
                  isSelected  ? "selected"        : "",
                  isBestValue ? "plan-card--best" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => setSelectedPlan(isSelected ? null : plan)}
                role="radio"
                tabIndex={0}
                aria-checked={isSelected}
                aria-label={`${plan.name} plan${isBestValue ? " — Best Value" : ""}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedPlan(isSelected ? null : plan);
                  }
                }}
              >
                {isBestValue && (
                  <div className="plan-best-badge">Best Value</div>
                )}
                <div className="plan-header">
                  <strong>{plan.name}</strong>
                  <span className="plan-price">{planPriceLabel(plan)}</span>
                </div>
                <div className="plan-duration">
                  {plan.duration || `${plan.duration_days ?? 30} days`}
                </div>
                {Array.isArray(plan.features) && plan.features.length > 0 && (
                  <ul className="plan-features">
                    {plan.features.map((f, i) => (
                      <li key={i}><CheckIcon /> {safeStr(f)}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isVerifiedSeller && !plansLoading && promotionPlans.length > 0 && (
        <button
          type="button"
          className="plans-upsell-btn"
          onClick={onUpsellClick}
          aria-haspopup="dialog"
        >
          <ShieldIcon />
          <span>Verify your identity to post without the 7-day listing limit</span>
          <ChevronRightIcon />
        </button>
      )}
    </section>
  );
}