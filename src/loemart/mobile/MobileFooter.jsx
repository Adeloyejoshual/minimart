/**
 * src/loemart/mobile/MobileFooter.jsx
 *
 * Bottom of page:
 * - Notify me newsletter card
 * - Floating action button (FAB) — cart or post ad
 * - Fixed bottom navigation with badges
 */

import { memo, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FiBell, FiCheckCircle, FiArrowRight, FiPlus, FiShoppingCart,
} from "react-icons/fi";

import { BOTTOM_NAV, haptic } from "./mobileHelpers";

/* ═══════════════════════════════════════════════════════════════
   NOTIFY BANNER
═══════════════════════════════════════════════════════════════ */
const NotifyBanner = memo(function NotifyBanner() {
  const [email, setEmail] = useState("");
  const [sent,  setSent]  = useState(false);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    setSent(true);
    toast.success("Subscribed! 🎉");
    haptic(12);
  }, [email]);

  return (
    <section className="lmm-notify" aria-label="Deal notifications">
      <div className="lmm-notify__icon-wrap" aria-hidden="true">
        <FiBell size={20} />
      </div>
      <div className="lmm-notify__body">
        <p className="lmm-notify__title">Never miss a deal</p>
        <p className="lmm-notify__sub">Get alerts for new products</p>
      </div>
      {sent ? (
        <div className="lmm-notify__done" role="status" aria-live="polite">
          <FiCheckCircle size={16} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="lmm-notify__form">
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email"
            required
            className="lmm-notify__input"
          />
          <button
            type="submit"
            className="lmm-notify__btn"
            aria-label="Subscribe"
          >
            <FiArrowRight size={14} />
          </button>
        </form>
      )}
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   FLOATING ACTION BUTTON
═══════════════════════════════════════════════════════════════ */
const MobileFAB = memo(function MobileFAB({ cartCount, user, onPostAd }) {
  const navigate = useNavigate();

  if (cartCount > 0) {
    return (
      <button
        type="button"
        className="lmm-fab lmm-fab--cart"
        onClick={() => { navigate("/shop/cart"); haptic(10); }}
        aria-label={`View cart with ${cartCount} items`}
      >
        <FiShoppingCart size={18} />
        <span className="lmm-fab__count">{cartCount > 9 ? "9+" : cartCount}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="lmm-fab lmm-fab--post"
      onClick={() => { onPostAd(); haptic(10); }}
      aria-label={user ? "Post an ad" : "Sign up to sell"}
    >
      <FiPlus size={20} />
    </button>
  );
});

/* ═══════════════════════════════════════════════════════════════
   BOTTOM NAV
═══════════════════════════════════════════════════════════════ */
const BottomNav = memo(function BottomNav({ cartCount, wishCount, active = 0 }) {
  const navigate = useNavigate();

  return (
    <nav className="lmm-bottomnav" aria-label="Main navigation">
      {BOTTOM_NAV.map((item, i) => {
        const Icon     = item.icon;
        const isActive = i === active;
        const badge    = item.label === "Cart"  ? cartCount
                       : item.label === "Saved" ? wishCount
                       : 0;

        return (
          <button
            key={item.label}
            type="button"
            className={`lmm-bottomnav__item ${isActive ? "lmm-bottomnav__item--active" : ""}`}
            onClick={() => { navigate(item.path); haptic(6); }}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="lmm-bottomnav__icon">
              <Icon size={20} />
              {badge > 0 && (
                <span className="lmm-bottomnav__badge">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </span>
            <span className="lmm-bottomnav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN FOOTER
═══════════════════════════════════════════════════════════════ */
const MobileFooter = memo(function MobileFooter({
  user, cartCount, wishCount, onPostAd,
}) {
  return (
    <>
      <NotifyBanner />
      <MobileFAB cartCount={cartCount} user={user} onPostAd={onPostAd} />
      <BottomNav cartCount={cartCount} wishCount={wishCount} active={0} />
    </>
  );
});

export default MobileFooter;