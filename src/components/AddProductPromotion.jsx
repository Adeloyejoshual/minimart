import { useEffect, useRef } from "react";
import { promotionPlans } from "../config/promotionPlans";

export default function AddProductPromotion({ form, onSelectPlan, onTogglePromote }) {
  const formatPrice = (num) => num?.toLocaleString("en-NG");
  const plansRef = useRef(null);

  // Scroll selected plan into center
  useEffect(() => {
    if (form.promotionPlan && plansRef.current) {
      const activeCard = plansRef.current.querySelector(".promo-card.active");
      if (activeCard) {
        const container = plansRef.current;
        const containerWidth = container.offsetWidth;
        const cardWidth = activeCard.offsetWidth;
        const cardLeft = activeCard.offsetLeft;
        const scrollPosition = cardLeft - containerWidth / 2 + cardWidth / 2;

        container.scrollTo({
          left: scrollPosition,
          behavior: "smooth",
        });
      }
    }
  }, [form.promotionPlan]);

  return (
    <div className="promotion-section">
      {/* Toggle Promote */}
      <label className="promo-toggle">
        <input
          type="checkbox"
          checked={form.isPromoted}
          onChange={(e) => onTogglePromote(e.target.checked)}
        />
        Promote this product
      </label>

      {/* Promotion Plans */}
      {form.isPromoted && (
        <div
          className="promo-plans"
          ref={plansRef}
          tabIndex={0}
          aria-label="Promotion plans scrollable"
        >
          {promotionPlans.map((plan) => {
            const isFree = plan.price === 0;
            const discounted = plan.discountPrice != null && plan.discountPrice < plan.price;
            const active = form.promotionPlan?.id === plan.id;

            return (
              <div
                key={plan.id}
                className={`promo-card ${active ? "active" : ""}`}
                onClick={() => onSelectPlan(plan)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelectPlan(plan);
                }}
                aria-pressed={active}
              >
                {/* Popular / Discount Badges */}
                {plan.popular && <span className="badge popular">Popular</span>}
                {discounted && (
                  <span className="badge discount">
                    Save ₦{Math.max(0, plan.price - plan.discountPrice)}
                  </span>
                )}

                {/* Plan Label */}
                <h4>
                  {plan.label} {isFree && "(Free)"}
                </h4>

                {/* Price */}
                {isFree ? (
                  <div className="price">₦0</div>
                ) : discounted ? (
                  <div className="price-section">
                    <div className="old-price">₦{formatPrice(plan.price)}</div>
                    <div className="price">₦{formatPrice(plan.discountPrice)}</div>
                  </div>
                ) : (
                  <div className="price">₦{formatPrice(plan.price)}</div>
                )}

                {/* Duration */}
                <p>{plan.days} day{plan.days > 1 ? "s" : ""}</p>

                {/* Paid Badge */}
                {active && form.paymentSuccess && !isFree && (
                  <span className="paid">Paid ✓</span>
                )}

                {/* Plan Icon at the bottom */}
                <div className="plan-icon-bottom">{plan.icon}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}