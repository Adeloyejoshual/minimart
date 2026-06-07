// pages/seller/components/Sidebar.jsx
import React from "react";

const NAV = [
  { key: "overview",  icon: "⊞",  label: "Overview"  },
  { key: "orders",    icon: "📦",  label: "Orders"    },
  { key: "products",  icon: "🏷️", label: "Products"  },
  { key: "analytics", icon: "📊",  label: "Analytics" },
  { key: "payouts",   icon: "💳",  label: "Payouts"   },
  { key: "settings",  icon: "⚙️", label: "Settings"  },
];

export default function Sidebar({
  vendor, activePage, onNavigate,
  isOpen, onClose, unreadCount = 0,
}) {
  return (
    <aside
      style={{
        ...s.sidebar,
        ...(isOpen
          ? { transform: "translateX(0)", boxShadow: "4px 0 24px rgba(0,0,0,0.15)" }
          : {}),
      }}
    >
      {/* Brand header */}
      <div style={s.brand}>
        <div style={s.brandIcon}>🛒</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={s.brandName} title={vendor?.store_name}>
            {vendor?.store_name ?? "My Store"}
          </p>
          <div style={s.statusRow}>
            <span style={s.dot} />
            <span style={s.statusText}>Active</span>
          </div>
        </div>
        <button
          onClick={onClose}
          style={s.closeBtn}
          aria-label="Close sidebar"
        >
          ✕
        </button>
      </div>

      {/* Navigation */}
      <nav style={s.nav}>
        <p style={s.navSectionLabel}>MENU</p>

        {NAV.map(({ key, icon, label }) => {
          const active = activePage === key;
          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              style={{
                ...s.navItem,
                background:  active
                  ? "rgba(255,255,255,0.13)" : "transparent",
                color:       active
                  ? "white" : "rgba(255,255,255,0.62)",
                fontWeight:  active ? 700 : 400,
              }}
            >
              {active && <span style={s.activeIndicator} />}
              <span style={s.navItemIcon}>{icon}</span>
              <span style={{ flex: 1 }}>{label}</span>

              {/* Notification badge on overview */}
              {key === "overview" && unreadCount > 0 && (
                <span style={s.badge}>{unreadCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Store info footer */}
      <div style={s.footer}>
        <div style={s.footerAvatar}>
          {(vendor?.store_name?.[0] ?? "S").toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={s.footerStoreName} title={vendor?.store_name}>
            {vendor?.store_name ?? "Seller"}
          </p>
          <p style={s.footerCategory}>
            {vendor?.store_category ?? "Marketplace"}
          </p>
        </div>
        <button
          title="Sign out"
          style={s.signOutBtn}
          onClick={() => {
            if (!window.confirm(
              "Sign out of your seller dashboard?"
            )) return;
            localStorage.removeItem("token");
            window.location.href = "/become-seller";
          }}
        >
          ↩
        </button>
      </div>
    </aside>
  );
}

const s = {
  sidebar: {
    width:          "240px",
    minWidth:       "240px",
    background:     "linear-gradient(170deg,#1e1b4b 0%,#312e81 60%,#3730a3 100%)",
    display:        "flex",
    flexDirection:  "column",
    height:         "100vh",
    position:       "sticky",
    top:            0,
    overflowY:      "auto",
    zIndex:         100,
    transition:     "transform 0.25s cubic-bezier(.4,0,.2,1)",
    // On mobile (<768px) it slides in from left
    // We handle this via isOpen prop + transform override above
  },
  brand: {
    display:       "flex",
    alignItems:    "center",
    gap:           "0.75rem",
    padding:       "1.5rem 1.25rem 1.1rem",
    borderBottom:  "1px solid rgba(255,255,255,0.07)",
  },
  brandIcon: {
    width:          "40px",
    height:         "40px",
    background:     "rgba(255,255,255,0.14)",
    borderRadius:   "12px",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontSize:       "1.2rem",
    flexShrink:     0,
  },
  brandName: {
    fontWeight:   700,
    color:        "white",
    fontSize:     "0.95rem",
    margin:       0,
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap",
  },
  statusRow: {
    display:    "flex",
    alignItems: "center",
    gap:        "0.3rem",
    marginTop:  "0.2rem",
  },
  dot: {
    width:        "6px",
    height:       "6px",
    borderRadius: "50%",
    background:   "#34d399",
    flexShrink:   0,
  },
  statusText: {
    color:    "#6ee7b7",
    fontSize: "0.72rem",
    fontWeight: 600,
  },
  closeBtn: {
    background:   "rgba(255,255,255,0.1)",
    border:       "none",
    color:        "rgba(255,255,255,0.8)",
    cursor:       "pointer",
    borderRadius: "8px",
    padding:      "0.4rem 0.6rem",
    fontSize:     "0.9rem",
    flexShrink:   0,
    lineHeight:   1,
  },
  nav: {
    flex:          1,
    padding:       "1.1rem 0.75rem",
    display:       "flex",
    flexDirection: "column",
    gap:           "0.15rem",
  },
  navSectionLabel: {
    fontSize:      "0.65rem",
    fontWeight:    700,
    color:         "rgba(255,255,255,0.28)",
    letterSpacing: "0.1em",
    padding:       "0 0.5rem",
    margin:        "0 0 0.5rem",
  },
  navItem: {
    display:       "flex",
    alignItems:    "center",
    gap:           "0.7rem",
    padding:       "0.68rem 0.875rem",
    borderRadius:  "11px",
    border:        "none",
    cursor:        "pointer",
    fontSize:      "0.875rem",
    transition:    "all 0.15s",
    width:         "100%",
    textAlign:     "left",
    position:      "relative",
  },
  activeIndicator: {
    position:     "absolute",
    left:         "-0.75rem",
    top:          "50%",
    transform:    "translateY(-50%)",
    width:        "3px",
    height:       "55%",
    background:   "white",
    borderRadius: "0 3px 3px 0",
  },
  navItemIcon: {
    fontSize: "1rem",
    width:    "20px",
    textAlign:"center",
    flexShrink:0,
  },
  badge: {
    background:    "#f59e0b",
    color:         "white",
    fontSize:      "0.62rem",
    fontWeight:    800,
    padding:       "0.1rem 0.42rem",
    borderRadius:  "100px",
    minWidth:      "18px",
    textAlign:     "center",
    lineHeight:    "1.4",
  },
  footer: {
    display:       "flex",
    alignItems:    "center",
    gap:           "0.7rem",
    padding:       "1rem 1.1rem",
    borderTop:     "1px solid rgba(255,255,255,0.07)",
  },
  footerAvatar: {
    width:          "34px",
    height:         "34px",
    borderRadius:   "10px",
    background:     "rgba(255,255,255,0.18)",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontWeight:     800,
    color:          "white",
    fontSize:       "0.95rem",
    flexShrink:     0,
  },
  footerStoreName: {
    fontWeight:   600,
    color:        "rgba(255,255,255,0.9)",
    fontSize:     "0.8rem",
    margin:       0,
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap",
  },
  footerCategory: {
    color:        "rgba(255,255,255,0.4)",
    fontSize:     "0.7rem",
    margin:       0,
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap",
  },
  signOutBtn: {
    background:   "rgba(255,255,255,0.08)",
    border:       "none",
    color:        "rgba(255,255,255,0.55)",
    cursor:       "pointer",
    borderRadius: "8px",
    padding:      "0.45rem 0.6rem",
    fontSize:     "1rem",
    flexShrink:   0,
    transition:   "all 0.15s",
    lineHeight:   1,
  },
};