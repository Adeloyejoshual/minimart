// ─────────────────────────────────────────────────────────────────────────────
// AdminDashboard.jsx  — Professional single-file structure
// Layers: CSS → API → Helpers → Hooks (data / derived / actions) → Components → App
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
// 1. CSS
// ─────────────────────────────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0b0e17;--surface:#131824;--panel:#1a2030;--border:#252d40;
  --accent:#4f8cff;--green:#22d3a5;--amber:#f59e42;--red:#f43f5e;
  --text:#e8edf7;--muted:#6b7a99;
  --font:'Syne',sans-serif;--mono:'DM Mono',monospace;
}
body{background:var(--bg);color:var(--text);font-family:var(--font)}

/* Layout */
.dash{display:flex;min-height:100vh}
.main{flex:1;padding:32px 36px;overflow-x:hidden;max-width:100%}

/* Sidebar */
.sidebar{width:220px;min-height:100vh;background:var(--surface);border-right:1px solid var(--border);padding:28px 16px;display:flex;flex-direction:column;gap:4px;flex-shrink:0}
.logo{font-size:1.3rem;font-weight:800;color:var(--accent);letter-spacing:-.03em;padding:0 8px 24px}
.nav-btn{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;cursor:pointer;color:var(--muted);font-size:.875rem;font-weight:600;transition:background .15s,color .15s;border:none;background:none;width:100%;text-align:left;font-family:var(--font)}
.nav-btn:hover{background:var(--panel);color:var(--text)}
.nav-btn.active{background:rgba(79,140,255,.12);color:var(--accent)}
.nav-icon{font-size:.95rem;width:20px;text-align:center}

/* Page header */
.page-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;gap:12px;flex-wrap:wrap}
.page-title{font-size:1.55rem;font-weight:800;letter-spacing:-.03em}
.page-sub{color:var(--muted);font-weight:400;font-size:1rem}

/* Badges */
.badge{font-size:.7rem;font-weight:600;padding:3px 9px;border-radius:20px;background:rgba(79,140,255,.12);color:var(--accent);font-family:var(--mono)}
.live-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--green);margin-right:5px;animation:pulse 1.6s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.4)}}

/* Stat grid */
.stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px;margin-bottom:26px}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 20px;transition:border-color .2s,transform .2s;cursor:default}
.stat-card:hover{border-color:var(--accent);transform:translateY(-2px)}
.stat-label{font-size:.68rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.09em;margin-bottom:8px}
.stat-val{font-size:1.9rem;font-weight:800;letter-spacing:-.04em;line-height:1}
.c-blue{color:var(--accent)}.c-green{color:var(--green)}.c-amber{color:var(--amber)}.c-red{color:var(--red)}

/* Section card */
.section{background:var(--surface);border:1px solid var(--border);border-radius:14px;margin-bottom:22px;overflow:hidden}
.sec-hd{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--border);gap:10px;flex-wrap:wrap}
.sec-title{font-size:.92rem;font-weight:700}
.sec-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}

/* Chart */
.chart-wrap{padding:16px 20px 22px}

/* Tabs */
.tabs{display:flex;gap:4px;padding:12px 16px 0;border-bottom:1px solid var(--border)}
.tab-btn{padding:7px 14px;border-radius:8px 8px 0 0;font-size:.78rem;font-weight:700;cursor:pointer;border:none;background:none;color:var(--muted);transition:color .15s,background .15s;font-family:var(--font)}
.tab-btn.active{background:var(--panel);color:var(--text)}

/* Table */
.tbl-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:.8rem}
th{padding:10px 16px;text-align:left;font-size:.67rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;white-space:nowrap;border-bottom:1px solid var(--border)}
td{padding:11px 16px;border-bottom:1px solid rgba(37,45,64,.55);vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(79,140,255,.04)}

/* Pills */
.pill{display:inline-block;padding:2px 9px;border-radius:20px;font-size:.65rem;font-weight:700;font-family:var(--mono);text-transform:uppercase;letter-spacing:.05em}
.p-active{background:rgba(34,211,165,.13);color:var(--green)}
.p-draft{background:rgba(107,122,153,.13);color:var(--muted)}
.p-pending{background:rgba(245,158,66,.13);color:var(--amber)}
.p-banned{background:rgba(244,63,94,.13);color:var(--red)}
.p-promoted{background:rgba(79,140,255,.13);color:var(--accent)}

/* Buttons */
.btn{padding:5px 11px;border-radius:7px;font-size:.73rem;font-weight:700;cursor:pointer;border:1px solid transparent;transition:opacity .15s,transform .1s;font-family:var(--font);white-space:nowrap}
.btn:hover{opacity:.8;transform:translateY(-1px)}
.btn:active{transform:translateY(0)}
.btn:disabled{opacity:.4;cursor:not-allowed;transform:none}
.btn-blue{background:rgba(79,140,255,.12);color:var(--accent);border-color:rgba(79,140,255,.25)}
.btn-green{background:rgba(34,211,165,.12);color:var(--green);border-color:rgba(34,211,165,.25)}
.btn-red{background:rgba(244,63,94,.12);color:var(--red);border-color:rgba(244,63,94,.25)}

/* Input */
.search{background:var(--panel);border:1px solid var(--border);color:var(--text);padding:7px 13px;border-radius:8px;font-size:.8rem;font-family:var(--font);outline:none;transition:border-color .15s;width:220px}
.search:focus{border-color:var(--accent)}

/* Logs */
.log-list{max-height:360px;overflow-y:auto}
.log-item{display:flex;align-items:flex-start;gap:12px;padding:10px 20px;border-bottom:1px solid rgba(37,45,64,.5)}
.log-item:last-child{border-bottom:none}
.log-time{color:var(--muted);font-family:var(--mono);font-size:.7rem;white-space:nowrap;flex-shrink:0;padding-top:2px}
.log-body{flex:1;font-size:.78rem;line-height:1.55}
.log-admin{color:var(--accent);font-weight:600}

/* States */
.empty{padding:36px 20px;text-align:center;color:var(--muted);font-size:.85rem}
.loading{display:flex;align-items:center;justify-content:center;height:100vh;color:var(--muted);font-size:.95rem;gap:10px}

/* Thumb */
.thumb{width:30px;height:30px;border-radius:6px;object-fit:cover;flex-shrink:0}

/* Scrollbar */
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:var(--surface)}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px}
`;

// ─────────────────────────────────────────────────────────────────────────────
// 2. API LAYER
// ─────────────────────────────────────────────────────────────────────────────
const BASE = "https://minimart-ivrm.onrender.com/api/admin";

const createApi = (token) => {
  const headers = { Authorization: `Bearer ${token}` };
  return {
    get:  (path)          => axios.get (BASE + path,       { headers }),
    post: (path, body={}) => axios.post(BASE + path, body, { headers }),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. PURE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmt         = (n) => Number(n ?? 0).toLocaleString();
const fmtCurrency = (n) => `₦${Number(n ?? 0).toLocaleString()}`;
const fmtDate     = (d) =>
  d ? new Date(d).toLocaleString("en-NG", { dateStyle: "short", timeStyle: "short" }) : "—";

const PILL_MAP = { active: "p-active", draft: "p-draft", pending: "p-pending", banned: "p-banned" };
const Pill = ({ s }) => <span className={`pill ${PILL_MAP[s] || "p-draft"}`}>{s || "—"}</span>;

const TOOLTIP_STYLE = {
  background: "#131824", border: "1px solid #252d40", borderRadius: 8, color: "#e8edf7",
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. DATA HOOK  — single source of truth for all server state
// ─────────────────────────────────────────────────────────────────────────────
const useAdminData = (api) => {
  const [stats,       setStats]       = useState({ users: 0, orders: 0, revenue: 0, dailySales: [], activeUsers: 0, bannedUsers: 0, pendingProducts: 0, totalProducts: 0 });
  const [users,       setUsers]       = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [pending,     setPending]     = useState([]);
  const [logs,        setLogs]        = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading,     setLoading]     = useState(true);

  const safeGet = useCallback(async (path, setter) => {
    try { const { data } = await api.get(path); setter(data); }
    catch (e) { console.warn(`[admin] GET ${path}:`, e.message); }
  }, [api]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      safeGet("/stats",            setStats),
      safeGet("/users",            setUsers),
      safeGet("/products",         setAllProducts),
      safeGet("/products/pending", setPending),
      safeGet("/logs",             setLogs),
      safeGet("/me",               (d) => setPermissions(d.permissions || [])),
    ]);
    setLoading(false);
  }, [safeGet]);

  const reloadUsers    = useCallback(() => safeGet("/users",            setUsers),       [safeGet]);
  const reloadLogs     = useCallback(() => safeGet("/logs",             setLogs),        [safeGet]);
  const reloadProducts = useCallback(() => Promise.all([
    safeGet("/products",         setAllProducts),
    safeGet("/products/pending", setPending),
    safeGet("/stats",            setStats),
  ]), [safeGet]);

  return {
    stats, users, allProducts, pending, logs, permissions, loading,
    loadAll, reloadUsers, reloadLogs, reloadProducts,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. DERIVED DATA HOOK  — memoized, zero inline filtering in JSX
// ─────────────────────────────────────────────────────────────────────────────
const useDerived = ({ users, allProducts, pending, stats, productTab, userSearch, productSearch }) => {
  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase();
    return users.filter((u) => `${u.name ?? ""} ${u.email ?? ""}`.toLowerCase().includes(q));
  }, [users, userSearch]);

  const displayedProducts = useMemo(() => {
    const base = productTab === "pending" ? pending : allProducts;
    const q    = productSearch.toLowerCase();
    return base.filter((p) =>
      (p.name ?? p.title ?? "").toLowerCase().includes(q) ||
      (p.seller_name ?? "").toLowerCase().includes(q)
    );
  }, [allProducts, pending, productTab, productSearch]);

  const productStatusData = useMemo(() => [
    { status: "Active",  count: allProducts.filter((p) => p.status === "active").length },
    { status: "Draft",   count: allProducts.filter((p) => p.status === "draft").length },
    { status: "Pending", count: allProducts.filter((p) => p.status === "pending").length },
  ], [allProducts]);

  const salesData = useMemo(() =>
    (stats.dailySales ?? []).map((d) => ({ date: d.date?.slice(5), sales: Number(d.amount) })),
    [stats.dailySales]);

  const userStats = useMemo(() => ({
    total:  users.length,
    active: users.filter((u) => u.status !== "banned").length,
    banned: users.filter((u) => u.status === "banned").length,
  }), [users]);

  return { filteredUsers, displayedProducts, productStatusData, salesData, userStats };
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. ACTIONS HOOK  — all mutations in one place
// ─────────────────────────────────────────────────────────────────────────────
const useActions = (api, { reloadUsers, reloadProducts }) => {
  const [busy, setBusy] = useState(null);

  const run = useCallback(async (key, fn) => {
    setBusy(key);
    try   { await fn(); }
    catch (e) { console.error("[action]", key, e.message); }
    finally   { setBusy(null); }
  }, []);

  return {
    busy,
    banUser:        (id) => run(`ban-${id}`,     async () => { await api.post(`/users/${id}/ban`);        reloadUsers(); }),
    approveProduct: (id) => run(`approve-${id}`, async () => { await api.post(`/products/${id}/approve`); reloadProducts(); }),
    rejectProduct:  (id) => run(`reject-${id}`,  async () => { await api.post(`/products/${id}/reject`);  reloadProducts(); }),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. REUSABLE UI ATOMS
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color = "c-blue" }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{icon} {label}</div>
      <div className={`stat-val ${color}`}>{value}</div>
    </div>
  );
}

function SectionCard({ title, actions, tabs, children }) {
  return (
    <div className="section">
      {tabs}
      {(title || actions) && (
        <div className="sec-hd">
          {title  && <span className="sec-title">{title}</span>}
          {actions && <div className="sec-actions">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

function LogItem({ log }) {
  return (
    <div className="log-item">
      <span className="log-time">{fmtDate(log.created_at)}</span>
      <span className="log-body">
        {log.details}
        {log.admin_name && <> — <span className="log-admin">{log.admin_name}</span></>}
      </span>
    </div>
  );
}

const RefreshBtn = ({ onClick }) => (
  <button className="btn btn-blue" onClick={onClick}>↻ Refresh</button>
);

// ─────────────────────────────────────────────────────────────────────────────
// 8. PAGE RENDERERS  — receive only what they need, no shared state touching
// ─────────────────────────────────────────────────────────────────────────────

// ── Sidebar ───────────────────────────────────────────────────────────────────
const NAV = [
  { id: "overview",  icon: "◈", label: "Overview"  },
  { id: "users",     icon: "◉", label: "Users",    perm: "user_support"       },
  { id: "products",  icon: "▦", label: "Products", perm: "content_moderation" },
  { id: "logs",      icon: "≡", label: "Activity", perm: "manage_site"        },
];

function Sidebar({ page, setPage, can }) {
  return (
    <aside className="sidebar">
      <div className="logo">⚡ MiniMart</div>
      {NAV.map(({ id, icon, label, perm }) => {
        if (perm && !can(perm)) return null;
        return (
          <button key={id} className={`nav-btn ${page === id ? "active" : ""}`} onClick={() => setPage(id)}>
            <span className="nav-icon">{icon}</span> {label}
          </button>
        );
      })}
    </aside>
  );
}

// ── Overview page ─────────────────────────────────────────────────────────────
function PageOverview({ stats, userStats, salesData, productStatusData, logs, allProducts, pending, can, goLogs }) {
  return (
    <>
      <div className="page-hd">
        <h1 className="page-title">Overview</h1>
        <span className="badge">{new Date().toLocaleDateString("en-NG", { dateStyle: "long" })}</span>
      </div>

      <div className="stats-grid">
        <StatCard icon="👥" label="Total Users"    value={fmt(userStats.total)}                               color="c-blue"  />
        <StatCard icon="✅" label="Active Users"   value={fmt(userStats.active)}                              color="c-green" />
        <StatCard icon="🚫" label="Banned Users"   value={fmt(userStats.banned)}                              color="c-red"   />
        <StatCard icon="📦" label="All Products"   value={fmt(stats.totalProducts || allProducts.length)}     color="c-blue"  />
        <StatCard icon="⏳" label="Pending Review" value={fmt(stats.pendingProducts || pending.length)}       color="c-amber" />
        <StatCard icon="🛒" label="Total Orders"   value={fmt(stats.orders)}                                  color="c-green" />
        <StatCard icon="₦"  label="Revenue"        value={fmtCurrency(stats.revenue)}                        color="c-green" />
      </div>

      {can("analytics") && salesData.length > 0 && (
        <SectionCard title="📈 Daily Sales">
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252d40" />
                <XAxis dataKey="date" tick={{ fill: "#6b7a99", fontSize: 11 }} />
                <YAxis tick={{ fill: "#6b7a99", fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [fmtCurrency(v), "Sales"]} />
                <Line type="monotone" dataKey="sales" stroke="#4f8cff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      )}

      {can("content_moderation") && (
        <SectionCard title="▦ Product Status Breakdown">
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={175}>
              <BarChart data={productStatusData} barSize={44}>
                <CartesianGrid strokeDasharray="3 3" stroke="#252d40" />
                <XAxis dataKey="status" tick={{ fill: "#6b7a99", fontSize: 11 }} />
                <YAxis tick={{ fill: "#6b7a99", fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="#22d3a5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      )}

      {can("manage_site") && (
        <SectionCard
          title="≡ Recent Activity"
          actions={[
            <span key="live" className="badge"><span className="live-dot" />LIVE</span>,
            <button key="all" className="btn btn-blue" onClick={goLogs}>See all →</button>,
          ]}
        >
          <div className="log-list">
            {logs.slice(0, 6).map((l) => <LogItem key={l.id} log={l} />)}
            {!logs.length && <div className="empty">No activity yet</div>}
          </div>
        </SectionCard>
      )}
    </>
  );
}

// ── Users page ────────────────────────────────────────────────────────────────
function PageUsers({ filteredUsers, userSearch, setUserSearch, banUser, busy, reloadUsers }) {
  return (
    <>
      <div className="page-hd">
        <h1 className="page-title">
          Users <span className="page-sub">({fmt(filteredUsers.length)})</span>
        </h1>
        <input
          className="search"
          placeholder="Search name or email…"
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
        />
      </div>

      <SectionCard
        title="👥 All Users"
        actions={[<RefreshBtn key="r" onClick={reloadUsers} />]}
      >
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Phone</th><th>City</th>
                <th>Status</th><th>Joined</th><th>Last Login</th><th>Balance</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: ".72rem" }}>{u.email}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: ".72rem" }}>{u.phone_number || "—"}</td>
                  <td>{u.city || "—"}</td>
                  <td><Pill s={u.status || "active"} /></td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: ".7rem" }}>{fmtDate(u.created_at)}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: ".7rem" }}>{fmtDate(u.last_login)}</td>
                  <td style={{ color: "var(--green)", fontFamily: "var(--mono)" }}>{fmtCurrency(u.balance)}</td>
                  <td>
                    {u.status === "banned"
                      ? <span style={{ color: "var(--muted)", fontSize: ".7rem" }}>Banned</span>
                      : <button className="btn btn-red" disabled={busy === `ban-${u.id}`} onClick={() => banUser(u.id)}>
                          {busy === `ban-${u.id}` ? "…" : "Ban"}
                        </button>
                    }
                  </td>
                </tr>
              ))}
              {!filteredUsers.length && (
                <tr><td colSpan={9} className="empty">No users match your search</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}

// ── Products page ─────────────────────────────────────────────────────────────
function PageProducts({ displayedProducts, allProducts, pending, productTab, setProductTab, productSearch, setProductSearch, approveProduct, rejectProduct, busy, reloadProducts }) {
  const tabs = (
    <div className="tabs">
      {[
        { id: "all",     label: `All (${allProducts.length})` },
        { id: "pending", label: `Pending (${pending.length})` },
      ].map(({ id, label }) => (
        <button key={id} className={`tab-btn ${productTab === id ? "active" : ""}`} onClick={() => setProductTab(id)}>
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className="page-hd">
        <h1 className="page-title">Products</h1>
        <input
          className="search"
          placeholder="Search product or seller…"
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
        />
      </div>

      <SectionCard
        tabs={tabs}
        title={`▦ ${displayedProducts.length} results`}
        actions={[<RefreshBtn key="r" onClick={reloadProducts} />]}
      >
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th><th>Seller</th><th>Price</th><th>Category</th>
                <th>Location</th><th>Status</th><th>Promoted</th><th>Created</th>
                {productTab === "pending" && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {displayedProducts.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600, maxWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {p.thumbnail_url && <img className="thumb" src={p.thumbnail_url} alt="" />}
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.name || p.title}
                      </span>
                    </div>
                  </td>
                  <td style={{ color: "var(--accent)", fontSize: ".78rem" }}>{p.seller_name || "—"}</td>
                  <td style={{ fontFamily: "var(--mono)", color: "var(--green)" }}>{fmtCurrency(p.price)}</td>
                  <td style={{ fontSize: ".75rem", color: "var(--muted)" }}>{p.category_name || "—"}</td>
                  <td style={{ fontSize: ".75rem" }}>{[p.location_city, p.location_state].filter(Boolean).join(", ") || "—"}</td>
                  <td><Pill s={p.status} /></td>
                  <td>
                    {p.is_promoted
                      ? <span className="pill p-promoted">Boosted</span>
                      : <span style={{ color: "var(--muted)", fontSize: ".68rem" }}>—</span>
                    }
                  </td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: ".7rem" }}>{fmtDate(p.created_at)}</td>
                  {productTab === "pending" && (
                    <td>
                      <div style={{ display: "flex", gap: 5 }}>
                        <button className="btn btn-green" disabled={busy === `approve-${p.id}`} onClick={() => approveProduct(p.id)}>
                          {busy === `approve-${p.id}` ? "…" : "✓ Approve"}
                        </button>
                        <button className="btn btn-red" disabled={busy === `reject-${p.id}`} onClick={() => rejectProduct(p.id)}>
                          {busy === `reject-${p.id}` ? "…" : "✕ Reject"}
                        </button>
                      </div>
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
      </SectionCard>
    </>
  );
}

// ── Logs page ─────────────────────────────────────────────────────────────────
function PageLogs({ logs, reloadLogs }) {
  return (
    <>
      <div className="page-hd">
        <h1 className="page-title">Activity Logs</h1>
        <span className="badge"><span className="live-dot" />Auto-refresh 5 s</span>
      </div>
      <SectionCard
        title={`≡ ${logs.length} events`}
        actions={[<RefreshBtn key="r" onClick={reloadLogs} />]}
      >
        <div className="log-list" style={{ maxHeight: "calc(100vh - 240px)" }}>
          {logs.map((l) => <LogItem key={l.id} log={l} />)}
          {!logs.length && <div className="empty">No activity logged yet</div>}
        </div>
      </SectionCard>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. MAIN COMPONENT  — thin orchestration only, no logic here
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const token = useMemo(() => localStorage.getItem("admin_token"), []);
  const api   = useMemo(() => createApi(token), [token]);

  // UI state
  const [page,          setPage]          = useState("overview");
  const [productTab,    setProductTab]    = useState("all");
  const [userSearch,    setUserSearch]    = useState("");
  const [productSearch, setProductSearch] = useState("");

  // Server state (single hook)
  const {
    stats, users, allProducts, pending, logs, permissions, loading,
    loadAll, reloadUsers, reloadLogs, reloadProducts,
  } = useAdminData(api);

  // Derived state (memoized — no filtering in JSX)
  const { filteredUsers, displayedProducts, productStatusData, salesData, userStats } =
    useDerived({ users, allProducts, pending, stats, productTab, userSearch, productSearch });

  // All mutations in one place
  const { busy, banUser, approveProduct, rejectProduct } =
    useActions(api, { reloadUsers, reloadProducts });

  // Permission helper (stable reference)
  const can = useCallback((p) => permissions.includes(p), [permissions]);

  // Bootstrap + live log interval (controlled cleanup)
  useEffect(() => {
    loadAll();
    const iv = setInterval(reloadLogs, 5000);
    return () => clearInterval(iv);
  }, [loadAll, reloadLogs]);

  if (loading) return (
    <>
      <style>{css}</style>
      <div className="loading"><span className="live-dot" /> Loading admin panel…</div>
    </>
  );

  return (
    <>
      <style>{css}</style>
      <div className="dash">

        <Sidebar page={page} setPage={setPage} can={can} />

        <main className="main">
          {page === "overview" && (
            <PageOverview
              stats={stats} userStats={userStats} salesData={salesData}
              productStatusData={productStatusData} logs={logs}
              allProducts={allProducts} pending={pending}
              can={can} goLogs={() => setPage("logs")}
            />
          )}

          {page === "users" && can("user_support") && (
            <PageUsers
              filteredUsers={filteredUsers}
              userSearch={userSearch} setUserSearch={setUserSearch}
              banUser={banUser} busy={busy} reloadUsers={reloadUsers}
            />
          )}

          {page === "products" && can("content_moderation") && (
            <PageProducts
              displayedProducts={displayedProducts}
              allProducts={allProducts} pending={pending}
              productTab={productTab} setProductTab={setProductTab}
              productSearch={productSearch} setProductSearch={setProductSearch}
              approveProduct={approveProduct} rejectProduct={rejectProduct}
              busy={busy} reloadProducts={reloadProducts}
            />
          )}

          {page === "logs" && can("manage_site") && (
            <PageLogs logs={logs} reloadLogs={reloadLogs} />
          )}
        </main>
      </div>
    </>
  );
}
