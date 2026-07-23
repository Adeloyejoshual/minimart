import { NAV } from "./nav";

export default function Sidebar({ page, setPage, counts = {} }) {
  return (
    <aside className="sidebar">
      <div className="sb-logo">MM <span>Admin</span></div>

      {NAV.map((item, i) => {
        if (item.g) {
          return <div key={`g-${i}`} className="sb-section">{item.g}</div>;
        }

        const count = item.badgeKey ? counts[item.badgeKey] : 0;

        return (
          <button
            key={item.id}
            className={`nav-btn ${page === item.id ? "active" : ""}`}
            onClick={() => setPage(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
            {count > 0 && (
              <span className={`nav-badge ${item.tone ? `nav-badge-${item.tone}` : ""}`}>
                {count > 999 ? "999+" : count}
              </span>
            )}
          </button>
        );
      })}

      <div className="sb-footer">Super Admin v2</div>
    </aside>
  );
}