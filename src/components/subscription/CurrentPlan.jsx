import "../../styles/subscription/index.css";

const CurrentPlan = ({ subscription, onToggleAutoRenew, onCancel, onUpgrade, togglingRenew }) => {
  if (!subscription) return null;

  const plan        = subscription.plan ?? "free";
  const totalDays   = subscription.billingCycle === "yearly" ? 365 : 30;
  const progressPct = subscription.isActive
    ? Math.min(100, Math.round((subscription.daysRemaining / totalDays) * 100))
    : 0;

  const fmt = (d) =>
    d ? new Date(d).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" }) : "—";

  return (
    <div className="sub-card">
      <h2 className="sub-card__title">Current Plan</h2>

      <div className="sub-current">
        <div className="sub-current__info">
          <div className="sub-current__identity">
            <span className="sub-current__badge">{subscription.planBadge || "—"}</span>
            <div>
              <p className="sub-current__plan-name">{subscription.planName}</p>
              {subscription.billingCycle && (
                <p className="sub-current__cycle">{subscription.billingCycle} billing</p>
              )}
            </div>
          </div>

          <div className="sub-current__pills">
            <span className={`sub-pill sub-pill--${subscription.isActive ? "active" : "inactive"}`}>
              <span className={`sub-pill__dot sub-pill__dot--${subscription.isActive ? "green" : "gray"}`} />
              {subscription.isActive ? "Active" : "Inactive"}
            </span>

            {subscription.isActive && (
              <span className={`sub-pill sub-pill--${subscription.autoRenew ? "renew-on" : "renew-off"}`}>
                {subscription.autoRenew ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                )}
                {subscription.autoRenew ? "Auto-renew on" : "Auto-renew off"}
              </span>
            )}
          </div>

          {subscription.isActive && subscription.expiresAt && (
            <div className="sub-current__progress">
              <div className="sub-current__progress-labels">
                <span>{subscription.daysRemaining} day(s) left</span>
                <span>Renews {fmt(subscription.expiresAt)}</span>
              </div>
              <div className="sub-current__progress-bar">
                <div
                  className={`sub-current__progress-fill sub-current__progress-fill--${plan}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {subscription.isActive && (
          <dl className="sub-current__details">
            {[
              ["Started", fmt(subscription.startedAt)],
              ["Expires", fmt(subscription.expiresAt)],
              ["Billing", subscription.billingCycle
                ? subscription.billingCycle.charAt(0).toUpperCase() + subscription.billingCycle.slice(1)
                : "—"],
            ].map(([label, value]) => (
              <div key={label} className="sub-current__detail-row">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {subscription.isActive && (
        <>
          <div className="sub-current__actions">
            <button onClick={onUpgrade} className="sub-btn sub-btn--primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
              Change Plan
            </button>

            <button
              onClick={onToggleAutoRenew}
              disabled={togglingRenew}
              className={`sub-btn ${subscription.autoRenew ? "sub-btn--warning" : "sub-btn--success"}`}
            >
              {togglingRenew ? (
                <><span className="sub-btn__spinner" /> Updating...</>
              ) : subscription.autoRenew ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  Turn Off Auto-Renew
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                  Turn On Auto-Renew
                </>
              )}
            </button>

            <button onClick={onCancel} className="sub-btn sub-btn--danger">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              Cancel Subscription
            </button>
          </div>

          <p className="sub-current__note">
            {subscription.autoRenew ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                Auto-renew is on — your subscription renews automatically before expiry.
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Auto-renew is off — access ends on {fmt(subscription.expiresAt)} and will not renew.
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
};

export default CurrentPlan;