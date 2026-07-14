import { useState, useEffect, useCallback } from "react";
import { useNavigate }                       from "react-router-dom";
import DesktopCurrentPlan                    from "./components/DesktopCurrentPlan";
import DesktopFeatureTable                   from "./components/DesktopFeatureTable";
import DesktopPaymentHistory                 from "./components/DesktopPaymentHistory";
import DesktopCancelModal                    from "./components/DesktopCancelModal";
import "./styles/desktop-subscription.css";

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Subscription {
  plan:          string;
  planId:        string | null;
  planName:      string;
  planBadge:     string;
  planFeatures:  string[];
  planRank:      number;
  monthlyPrice:  number;
  yearlyPrice:   number;
  featureKeys:   Record<string, string>;
  status:        string;
  billingCycle:  string | null;
  startedAt:     string | null;
  expiresAt:     string | null;
  autoRenew:     boolean;
  isActive:      boolean;
  daysRemaining: number;
  activeRecord:  Record<string, unknown> | null;
}

// ─── Sidebar nav items ────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "overview",  label: "Overview",        icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  )},
  { id: "features",  label: "Plan Features",   icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12l2 2 4-4"/><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
    </svg>
  )},
  { id: "history",   label: "Payment History",  icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  )},
];

const DesktopSubscription = () => {
  const navigate = useNavigate();

  const [subscription,  setSubscription]  = useState<Subscription | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [activeSection, setActiveSection] = useState("overview");
  const [cancelOpen,    setCancelOpen]    = useState(false);
  const [togglingRenew, setTogglingRenew] = useState(false);
  const [cancelling,    setCancelling]    = useState(false);
  const [toast,         setToast]         = useState<{ type: string; message: string } | null>(null);

  const showToast = useCallback((type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const fetchSubscription = useCallback(async () => {
    try {
      const res  = await fetch("/api/subscription", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSubscription(data.subscription);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load subscription.";
      showToast("error", msg);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchSubscription(); }, [fetchSubscription]);

  const handleToggleAutoRenew = async () => {
    if (!subscription) return;
    setTogglingRenew(true);
    try {
      const newValue = !subscription.autoRenew;
      const res  = await fetch("/api/subscription/payments/toggle-auto-renew", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ autoRenew: newValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSubscription((prev) => prev ? { ...prev, autoRenew: newValue } : prev);
      showToast("success", data.message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update auto-renew.";
      showToast("error", msg);
    } finally {
      setTogglingRenew(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res  = await fetch("/api/subscription/payments/cancel", {
        method:  "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setCancelOpen(false);
      showToast("success", data.message);
      fetchSubscription();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to cancel.";
      showToast("error", msg);
    } finally {
      setCancelling(false);
    }
  };

  // ─── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="dsub-page">
        <div className="dsub-layout">
          <aside className="dsub-sidebar">
            <div className="dsub-sk dsub-sk--title" />
            {[1,2,3].map((i) => <div key={i} className="dsub-sk dsub-sk--nav" />)}
          </aside>
          <main className="dsub-main">
            <div className="dsub-sk dsub-sk--hero" />
            <div className="dsub-sk dsub-sk--card" />
            <div className="dsub-sk dsub-sk--card" />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="dsub-page">

      {/* Toast */}
      {toast && (
        <div className={`dsub-toast dsub-toast--${toast.type}`}>
          <span className="dsub-toast__icon">
            {toast.type === "success" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            )}
          </span>
          <p>{toast.message}</p>
          <button onClick={() => setToast(null)} className="dsub-toast__close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      <div className="dsub-layout">

        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
        <aside className="dsub-sidebar">

          {/* Plan identity */}
          <div className="dsub-sidebar__identity">
            <div className={`dsub-plan-icon dsub-plan-icon--${subscription?.plan ?? "free"}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/>
                <path d="M3 20h18"/>
              </svg>
            </div>
            <div>
              <p className="dsub-sidebar__plan-name">
                {subscription?.planBadge} {subscription?.planName}
              </p>
              <span className={`dsub-sidebar__status dsub-sidebar__status--${subscription?.isActive ? "active" : "free"}`}>
                <span className="dsub-sidebar__status-dot" />
                {subscription?.isActive ? "Active" : "Free Plan"}
              </span>
            </div>
          </div>

          {/* Days remaining ring */}
          {subscription?.isActive && subscription.expiresAt && (
            <div className="dsub-sidebar__ring-wrap">
              <DaysRing
                daysRemaining={subscription.daysRemaining}
                totalDays={subscription.billingCycle === "yearly" ? 365 : 30}
                plan={subscription.plan}
              />
            </div>
          )}

          {/* Nav */}
          <nav className="dsub-sidebar__nav">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`dsub-sidebar__nav-btn ${activeSection === item.id ? "dsub-sidebar__nav-btn--active" : ""}`}
              >
                <span className="dsub-sidebar__nav-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* Actions */}
          <div className="dsub-sidebar__actions">
            <button
              onClick={() => navigate("/seller/subscription/plans")}
              className="dsub-btn dsub-btn--primary dsub-btn--full"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
              {subscription?.isActive ? "Change Plan" : "Upgrade Now"}
            </button>

            {subscription?.isActive && (
              <>
                <button
                  onClick={handleToggleAutoRenew}
                  disabled={togglingRenew}
                  className={`dsub-btn dsub-btn--full ${subscription.autoRenew ? "dsub-btn--warning" : "dsub-btn--success"}`}
                >
                  {togglingRenew ? (
                    <><span className="dsub-btn__spinner" /> Updating...</>
                  ) : subscription.autoRenew ? (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Turn Off Auto-Renew</>
                  ) : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>Turn On Auto-Renew</>
                  )}
                </button>

                <button
                  onClick={() => setCancelOpen(true)}
                  className="dsub-btn dsub-btn--ghost-danger dsub-btn--full"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  Cancel Subscription
                </button>
              </>
            )}
          </div>

          {/* Auto-renew note */}
          {subscription?.isActive && (
            <p className="dsub-sidebar__note">
              {subscription.autoRenew ? (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                  Renews automatically
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  Expires without renewal
                </>
              )}
            </p>
          )}
        </aside>

        {/* ── Main content ───────────────────────────────────────────────────── */}
        <main className="dsub-main">

          {/* Overview */}
          {activeSection === "overview" && (
            <div className="dsub-section">
              <DesktopCurrentPlan subscription={subscription} />

              {/* Billing details card */}
              {subscription?.isActive && (
                <div className="dsub-card">
                  <h2 className="dsub-card__title">Billing Details</h2>
                  <div className="dsub-billing-grid">
                    {[
                      {
                        label: "Current Plan",
                        value: `${subscription.planBadge} ${subscription.planName}`,
                        accent: true,
                      },
                      {
                        label: "Billing Cycle",
                        value: subscription.billingCycle
                          ? subscription.billingCycle.charAt(0).toUpperCase() +
                            subscription.billingCycle.slice(1)
                          : "—",
                      },
                      {
                        label: "Started",
                        value: subscription.startedAt
                          ? new Date(subscription.startedAt).toLocaleDateString("en-NG", {
                              year: "numeric", month: "long", day: "numeric",
                            })
                          : "—",
                      },
                      {
                        label: "Next Renewal",
                        value: subscription.expiresAt
                          ? new Date(subscription.expiresAt).toLocaleDateString("en-NG", {
                              year: "numeric", month: "long", day: "numeric",
                            })
                          : "—",
                      },
                      {
                        label: "Monthly Rate",
                        value: `₦${(subscription.monthlyPrice / 100).toLocaleString("en-NG")}`,
                      },
                      {
                        label: "Auto-Renew",
                        value: subscription.autoRenew ? "Enabled" : "Disabled",
                        good:  subscription.autoRenew,
                      },
                    ].map(({ label, value, accent, good }) => (
                      <div key={label} className="dsub-billing-item">
                        <span className="dsub-billing-item__label">{label}</span>
                        <span className={`dsub-billing-item__value ${
                          accent ? "dsub-billing-item__value--accent" :
                          good === true  ? "dsub-billing-item__value--good"  :
                          good === false ? "dsub-billing-item__value--muted" : ""
                        }`}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Free plan CTA */}
              {!subscription?.isActive && (
                <div className="dsub-card dsub-card--upgrade">
                  <div className="dsub-upgrade-content">
                    <div className="dsub-upgrade-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/><path d="M3 20h18"/></svg>
                    </div>
                    <div>
                      <h3 className="dsub-upgrade-title">Unlock Premium Features</h3>
                      <p className="dsub-upgrade-desc">
                        You are on the Free plan. Upgrade to enable automatic listing
                        renewal, search boosts, seller badges, analytics, and more.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate("/seller/subscription/plans")}
                    className="dsub-btn dsub-btn--primary"
                  >
                    View Plans
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Features */}
          {activeSection === "features" && (
            <div className="dsub-section">
              <DesktopFeatureTable featureKeys={subscription?.featureKeys ?? {}} />
            </div>
          )}

          {/* History */}
          {activeSection === "history" && (
            <div className="dsub-section">
              <DesktopPaymentHistory />
            </div>
          )}
        </main>
      </div>

      {cancelOpen && (
        <DesktopCancelModal
          subscription={subscription}
          onConfirm={handleCancel}
          onClose={() => setCancelOpen(false)}
          loading={cancelling}
        />
      )}
    </div>
  );
};

// ─── Days ring SVG ────────────────────────────────────────────────────────────
interface DaysRingProps {
  daysRemaining: number;
  totalDays:     number;
  plan:          string;
}

const PLAN_RING_COLOR: Record<string, string> = {
  premium:  "#eab308",
  pro:      "#FF5C00",
  business: "#9333ea",
  elite:    "#2563eb",
  diamond:  "#FF5C00",
};

function DaysRing({ daysRemaining, totalDays, plan }: DaysRingProps) {
  const pct        = Math.min(1, daysRemaining / totalDays);
  const radius     = 44;
  const circ       = 2 * Math.PI * radius;
  const dash       = pct * circ;
  const gap        = circ - dash;
  const color      = PLAN_RING_COLOR[plan] ?? "#FF5C00";

  return (
    <div className="dsub-ring">
      <svg width="112" height="112" viewBox="0 0 112 112">
        {/* Track */}
        <circle
          cx="56" cy="56" r={radius}
          fill="none"
          stroke="var(--bd)"
          strokeWidth="7"
        />
        {/* Progress */}
        <circle
          cx="56" cy="56" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          strokeDashoffset={circ / 4}
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />
      </svg>
      <div className="dsub-ring__label">
        <span className="dsub-ring__days">{daysRemaining}</span>
        <span className="dsub-ring__text">days left</span>
      </div>
    </div>
  );
}

export default DesktopSubscription;