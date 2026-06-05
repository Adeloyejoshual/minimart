// components/seller/dashboard/Sidebar.jsx
import { StatusBadge } from "./Shared";

const NAV_ITEMS = [
  { key: "overview",   icon: "📊", label: "Overview"   },
  { key: "orders",     icon: "📦", label: "Orders"     },
  { key: "products",   icon: "🏷️", label: "Products"  },
  { key: "analytics",  icon: "📈", label: "Analytics"  },
  { key: "payouts",    icon: "💳", label: "Payouts"    },
  { key: "settings",   icon: "⚙️", label: "Settings"  },
];

export const Sidebar = ({
  vendor,
  activeSection,
  setActiveSection,
  sidebarOpen,
  setSidebarOpen,
  unreadCount,
}) => (
  <>
    {sidebarOpen && (
      <div
        className="sd-overlay"
        onClick={() => setSidebarOpen(false)}
      />
    )}

    <aside className={`sd-sidebar ${sidebarOpen ? "open" : ""}`}>
      {/* Store header */}
      <div className="sd-sidebar-header">
        {vendor?.store_logo ? (
          <img
            src={vendor.store_logo}
            alt={vendor.store_name}
            className="sd-store-logo"
          />
        ) : (
          <div className="sd-store-logo-placeholder">
            {vendor?.store_name?.[0]?.toUpperCase() ?? "S"}
          </div>
        )}
        <div className="sd-store-info">
          <h3 className="sd-store-name">
            {vendor?.store_name ?? "My Store"}
          </h3>
          <StatusBadge status={vendor?.status} />
        </div>
        <button
          className="sd-sidebar-close"
          onClick={() => setSidebarOpen(false)}
        >
          ✕
        </button>
      </div>

      {/* Nav */}
      <nav className="sd-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={`sd-nav-item ${activeSection === item.key ? "active" : ""}`}
            onClick={() => {
              setActiveSection(item.key);
              setSidebarOpen(false);
            }}
          >
            <span className="sd-nav-icon">{item.icon}</span>
            <span className="sd-nav-label">{item.label}</span>
            {item.key === "orders" && unreadCount > 0 && (
              <span className="sd-nav-badge">{unreadCount}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="sd-sidebar-footer">
        <a href="/become-seller" className="sd-footer-link">🏪 Edit Store</a>
        <a href="/"              className="sd-footer-link">🌐 Marketplace</a>
        <a href="/support"       className="sd-footer-link">💬 Support</a>
      </div>
    </aside>
  </>
);