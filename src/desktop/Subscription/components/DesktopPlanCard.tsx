import "./styles/desktop-plan-card.css";

interface Plan {
  id:                string;
  slug:              string;
  name:              string;
  badge:             string;
  monthlyPriceNaira: number;
  yearlyPriceNaira:  number;
  features:          string[];
}

interface Props {
  plan:            Plan;
  cycle:           "monthly" | "yearly";
  currentPlan:     string | undefined;
  isCurrentActive: boolean;
  loading:         boolean;
  onSelect:        () => void;
}

const FEATURE_HIGHLIGHTS: Record<string, Array<{ icon: JSX.Element; text: string }>> = {
  premium: [
    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>, text: "Auto-renewal" },
    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>, text: "Search boost" },
    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>, text: "Basic analytics" },
    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/></svg>, text: "Priority support" },
  ],
  pro: [
    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, text: "Featured listings (5/mo)" },
    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>, text: "Stronger search boost" },
    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>, text: "Advanced analytics" },
    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>, text: "Faster support" },
  ],
  business: [
    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>, text: "Business verification" },
    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>, text: "Team accounts" },
    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>, text: "Inventory management" },
    { icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>, text: "High search boost" },
  ],
};

const DesktopPlanCard = ({
  plan, cycle, currentPlan, isCurrentActive, loading, onSelect,
}: Props) => {
  const isCurrentPlan     = isCurrentActive && currentPlan === plan.slug;
  const isFeatured        = plan.slug === "business";
  const price             = cycle === "yearly" ? plan.yearlyPriceNaira : plan.monthlyPriceNaira;
  const monthlyEquivalent = cycle === "yearly" ? Math.round(plan.yearlyPriceNaira / 12) : null;
  const highlights        = FEATURE_HIGHLIGHTS[plan.slug] ?? [];

  return (
    <div className={`dpc-card ${isFeatured ? "dpc-card--featured" : ""}`}>

      {isFeatured && (
        <span className="dpc-card__popular">Most Popular</span>
      )}
      {isCurrentPlan && (
        <span className="dpc-card__current-badge">Current</span>
      )}

      <div className="dpc-card__identity">
        <span className="dpc-card__badge">{plan.badge}</span>
        <h3 className="dpc-card__name">{plan.name}</h3>
      </div>

      <div className="dpc-card__pricing">
        <div className="dpc-card__price-row">
          <span className="dpc-card__price">₦{price.toLocaleString("en-NG")}</span>
          <span className="dpc-card__period">/{cycle === "yearly" ? "yr" : "mo"}</span>
        </div>
        {monthlyEquivalent && (
          <p className="dpc-card__equiv">
            ≈ ₦{monthlyEquivalent.toLocaleString("en-NG")}/month
          </p>
        )}
      </div>

      <ul className="dpc-card__features">
        {highlights.map((h, i) => (
          <li key={i}>
            <span className="dpc-card__feature-icon">{h.icon}</span>
            {h.text}
          </li>
        ))}
      </ul>

      {isCurrentPlan ? (
        <div className="dpc-card__current-label">Current Plan</div>
      ) : (
        <button
          onClick={onSelect}
          disabled={loading}
          className={`dpc-btn ${isFeatured ? "dpc-btn--primary" : "dpc-btn--dark"}`}
        >
          {loading ? (
            <><span className="dpc-btn__spinner" /> Processing...</>
          ) : isCurrentActive ? (
            "Switch to This Plan"
          ) : (
            "Get Started"
          )}
        </button>
      )}
    </div>
  );
};

export default DesktopPlanCard;