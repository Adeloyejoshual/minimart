import { NAV } from "./nav";

const fmt = (n) => Number(n ?? 0).toLocaleString();

export default function Sidebar({ page, setPage, pendingCount }) {
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
          </button>
        )
      )}
      <div className="sb-footer">Super Admin v2</div>
    </aside>
  );
}