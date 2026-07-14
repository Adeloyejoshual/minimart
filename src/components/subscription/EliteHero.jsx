import "../../styles/subscription/index.css";

const EliteSVG = () => (
  <svg
    className="elite-hero__svg"
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <radialGradient id="eGlow" cx="50%" cy="40%" r="55%">
        <stop offset="0%"   stopColor="var(--o)" stopOpacity="0.12" />
        <stop offset="100%" stopColor="var(--o)" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="eFill" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%"   stopColor="var(--o2)" stopOpacity="0.85" />
        <stop offset="100%" stopColor="var(--o)"  stopOpacity="0.5" />
      </linearGradient>
      <linearGradient id="eShine" x1="20%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%"   stopColor="#fff" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </defs>

    {/* Background glow */}
    <circle cx="100" cy="100" r="90" fill="url(#eGlow)" />

    {/* Star shape — 5 points */}
    <polygon
      points="100,20 118,72 175,72 128,106 146,160 100,130 54,160 72,106 25,72 82,72"
      fill="url(#eFill)"
      stroke="var(--o)"
      strokeWidth="1.2"
      strokeOpacity="0.3"
    />

    {/* Top facet shine */}
    <polygon
      points="100,20 118,72 82,72"
      fill="url(#eShine)"
    />

    {/* Inner star lines */}
    <line x1="100" y1="20" x2="100" y2="130" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.12" />
    <line x1="82"  y1="72" x2="146" y2="160" stroke="#fff" strokeWidth="0.4" strokeOpacity="0.08" />
    <line x1="118" y1="72" x2="54"  y2="160" stroke="#fff" strokeWidth="0.4" strokeOpacity="0.08" />
    <line x1="25"  y1="72" x2="128" y2="106" stroke="#fff" strokeWidth="0.4" strokeOpacity="0.08" />
    <line x1="175" y1="72" x2="72"  y2="106" stroke="#fff" strokeWidth="0.4" strokeOpacity="0.08" />

    {/* Center sparkle */}
    <circle cx="100" cy="88" r="4" fill="#fff" fillOpacity="0.35" />
    <circle cx="100" cy="88" r="2" fill="#fff" fillOpacity="0.7" />

    {/* Accent sparkles */}
    <circle cx="78"  cy="60" r="1" fill="#fff" fillOpacity="0.35" />
    <circle cx="122" cy="60" r="1" fill="#fff" fillOpacity="0.35" />
    <circle cx="62"  cy="95" r="0.8" fill="#fff" fillOpacity="0.2" />
    <circle cx="138" cy="95" r="0.8" fill="#fff" fillOpacity="0.2" />
    <circle cx="88"  cy="130" r="0.7" fill="#fff" fillOpacity="0.15" />
    <circle cx="112" cy="130" r="0.7" fill="#fff" fillOpacity="0.15" />

    {/* Orbiting dots */}
    <circle cx="100" cy="100" r="70" fill="none" stroke="#fff" strokeWidth="0.3" strokeOpacity="0.06" strokeDasharray="4 8" />
    <circle cx="170" cy="100" r="2" fill="var(--o)" fillOpacity="0.25" />
    <circle cx="30"  cy="100" r="2" fill="var(--o)" fillOpacity="0.2" />
  </svg>
);

const EliteHero = ({ plan, cycle, currentPlan, isCurrentActive, loading, onSelect }) => {
  const isCurrentPlan = isCurrentActive && currentPlan === plan.slug;
  const price        = cycle === "yearly" ? plan.yearlyPriceNaira : plan.monthlyPriceNaira;
  const monthlyEquiv = cycle === "yearly" ? Math.round(plan.yearlyPriceNaira / 12) : null;

  return (
    <div className="elite-hero">
      <div className="elite-hero__glow" />
      <div className="elite-hero__content">

        {/* Left: Visual */}
        <div className="elite-hero__visual">
          <EliteSVG />
        </div>

        {/* Right: Text */}
        <div className="elite-hero__text">
          <span className="elite-hero__label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Elite Plan
          </span>
          <h2 className="elite-hero__title">{plan.name}</h2>
          <p className="elite-hero__desc">
            Homepage promotion, advertising credits, dedicated account manager,
            and early access to new features. Built for ambitious sellers.
          </p>

          <div className="elite-hero__price">
            <span className="elite-hero__amount">₦{price.toLocaleString("en-NG")}</span>
            <span className="elite-hero__cycle">/{cycle === "yearly" ? "yr" : "mo"}</span>
          </div>
          {monthlyEquiv && (
            <p className="elite-hero__equiv">≈ ₦{monthlyEquiv.toLocaleString("en-NG")}/month</p>
          )}

          <ul className="elite-hero__features">
            {(plan.features ?? []).slice(0, 5).map((f, i) => (
              <li key={i}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gn)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {f}
              </li>
            ))}
          </ul>

          {isCurrentPlan ? (
            <div className="elite-hero__current">Current Plan</div>
          ) : (
            <button onClick={onSelect} disabled={loading} className="sub-btn sub-btn--elite">
              {loading ? (
                <><span className="sub-btn__spinner" /> Processing...</>
              ) : isCurrentActive ? "Upgrade to Elite" : "Get Elite"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EliteHero;