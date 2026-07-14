import "../../styles/subscription/index.css";

const DiamondSVG = () => (
  <svg
    className="diamond-hero__svg"
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <radialGradient id="dGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%"   stopColor="var(--o)" stopOpacity="0.15" />
        <stop offset="100%" stopColor="var(--o)" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="dFill" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%"   stopColor="var(--o2)" stopOpacity="0.9" />
        <stop offset="50%"  stopColor="var(--o)"  stopOpacity="0.7" />
        <stop offset="100%" stopColor="var(--o)"  stopOpacity="0.4" />
      </linearGradient>
      <linearGradient id="dShine" x1="30%" y1="0%" x2="70%" y2="100%">
        <stop offset="0%"   stopColor="#fff" stopOpacity="0.6" />
        <stop offset="50%"  stopColor="#fff" stopOpacity="0.1" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </defs>
    <circle cx="100" cy="100" r="90" fill="url(#dGlow)" />
    <polygon points="100,18 165,72 100,180 35,72" fill="url(#dFill)" stroke="var(--o)" strokeWidth="1.5" strokeOpacity="0.3" />
    <polygon points="100,18 65,72 135,72" fill="url(#dShine)" />
    <polygon points="35,72 65,72 100,180" fill="#fff" fillOpacity="0.08" />
    <polygon points="165,72 135,72 100,180" fill="#fff" fillOpacity="0.04" />
    <line x1="65" y1="72" x2="100" y2="180" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.15" />
    <line x1="135" y1="72" x2="100" y2="180" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.15" />
    <line x1="100" y1="18" x2="65" y2="72" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.2" />
    <line x1="100" y1="18" x2="135" y2="72" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.2" />
    <circle cx="100" cy="65" r="3" fill="#fff" fillOpacity="0.5" />
    <circle cx="100" cy="65" r="1.5" fill="#fff" fillOpacity="0.9" />
    <circle cx="72" cy="55" r="1" fill="#fff" fillOpacity="0.4" />
    <circle cx="128" cy="55" r="1" fill="#fff" fillOpacity="0.4" />
    <circle cx="85" cy="90" r="0.8" fill="#fff" fillOpacity="0.25" />
    <circle cx="115" cy="90" r="0.8" fill="#fff" fillOpacity="0.25" />
  </svg>
);

const DiamondHero = ({ plan, cycle, currentPlan, isCurrentActive, loading, onSelect }) => {
  const isCurrentPlan = isCurrentActive && currentPlan === plan.slug;
  const price        = cycle === "yearly" ? plan.yearlyPriceNaira : plan.monthlyPriceNaira;
  const monthlyEquiv = cycle === "yearly" ? Math.round(plan.yearlyPriceNaira / 12) : null;

  return (
    <div className="diamond-hero">
      <div className="diamond-hero__glow" />
      <div className="diamond-hero__content">
        <div className="diamond-hero__text">
          <span className="diamond-hero__label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3l1 6"/><path d="M2 9h20"/></svg>
            Ultimate Plan
          </span>
          <h2 className="diamond-hero__title">{plan.name}</h2>
          <p className="diamond-hero__desc">
            Maximum search visibility, VIP support, API access, custom branding,
            and strategic account management. The ultimate seller experience.
          </p>

          <div className="diamond-hero__price">
            <span className="diamond-hero__amount">₦{price.toLocaleString("en-NG")}</span>
            <span className="diamond-hero__cycle">/{cycle === "yearly" ? "yr" : "mo"}</span>
          </div>
          {monthlyEquiv && (
            <p className="diamond-hero__equiv">≈ ₦{monthlyEquiv.toLocaleString("en-NG")}/month</p>
          )}

          <ul className="diamond-hero__features">
            {(plan.features ?? []).slice(0, 6).map((f, i) => (
              <li key={i}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gn)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {f}
              </li>
            ))}
          </ul>

          {isCurrentPlan ? (
            <div className="diamond-hero__current">Current Plan</div>
          ) : (
            <button onClick={onSelect} disabled={loading} className="sub-btn sub-btn--diamond">
              {loading ? (
                <><span className="sub-btn__spinner" /> Processing...</>
              ) : isCurrentActive ? "Upgrade to Diamond" : "Get Diamond"}
            </button>
          )}
        </div>

        <div className="diamond-hero__visual">
          <DiamondSVG />
        </div>
      </div>
    </div>
  );
};

export default DiamondHero;