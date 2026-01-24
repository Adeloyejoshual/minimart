import { promotionPlans } from "../config/promotionPlans";
import { useRef } from "react";

export default function AddProductPromotion({ form, onSelectPlan, onTogglePromote }) {
  const promoRef = useRef();

  const handleSnap = () => {
    const container = promoRef.current;
    if (!container) return;

    const cards = Array.from(container.children);
    const scrollLeft = container.scrollLeft + container.offsetWidth / 2;

    // Find nearest card
    let nearest = cards[0];
    let minDist = Math.abs(nearest.offsetLeft + nearest.offsetWidth / 2 - scrollLeft);

    cards.forEach(card => {
      const dist = Math.abs(card.offsetLeft + card.offsetWidth / 2 - scrollLeft);
      if (dist < minDist) {
        nearest = card;
        minDist = dist;
      }
    });

    // Smooth scroll to center nearest card
    container.scrollTo({
      left: nearest.offsetLeft - container.offsetWidth / 2 + nearest.offsetWidth / 2,
      behavior: "smooth",
    });
  };

  return (
    <div className="promotion-section">
      <label className="promo-toggle">
        <input
          type="checkbox"
          checked={form.isPromoted}
          onChange={e => onTogglePromote(e.target.checked)}
        />
        Promote this product
      </label>

      {form.isPromoted && (
        <div
          className="promo-plans"
          ref={promoRef}
          onTouchEnd={handleSnap}  // Snap nearest card on swipe end
          onMouseUp={handleSnap}   // Snap on desktop drag
        >
          {promotionPlans.map(plan => {
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
                onKeyDown={e => (e.key === "Enter" || e.key === " ") && onSelectPlan(plan)}
              >
                {plan.popular && <span className="badge popular">Popular</span>}
                {discounted && (
                  <span className="badge discount">
                    Save ₦{Math.max(0, plan.price - plan.discountPrice)}
                  </span>
                )}

                <h4>{plan.label} {isFree && "(Free)"}</h4>

                {isFree ? (
                  <div className="price">₦0</div>
                ) : discounted ? (
                  <div className="price-section">
                    <div className="old-price">₦{plan.price.toLocaleString("en-NG")}</div>
                    <div className="price">₦{plan.discountPrice.toLocaleString("en-NG")}</div>
                  </div>
                ) : (
                  <div className="price">₦{plan.price.toLocaleString("en-NG")}</div>
                )}

                <p>{plan.days} day{plan.days > 1 ? "s" : ""}</p>

                {active && form.paymentSuccess && !isFree && (
                  <span className="paid">Paid ✓</span>
                )}

                <div className="plan-icon-bottom">{plan.icon}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}