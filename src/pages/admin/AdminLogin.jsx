import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const API = "https://minimart-ivrm.onrender.com/api/admin";

// ─── Design tokens ────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #0b0e17;
    --surface:  #131824;
    --panel:    #1a2030;
    --border:   #252d40;
    --accent:   #4f8cff;
    --accent2:  #22d3a5;
    --warn:     #f59e42;
    --danger:   #f43f5e;
    --text:     #e8edf7;
    --muted:    #6b7a99;
    --font:     'Syne', sans-serif;
    --mono:     'DM Mono', monospace;
  }

  body { background: var(--bg); color: var(--text); font-family: var(--font); }

  .dash { display: flex; min-height: 100vh; }

  /* ── Sidebar ── */
  .sidebar {
    width: 220px; min-height: 100vh; background: var(--surface);
    border-right: 1px solid var(--border); padding: 28px 16px;
    display: flex; flex-direction: column; gap: 6px; flex-shrink: 0;
  }
  .sidebar-logo {
    font-size: 1.25rem; font-weight: 800; color: var(--accent);
    letter-spacing: -.02em; padding: 0 8px 24px;
  }
  .nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; border-radius: 8px; cursor: pointer;
    color: var(--muted); font-size: .875rem; font-weight: 600;
    transition: background .15s, color .15s; border: none; background: none;
    width: 100%; text-align: left;
  }
  .nav-item:hover { background: var(--panel); color: var(--text); }
  .nav-item.active { background: rgba(79,140,255,.12); color: var(--accent); }
  .nav-icon { font-size: 1rem; width: 20px; text-align: center; }

  /* ── Main ── */
  .main { flex: 1; padding: 32px 36px; overflow-x: hidden; }
  .page-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 28px;
  }
  .page-title { font-size: 1.6rem; font-weight: 800; letter-spacing: -.03em; }
  .badge {
    font-size: .7rem; font-weight: 600; padding: 3px 9px; border-radius: 20px;
    background: rgba(79,140,255,.15); color: var(--accent);
    font-family: var(--mono);
  }
  .live-dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%;
    background: var(--accent2); margin-right: 6px;
    animation: pulse 1.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,100% { opacity: 1; transform: scale(1); }
    50%      { opacity: .5; transform: scale(1.3); }
  }

  /* ── Stat cards ── */
  .stats-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px; margin-bottom: 28px;
  }
  .stat-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 20px;
    transition: border-color .2s, transform .2s;
  }
  .stat-card:hover { border-color: var(--accent); transform: translateY(-2px); }
  .stat-label { font-size: .72rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 8px; }
  .stat-value { font-size: 2rem; font-weight: 800; letter-spacing: -.04em; }
  .stat-value.blue  { color: var(--accent); }
  .stat-value.green { color: var(--accent2); }
  .stat-value.amber { color: var(--warn); }
  .stat-value.red   { color: var(--danger); }

  /* ── Section ── */
  .section { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; margin-bottom: 24px; overflow: hidden; }
  .section-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px; border-bottom: 1px solid var(--border);
  }
  .section-title { font-size: .95rem; font-weight: 700; }

  /* ── Table ── */
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: .82rem; }
  th { padding: 10px 16px; text-align: left; font-size: .7rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .07em; border-bottom: 1px solid var(--border); white-space: nowrap; }
  td { padding: 11px 16px; border-bottom: 1px solid rgba(37,45,64,.6); vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: rgba(79,140,255,.04); }

  /* ── Status pills ── */
  .pill {
    display: inline-block; padding: 2px 10px; border-radius: 20px;
    font-size: .68rem; font-weight: 700; font-family: var(--mono);
    text-transform: uppercase; letter-spacing: .05em;
  }
  .pill-active   { background: rgba(34,211,165,.15); color: var(--accent2); }
  .pill-draft    { background: rgba(107,122,153,.15); color: var(--muted); }
  .pill-pending  { background: rgba(245,158,66,.15);  color: var(--warn); }
  .pill-banned   { background: rgba(244,63,94,.15);   color: var(--danger); }
  .pill-promoted { background: rgba(79,140,255,.15);  color: var(--accent); }

  /* ── Buttons ── */
  .btn {
    padding: 5px 12px; border-radius: 7px; border: 1px solid transparent;
    font-size: .75rem; font-weight: 700; cursor: pointer;
    transition: opacity .15s, transform .1s; font-family: var(--font);
  }
  .btn:hover { opacity: .82; transform: translateY(-1px); }
  .btn:active { transform: translateY(0); }
  .btn-danger { background: rgba(244,63,94,.15); color: var(--danger); border-color: rgba(244,63,94,.3); }
  .btn-success { background: rgba(34,211,165,.15); color: var(--accent2); border-color: rgba(34,211,165,.3); }
  .btn-warn { background: rgba(245,158,66,.15); color: var(--warn); border-color: rgba(245,158,66,.3); }
  .btn-blue { background: rgba(79,140,255,.15); color: var(--accent); border-color: rgba(79,140,255,.3); }

  /* ── Chart area ── */
  .chart-area { padding: 16px 20px 20px; }

  /* ── Tabs ── */
  .tabs { display: flex; gap: 4px; padding: 12px 16px 0; }
  .tab {
    padding: 7px 14px; border-radius: 8px 8px 0 0; font-size: .78rem;
    font-weight: 700; cursor: pointer; border: none; background: none;
    color: var(--muted); transition: color .15s, background .15s;
    font-family: var(--font);
  }
  .tab.active { background: var(--panel); color: var(--text); }

  /* ── Logs ── */
  .logs-list { padding: 6px 0; max-height: 320px; overflow-y: auto; }
  .log-item {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 10px 20px; border-bottom: 1px solid rgba(37,45,64,.5);
    font-size: .78rem;
  }
  .log-item:last-child { border-bottom: none; }
  .log-time { color: var(--muted); font-family: var(--mono); white-space: nowrap; flex-shrink: 0; font-size: .72rem; margin-top: 1px; }
  .log-details { flex: 1; line-height: 1.5; }
  .log-admin { color: var(--accent); font-weight: 600; }

  /* ── Empty / loading ── */
  .empty { padding: 40px 20px; text-align: center; color: var(--muted); font-size: .85rem; }
  .loading { text-align: center; color: var(--muted); padding: 60px; font-size: .9rem; }

  /* ── Search ── */
  .search-bar {
    background: var(--panel); border: 1px solid var(--border); color: var(--text);
    padding: 7px 14px; border-radius: 8px; font-size: .82rem; width: 220px;
    font-family: var(--font); outline: none;
    transition: border-color .15s;
  }
  .search-bar:focus { border-color: var(--accent); }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: var(--surface); }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n ?? 0).toLocaleString();
const fmtCurrency = (n) => `₦${Number(n ?? 0).toLocaleString()}`;
const fmtDate = (d) => d ? new Date(d).toLocaleString("en-NG", { dateStyle: "short", timeStyle: "short" }) : "—";

const statusPill = (s) => {
  const map = { active: "active", draft: "draft", pending: "pending", banned: "banned", promoted: "promoted" };
  return <span className={`pill pill-${map[s] || "draft"}`}>{s || "—"}</span>;
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ label, value, color = "blue", icon }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{icon} {label}</div>
      <div className={`stat-value ${color}`}>{value}</div>
    </div>
  );
}

function SectionHeader({ title, children }) {
  return (
    <div className="section-header">
      <span className="section-title">{title}</span>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{children}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const token = localStorage.getItem("admin_token");
  const headers = { Authorization: `Bearer ${token}` };

  const [page, setPage] = useState("overview");
  const [stats, setStats] = useState({ users: 0, orders: 0, revenue: 0, dailySales: [], activeUsers: 0, bannedUsers: 0, pendingProducts: 0, totalProducts: 0 });
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [productTab, setProductTab] = useState("all");
  const [userSearch, setUserSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const can = (p) => permissions.includes(p);

  // ── Fetch helpers ──────────────────────────────────────────────────────────
  const load = useCallback(async (path, setter) => {
    try {
      const { data } = await axios.get(`${API}${path}`, { headers });
      setter(data);
    } catch { /* silently fail per section */ }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      load("/stats",           setStats),
      load("/users",           setUsers),
      load("/products",        setAllProducts),
      load("/products/pending", setProducts),
      load("/logs",            setLogs),
      load("/me",              (d) => setPermissions(d.permissions || [])),
    ]);
    setLoading(false);
  }, [load]);

  useEffect(() => {
    loadAll();
    const iv = setInterval(() => load("/logs", setLogs), 5000);
    return () => clearInterval(iv);
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────
  const banUser = async (id) => {
    await axios.post(`${API}/users/${id}/ban`, {}, { headers });
    load("/users", setUsers);
    load("/stats", setStats);
  };

  const approveProduct = async (id) => {
    await axios.post(`${API}/products/${id}/approve`, {}, { headers });
    load("/products/pending", setProducts);
    load("/products", setAllProducts);
    load("/stats", setStats);
  };

  const rejectProduct = async (id) => {
    await axios.post(`${API}/products/${id}/reject`, {}, { headers });
    load("/products/pending", setProducts);
    load("/products", setAllProducts);
    load("/stats", setStats);
  };

  // ── Filtered data ──────────────────────────────────────────────────────────
  const filteredUsers = users.filter(u =>
    `${u.name} ${u.email}`.toLowerCase().includes(userSearch.toLowerCase())
  );

  const displayedProducts = (productTab === "pending" ? products : allProducts)
    .filter(p => p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
                 p.seller_name?.toLowerCase().includes(productSearch.toLowerCase()));

  // ── Chart data ─────────────────────────────────────────────────────────────
  const salesData = (stats.dailySales ?? []).map(d => ({ date: d.date?.slice(5), sales: Number(d.amount) }));

  // ── Product stats for chart ────────────────────────────────────────────────
  const productStatusData = [
    { status: "Active",  count: allProducts.filter(p => p.status === "active").length },
    { status: "Draft",   count: allProducts.filter(p => p.status === "draft").length },
    { status: "Pending", count: allProducts.filter(p => p.status === "pending").length },
  ];

  if (loading) return (
    <>
      <style>{css}</style>
      <div className="loading">⟳ Loading admin panel…</div>
    </>
  );

  return (
    <>
      <style>{css}</style>
      <div className="dash">

        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-logo">⚡ MiniMart</div>
          {[
            { id: "overview",  icon: "◈", label: "Overview" },
            { id: "users",     icon: "◉", label: "Users",    perm: "user_support" },
            { id: "products",  icon: "▦",  label: "Products", perm: "content_moderation" },
            { id: "logs",      icon: "≡",  label: "Activity", perm: "manage_site" },
          ].map(({ id, icon, label, perm }) => {
            if (perm && !can(perm)) return null;
            return (
              <button key={id} className={`nav-item ${page === id ? "active" : ""}`} onClick={() => setPage(id)}>
                <span className="nav-icon">{icon}</span> {label}
              </button>
            );
          })}
        </aside>

        {/* ── Main ── */}
        <main className="main">

          {/* ── OVERVIEW ── */}
          {page === "overview" && (
            <>
              <div className="page-header">
                <h1 className="page-title">Overview</h1>
                <span className="badge">{new Date().toLocaleDateString("en-NG", { dateStyle: "medium" })}</span>
              </div>

              {/* Stats */}
              <div className="stats-grid">
                <StatCard icon="👥" label="Total Users"    value={fmt(stats.users)}          color="blue"  />
                <StatCard icon="✅" label="Active Users"   value={fmt(stats.activeUsers)}     color="green" />
                <StatCard icon="🚫" label="Banned Users"   value={fmt(stats.bannedUsers)}     color="red"   />
                <StatCard icon="📦" label="Total Products" value={fmt(stats.totalProducts || allProducts.length)} color="blue"  />
                <StatCard icon="⏳" label="Pending Review" value={fmt(stats.pendingProducts || products.length)}  color="amber" />
                <StatCard icon="🛒" label="Total Orders"   value={fmt(stats.orders)}          color="green" />
                <StatCard icon="₦"  label="Revenue"        value={fmtCurrency(stats.revenue)} color="green" />
              </div>

              {/* Sales chart */}
              {can("analytics") && salesData.length > 0 && (
                <div className="section">
                  <SectionHeader title="📈 Daily Sales" />
                  <div className="chart-area">
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={salesData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#252d40" />
                        <XAxis dataKey="date" tick={{ fill: "#6b7a99", fontSize: 11 }} />
                        <YAxis tick={{ fill: "#6b7a99", fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ background: "#131824", border: "1px solid #252d40", borderRadius: 8, color: "#e8edf7" }}
                          formatter={(v) => [`₦${v.toLocaleString()}`, "Sales"]}
                        />
                        <Line type="monotone" dataKey="sales" stroke="#4f8cff" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Product distribution chart */}
              {can("content_moderation") && (
                <div className="section">
                  <SectionHeader title="▦ Product Status Breakdown" />
                  <div className="chart-area">
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={productStatusData} barSize={40}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#252d40" />
                        <XAxis dataKey="status" tick={{ fill: "#6b7a99", fontSize: 11 }} />
                        <YAxis tick={{ fill: "#6b7a99", fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: "#131824", border: "1px solid #252d40", borderRadius: 8, color: "#e8edf7" }} />
                        <Bar dataKey="count" fill="#22d3a5" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Recent logs preview */}
              {can("manage_site") && (
                <div className="section">
                  <SectionHeader title="≡ Recent Activity">
                    <span className="badge"><span className="live-dot" />LIVE</span>
                    <button className="btn btn-blue" onClick={() => setPage("logs")}>See all →</button>
                  </SectionHeader>
                  <div className="logs-list">
                    {logs.slice(0, 6).map((log) => (
                      <div key={log.id} className="log-item">
                        <span className="log-time">{fmtDate(log.created_at)}</span>
                        <span className="log-details">
                          {log.details} — <span className="log-admin">{log.admin_name}</span>
                        </span>
                      </div>
                    ))}
                    {!logs.length && <div className="empty">No activity yet</div>}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── USERS ── */}
          {page === "users" && can("user_support") && (
            <>
              <div className="page-header">
                <h1 className="page-title">Users <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "1rem" }}>({fmt(users.length)})</span></h1>
                <input className="search-bar" placeholder="Search by name or email…" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
              </div>

              <div className="section">
                <SectionHeader title={`👥 All Users (${filteredUsers.length})`}>
                  <button className="btn btn-blue" onClick={() => load("/users", setUsers)}>↻ Refresh</button>
                </SectionHeader>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th><th>Email</th><th>Phone</th>
                        <th>City</th><th>Status</th><th>Joined</th>
                        <th>Last Login</th><th>Balance</th><th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(u => (
                        <tr key={u.id}>
                          <td style={{ fontWeight: 600 }}>{u.name}</td>
                          <td style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: ".75rem" }}>{u.email}</td>
                          <td style={{ fontFamily: "var(--mono)", fontSize: ".75rem" }}>{u.phone_number || "—"}</td>
                          <td>{u.city || "—"}</td>
                          <td>{statusPill(u.status || "active")}</td>
                          <td style={{ fontFamily: "var(--mono)", fontSize: ".72rem" }}>{fmtDate(u.created_at)}</td>
                          <td style={{ fontFamily: "var(--mono)", fontSize: ".72rem" }}>{fmtDate(u.last_login)}</td>
                          <td style={{ color: "var(--accent2)", fontFamily: "var(--mono)" }}>{fmtCurrency(u.balance)}</td>
                          <td>
                            {u.status !== "banned"
                              ? <button className="btn btn-danger" onClick={() => banUser(u.id)}>Ban</button>
                              : <span style={{ color: "var(--muted)", fontSize: ".72rem" }}>Banned</span>}
                          </td>
                        </tr>
                      ))}
                      {!filteredUsers.length && (
                        <tr><td colSpan={9} className="empty">No users found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── PRODUCTS ── */}
          {page === "products" && can("content_moderation") && (
            <>
              <div className="page-header">
                <h1 className="page-title">Products</h1>
                <input className="search-bar" placeholder="Search product or seller…" value={productSearch} onChange={e => setProductSearch(e.target.value)} />
              </div>

              <div className="section">
                <div className="tabs">
                  {[
                    { id: "all",     label: `All (${allProducts.length})` },
                    { id: "pending", label: `Pending (${products.length})` },
                  ].map(t => (
                    <button key={t.id} className={`tab ${productTab === t.id ? "active" : ""}`} onClick={() => setProductTab(t.id)}>
                      {t.label}
                    </button>
                  ))}
                </div>

                <SectionHeader title="">
                  <button className="btn btn-blue" onClick={() => { load("/products", setAllProducts); load("/products/pending", setProducts); }}>↻ Refresh</button>
                </SectionHeader>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th><th>Seller</th><th>Price</th>
                        <th>Category</th><th>Location</th><th>Status</th>
                        <th>Promoted</th><th>Created</th>
                        {productTab === "pending" && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {displayedProducts.map(p => (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 600, maxWidth: 200 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {p.thumbnail_url && (
                                <img src={p.thumbnail_url} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                              )}
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name || p.title}</span>
                            </div>
                          </td>
                          <td style={{ color: "var(--accent)", fontSize: ".8rem" }}>{p.seller_name || "—"}</td>
                          <td style={{ fontFamily: "var(--mono)", color: "var(--accent2)" }}>{fmtCurrency(p.price)}</td>
                          <td style={{ fontSize: ".78rem", color: "var(--muted)" }}>{p.category_name || "—"}</td>
                          <td style={{ fontSize: ".78rem" }}>{[p.location_city, p.location_state].filter(Boolean).join(", ") || "—"}</td>
                          <td>{statusPill(p.status)}</td>
                          <td>{p.is_promoted ? <span className="pill pill-promoted">Boosted</span> : <span style={{ color: "var(--muted)", fontSize: ".72rem" }}>—</span>}</td>
                          <td style={{ fontFamily: "var(--mono)", fontSize: ".72rem" }}>{fmtDate(p.created_at)}</td>
                          {productTab === "pending" && (
                            <td style={{ display: "flex", gap: 6 }}>
                              <button className="btn btn-success" onClick={() => approveProduct(p.id)}>✓ Approve</button>
                              <button className="btn btn-danger"  onClick={() => rejectProduct(p.id)}>✕ Reject</button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {!displayedProducts.length && (
                        <tr><td colSpan={9} className="empty">No products found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── ACTIVITY LOGS ── */}
          {page === "logs" && can("manage_site") && (
            <>
              <div className="page-header">
                <h1 className="page-title">Activity Logs</h1>
                <span className="badge"><span className="live-dot" />Auto-refresh 5s</span>
              </div>

              <div className="section">
                <SectionHeader title={`≡ ${logs.length} events`}>
                  <button className="btn btn-blue" onClick={() => load("/logs", setLogs)}>↻ Refresh now</button>
                </SectionHeader>
                <div className="logs-list" style={{ maxHeight: "calc(100vh - 260px)" }}>
                  {logs.map((log) => (
                    <div key={log.id} className="log-item">
                      <span className="log-time">{fmtDate(log.created_at)}</span>
                      <span className="log-details">
                        {log.details}
                        {log.admin_name && <> — <span className="log-admin">{log.admin_name}</span></>}
                      </span>
                    </div>
                  ))}
                  {!logs.length && <div className="empty">No activity logged yet</div>}
                </div>
              </div>
            </>
          )}

        </main>
      </div>
    </>
  );
}
