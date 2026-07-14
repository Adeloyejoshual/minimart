import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams }      from "react-router-dom";
import PlanCard                              from "../../components/subscription/PlanCard.jsx";
import DiamondHero                           from "../../components/subscription/DiamondHero.jsx";
import EliteHero                             from "../../components/subscription/EliteHero.jsx";

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const Plans = () => {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  const [plans,      setPlans]      = useState([]);
  const [currentSub, setCurrentSub] = useState(null);
  const [cycle,      setCycle]      = useState(searchParams.get("cycle") ?? "monthly");
  const [loading,    setLoading]    = useState(true);
  const [initiating, setInitiating] = useState(null);
  const [toast,      setToast]      = useState(null);

  const showToast = useCallback((type, message) => {
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
            headers: token
              ? { Authorization: `Bearer ${token}` }
              : {},
          }),
        ]);

        const plansData = await plansRes.json();
        const subData   = subRes.ok ? await subRes.json() : null;

        setPlans((plansData.plans ?? []).filter((p) => p.slug !== "free"));
        setCurrentSub(subData?.subscription ?? null);
      } catch {
        showToast("error", "Failed to load plans. Please refresh.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [showToast]);

  const handleSelectPlan = async (planSlug) => {
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
    } catch (err) {
      showToast("error", err.message ?? "Could not start payment. Please try again.");
    } finally {
      setInitiating(null);
    }
  };

  if (loading) {
    return (
      <div className="sub-page">
        <div className="sub-plans-grid">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="sub-skeleton sub-skeleton--card" />
          ))}
        </div>
      </div>
    );
  }

  const diamondPlan = plans.find((p) => p.slug === "diamond");
  const elitePlan   = plans.find((p) => p.slug === "elite");
  const cardPlans   = plans.filter((p) => p.slug !== "diamond" && p.slug !== "elite");

  return (
    <div className="sub-page">

      {toast && (
        <div className={`sub-toast sub-toast--${toast.type}`}>
          <span className="sub-toast__icon">
            {toast.type === "success" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            )}
          </span>
          <p>{toast.message}</p>
          <button onClick={() => setToast(null)} className="sub-toast__close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {diamondPlan && (
        <DiamondHero
          plan={diamondPlan}
          cycle={cycle}
          currentPlan={currentSub?.plan}
          isCurrentActive={currentSub?.isActive}
          loading={initiating === "diamond"}
          onSelect={() => handleSelectPlan("diamond")}
        />
      )}

      {elitePlan && (
        <EliteHero
          plan={elitePlan}
          cycle={cycle}
          currentPlan={currentSub?.plan}
          isCurrentActive={currentSub?.isActive}
          loading={initiating === "elite"}
          onSelect={() => handleSelectPlan("elite")}
        />
      )}

      <div className="sub-plans-header">
        <h1 className="sub-plans-header__title">Choose Your Seller Plan</h1>
        <p className="sub-plans-header__subtitle">
          Every paid plan includes automatic listing renewal. Higher plans unlock
          search boosts, analytics, featured listings, and more.
        </p>
      </div>

      <div className="sub-cycle-toggle">
        <div className="sub-cycle-toggle__inner">
          {["monthly", "yearly"].map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={`sub-cycle-toggle__btn ${cycle === c ? "sub-cycle-toggle__btn--active" : ""}`}
            >
              {c === "monthly" ? "Monthly" : (
                <>
                  Yearly
                  <span className="sub-cycle-toggle__save">Save ~17%</span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="sub-plans-grid">
        {cardPlans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            cycle={cycle}
            currentPlan={currentSub?.plan}
            isCurrentActive={currentSub?.isActive}
            loading={initiating === plan.slug}
            onSelect={() => handleSelectPlan(plan.slug)}
          />
        ))}
      </div>

      <p className="sub-plans-footer">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        All plans allow up to 20 photos per listing · Payments secured by Paystack
      </p>

      <div className="sub-plans-back">
        <button
          onClick={() => navigate("/seller/subscription")}
          className="sub-link"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back to Subscription Dashboard
        </button>
      </div>
    </div>
  );
};

export default Plans;