/**
 * src/loemart/mobile/MobileFooter.jsx
 *
 * Real-Time Mobile Footer Suite:
 * - Real API Newsletter/Deal Subscription Pipeline
 * - Real-Time Dynamic Route Active State
 * - Contextual Floating Action Button (FAB)
 * - Safe-area-aware Bottom Navigation with Real Badges
 */

import { memo, useCallback, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  FiBell,
  FiCheckCircle,
  FiArrowRight,
  FiPlus,
  FiLoader,
} from "react-icons/fi";

import { API, BOTTOM_NAV, haptic } from "./mobileHelpers";

const NEWSLETTER_URL = `${API}/newsletter/subscribe`;

/* ═══════════════════════════════════════════════════════════════
   1. 100% REAL NOTIFY & DEAL SUBSCRIPTION BANNER
═══════════════════════════════════════════════════════════════ */
const NotifyBanner = memo(function NotifyBanner() {
  const [email, setEmail]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState(() => {
    return localStorage.getItem("loemart_subscribed") === "true";
  });

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    // Stricter Real Email Format Regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setSubmitting(true);
    try {
      // Real database API call
      await axios.post(
        NEWSLETTER_URL,
        { email: cleanEmail },
        { headers: { "Content-Type": "application/json" }, timeout: 8000 }
      );

      setSubscribed(true);
      localStorage.setItem("loemart_subscribed", "true");
      toast.success("You're subscribed to Loemart alerts! 🎉");
      haptic(15);
    } catch (err) {
      const errorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Could not subscribe. Please try again.";
      
      // If already subscribed on server
      if (err.response?.status === 409 || errorMsg.toLowerCase().includes("already")) {
        setSubscribed(true);
        localStorage.setItem("loemart_subscribed", "true");
        toast("You are already subscribed to alerts!", { icon: "✨" });
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setSubmitting(false);
    }
  }, [email]);

  if (subscribed) {
    return (
      <section className="lmm-notify lmm-notify--subscribed" aria-label="Subscribed to notifications">
        <div className="lmm-notify__icon-wrap" aria-hidden="true">
          <FiCheckCircle size={20} className="lmm-text-success" />
        </div>
        <div className="lmm-notify__body">
          <p className="lmm-notify__title">You're on the VIP list</p>
          <p className="lmm-notify__sub">We'll alert you when new deals drop.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="lmm-notify" aria-label="Deal notifications">
      <div className="lmm-notify__icon-wrap" aria-hidden="true">
        <FiBell size={20} />
      </div>
      <div className="lmm-notify__body">
        <p className="lmm-notify__title">Never miss a deal</p>
        <p className="lmm-notify__sub">Get real-time alerts for new products</p>
      </div>
      
      <form onSubmit={handleSubmit} className="lmm-notify__form" noValidate>
        <input
          type="email"
          placeholder="Your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email address"
          disabled={submitting}
          required
          className="lmm-notify__input"
        />
        <button
          type="submit"
          disabled={submitting || !email}
          className="lmm-notify__btn"
          aria-label="Subscribe"
        >
          {submitting ? (
            <FiLoader size={14} className="lmm-spin" />
          ) : (
            <FiArrowRight size={14} />
          )}
        </button>
      </form>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   2. PURPOSE-BUILT FLOATING ACTION BUTTON (POST / SELL)
═══════════════════════════════════════════════════════════════ */
const MobileFAB = memo(function MobileFAB({ user, onPostAd }) {
  return (
    <button
      type="button"
      className="lmm-fab lmm-fab--post"
      onClick={() => {
        onPostAd();
        haptic(10);
      }}
      aria-label={user ? "Post a new listing" : "Sign in to sell"}
      title={user ? "Post a listing" : "Sign in to sell"}
    >
      <FiPlus size={22} />
      <span className="lmm-fab__label">Sell</span>
    </button>
  );
});

/* ═══════════════════════════════════════════════════════════════
   3. DYNAMIC SAFE-AREA BOTTOM NAVIGATION
═══════════════════════════════════════════════════════════════ */
const BottomNav = memo(function BottomNav({ cartCount = 0, wishCount = 0 }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="lmm-bottomnav" aria-label="Main application navigation">
      <div className="lmm-bottomnav__inner">
        {BOTTOM_NAV.map((item) => {
          const Icon = item.icon;
          
          // Match current URL dynamically (No more hardcoded active index)
          const isActive = 
            item.path === "/" 
              ? location.pathname === "/" || location.pathname === "/loemart"
              : location.pathname.startsWith(item.path);

          const badge =
            item.label.toLowerCase() === "cart"
              ? cartCount
              : item.label.toLowerCase() === "saved" || item.label.toLowerCase() === "wishlist"
              ? wishCount
              : 0;

          return (
            <button
              key={item.label}
              type="button"
              className={`lmm-bottomnav__item ${
                isActive ? "lmm-bottomnav__item--active" : ""
              }`}
              onClick={() => {
                if (!isActive) {
                  navigate(item.path);
                  haptic(8);
                }
              }}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="lmm-bottomnav__icon">
                <Icon size={20} />
                {badge > 0 && (
                  <span className="lmm-bottomnav__badge">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </span>
              <span className="lmm-bottomnav__label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});

/* ═══════════════════════════════════════════════════════════════
   4. MAIN EXPORT
═══════════════════════════════════════════════════════════════ */
const MobileFooter = memo(function MobileFooter({
  user,
  cartCount,
  wishCount,
  onPostAd,
}) {
  return (
    <footer className="lmm-footer-wrapper">
      <NotifyBanner />
      <MobileFAB user={user} onPostAd={onPostAd} />
      <BottomNav cartCount={cartCount} wishCount={wishCount} />
    </footer>
  );
});

export default MobileFooter;