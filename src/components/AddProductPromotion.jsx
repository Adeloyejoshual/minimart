import { promotionPlans } from "../config/promotionPlans";

export default function AddProductPromotion({
  form,
  onSelectPlan,
  onTogglePromote,
}) {
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
            const discounted = plan.discountPrice && plan.discountPrice < plan.price;
            const active = form.promotionPlan?.id === plan.id;

            return (
              <div
                key={plan.id}
                className={`promo-card ${active ? "active" : ""}`}
                onClick={() => onSelectPlan(plan)}
              >
                {plan.popular && <span className="badge popular">Popular</span>}

                {discounted && (
                  <span className="badge discount">
                    Save ₦{plan.price - plan.discountPrice}
                  </span>
                )}

                <h4>{plan.label}</h4>

                {discounted ? (
                  <>
                    <div className="old-price">₦{plan.price}</div>
                    <div className="price">₦{plan.discountPrice}</div>
                  </>
                ) : (
                  <div className="price">₦{plan.price}</div>
                )}

                <p>{plan.days} day{plan.days > 1 ? "s" : ""}</p>

                {active && form.paymentSuccess && (
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