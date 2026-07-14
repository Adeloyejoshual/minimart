import "./styles/desktop-diamond-hero.css";

interface Plan {
  slug:              string;
  name:              string;
  badge:             string;
  features:          string[];
  monthlyPriceNaira: number;
  yearlyPriceNaira:  number;
}

interface Props {
  plan:            Plan;
  cycle:           "monthly" | "yearly";
  currentPlan:     string | undefined;
  isCurrentActive: boolean;
  loading:         boolean;
  onSelect:        () => void;
}

const DiamondSVG = () => (
  <svg className="ddh-svg" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="ddGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%"   stopColor="var(--o)" stopOpacity="0.2" />
        <stop offset="100%" stopColor="var(--o)" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="ddFill" x1="50%" y1="0%" x2="50%" y2="100%">
        <stop offset="0%"   stopColor="var(--o2)" stopOpacity="0.92" />
        <stop offset="50%"  stopColor="var(--o)"  stopOpacity="0.72" />
        <stop offset="100%" stopColor="var(--o)"  stopOpacity="0.45" />
      </linearGradient>
      <linearGradient id="ddShine" x1="25%" y1="0%" x2="75%" y2="100%">
        <stop offset="0%"   stopColor="#fff" stopOpacity="0.65" />
        <stop offset="55%"  stopColor="#fff" stopOpacity="0.12" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </defs>
    <circle cx="100" cy="100" r="90" fill="url(#ddGlow)" />
    <polygon points="100,18 165,72 100,180 35,72" fill="url(#ddFill)" stroke="var(--o)" strokeWidth="1.5" strokeOpacity="0.3" />
    <polygon points="100,18 65,72 135,72" fill="url(#ddShine)" />
    <polygon points="35,72 65,72 100,180" fill="#fff" fillOpacity="0.08" />
    <polygon points="165,72 135,72 100,180" fill="#fff" fillOpacity="0.04" />
    <line x1="65" y1="72" x2="100" y2="180" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.15" />
    <line x1="135" y1="72" x2="100" y2="180" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.15" />
    <line x1="100" y1="18" x2="65" y2="72" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.2" />
    <line x1="100" y1="18" x2="135" y2="72" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.2" />
    <circle cx="100" cy="65" r="3.5" fill="#fff" fillOpacity="0.55" />
    <circle cx="100" cy="65" r="1.8" fill="#fff" fillOpacity="0.9" />
    <circle cx="72"  cy="55" r="1.2" fill="#fff" fillOpacity="0.4" />
    <circle cx="128" cy="55" r="1.2" fill="#fff" fillOpacity="0.4" />
    <circle cx="85"  cy="92" r="0.9" fill="#fff" fillOpacity="0.25" />
    <circle cx="115" cy="92" r="0.9" fill="#fff" fillOpacity="0.25" />
    <circle cx="100" cy="100" r="70" fill="none" stroke="#fff" strokeWidth="0.3" strokeOpacity="0.05" strokeDasharray="3 9" />
  </svg>
);

const DesktopDiamondHero = ({
  plan, cycle, currentPlan, isCurrentActive, loading, onSelect,
}: Props) => {
  const isCurrentPlan = isCurrentActive && currentPlan === plan.slug;
  const price         = cycle === "yearly" ? plan.yearlyPriceNaira : plan.monthlyPriceNaira;
  const monthlyEquiv  = cycle === "yearly" ? Math.round(plan.yearlyPriceNaira / 12) : null;

  return (
    <div className="ddh-hero">
      <div className="ddh-hero__glow" />
      <div className="ddh-hero__content">

        <div className="ddh-hero__text">
          <span className="ddh-hero__label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3l1 6"/><path d="M2 9h20"/></svg>
            Ultimate Plan
          </span>
          <h2 className="ddh-hero__title">{plan.name}</h2>
          <p className="ddh-hero__desc">
            Maximum search visibility, VIP support, API access, custom branding,
            and strategic account management.
          </p>

          <div className="ddh-hero__price">
            <span className="ddh-hero__amount">₦{price.toLocaleString("en-NG")}</span>
            <span className="ddh-hero__cycle">/{cycle === "yearly" ? "yr" : "mo"}</span>
          </div>
          {monthlyEquiv && (
            <p className="ddh-hero__equiv">≈ ₦{monthlyEquiv.toLocaleString("en-NG")}/month</p>
          )}

          <ul className="ddh-hero__features">
            {plan.features.slice(0, 5).map((f, i) => (
              <li key={i}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gn)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {f}
              </li>
            ))}
          </ul>

          {isCurrentPlan ? (
            <div className="ddh-hero__current">Current Plan</div>
          ) : (
            <button onClick={onSelect} disabled={loading} className="ddh-btn">
              {loading ? (
                <><span className="ddh-spinner" /> Processing...</>
              ) : isCurrentActive ? "Upgrade to Diamond" : "Get Diamond"}
            </button>
          )}
        </div>

        <div className="ddh-hero__visual">
          <DiamondSVG />
        </div>
      </div>
    </div>
  );
};

export default DesktopDiamondHero;