import "./styles/desktop-current-plan.css";

interface Subscription {
  plan:          string;
  planBadge:     string;
  planName:      string;
  planFeatures:  string[];
  billingCycle:  string | null;
  startedAt:     string | null;
  expiresAt:     string | null;
  autoRenew:     boolean;
  isActive:      boolean;
  daysRemaining: number;
  monthlyPrice:  number;
  yearlyPrice:   number;
}

interface Props {
  subscription: Subscription | null;
}

const PLAN_BG: Record<string, string> = {
  free:     "dcp-hero--free",
  premium:  "dcp-hero--premium",
  pro:      "dcp-hero--pro",
  business: "dcp-hero--business",
  elite:    "dcp-hero--elite",
  diamond:  "dcp-hero--diamond",
};

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-NG", {
        year: "numeric", month: "long", day: "numeric",
      })
    : "—";

const DesktopCurrentPlan = ({ subscription }: Props) => {
  if (!subscription) return null;

  const plan   = subscription.plan ?? "free";
  const bgClass = PLAN_BG[plan] ?? PLAN_BG.free;

  const totalDays   = subscription.billingCycle === "yearly" ? 365 : 30;
  const progressPct = subscription.isActive
    ? Math.min(100, Math.round((subscription.daysRemaining / totalDays) * 100))
    : 0;

  return (
    <div className={`dcp-hero ${bgClass}`}>
      <div className="dcp-hero__content">

        {/* Left */}
        <div className="dcp-hero__left">
          <div className="dcp-hero__badge-wrap">
            <span className="dcp-hero__plan-badge">{subscription.planBadge || "—"}</span>
            <div>
              <h2 className="dcp-hero__plan-name">{subscription.planName}</h2>
              {subscription.billingCycle && (
                <p className="dcp-hero__cycle">
                  {subscription.billingCycle.charAt(0).toUpperCase() +
                   subscription.billingCycle.slice(1)} billing
                </p>
              )}
            </div>
          </div>

          {/* Status + auto-renew pills */}
          <div className="dcp-hero__pills">
            <span className={`dcp-pill dcp-pill--${subscription.isActive ? "active" : "free"}`}>
              <span className="dcp-pill__dot" />
              {subscription.isActive ? "Active" : "Free Plan"}
            </span>
            {subscription.isActive && (
              <span className={`dcp-pill dcp-pill--${subscription.autoRenew ? "renew" : "paused"}`}>
                {subscription.autoRenew ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                )}
                {subscription.autoRenew ? "Auto-renew on" : "Auto-renew off"}
              </span>
            )}
          </div>

          {/* Progress */}
          {subscription.isActive && (
            <div className="dcp-hero__progress">
              <div className="dcp-hero__progress-labels">
                <span>{subscription.daysRemaining} day(s) remaining</span>
                <span>Renews {fmt(subscription.expiresAt)}</span>
              </div>
              <div className="dcp-hero__progress-bar">
                <div
                  className={`dcp-hero__progress-fill dcp-hero__progress-fill--${plan}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right — feature list */}
        {subscription.planFeatures.length > 0 && (
          <ul className="dcp-hero__features">
            {subscription.planFeatures.slice(0, 6).map((f, i) => (
              <li key={i}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                {f}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default DesktopCurrentPlan;