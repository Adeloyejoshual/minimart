// src/components/HamburgerMenu.jsx
import React, { useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./HamburgerMenu.css";

const NAV_SECTIONS = [
  {
    label: "Explore",
    items: [
      { icon: "◈", label: "Home", path: "/" },
      { icon: "◎", label: "Search", path: "/search" },
      { icon: "◉", label: "Near You", path: "/nearby" },
      { icon: "◇", label: "Trending", path: "/trending" },
      { icon: "◆", label: "Cheap Deals", path: "/deals" },
      { icon: "◈", label: "Latest", path: "/latest" },
    ],
  },
  {
    label: "Account",
    items: [
      { icon: "▣", label: "Profile", path: "/profile" },
      { icon: "▤", label: "Dashboard", path: "/dashboard" },
      { icon: "▦", label: "Messages", path: "/conversations" },
      { icon: "▧", label: "Coupons", path: "/coupons" },
      { icon: "▨", label: "Leaderboard", path: "/leaderboard" },
      { icon: "▩", label: "Verification", path: "/verification" },
      { icon: "□", label: "Settings", path: "/settings" },
    ],
  },
  {
    label: "Sellers",
    items: [
      { icon: "◐", label: "Sell Now", path: "/minimart/add" },
      { icon: "◒", label: "Invite Friends", path: "/invitation" },
    ],
  },
  {
    label: "Support",
    items: [
      { icon: "○", label: "Help & FAQ", path: "/faq" },
      { icon: "◌", label: "Contact Us", path: "/support" },
      { icon: "◍", label: "Complaints", path: "/complain" },
    ],
  },
  {
    label: "Legal",
    items: [
      { icon: "·", label: "Terms of Service", path: "/terms" },
      { icon: "·", label: "Privacy Policy", path: "/privacy" },
    ],
  },
];

export default function HamburgerMenu({ open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const drawerRef = useRef(null);
  const firstFocusRef = useRef(null);

  /* lock body scroll when open */
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  /* focus trap — focus first item on open */
  useEffect(() => {
    if (open && firstFocusRef.current) {
      firstFocusRef.current.focus();
    }
  }, [open]);

  /* ESC to close */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  /* swipe-to-close on mobile */
  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;

    let startX = 0;
    let currentX = 0;

    const onTouchStart = (e) => {
      startX = e.touches[0].clientX;
    };
    const onTouchMove = (e) => {
      currentX = e.touches[0].clientX;
    };
    const onTouchEnd = () => {
      if (startX - currentX > 80) onClose();
    };

    drawer.addEventListener("touchstart", onTouchStart, { passive: true });
    drawer.addEventListener("touchmove", onTouchMove, { passive: true });
    drawer.addEventListener("touchend", onTouchEnd);

    return () => {
      drawer.removeEventListener("touchstart", onTouchStart);
      drawer.removeEventListener("touchmove", onTouchMove);
      drawer.removeEventListener("touchend", onTouchEnd);
    };
  }, [onClose]);

  const go = useCallback(
    (path) => {
      onClose();
      navigate(path);
    },
    [onClose, navigate]
  );

  return (
    <>
      {/* ── BACKDROP ── */}
      <div
        className={`hm-backdrop${open ? " hm-backdrop--open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── DRAWER ── */}
      <aside
        ref={drawerRef}
        className={`hm-drawer${open ? " hm-drawer--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* ── HEADER ── */}
        <div className="hm-head">
          <div className="hm-brand">
            <div className="hm-brand-logo">
              <span className="hm-brand-mark">M</span>
            </div>
            <div className="hm-brand-text">
              <span className="hm-brand-name">Minimart</span>
              <span className="hm-brand-tagline">Marketplace</span>
            </div>
          </div>
          <button
            ref={firstFocusRef}
            className="hm-close"
            onClick={onClose}
            aria-label="Close menu"
          >
            <span className="hm-close-line" />
            <span className="hm-close-line" />
          </button>
        </div>

        {/* ── SELL CTA ── */}
        <div className="hm-cta-wrap">
          <button className="hm-cta" onClick={() => go("/minimart/add")}>
            <span className="hm-cta-icon">＋</span>
            <span className="hm-cta-text">Post a Listing</span>
            <span className="hm-cta-arrow">→</span>
          </button>
        </div>

        {/* ── SCROLLABLE NAV ── */}
        <nav className="hm-nav">
          <div className="hm-nav-scroll">
            {NAV_SECTIONS.map((section, si) => (
              <div key={section.label} className="hm-section">
                <div className="hm-section-label">
                  <span className="hm-section-label-text">
                    {section.label}
                  </span>
                  <span className="hm-section-label-line" />
                </div>
                {section.items.map((item) => {
                  const active = location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      className={`hm-item${active ? " hm-item--active" : ""}`}
                      onClick={() => go(item.path)}
                      aria-current={active ? "page" : undefined}
                      style={{ animationDelay: `${si * 40}ms` }}
                    >
                      <span className="hm-item-icon" aria-hidden="true">
                        {item.icon}
                      </span>
                      <span className="hm-item-label">{item.label}</span>
                      {active && (
                        <span className="hm-item-active-bar" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        {/* ── FOOTER ── */}
        <div className="hm-foot">
          <div className="hm-foot-divider" />
          <p className="hm-foot-copy">
            &copy; {new Date().getFullYear()} Loemart Technologies Ltd.
          </p>
          <p className="hm-foot-sub">Nigeria's neighbourhood marketplace</p>
        </div>
      </aside>
    </>
  );
}