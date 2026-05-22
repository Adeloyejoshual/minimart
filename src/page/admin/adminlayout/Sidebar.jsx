import { NAV } from "./nav";

export default function Sidebar({ page, setPage, pendingCount, reportCount }) {
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

            {/* pending products badge */}
            {item.id === "products" && pendingCount > 0 && (
              <span className="nav-badge">{pendingCount}</span>
            )}

            {/* pending reports badge */}
            {item.id === "reports" && reportCount > 0 && (
              <span className="nav-badge nav-badge-red">
                {reportCount}
              </span>
            )}
          </button>
        )
      )}

      <div className="sb-footer">Super Admin v2</div>
    </aside>
  );
}