// ─────────────────────────────────────────────────────────────────────────────
// SuperAdmin.jsx  —  Full control surface
// Layers: CSS → API → Helpers → Hooks → Atoms → Pages → App
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ─────────────────────────────────────────────────────────────────────────────
// 1. CSS
// ─────────────────────────────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:ital,wght@0,400;0,500;1,400&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:       #080b14;
  --surface:  #0f1320;
  --panel:    #161c2e;
  --raised:   #1d2540;
  --border:   #222c44;
  --accent:   #4f8cff;
  --accent-d: #2563cc;
  --green:    #1dd6a0;
  --amber:    #f59e42;
  --red:      #f43f5e;
  --purple:   #a78bfa;
  --text:     #dde4f5;
  --muted:    #5e6e94;
  --font:     'Syne', sans-serif;
  --mono:     'DM Mono', monospace;
  --radius:   10px;
  --shadow:   0 4px 24px rgba(0,0,0,.45);
}

body { background: var(--bg); color: var(--text); font-family: var(--font); -webkit-font-smoothing: antialiased; }

/* ── Layout ── */
.wrap   { display: flex; min-height: 100vh; }
.main   { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.body   { flex: 1; padding: 28px 32px; overflow-y: auto; }

/* ── Sidebar ── */
.sidebar {
  width: 230px; flex-shrink: 0; background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
  padding: 0 0 20px;
}
.sb-logo {
  padding: 26px 20px 22px;
  font-size: 1.15rem; font-weight: 800; letter-spacing: -.02em;
  color: var(--accent); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 8px;
}
.sb-logo span { color: var(--text); }
.sb-section { padding: 18px 12px 6px; font-size: .62rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .1em; }
.nav-btn {
  display: flex; align-items: center; gap: 10px; padding: 9px 14px;
  margin: 1px 8px; border-radius: 8px; cursor: pointer;
  color: var(--muted); font-size: .82rem; font-weight: 600;
  transition: background .14s, color .14s; border: none; background: none;
  width: calc(100% - 16px); text-align: left; font-family: var(--font);
}
.nav-btn:hover  { background: var(--panel); color: var(--text); }
.nav-btn.active { background: rgba(79,140,255,.13); color: var(--accent); }
.nav-icon { width: 18px; text-align: center; font-size: .9rem; flex-shrink: 0; }
.nav-badge {
  margin-left: auto; font-size: .6rem; font-family: var(--mono);
  background: var(--red); color: #fff; padding: 1px 6px;
  border-radius: 20px; font-weight: 700;
}
.sb-footer {
  margin-top: auto; padding: 14px 16px 0; border-top: 1px solid var(--border);
  font-size: .72rem; color: var(--muted); font-family: var(--mono);
}

/* ── Topbar ── */
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 32px; background: var(--surface);
  border-bottom: 1px solid var(--border); flex-shrink: 0; gap: 12px;
}
.topbar-title { font-size: 1rem; font-weight: 700; letter-spacing: -.01em; }
.topbar-right  { display: flex; align-items: center; gap: 10px; }
.notif-btn {
  position: relative; width: 34px; height: 34px; border-radius: 8px;
  background: var(--panel); border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: .9rem; transition: background .14s;
}
.notif-btn:hover { background: var(--raised); }
.notif-dot {
  position: absolute; top: 6px; right: 6px;
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--red); border: 1.5px solid var(--surface);
}
.avatar {
  width: 34px; height: 34px; border-radius: 8px;
  background: linear-gradient(135deg, var(--accent-d), var(--accent));
  display: flex; align-items: center; justify-content: center;
  font-size: .78rem; font-weight: 800; color: #fff; cursor: pointer;
  flex-shrink: 0;
}
.live-chip {
  display: flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 20px;
  background: rgba(29,214,160,.1); color: var(--green);
  font-size: .68rem; font-weight: 700; font-family: var(--mono);
}
.live-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--green);
  animation: pulse 1.6s ease-in-out infinite;
}
@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(1.5)} }

/* ── Page header ── */
.ph { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 12px; flex-wrap: wrap; }
.ph-left h1 { font-size: 1.5rem; font-weight: 800; letter-spacing: -.03em; line-height: 1.1; }
.ph-sub  { font-size: .8rem; color: var(--muted); margin-top: 3px; }
.ph-right { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

/* ── Stats grid ── */
.sg { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 13px; margin-bottom: 24px; }
.sc {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 17px 18px;
  transition: border-color .18s, transform .18s; cursor: default;
}
.sc:hover { border-color: var(--accent); transform: translateY(-2px); }
.sc-label { font-size: .65rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .09em; margin-bottom: 7px; }
.sc-val   { font-size: 1.8rem; font-weight: 800; letter-spacing: -.04em; line-height: 1; }
.sc-delta { font-size: .7rem; color: var(--muted); margin-top: 4px; font-family: var(--mono); }
.c-blue   { color: var(--accent); }
.c-green  { color: var(--green); }
.c-amber  { color: var(--amber); }
.c-red    { color: var(--red); }
.c-purple { color: var(--purple); }

/* ── Section card ── */
.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 13px; margin-bottom: 20px; overflow: hidden;
}
.card-hd {
  display: flex; align-items: center; justify-content: space-between;
  padding: 13px 18px; border-bottom: 1px solid var(--border);
  gap: 10px; flex-wrap: wrap;
}
.card-title { font-size: .88rem; font-weight: 700; }
.card-acts  { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.chart-wrap { padding: 14px 18px 20px; }

/* ── Tabs ── */
.tabs { display: flex; gap: 3px; padding: 11px 14px 0; border-bottom: 1px solid var(--border); }
.tab  {
  padding: 6px 13px; border-radius: 7px 7px 0 0; font-size: .75rem;
  font-weight: 700; cursor: pointer; border: none; background: none;
  color: var(--muted); transition: color .14s, background .14s; font-family: var(--font);
}
.tab.active { background: var(--panel); color: var(--text); }

/* ── Table ── */
.tw { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: .78rem; }
th {
  padding: 9px 15px; text-align: left; font-size: .63rem; font-weight: 700;
  color: var(--muted); text-transform: uppercase; letter-spacing: .08em;
  white-space: nowrap; border-bottom: 1px solid var(--border);
}
td { padding: 10px 15px; border-bottom: 1px solid rgba(34,44,68,.6); vertical-align: middle; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(79,140,255,.035); }
.mono { font-family: var(--mono); }
.dim  { color: var(--muted); }

/* ── Pills ── */
.pill { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: .62rem; font-weight: 700; font-family: var(--mono); text-transform: uppercase; letter-spacing: .04em; }
.pa { background: rgba(29,214,160,.12); color: var(--green); }
.pd { background: rgba(94,110,148,.12); color: var(--muted); }
.pp { background: rgba(245,158,66,.12); color: var(--amber); }
.pb { background: rgba(244,63,94,.12);  color: var(--red); }
.pc { background: rgba(79,140,255,.12); color: var(--accent); }
.pv { background: rgba(167,139,250,.12);color: var(--purple); }

/* ── Buttons ── */
.btn {
  padding: 5px 12px; border-radius: 7px; font-size: .72rem; font-weight: 700;
  cursor: pointer; border: 1px solid transparent; transition: opacity .14s, transform .1s;
  font-family: var(--font); white-space: nowrap; display: inline-flex;
  align-items: center; gap: 5px;
}
.btn:hover    { opacity: .82; transform: translateY(-1px); }
.btn:active   { transform: translateY(0); }
.btn:disabled { opacity: .35; cursor: not-allowed; transform: none; }
.b-blue  { background: rgba(79,140,255,.12); color: var(--accent);  border-color: rgba(79,140,255,.25); }
.b-green { background: rgba(29,214,160,.12); color: var(--green);   border-color: rgba(29,214,160,.25); }
.b-red   { background: rgba(244,63,94,.12);  color: var(--red);     border-color: rgba(244,63,94,.25); }
.b-amber { background: rgba(245,158,66,.12); color: var(--amber);   border-color: rgba(245,158,66,.25); }
.b-ghost { background: var(--panel);         color: var(--text);    border-color: var(--border); }
.b-solid { background: var(--accent);        color: #fff;           border-color: var(--accent); }

/* ── Input ── */
.input {
  background: var(--panel); border: 1px solid var(--border); color: var(--text);
  padding: 7px 12px; border-radius: 8px; font-size: .78rem;
  font-family: var(--font); outline: none; transition: border-color .14s;
}
.input:focus { border-color: var(--accent); }
.input-sm { width: 200px; }
select.input { cursor: pointer; }

/* ── Toggle switch ── */
.toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; border-bottom: 1px solid rgba(34,44,68,.6);
}
.toggle-row:last-child { border-bottom: none; }
.toggle-info h4 { font-size: .85rem; font-weight: 700; margin-bottom: 2px; }
.toggle-info p  { font-size: .72rem; color: var(--muted); }
.sw {
  width: 44px; height: 24px; border-radius: 12px; border: none; cursor: pointer;
  position: relative; flex-shrink: 0; transition: background .2s;
}
.sw.on  { background: var(--green); }
.sw.off { background: var(--border); }
.sw::after {
  content: ''; position: absolute; top: 3px; width: 18px; height: 18px;
  border-radius: 50%; background: #fff; transition: left .2s;
}
.sw.on::after  { left: 23px; }
.sw.off::after { left: 3px; }

/* ── Log ── */
.log-list { max-height: 340px; overflow-y: auto; }
.log-item { display: flex; align-items: flex-start; gap: 11px; padding: 9px 18px; border-bottom: 1px solid rgba(34,44,68,.5); }
.log-item:last-child { border-bottom: none; }
.log-time { color: var(--muted); font-family: var(--mono); font-size: .67rem; white-space: nowrap; flex-shrink: 0; padding-top: 2px; }
.log-body { flex: 1; font-size: .76rem; line-height: 1.55; }
.log-admin { color: var(--accent); font-weight: 700; }

/* ── Modal ── */
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.7);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999; backdrop-filter: blur(3px);
  animation: fadein .15s ease;
}
@keyframes fadein { from { opacity: 0 } to { opacity: 1 } }
.modal {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 14px; padding: 28px 28px 22px; width: 360px;
  box-shadow: var(--shadow); animation: slideup .18s ease;
}
@keyframes slideup { from { transform: translateY(10px); opacity: 0 } to { transform: none; opacity: 1 } }
.modal-icon { font-size: 2rem; margin-bottom: 10px; }
.modal h3   { font-size: 1rem; font-weight: 800; margin-bottom: 6px; }
.modal p    { font-size: .8rem; color: var(--muted); margin-bottom: 20px; line-height: 1.6; }
.modal-btns { display: flex; gap: 8px; justify-content: flex-end; }

/* ── Register Admin form ── */
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 16px 18px; }
.form-group { display: flex; flex-direction: column; gap: 4px; }
.form-group label { font-size: .65rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .07em; }
.form-group .input { width: 100%; }
.form-full { grid-column: 1 / -1; }

/* ── Empty / loading ── */
.empty   { padding: 36px 18px; text-align: center; color: var(--muted); font-size: .82rem; }
.loading { display: flex; align-items: center; justify-content: center; height: 100vh; color: var(--muted); font-size: .88rem; gap: 8px; }

/* ── Thumb ── */
.thumb { width: 28px; height: 28px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }

/* ── System danger zone ── */
.danger-zone { margin: 16px 18px 18px; padding: 14px 16px; border-radius: 9px; background: rgba(244,63,94,.06); border: 1px solid rgba(244,63,94,.2); }
.danger-zone h4 { font-size: .78rem; font-weight: 800; color: var(--red); margin-bottom: 8px; text-transform: uppercase; letter-spacing: .06em; }
.danger-zone p  { font-size: .73rem; color: var(--muted); margin-bottom: 12px; line-height: 1.6; }

/* ── Scrollbar ── */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: var(--surface); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// 2. API LAYER
// ─────────────────────────────────────────────────────────────────────────────
const BASE = "https://minimart-ivrm.onrender.com/api/admin";

const createApi = (token) => {
  const h = { Authorization: `Bearer ${token}` };
  return {
    get:  (p)      => axios.get (BASE + p,      { headers: h }),
    post: (p, b={}) => axios.post(BASE + p, b,  { headers: h }),
    del:  (p)      => axios.delete(BASE + p,    { headers: h }),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. PURE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmt         = (n)  => Number(n ?? 0).toLocaleString();
const fmtN        = (n)  => `₦${Number(n ?? 0).toLocaleString()}`;
const fmtDate     = (d)  => d ? new Date(d).toLocaleString("en-NG", { dateStyle: "short", timeStyle: "short" }) : "—";
const initials    = (s="") => s.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);

const PILL = {
  active:    "pill pa", draft:     "pill pd", pending: "pill pp",
  banned:    "pill pb", completed: "pill pa", failed:  "pill pb",
  refunded:  "pill pv", cancelled: "pill pb", paid:    "pill pa",
  super_admin:"pill pc",moderator: "pill pv", support: "pill pd",
};
const Pill = ({ s }) => <span className={PILL[s] || "pill pd"}>{s || "—"}</span>;

const TT = { background:"#0f1320", border:"1px solid #222c44", borderRadius:8, color:"#dde4f5" };

// ─────────────────────────────────────────────────────────────────────────────
// 4. DATA HOOK
// ─────────────────────────────────────────────────────────────────────────────
const useData = (api) => {
  const [stats,    setStats]    = useState({ users:0, orders:0, revenue:0, dailySales:[], activeUsers:0, bannedUsers:0, pendingProducts:0, totalProducts:0 });
  const [users,    setUsers]    = useState([]);
  const [admins,   setAdmins]   = useState([]);
  const [products, setProducts] = useState([]);
  const [pending,  setPending]  = useState([]);
  const [payments, setPayments] = useState([]);
  const [orders,   setOrders]   = useState([]);
  const [logs,     setLogs]     = useState([]);
  const [system,   setSystem]   = useState({ maintenance:false, allowPosting:true, allowPayments:true });
  const [loading,  setLoading]  = useState(true);

  const safe = useCallback(async (path, setter) => {
    try { const { data } = await api.get(path); setter(data); }
    catch (e) { console.warn("[sa]", path, e.message); }
  }, [api]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      safe("/stats",            setStats),
      safe("/users",            setUsers),
      safe("/admins",           setAdmins),
      safe("/products",         setProducts),
      safe("/products/pending", setPending),
      safe("/payments",         setPayments),
      safe("/orders",           setOrders),
      safe("/logs",             setLogs),
      safe("/system",           setSystem),
    ]);
    setLoading(false);
  }, [safe]);

  const reload = {
    users:    useCallback(() => safe("/users",            setUsers),    [safe]),
    admins:   useCallback(() => safe("/admins",           setAdmins),   [safe]),
    products: useCallback(() => Promise.all([safe("/products", setProducts), safe("/products/pending", setPending), safe("/stats", setStats)]), [safe]),
    payments: useCallback(() => safe("/payments",         setPayments), [safe]),
    orders:   useCallback(() => safe("/orders",           setOrders),   [safe]),
    logs:     useCallback(() => safe("/logs",             setLogs),     [safe]),
    system:   useCallback((d) => setSystem(d),                         []),
  };

  return { stats, users, admins, products, pending, payments, orders, logs, system, loading, loadAll, reload };
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. DERIVED HOOK
// ─────────────────────────────────────────────────────────────────────────────
const useDerived = ({ users, products, pending, orders, payments, stats, productTab, userQ, productQ, orderQ, payQ }) => {
  const salesData = useMemo(() =>
    (stats.dailySales ?? []).map(d => ({ date: d.date?.slice(5), sales: Number(d.amount) })), [stats.dailySales]);

  const userStats = useMemo(() => ({
    total:  users.length,
    active: users.filter(u => u.status !== "banned").length,
    banned: users.filter(u => u.status === "banned").length,
  }), [users]);

  const prodStatusData = useMemo(() => [
    { status:"Active",  count: products.filter(p => p.status==="active").length },
    { status:"Draft",   count: products.filter(p => p.status==="draft").length  },
    { status:"Pending", count: products.filter(p => p.status==="pending").length},
  ], [products]);

  const filteredUsers    = useMemo(() => { const q=userQ.toLowerCase();    return users.filter(u    => `${u.name??""} ${u.email??""}`.toLowerCase().includes(q)); }, [users, userQ]);
  const displayedProds   = useMemo(() => { const q=productQ.toLowerCase(); const base=productTab==="pending"?pending:products; return base.filter(p => (p.name??p.title??"").toLowerCase().includes(q)||(p.seller_name??"").toLowerCase().includes(q)); }, [products, pending, productTab, productQ]);
  const filteredOrders   = useMemo(() => { const q=orderQ.toLowerCase();   return orders.filter(o   => `${o.id??""} ${o.buyer_name??""} ${o.status??""}`.toLowerCase().includes(q)); }, [orders, orderQ]);
  const filteredPayments = useMemo(() => { const q=payQ.toLowerCase();     return payments.filter(p => `${p.user??""} ${p.reference??""} ${p.status??""}`.toLowerCase().includes(q)); }, [payments, payQ]);

  return { salesData, userStats, prodStatusData, filteredUsers, displayedProds, filteredOrders, filteredPayments };
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. ACTIONS HOOK
// ─────────────────────────────────────────────────────────────────────────────
const useActions = (api, reload) => {
  const [busy, setBusy] = useState(null);

  const run = useCallback(async (key, fn) => {
    setBusy(key); try { await fn(); } catch(e) { console.error(key, e.message); } finally { setBusy(null); }
  }, []);

  return {
    busy,
    banUser:        (id) => run(`bu-${id}`,  async () => { await api.post(`/users/${id}/ban`);          reload.users(); }),
    banAdmin:       (id) => run(`ba-${id}`,  async () => { await api.post(`/admins/${id}/ban`);         reload.admins(); }),
    approveProduct: (id) => run(`ap-${id}`,  async () => { await api.post(`/products/${id}/approve`);   reload.products(); }),
    rejectProduct:  (id) => run(`rp-${id}`,  async () => { await api.post(`/products/${id}/reject`);    reload.products(); }),
    refundPayment:  (id) => run(`rf-${id}`,  async () => { await api.post(`/payments/${id}/refund`);    reload.payments(); }),
    cancelOrder:    (id) => run(`co-${id}`,  async () => { await api.post(`/orders/${id}/cancel`);      reload.orders(); }),
    toggleSystem:   async (key, system) => {
      const next = { ...system, [key]: !system[key] };
      reload.system(next);
      try { await api.post("/system", next); } catch { reload.system(system); }
    },
    registerAdmin: async (form) => { await api.post("/register", form); reload.admins(); },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. CONFIRM MODAL
// ─────────────────────────────────────────────────────────────────────────────
function Confirm({ cfg, onClose }) {
  if (!cfg) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-icon">{cfg.icon || "⚠️"}</div>
        <h3>{cfg.title}</h3>
        <p>{cfg.body}</p>
        <div className="modal-btns">
          <button className="btn b-ghost" onClick={onClose}>Cancel</button>
          <button className={`btn ${cfg.danger ? "b-red" : "b-solid"}`} onClick={() => { cfg.action(); onClose(); }}>
            {cfg.confirm || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. UI ATOMS
// ─────────────────────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, color="c-blue", delta }) => (
  <div className="sc">
    <div className="sc-label">{icon}  {label}</div>
    <div className={`sc-val ${color}`}>{value}</div>
    {delta && <div className="sc-delta">{delta}</div>}
  </div>
);

const Card = ({ title, actions, tabs, children }) => (
  <div className="card">
    {tabs}
    {(title || actions) && (
      <div className="card-hd">
        {title   && <span className="card-title">{title}</span>}
        {actions && <div className="card-acts">{actions}</div>}
      </div>
    )}
    {children}
  </div>
);

const LogItem = ({ log }) => (
  <div className="log-item">
    <span className="log-time">{fmtDate(log.created_at)}</span>
    <span className="log-body">
      {log.details}
      {log.admin_name && <> — <span className="log-admin">{log.admin_name}</span></>}
    </span>
  </div>
);

const Rfr  = ({ onClick }) => <button className="btn b-ghost" onClick={onClick}>↻ Refresh</button>;
const Srch = ({ value, onChange, placeholder }) => (
  <input className="input input-sm" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || "Search…"} />
);

// ─────────────────────────────────────────────────────────────────────────────
// 9. PAGE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// ── Sidebar ───────────────────────────────────────────────────────────────────
const NAV = [
  { g: "Dashboard" },
  { id:"overview",  icon:"◈", label:"Overview"    },
  { id:"logs",      icon:"≡", label:"Activity"    },
  { g: "Management" },
  { id:"users",     icon:"◉", label:"Users"       },
  { id:"products",  icon:"▦", label:"Products"    },
  { id:"admins",    icon:"⬡", label:"Admins"      },
  { g: "Operations" },
  { id:"payments",  icon:"₦", label:"Payments"    },
  { id:"orders",    icon:"◫", label:"Orders"      },
  { g: "Config" },
  { id:"system",    icon:"⌬", label:"System"      },
];

function Sidebar({ page, setPage, pendingCount }) {
  return (
    <aside className="sidebar">
      <div className="sb-logo">⚡ <span>MiniMart</span></div>
      {NAV.map((item, i) => item.g
        ? <div key={i} className="sb-section">{item.g}</div>
        : (
          <button key={item.id} className={`nav-btn ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}>
            <span className="nav-icon">{item.icon}</span>
            {item.label}
            {item.id === "products" && pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
          </button>
        )
      )}
      <div className="sb-footer">Super Admin Panel</div>
    </aside>
  );
}

// ── Topbar ────────────────────────────────────────────────────────────────────
function Topbar({ page, adminName, notifCount }) {
  const label = NAV.find(n => n.id === page)?.label || page;
  return (
    <div className="topbar">
      <span className="topbar-title">{label}</span>
      <div className="topbar-right">
        <div className="live-chip"><span className="live-dot" />Live</div>
        <div className="notif-btn">
          🔔{notifCount > 0 && <span className="notif-dot" />}
        </div>
        <div className="avatar">{initials(adminName)}</div>
      </div>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────
function PageOverview({ stats, userStats, salesData, prodStatusData, logs, products, pending, goTo }) {
  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <h1>Overview</h1>
          <div className="ph-sub">{new Date().toLocaleDateString("en-NG", { dateStyle: "full" })}</div>
        </div>
      </div>

      <div className="sg">
        <StatCard icon="👥" label="Total Users"    value={fmt(userStats.total)}                            color="c-blue"   />
        <StatCard icon="✅" label="Active Users"   value={fmt(userStats.active)}                           color="c-green"  />
        <StatCard icon="🚫" label="Banned"         value={fmt(userStats.banned)}                           color="c-red"    />
        <StatCard icon="📦" label="All Products"   value={fmt(stats.totalProducts || products.length)}     color="c-blue"   />
        <StatCard icon="⏳" label="Pending Review" value={fmt(stats.pendingProducts || pending.length)}    color="c-amber"  />
        <StatCard icon="🛒" label="Orders"         value={fmt(stats.orders)}                               color="c-purple" />
        <StatCard icon="₦"  label="Revenue"        value={fmtN(stats.revenue)}                            color="c-green"  />
      </div>

      {salesData.length > 0 && (
        <Card title="📈 Daily Sales">
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222c44" />
                <XAxis dataKey="date" tick={{ fill:"#5e6e94", fontSize:11 }} />
                <YAxis tick={{ fill:"#5e6e94", fontSize:11 }} />
                <Tooltip contentStyle={TT} formatter={v => [fmtN(v),"Sales"]} />
                <Line type="monotone" dataKey="sales" stroke="#4f8cff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card title="▦ Product Status">
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height={165}>
            <BarChart data={prodStatusData} barSize={42}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222c44" />
              <XAxis dataKey="status" tick={{ fill:"#5e6e94", fontSize:11 }} />
              <YAxis tick={{ fill:"#5e6e94", fontSize:11 }} allowDecimals={false} />
              <Tooltip contentStyle={TT} />
              <Bar dataKey="count" fill="#1dd6a0" radius={[5,5,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="≡ Recent Activity" actions={[
        <span key="l" style={{ fontSize:".68rem", color:"var(--muted)" }}>{logs.length} events</span>,
        <button key="a" className="btn b-blue" onClick={() => goTo("logs")}>See all →</button>,
      ]}>
        <div className="log-list">
          {logs.slice(0,7).map(l => <LogItem key={l.id} log={l} />)}
          {!logs.length && <div className="empty">No activity yet</div>}
        </div>
      </Card>
    </>
  );
}

// ── Users ─────────────────────────────────────────────────────────────────────
function PageUsers({ filteredUsers, userQ, setUserQ, banUser, busy, reloadUsers, confirm }) {
  return (
    <>
      <div className="ph">
        <div className="ph-left"><h1>Users <span style={{ color:"var(--muted)", fontWeight:400, fontSize:"1rem" }}>({fmt(filteredUsers.length)})</span></h1></div>
        <div className="ph-right"><Srch value={userQ} onChange={setUserQ} placeholder="Search name or email…" /><Rfr onClick={reloadUsers} /></div>
      </div>
      <Card>
        <div className="tw">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>City</th><th>Status</th><th>Balance</th><th>Joined</th><th>Last Login</th><th>Action</th></tr></thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight:700 }}>{u.name}</td>
                  <td className="mono dim" style={{ fontSize:".7rem" }}>{u.email}</td>
                  <td className="mono" style={{ fontSize:".7rem" }}>{u.phone_number||"—"}</td>
                  <td className="dim">{u.city||"—"}</td>
                  <td><Pill s={u.status||"active"} /></td>
                  <td className="mono" style={{ color:"var(--green)" }}>{fmtN(u.balance)}</td>
                  <td className="mono dim" style={{ fontSize:".68rem" }}>{fmtDate(u.created_at)}</td>
                  <td className="mono dim" style={{ fontSize:".68rem" }}>{fmtDate(u.last_login)}</td>
                  <td>
                    {u.status==="banned"
                      ? <span className="dim" style={{ fontSize:".68rem" }}>Banned</span>
                      : <button className="btn b-red" disabled={busy===`bu-${u.id}`} onClick={() => confirm({ icon:"🚫", title:"Ban User?", body:`Ban "${u.name}"? They will lose access immediately.`, danger:true, confirm:"Ban", action:() => banUser(u.id) })}>
                          {busy===`bu-${u.id}` ? "…" : "Ban"}
                        </button>
                    }
                  </td>
                </tr>
              ))}
              {!filteredUsers.length && <tr><td colSpan={9} className="empty">No users match</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

// ── Admins ────────────────────────────────────────────────────────────────────
function PageAdmins({ admins, banAdmin, registerAdmin, busy, reloadAdmins, confirm }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", email:"", password:"", role:"moderator" });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.name || !form.email || !form.password) return;
    await registerAdmin(form);
    setForm({ name:"", email:"", password:"", role:"moderator" });
    setShowForm(false);
  };

  return (
    <>
      <div className="ph">
        <div className="ph-left"><h1>Admins <span style={{ color:"var(--muted)", fontWeight:400, fontSize:"1rem" }}>({admins.length})</span></h1></div>
        <div className="ph-right">
          <Rfr onClick={reloadAdmins} />
          <button className="btn b-solid" onClick={() => setShowForm(s => !s)}>
            {showForm ? "✕ Close" : "+ New Admin"}
          </button>
        </div>
      </div>

      {showForm && (
        <Card title="⬡ Register New Admin">
          <div className="form-grid">
            <div className="form-group"><label>Full Name</label><input className="input" value={form.name}     onChange={set("name")}     placeholder="Jane Doe" /></div>
            <div className="form-group"><label>Email</label>    <input className="input" value={form.email}    onChange={set("email")}    placeholder="jane@example.com" /></div>
            <div className="form-group"><label>Password</label> <input className="input" value={form.password} onChange={set("password")} type="password" placeholder="••••••••" /></div>
            <div className="form-group">
              <label>Role</label>
              <select className="input" value={form.role} onChange={set("role")}>
                <option value="moderator">Moderator</option>
                <option value="support">Support</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <div className="form-full" style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
              <button className="btn b-ghost"  onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn b-solid"  onClick={submit}>Create Admin</button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="tw">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {admins.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight:700 }}>{a.name}</td>
                  <td className="mono dim" style={{ fontSize:".7rem" }}>{a.email}</td>
                  <td><Pill s={a.role} /></td>
                  <td><Pill s={a.status||"active"} /></td>
                  <td>
                    {a.status==="banned"
                      ? <span className="dim" style={{ fontSize:".68rem" }}>Banned</span>
                      : <button className="btn b-red" disabled={busy===`ba-${a.id}`} onClick={() => confirm({ icon:"⬡", title:"Ban Admin?", body:`Revoke access for "${a.name}"?`, danger:true, confirm:"Ban", action:() => banAdmin(a.id) })}>
                          {busy===`ba-${a.id}` ? "…" : "Ban"}
                        </button>
                    }
                  </td>
                </tr>
              ))}
              {!admins.length && <tr><td colSpan={5} className="empty">No admins found</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

// ── Products ──────────────────────────────────────────────────────────────────
function PageProducts({ displayedProds, products, pending, productTab, setProductTab, productQ, setProductQ, approveProduct, rejectProduct, busy, reloadProducts, confirm }) {
  const tabs = (
    <div className="tabs">
      {[{ id:"all", label:`All (${products.length})` }, { id:"pending", label:`Pending (${pending.length})` }].map(t => (
        <button key={t.id} className={`tab ${productTab===t.id?"active":""}`} onClick={() => setProductTab(t.id)}>{t.label}</button>
      ))}
    </div>
  );

  return (
    <>
      <div className="ph">
        <div className="ph-left"><h1>Products</h1></div>
        <div className="ph-right"><Srch value={productQ} onChange={setProductQ} placeholder="Search product or seller…" /><Rfr onClick={reloadProducts} /></div>
      </div>
      <Card tabs={tabs} title={`${displayedProds.length} results`}>
        <div className="tw">
          <table>
            <thead>
              <tr><th>Product</th><th>Seller</th><th>Price</th><th>Category</th><th>Location</th><th>Status</th><th>Promoted</th><th>Created</th>
                {productTab==="pending" && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {displayedProds.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight:700, maxWidth:200 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                      {p.thumbnail_url && <img className="thumb" src={p.thumbnail_url} alt="" />}
                      <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name||p.title}</span>
                    </div>
                  </td>
                  <td style={{ color:"var(--accent)", fontSize:".75rem" }}>{p.seller_name||"—"}</td>
                  <td className="mono" style={{ color:"var(--green)" }}>{fmtN(p.price)}</td>
                  <td className="dim" style={{ fontSize:".72rem" }}>{p.category_name||"—"}</td>
                  <td style={{ fontSize:".72rem" }}>{[p.location_city, p.location_state].filter(Boolean).join(", ")||"—"}</td>
                  <td><Pill s={p.status} /></td>
                  <td>{p.is_promoted ? <span className="pill pc">Boosted</span> : <span className="dim">—</span>}</td>
                  <td className="mono dim" style={{ fontSize:".68rem" }}>{fmtDate(p.created_at)}</td>
                  {productTab==="pending" && (
                    <td><div style={{ display:"flex", gap:5 }}>
                      <button className="btn b-green" disabled={busy===`ap-${p.id}`} onClick={() => confirm({ icon:"✅", title:"Approve Product?", body:`Publish "${p.name||p.title}"?`, confirm:"Approve", action:() => approveProduct(p.id) })}>{busy===`ap-${p.id}`?"…":"✓"}</button>
                      <button className="btn b-red"   disabled={busy===`rp-${p.id}`} onClick={() => confirm({ icon:"✕", title:"Reject Product?", body:`Reject "${p.name||p.title}"?`, danger:true, confirm:"Reject", action:() => rejectProduct(p.id) })}>{busy===`rp-${p.id}`?"…":"✕"}</button>
                    </div></td>
                  )}
                </tr>
              ))}
              {!displayedProds.length && <tr><td colSpan={9} className="empty">No products found</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

// ── Payments ──────────────────────────────────────────────────────────────────
function PagePayments({ filteredPayments, payQ, setPayQ, refundPayment, busy, reloadPayments, confirm }) {
  return (
    <>
      <div className="ph">
        <div className="ph-left"><h1>Payments <span style={{ color:"var(--muted)", fontWeight:400, fontSize:"1rem" }}>({filteredPayments.length})</span></h1></div>
        <div className="ph-right"><Srch value={payQ} onChange={setPayQ} placeholder="Search user or ref…" /><Rfr onClick={reloadPayments} /></div>
      </div>
      <Card>
        <div className="tw">
          <table>
            <thead><tr><th>User</th><th>Reference</th><th>Amount</th><th>Type</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
            <tbody>
              {filteredPayments.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight:600 }}>{p.user||p.user_name||"—"}</td>
                  <td className="mono dim" style={{ fontSize:".7rem" }}>{p.reference||p.ref||"—"}</td>
                  <td className="mono" style={{ color:"var(--green)" }}>{fmtN(p.amount)}</td>
                  <td className="dim" style={{ fontSize:".72rem" }}>{p.type||"—"}</td>
                  <td><Pill s={p.status} /></td>
                  <td className="mono dim" style={{ fontSize:".68rem" }}>{fmtDate(p.created_at)}</td>
                  <td>
                    {p.status==="paid" || p.status==="completed"
                      ? <button className="btn b-amber" disabled={busy===`rf-${p.id}`} onClick={() => confirm({ icon:"💸", title:"Issue Refund?", body:`Refund ₦${Number(p.amount).toLocaleString()} to ${p.user||"this user"}?`, danger:true, confirm:"Refund", action:() => refundPayment(p.id) })}>
                          {busy===`rf-${p.id}` ? "…" : "Refund"}
                        </button>
                      : <span className="dim" style={{ fontSize:".68rem" }}>—</span>
                    }
                  </td>
                </tr>
              ))}
              {!filteredPayments.length && <tr><td colSpan={7} className="empty">No payments found</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

// ── Orders ────────────────────────────────────────────────────────────────────
function PageOrders({ filteredOrders, orderQ, setOrderQ, cancelOrder, busy, reloadOrders, confirm }) {
  return (
    <>
      <div className="ph">
        <div className="ph-left"><h1>Orders <span style={{ color:"var(--muted)", fontWeight:400, fontSize:"1rem" }}>({filteredOrders.length})</span></h1></div>
        <div className="ph-right"><Srch value={orderQ} onChange={setOrderQ} placeholder="Search order or buyer…" /><Rfr onClick={reloadOrders} /></div>
      </div>
      <Card>
        <div className="tw">
          <table>
            <thead><tr><th>Order ID</th><th>Buyer</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
            <tbody>
              {filteredOrders.map(o => (
                <tr key={o.id}>
                  <td className="mono" style={{ fontSize:".7rem", color:"var(--accent)" }}>#{String(o.id).slice(0,8)}</td>
                  <td style={{ fontWeight:600 }}>{o.buyer_name||o.user||"—"}</td>
                  <td className="dim">{o.item_count||o.items||1} item(s)</td>
                  <td className="mono" style={{ color:"var(--green)" }}>{fmtN(o.total)}</td>
                  <td><Pill s={o.status} /></td>
                  <td className="mono dim" style={{ fontSize:".68rem" }}>{fmtDate(o.created_at)}</td>
                  <td>
                    {["pending","processing","active"].includes(o.status)
                      ? <button className="btn b-red" disabled={busy===`co-${o.id}`} onClick={() => confirm({ icon:"◫", title:"Cancel Order?", body:`Cancel order #${String(o.id).slice(0,8)}? This cannot be undone.`, danger:true, confirm:"Cancel Order", action:() => cancelOrder(o.id) })}>
                          {busy===`co-${o.id}` ? "…" : "Cancel"}
                        </button>
                      : <span className="dim" style={{ fontSize:".68rem" }}>—</span>
                    }
                  </td>
                </tr>
              ))}
              {!filteredOrders.length && <tr><td colSpan={7} className="empty">No orders found</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

// ── Logs ──────────────────────────────────────────────────────────────────────
function PageLogs({ logs, reloadLogs }) {
  return (
    <>
      <div className="ph">
        <div className="ph-left"><h1>Activity Logs</h1></div>
        <div className="ph-right">
          <span style={{ fontSize:".7rem", color:"var(--muted)", fontFamily:"var(--mono)" }}>{logs.length} events</span>
          <Rfr onClick={reloadLogs} />
        </div>
      </div>
      <Card title="≡ All Events" actions={[<span key="c" className="live-chip"><span className="live-dot" />Auto-refresh 5s</span>]}>
        <div className="log-list" style={{ maxHeight:"calc(100vh - 220px)" }}>
          {logs.map(l => <LogItem key={l.id} log={l} />)}
          {!logs.length && <div className="empty">No activity yet</div>}
        </div>
      </Card>
    </>
  );
}

// ── System ────────────────────────────────────────────────────────────────────
const TOGGLES = [
  { key:"maintenance",   label:"Maintenance Mode",  desc:"Take the platform offline for all users. Only admins can access.", danger:true  },
  { key:"allowPosting",  label:"Allow Posting",      desc:"Let sellers create and publish product listings.",                  danger:false },
  { key:"allowPayments", label:"Allow Payments",     desc:"Enable the Paystack payment gateway for all transactions.",        danger:false },
];

function PageSystem({ system, toggleSystem, confirm }) {
  return (
    <>
      <div className="ph">
        <div className="ph-left"><h1>System Control</h1><div className="ph-sub">Platform-wide toggles and configuration</div></div>
      </div>

      <Card title="⌬ Platform Switches">
        {TOGGLES.map(({ key, label, desc, danger }) => (
          <div key={key} className="toggle-row">
            <div className="toggle-info">
              <h4>{label}</h4>
              <p>{desc}</p>
            </div>
            <button
              className={`sw ${system[key] ? "on" : "off"}`}
              onClick={() => confirm({
                icon: danger ? "⚠️" : "⌬",
                title: `${system[key] ? "Disable" : "Enable"} ${label}?`,
                body:  `This will take effect immediately across the platform.`,
                danger,
                confirm: system[key] ? "Turn Off" : "Turn On",
                action: () => toggleSystem(key, system),
              })}
            />
          </div>
        ))}
      </Card>

      <Card title="⚠️ Danger Zone">
        <div className="danger-zone">
          <h4>Hard Reset (coming soon)</h4>
          <p>Clear all sessions, revoke tokens, and force re-login for every user and admin. This is irreversible until the next deploy.</p>
          <button className="btn b-red" disabled>Force Re-Login All</button>
        </div>
        <div className="danger-zone" style={{ margin:"0 18px 18px" }}>
          <h4>Flush Cache (coming soon)</h4>
          <p>Clear Redis trending, search, and session caches. Products may briefly have lower engagement scores.</p>
          <button className="btn b-amber" disabled>Flush Redis Cache</button>
        </div>
      </Card>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. MAIN COMPONENT  — thin orchestration
// ─────────────────────────────────────────────────────────────────────────────
export default function SuperAdmin() {
  const token     = useMemo(() => localStorage.getItem("admin_token"), []);
  const adminName = useMemo(() => localStorage.getItem("admin_name") || "SA", []);
  const api       = useMemo(() => createApi(token), [token]);

  // UI state
  const [page,       setPage]       = useState("overview");
  const [productTab, setProductTab] = useState("all");
  const [userQ,      setUserQ]      = useState("");
  const [productQ,   setProductQ]   = useState("");
  const [orderQ,     setOrderQ]     = useState("");
  const [payQ,       setPayQ]       = useState("");
  const [confirmCfg, setConfirmCfg] = useState(null);

  const confirm = useCallback(cfg => setConfirmCfg(cfg), []);

  // Server state
  const {
    stats, users, admins, products, pending, payments, orders, logs, system,
    loading, loadAll, reload,
  } = useData(api);

  // Derived
  const { salesData, userStats, prodStatusData, filteredUsers, displayedProds, filteredOrders, filteredPayments } =
    useDerived({ users, products, pending, orders, payments, stats, productTab, userQ, productQ, orderQ, payQ });

  // Actions
  const { busy, banUser, banAdmin, approveProduct, rejectProduct, refundPayment, cancelOrder, toggleSystem, registerAdmin } =
    useActions(api, reload);

  // Init + live log interval
  useEffect(() => {
    loadAll();
    const iv = setInterval(reload.logs, 5000);
    return () => clearInterval(iv);
  }, [loadAll, reload.logs]);

  if (loading) return (
    <>
      <style>{css}</style>
      <div className="loading"><span className="live-dot" /> Loading…</div>
    </>
  );

  return (
    <>
      <style>{css}</style>
      <div className="wrap">

        <Sidebar page={page} setPage={setPage} pendingCount={pending.length} />

        <div className="main">
          <Topbar page={page} adminName={adminName} notifCount={pending.length} />

          <div className="body">
            {page==="overview" && <PageOverview stats={stats} userStats={userStats} salesData={salesData} prodStatusData={prodStatusData} logs={logs} products={products} pending={pending} goTo={setPage} />}
            {page==="users"    && <PageUsers    filteredUsers={filteredUsers} userQ={userQ} setUserQ={setUserQ} banUser={banUser} busy={busy} reloadUsers={reload.users} confirm={confirm} />}
            {page==="admins"   && <PageAdmins   admins={admins} banAdmin={banAdmin} registerAdmin={registerAdmin} busy={busy} reloadAdmins={reload.admins} confirm={confirm} />}
            {page==="products" && <PageProducts displayedProds={displayedProds} products={products} pending={pending} productTab={productTab} setProductTab={setProductTab} productQ={productQ} setProductQ={setProductQ} approveProduct={approveProduct} rejectProduct={rejectProduct} busy={busy} reloadProducts={reload.products} confirm={confirm} />}
            {page==="payments" && <PagePayments filteredPayments={filteredPayments} payQ={payQ} setPayQ={setPayQ} refundPayment={refundPayment} busy={busy} reloadPayments={reload.payments} confirm={confirm} />}
            {page==="orders"   && <PageOrders   filteredOrders={filteredOrders} orderQ={orderQ} setOrderQ={setOrderQ} cancelOrder={cancelOrder} busy={busy} reloadOrders={reload.orders} confirm={confirm} />}
            {page==="logs"     && <PageLogs     logs={logs} reloadLogs={reload.logs} />}
            {page==="system"   && <PageSystem   system={system} toggleSystem={toggleSystem} confirm={confirm} />}
          </div>
        </div>
      </div>

      <Confirm cfg={confirmCfg} onClose={() => setConfirmCfg(null)} />
    </>
  );
}
