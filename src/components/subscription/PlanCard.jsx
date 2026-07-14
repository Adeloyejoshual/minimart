import "../../styles/subscription/index.css";

const FEATURE_HIGHLIGHTS = {
  premium: [
    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>, text: "Auto-renewal" },
    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>, text: "Search boost" },
    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>, text: "Basic analytics" },
    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>, text: "Priority support" },
  ],
  pro: [
    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, text: "Featured listings (5/mo)" },
    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>, text: "Stronger boost" },
    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>, text: "Advanced analytics" },
    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>, text: "Faster support" },
  ],
  business: [
    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>, text: "Business verification" },
    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, text: "Team accounts" },
    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>, text: "Inventory management" },
    { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>, text: "High search boost" },
  ],
};

const PlanCard = ({ plan, cycle, currentPlan, isCurrentActive, loading, onSelect }) => {
  const isCurrentPlan     = isCurrentActive && currentPlan === plan.slug;
  const isFeatured        = plan.slug === "business";
  const price             = cycle === "yearly" ? plan.yearlyPriceNaira : plan.monthlyPriceNaira;
  const monthlyEquivalent = cycle === "yearly" ? Math.round(plan.yearlyPriceNaira / 12) : null;
  const highlights        = FEATURE_HIGHLIGHTS[plan.slug] ?? [];

  return (
    <div className={`sub-plan-card ${isFeatured ? "sub-plan-card--featured" : ""}`}>

      {isFeatured && (
        <span className="sub-plan-card__popular">Most Popular</span>
      )}
      {isCurrentPlan && (
        <span className="sub-plan-card__current-badge">Current</span>
      )}

      <div className="sub-plan-card__identity">
        <span className="sub-plan-card__badge">{plan.badge}</span>
        <h3 className="sub-plan-card__name">{plan.name}</h3>
      </div>

      <div className="sub-plan-card__pricing">
        <span className="sub-plan-card__price">₦{price.toLocaleString("en-NG")}</span>
        <span className="sub-plan-card__period">/{cycle === "yearly" ? "yr" : "mo"}</span>
        {monthlyEquivalent && (
          <p className="sub-plan-card__equiv">≈ ₦{monthlyEquivalent.toLocaleString("en-NG")}/month</p>
        )}
      </div>

      <ul className="sub-plan-card__features">
        {highlights.map((h, i) => (
          <li key={i}>
            <span className="sub-plan-card__feature-icon">{h.icon}</span>
            {h.text}
          </li>
        ))}
      </ul>

      {isCurrentPlan ? (
        <div className="sub-plan-card__current-label">Current Plan</div>
      ) : (
        <button
          onClick={onSelect}
          disabled={loading}
          className={`sub-btn sub-btn--full ${isFeatured ? "sub-btn--primary" : "sub-btn--dark"}`}
        >
          {loading ? (
            <><span className="sub-btn__spinner" /> Processing...</>
          ) : isCurrentActive ? "Switch to This Plan" : "Get Started"}
        </button>
      )}
    </div>
  );
};

export default PlanCard;