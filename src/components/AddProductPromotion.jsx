import { promotionPlans } from "../config/promotionPlans";

export default function AddProductPromotion({ form, onSelectPlan, onTogglePromote }) {
  const formatPrice = num => num?.toLocaleString("en-NG");

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

                <h4>
                  {plan.label} {isFree && "(Free)"}
                </h4>

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

                <p>{plan.days} day{plan.days > 1 ? "s" : ""}</p>

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