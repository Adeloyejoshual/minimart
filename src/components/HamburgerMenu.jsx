// src/components/HamburgerMenu.jsx
import React, { useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./HamburgerMenu.css";

const NAV_SECTIONS = [
  {
    label: "Explore",
    items: [
      { icon: "◈", label: "Home",         path: "/"         },
      { icon: "◎", label: "Search",       path: "/search"   },
      { icon: "◉", label: "Near You",     path: "/nearby"   },
      { icon: "◇", label: "Trending",     path: "/trending" },
      { icon: "◆", label: "Cheap Deals",  path: "/deals"    },
      { icon: "◈", label: "New Arrivals", path: "/latest"   },
    ],
  },
  {
    label: "Account",
    items: [
      { icon: "▣", label: "Profile",      path: "/profile"       },
      { icon: "▤", label: "Dashboard",    path: "/dashboard"     },
      { icon: "▥", label: "Wallet",       path: "/wallet"        },
      { icon: "▦", label: "Messages",     path: "/conversations" },
      { icon: "▧", label: "Coupons",      path: "/coupons"       },
      { icon: "▨", label: "Leaderboard",  path: "/leaderboard"   },
      { icon: "▩", label: "Verification", path: "/verification"  },
      { icon: "□", label: "Settings",     path: "/settings"      },
    ],
  },
  {
    label: "Sellers",
    items: [
      { icon: "◐", label: "Sell Now",      path: "/minimart/add"  },
      { icon: "◑", label: "Become a Seller", path: "/become-seller" },
      { icon: "◒", label: "Invite Friends", path: "/invitation"   },
    ],
  },
  {
    label: "Support",
    items: [
      { icon: "○", label: "Help & FAQ",    path: "/faq"      },
      { icon: "◌", label: "Contact Us",    path: "/support"  },
      { icon: "◍", label: "Complaints",    path: "/complain" },
    ],
  },
  {
    label: "Legal",
    items: [
      { icon: "·", label: "Terms of Service", path: "/terms"   },
      { icon: "·", label: "Privacy Policy",   path: "/privacy" },
    ],
  },
];

export default function HamburgerMenu({ open, onClose }) {
  const navigate  = useNavigate();
  const location  = useLocation();

  /* lock body scroll when open */
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  /* ESC to close */
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const go = useCallback((path) => {
    onClose();
    navigate(path);
  }, [onClose, navigate]);

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
        className={`hm-drawer${open ? " hm-drawer--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* ── HEADER ── */}
        <div className="hm-head">
          <div className="hm-brand">
            <span className="hm-brand-mark">M</span>
            <span className="hm-brand-name">Minimart</span>
          </div>
          <button
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
          <button
            className="hm-cta"
            onClick={() => go("/minimart/add")}
          >
            <span className="hm-cta-plus">＋</span>
            Post a Listing
          </button>
        </div>

        {/* ── NAV SECTIONS ── */}
        <nav className="hm-nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="hm-section">
              <div className="hm-section-label">{section.label}</div>
              {section.items.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    className={`hm-item${active ? " hm-item--active" : ""}`}
                    onClick={() => go(item.path)}
                  >
                    <span className="hm-item-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="hm-item-label">{item.label}</span>
                    {active && <span className="hm-item-dot" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* ── FOOTER ── */}
        <div className="hm-foot">
          <p className="hm-foot-copy">
            &copy; {new Date().getFullYear()} Minimart Technologies Ltd.
          </p>
          <p className="hm-foot-sub">Nigeria's neighbourhood marketplace</p>
        </div>
      </aside>
    </>
  );
}
