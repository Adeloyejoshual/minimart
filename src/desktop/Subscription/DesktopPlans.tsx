import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams }      from "react-router-dom";
import DesktopPlanComparison                 from "./components/DesktopPlanComparison";
import DesktopPlanCard                       from "./components/DesktopPlanCard";
import DesktopDiamondHero                    from "./components/DesktopDiamondHero";
import DesktopEliteHero                      from "./components/DesktopEliteHero";
import "./styles/desktop-plans.css";

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

interface Plan {
  id:                string;
  slug:              string;
  name:              string;
  badge:             string;
  monthlyPrice:      number;
  yearlyPrice:       number;
  monthlyPriceNaira: number;
  yearlyPriceNaira:  number;
  rank:              number;
  features:          string[];
  featureKeys:       Record<string, string>;
}

interface CurrentSub {
  plan:     string;
  isActive: boolean;
}

const DesktopPlans = () => {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  const [plans,      setPlans]      = useState<Plan[]>([]);
  const [currentSub, setCurrentSub] = useState<CurrentSub | null>(null);
  const [cycle,      setCycle]      = useState<"monthly" | "yearly">(
    (searchParams.get("cycle") as "monthly" | "yearly") ?? "monthly"
  );
  const [view,       setView]       = useState<"cards" | "compare">("cards");
  const [loading,    setLoading]    = useState(true);
  const [initiating, setInitiating] = useState<string | null>(null);
  const [toast,      setToast]      = useState<{ type: string; message: string } | null>(null);

  const showToast = useCallback((type: string, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 6000);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = getToken();
        const [plansRes, subRes] = await Promise.all([
          fetch("/api/subscription/plans"),
          fetch("/api/subscription", {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }),
        ]);
        const plansData = await plansRes.json();
        const subData   = subRes.ok ? await subRes.json() : null;
        setPlans((plansData.plans ?? []).filter((p: Plan) => p.slug !== "free"));
        setCurrentSub(subData?.subscription ?? null);
      } catch {
        showToast("error", "Failed to load plans. Please refresh.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [showToast]);

  const handleSelectPlan = async (planSlug: string) => {
    const token = getToken();
    if (!token) {
      navigate(`/auth?redirect=${encodeURIComponent("/seller/subscription/plans")}`);
      return;
    }

    setInitiating(planSlug);
    try {
      const res = await fetch("/api/subscription/payments/initiate", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ planSlug, cycle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      sessionStorage.setItem(
        "pending_subscription",
        JSON.stringify({ planSlug, cycle, reference: data.reference })
      );

      window.location.href = data.authorizationUrl;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not start payment.";
      showToast("error", msg);
    } finally {
      setInitiating(null);
    }
  };

  if (loading) {
    return (
      <div className="dplans-page">
        <div className="dplans-sk-hero" />
        <div className="dplans-grid">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="dplans-sk-card" />
          ))}
        </div>
      </div>
    );
  }

  const diamondPlan = plans.find((p) => p.slug === "diamond");
  const elitePlan   = plans.find((p) => p.slug === "elite");
  const cardPlans   = plans.filter((p) => p.slug !== "diamond" && p.slug !== "elite");
  const allPlans    = plans;

  return (
    <div className="dplans-page">

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

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="dplans-topbar">
        <div className="dplans-topbar__left">
          <button
            onClick={() => navigate("/seller/subscription")}
            className="dplans-back-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Subscription
          </button>
          <span className="dplans-topbar__sep">/</span>
          <span className="dplans-topbar__current">Choose Plan</span>
        </div>

        <div className="dplans-topbar__controls">
          {/* View toggle */}
          <div className="dplans-view-toggle">
            <button
              onClick={() => setView("cards")}
              className={`dplans-view-toggle__btn ${view === "cards" ? "dplans-view-toggle__btn--active" : ""}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              Cards
            </button>
            <button
              onClick={() => setView("compare")}
              className={`dplans-view-toggle__btn ${view === "compare" ? "dplans-view-toggle__btn--active" : ""}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              Compare
            </button>
          </div>

          {/* Cycle toggle */}
          <div className="dplans-cycle-toggle">
            {(["monthly", "yearly"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={`dplans-cycle-btn ${cycle === c ? "dplans-cycle-btn--active" : ""}`}
              >
                {c === "monthly" ? "Monthly" : (
                  <>
                    Yearly
                    <span className="dplans-cycle-btn__save">−17%</span>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="dplans-header">
        <h1 className="dplans-header__title">Choose Your Seller Plan</h1>
        <p className="dplans-header__subtitle">
          Every paid plan includes automatic listing renewal, seller badge,
          and priority support. Higher plans unlock more.
        </p>
      </div>

      {/* ── Cards view ────────────────────────────────────────────────────── */}
      {view === "cards" && (
        <>
          {/* Diamond + Elite heroes — two columns */}
          {(diamondPlan || elitePlan) && (
            <div className="dplans-heroes">
              {diamondPlan && (
                <DesktopDiamondHero
                  plan={diamondPlan}
                  cycle={cycle}
                  currentPlan={currentSub?.plan}
                  isCurrentActive={currentSub?.isActive}
                  loading={initiating === "diamond"}
                  onSelect={() => handleSelectPlan("diamond")}
                />
              )}
              {elitePlan && (
                <DesktopEliteHero
                  plan={elitePlan}
                  cycle={cycle}
                  currentPlan={currentSub?.plan}
                  isCurrentActive={currentSub?.isActive}
                  loading={initiating === "elite"}
                  onSelect={() => handleSelectPlan("elite")}
                />
              )}
            </div>
          )}

          {/* Premium / Pro / Business cards */}
          <div className="dplans-grid">
            {cardPlans.map((plan) => (
              <DesktopPlanCard
                key={plan.id}
                plan={plan}
                cycle={cycle}
                currentPlan={currentSub?.plan}
                isCurrentActive={currentSub?.isActive ?? false}
                loading={initiating === plan.slug}
                onSelect={() => handleSelectPlan(plan.slug)}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Compare view ──────────────────────────────────────────────────── */}
      {view === "compare" && (
        <DesktopPlanComparison
          plans={allPlans}
          cycle={cycle}
          currentPlan={currentSub?.plan}
          isCurrentActive={currentSub?.isActive ?? false}
          initiating={initiating}
          onSelect={handleSelectPlan}
        />
      )}

      {/* Footer */}
      <p className="dplans-footer">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Up to 20 photos per listing on all plans · Payments secured by Paystack
      </p>
    </div>
  );
};

export default DesktopPlans;