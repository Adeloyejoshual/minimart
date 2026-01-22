import { promotionPlans } from "../config/promotionPlans";

export default function AddProductPromotion({ form, onSelectPlan, onTogglePromote }) {
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
        <div className="promo-plans">
          {promotionPlans.map(plan => {
            const isFree = plan.price === 0;
            const discounted = plan.discountPrice != null && plan.discountPrice < plan.price;
            const active = form.promotionPlan?.id === plan.id;

            return (
              <div
                key={plan.id}
                className={`promo-card ${active ? "active" : ""}`}
                onClick={() => onSelectPlan(plan)}
              >
                {/* Popular badge */}
                {plan.popular && <span className="badge popular">Popular</span>}

                {/* Discount badge */}
                {discounted && (
                  <span className="badge discount">
                    Save ₦{plan.price - plan.discountPrice}
                  </span>
                )}

                <h4>{plan.label} {isFree && "(Free)"}</h4>

                {/* Price display */}
                {isFree ? (
                  <div className="price">₦0</div>
                ) : discounted ? (
                  <>
                    <div className="old-price">₦{plan.price}</div>
                    <div className="price">₦{plan.discountPrice}</div>
                  </>
                ) : (
                  <div className="price">₦{plan.price}</div>
                )}

                <p>{plan.days} day{plan.days > 1 ? "s" : ""}</p>

                {/* Paid status */}
                {active && form.paymentSuccess && !isFree && (
                  <span className="paid">Paid ✓</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}