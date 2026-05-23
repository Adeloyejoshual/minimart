import { NAV } from "./nav";

export default function Sidebar({
  page,
  setPage,
  pendingCount,
  reportCount,
  marketPendingCount,
}) {
  return (
    <aside className="sidebar">
      <div className="sb-logo">MM <span>Admin</span></div>

      {NAV.map((item, i) =>
        item.g ? (
          <div key={i} className="sb-section">{item.g}</div>
        ) : (
          <button
            key={item.id}
            className={`nav-btn ${page === item.id ? "active" : ""}`}
            onClick={() => setPage(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}

            {/* existing products — pending from old products table */}
            {item.id === "products" && pendingCount > 0 && (
              <span className="nav-badge">{pendingCount}</span>
            )}

            {/* market products — pending_review from market.products */}
            {item.id === "market_products" && marketPendingCount > 0 && (
              <span className="nav-badge">{marketPendingCount}</span>
            )}

            {/* reports */}
            {item.id === "reports" && reportCount > 0 && (
              <span className="nav-badge nav-badge-red">{reportCount}</span>
            )}
          </button>
        )
      )}

      <div className="sb-footer">Super Admin v2</div>
    </aside>
  );
}