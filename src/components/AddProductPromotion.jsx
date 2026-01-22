import { promotionPlans } from "../config/promotionPlans";

export default function AddProductPromotion({
  form,
  onSelectPlan,
  onTogglePromote,
}) {
  return (
    <div className="field">
      <label>Promotion Plan</label>

      <div className="promotion-scroll">
        {promotionPlans.map(plan => (
          <div
            key={plan.id}
            className={`promotion-item ${
              form.promotionPlan?.id === plan.id ? "active" : ""
            }`}
            onClick={() => onSelectPlan(plan)}
          >
            <span className="promotion-icon">{plan.icon}</span>
            <span className="promotion-label">{plan.label}</span>
            <span className="promotion-days">{plan.days} days</span>
            <span className="promotion-price">
              {plan.price > 0 ? `₦${plan.price}` : "Free"}
            </span>

            {form.promotionPlan?.id === plan.id && form.paymentSuccess && (
              <span className="promotion-paid">✓ Paid</span>
            )}
          </div>
        ))}
      </div>

      <div className="promotion-toggle">
        <label>
          <input
            type="checkbox"
            checked={form.isPromoted}
            onChange={e => onTogglePromote(e.target.checked)}
          />{" "}
          Promote this product
        </label>
      </div>
    </div>
  );
}