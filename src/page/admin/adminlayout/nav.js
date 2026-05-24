import { NAV } from "./nav";

export default function Sidebar({
  page,
  setPage,
  pendingCount,
  reportCount,
  marketPendingCount,
  verificationPendingCount,
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

            {item.id === "products" && pendingCount > 0 && (
              <span className="nav-badge">{pendingCount}</span>
            )}

            {item.id === "market_products" && marketPendingCount > 0 && (
              <span className="nav-badge">{marketPendingCount}</span>
            )}

            {item.id === "reports" && reportCount > 0 && (
              <span className="nav-badge nav-badge-red">{reportCount}</span>
            )}

            {item.id === "verification" && verificationPendingCount > 0 && (
              <span className="nav-badge nav-badge-red">{verificationPendingCount}</span>
            )}
          </button>
        )
      )}

      <div className="sb-footer">Super Admin v2</div>
    </aside>
  );
}