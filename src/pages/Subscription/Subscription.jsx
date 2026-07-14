import { useState, useEffect, useCallback } from "react";
import { useNavigate }                       from "react-router-dom";
import CurrentPlan                           from "../../components/subscription/CurrentPlan.jsx";
import CancelModal                           from "../../components/subscription/CancelModal.jsx";
import History                               from "./History.jsx";
import "../../styles/subscription/index.css";

const FEATURE_META = {
  auto_renewal:          { label: "Automatic Listing Renewal", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg> },
  search_boost:          { label: "Search Ranking Boost",       icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg> },
  analytics:             { label: "Analytics Dashboard",        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg> },
  support_level:         { label: "Support Level",              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg> },
  seller_badge:          { label: "Seller Badge",               icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15l-2 5l1.5-3h1l1.5 3l-2-5z"/><circle cx="12" cy="9" r="6"/><path d="M9 9l1.5 1.5L13.5 7"/></svg> },
  featured_listings:     { label: "Featured Listings",          icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> },
  featured_quota:        { label: "Featured Listing Slots/mo",  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  business_verification: { label: "Business Verification",      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg> },
  team_accounts:         { label: "Team Accounts",              icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  inventory_management:  { label: "Inventory Management",       icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg> },
  homepage_promotion:    { label: "Homepage Promotion",         icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  advertising_credits:   { label: "Advertising Credits (₦/mo)", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
  dedicated_manager:     { label: "Dedicated Account Manager",  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  early_access:          { label: "Early Feature Access",       icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg> },
  api_access:            { label: "API & Integration Access",   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> },
  custom_branding:       { label: "Custom Branding",            icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12a10 10 0 0 0 4.5 8.33"/><path d="M7 20.662V18a1 1 0 0 1 1.45-.89l2.1 1.05a1 1 0 0 0 .9 0l2.1-1.05A1 1 0 0 1 15 18v2.662"/></svg> },
  vip_support:           { label: "VIP Support",                icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3l1 6"/><path d="M2 9h20"/><path d="M7 9l5 13 5-13"/></svg> },
};

const Subscription = () => {
  const navigate = useNavigate();

  const [subscription,  setSubscription]  = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [cancelOpen,    setCancelOpen]    = useState(false);
  const [togglingRenew, setTogglingRenew] = useState(false);
  const [cancelling,    setCancelling]    = useState(false);
  const [activeTab,     setActiveTab]     = useState("overview");
  const [toast,         setToast]         = useState(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const fetchSubscription = useCallback(async () => {
    try {
      const res  = await fetch("/api/subscription", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSubscription(data.subscription);
    } catch (err) {
      showToast("error", err.message ?? "Failed to load subscription.");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { fetchSubscription(); }, [fetchSubscription]);

  const handleToggleAutoRenew = async () => {
    setTogglingRenew(true);
    try {
      const newValue = !subscription.autoRenew;
      const res  = await fetch("/api/subscription/payments/toggle-auto-renew", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ autoRenew: newValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSubscription((prev) => ({ ...prev, autoRenew: newValue }));
      showToast("success", data.message);
    } catch (err) {
      showToast("error", err.message ?? "Failed to update auto-renew.");
    } finally {
      setTogglingRenew(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res  = await fetch("/api/subscription/payments/cancel", {
        method:  "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setCancelOpen(false);
      showToast("success", data.message);
      fetchSubscription();
    } catch (err) {
      showToast("error", err.message ?? "Failed to cancel.");
    } finally {
      setCancelling(false);
    }
  };

  const renderFeatureValue = (key, value) => {
    if (value === "true")
      return <span className="sub-feature-val sub-feature-val--yes">Yes</span>;
    if (value === "false")
      return <span className="sub-feature-val sub-feature-val--no">No</span>;
    if (key === "advertising_credits" && value !== "0")
      return <span className="sub-feature-val sub-feature-val--credits">₦{Number(value).toLocaleString("en-NG")}</span>;
    if (value === "0")
      return <span className="sub-feature-val sub-feature-val--no">—</span>;
    return <span className="sub-feature-val sub-feature-val--text">{value}</span>;
  };

  if (loading) {
    return (
      <div className="sub-page">
        <div className="sub-skeleton sub-skeleton--sm" />
        <div className="sub-skeleton sub-skeleton--lg" />
        <div className="sub-skeleton sub-skeleton--md" />
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "history",  label: "Payment History" },
  ];

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

      <div className="sub-header">
        <h1 className="sub-header__title">My Subscription</h1>
        {!subscription?.isActive && (
          <button
            onClick={() => navigate("/seller/subscription/plans")}
            className="sub-btn sub-btn--primary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
            Upgrade Now
          </button>
        )}
      </div>

      <div className="sub-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`sub-tabs__btn ${activeTab === tab.id ? "sub-tabs__btn--active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="sub-overview">
          <CurrentPlan
            subscription={subscription}
            onToggleAutoRenew={handleToggleAutoRenew}
            onCancel={() => setCancelOpen(true)}
            onUpgrade={() => navigate("/seller/subscription/plans")}
            togglingRenew={togglingRenew}
          />

          {subscription?.featureKeys &&
            Object.keys(subscription.featureKeys).length > 0 && (
            <div className="sub-card">
              <h2 className="sub-card__title">Plan Features & Access</h2>
              <div className="sub-features-list">
                {Object.entries(subscription.featureKeys).map(([key, value]) => {
                  const meta = FEATURE_META[key];
                  if (!meta) return null;
                  return (
                    <div key={key} className="sub-features-list__row">
                      <span className="sub-features-list__label">
                        <span className="sub-features-list__icon">{meta.icon}</span>
                        {meta.label}
                      </span>
                      {renderFeatureValue(key, value)}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!subscription?.isActive && (
            <div className="sub-free-notice">
              <div className="sub-free-notice__icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div>
                <p className="sub-free-notice__title">You are on the Free plan</p>
                <p className="sub-free-notice__text">
                  Listings expire every 30 days and require manual renewal.
                  Upgrade to unlock automatic renewal, search ranking boosts,
                  a seller badge, analytics, and more.
                </p>
                <button
                  onClick={() => navigate("/seller/subscription/plans")}
                  className="sub-btn sub-btn--secondary"
                >
                  View Plans
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && <History />}

      {cancelOpen && (
        <CancelModal
          subscription={subscription}
          onConfirm={handleCancel}
          onClose={() => setCancelOpen(false)}
          loading={cancelling}
        />
      )}
    </div>
  );
};

export default Subscription;