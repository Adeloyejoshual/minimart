/**
 * src/product/shared/PromotionPlanSection.jsx
 * Plan cards — create mode only
 */
import { useCallback, useMemo, useRef } from "react";
import { useAddProductContext } from "../../hooks/useAddProductContext.js";
import { WarningIcon, SpinnerIcon, CheckIcon, StarIcon }
  from "../components/icons/index.jsx";

const safeStr = (v) => (typeof v === "string" ? v : String(v ?? ""));

export default function PromotionPlanSection({ innerRef }) {
  const {
    promotionPlans, plansLoading,
    selectedPlan, setSelectedPlan,
    displayPrice, isEditMode,
  } = useAddProductContext();

  const planRefs = useRef([]);

  const bestValuePlanId = useMemo(() => {
    if (!promotionPlans.length) return null;
    let best = null, bestDiscount = 0;
    for (const p of promotionPlans) {
      const d = Number(p.discount_percent ?? 0);
      if (d > bestDiscount) { bestDiscount = d; best = p.id; }
    }
    return bestDiscount > 0 ? best : null;
  }, [promotionPlans]);

  const planPriceLabel = useCallback((plan) => {
    const price    = Number(plan.price ?? 0);
    const discount = Number(plan.discount_percent ?? 0);
    if (price === 0) return "Free";
    if (discount > 0) {
      const eff = Number(plan.effective_price) > 0
        ? Number(plan.effective_price)
        : price * (1 - discount / 100);
      return (
        <>
          <span className="plan-price-original">&#8358;{displayPrice(price)}</span>{" "}
          <span className="plan-price-effective">&#8358;{displayPrice(eff.toFixed(2))}</span>{" "}
          <span className="plan-price-badge">-{discount}%</span>
        </>
      );
    }
    return <>&#8358;{displayPrice(price)}</>;
  }, [displayPrice]);

  if (isEditMode) return null;

  return (
    <section ref={innerRef} className="section form-card">
      <h3 className="section-title">Promotion Plan</h3>

      {plansLoading && (
        <div className="plans-loading" aria-live="polite">
          <SpinnerIcon /> Loading plans&#8230;
        </div>
      )}

      {!plansLoading && promotionPlans.length === 0 && (
        <div className="form-error" role="alert">
          <WarningIcon /> Could not load promotion plans. Please refresh.
        </div>
      )}

      {!plansLoading && promotionPlans.length > 0 && (
        <div className="plans-grid" role="radiogroup" aria-label="Promotion plan">
          {promotionPlans.map((plan, planIndex) => {
            const isSelected  = String(selectedPlan?.id) === String(plan.id);
            const isBestValue = String(plan.id) === String(bestValuePlanId);
            return (
              <div
                key={plan.id}
                ref={(el) => { if (el) planRefs.current[planIndex] = el; }}
                className={[
                  "plan-card",
                  isSelected  ? "selected"        : "",
                  isBestValue ? "plan-card--best" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => setSelectedPlan(isSelected ? null : plan)}
                role="radio"
                tabIndex={isSelected ? 0 : -1}
                aria-checked={isSelected}
                aria-label={`${plan.name} plan${isBestValue ? " — Best Value" : ""}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedPlan(isSelected ? null : plan);
                    return;
                  }
                  const total = promotionPlans.length;
                  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                    e.preventDefault();
                    const next = (planIndex + 1) % total;
                    setSelectedPlan(promotionPlans[next]);
                    planRefs.current[next]?.focus();
                  }
                  if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                    e.preventDefault();
                    const prev = (planIndex - 1 + total) % total;
                    setSelectedPlan(promotionPlans[prev]);
                    planRefs.current[prev]?.focus();
                  }
                }}
              >
                {isBestValue && (
                  <div className="plan-best-badge">
                    <StarIcon /> Best Value
                  </div>
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
                    {plan.features.map((f) => (
                      <li key={safeStr(f)}><CheckIcon /> {safeStr(f)}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}