import { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";

// layout
import Sidebar from "./adminlayout/Sidebar";
import Topbar  from "./adminlayout/Topbar";
import { css } from "./adminlayout/css";

// pages
import Overview   from "./SuperAdmin/Overview";
import Users      from "./SuperAdmin/Users";
import Admins     from "./SuperAdmin/Admins";
import Products   from "./SuperAdmin/Products";
import Payments   from "./SuperAdmin/Payments";
import Orders     from "./SuperAdmin/Orders";
import Logs       from "./SuperAdmin/Logs";
import Promotions from "./SuperAdmin/Promotions";
import System     from "./SuperAdmin/System";
import Reports    from "./SuperAdmin/Reports";     // ← NEW

// helpers
import { safeFeatures } from "./adminlayout/helpers";

const BASE     = "https://minimart-ivrm.onrender.com/api/admin";
const PAY_BASE = "https://minimart-ivrm.onrender.com/api/payment";

const createApi = (token) => {
  const h = { Authorization: `Bearer ${token}` };
  return {
    get:  (p, base = BASE)         => axios.get(base + p,       { headers: h }),
    post: (p, b = {}, base = BASE) => axios.post(base + p,  b,  { headers: h }),
    put:  (p, b = {}, base = BASE) => axios.put(base + p,   b,  { headers: h }),
    del:  (p, base = BASE)         => axios.delete(base + p,    { headers: h }),
  };
};

/* ── Confirm modal ── */
function Confirm({ cfg, onClose }) {
  if (!cfg) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{cfg.title}</div>
        <p style={{ fontSize: ".82rem", color: "var(--muted)", lineHeight: 1.6 }}>
          {cfg.body}
        </p>
        <div className="modal-btns">
          <button className="btn b-ghost" onClick={onClose}>Cancel</button>
          <button
            className={`btn ${cfg.danger ? "b-red" : "b-solid"}`}
            onClick={() => { cfg.action(); onClose(); }}
          >
            {cfg.confirm || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── useData ── */
function useData(api) {
  const [stats,    setStats]   = useState({
    users: 0, orders: 0, revenue: 0, dailySales: [],
    activeUsers: 0, bannedUsers: 0,
    pendingProducts: 0, totalProducts: 0,
    todayUsers: 0, todayProducts: 0,
    todayRevenue: 0, todayOrders: 0,
  });
  const [users,    setUsers]    = useState([]);
  const [admins,   setAdmins]   = useState([]);
  const [products, setProducts] = useState([]);
  const [pending,  setPending]  = useState([]);
  const [payments, setPayments] = useState([]);
  const [orders,   setOrders]   = useState([]);
  const [logs,     setLogs]     = useState([]);
  const [system,   setSystem]   = useState({
    maintenance: false, allowPosting: true, allowPayments: true,
  });
  const [plans,        setPlans]        = useState([]);
  const [reportCount,  setReportCount]  = useState(0); // ← pending reports
  const [loading,      setLoading]      = useState(true);

  const safe = useCallback(async (path, setter, base) => {
    try {
      const { data } = await api.get(path, base);
      setter(data);
    } catch (e) {
      console.warn("[sa]", path, e.message);
    }
  }, [api]);

  const normalizePlans = useCallback((data) => {
    if (data?.plans)
      setPlans(data.plans.map(p => ({
        ...p, features: safeFeatures(p.features),
      })));
  }, []);

  const reloadPlans = useCallback(async () => {
    try {
      const { data } = await api.get("/plans", PAY_BASE);
      normalizePlans(data);
    } catch (e) { console.warn("[plans]", e.message); }
  }, [api, normalizePlans]);

  /* fetch pending report count for sidebar badge */
  const reloadReportCount = useCallback(async () => {
    try {
      const { data } = await api.get("/reports/stats");
      setReportCount(data.pending ?? 0);
    } catch {}
  }, [api]);

  const reload = useMemo(() => ({
    users:    () => safe("/users",            setUsers),
    admins:   () => safe("/admins",           setAdmins),
    products: () => Promise.all([
      safe("/products",         setProducts),
      safe("/products/pending", setPending),
      safe("/stats",            setStats),
    ]),
    payments:     () => safe("/payments", setPayments),
    orders:       () => safe("/orders",   setOrders),
    logs:         () => safe("/logs",     setLogs),
    system:       (d) => setSystem(d),
    plans:        reloadPlans,
    reportCount:  reloadReportCount,
  }), [safe, reloadPlans, reloadReportCount]);

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
      reloadPlans(),
      reloadReportCount(),
    ]);
    setLoading(false);
  }, [safe, reloadPlans, reloadReportCount]);

  return {
    stats, users, admins, products, pending, payments,
    orders, logs, system, plans, reportCount, loading,
    loadAll, reload,
  };
}

/* ── useDerived ── */
function useDerived({
  users, products, pending, orders, payments, stats,
  productTab, userQ, productQ, orderQ, payQ,
}) {
  const salesData = useMemo(() =>
    (stats.dailySales ?? []).map(d => ({
      date:  d.date?.slice(5),
      sales: Number(d.amount),
    })), [stats.dailySales]);

  const userStats = useMemo(() => ({
    total:  users.length,
    active: users.filter(u => u.status !== "banned").length,
    banned: users.filter(u => u.status === "banned").length,
  }), [users]);

  const prodStatusData = useMemo(() => [
    { status: "Active",  count: products.filter(p => p.status === "active").length  },
    { status: "Draft",   count: products.filter(p => p.status === "draft").length   },
    { status: "Pending", count: products.filter(p => p.status === "pending").length },
  ], [products]);

  const lastProducts = useMemo(() =>
    [...products]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8),
  [products]);

  const filteredUsers = useMemo(() => {
    const q = userQ.toLowerCase();
    return users.filter(u =>
      `${u.name ?? ""} ${u.email ?? ""}`.toLowerCase().includes(q)
    );
  }, [users, userQ]);

  const displayedProds = useMemo(() => {
    const q    = productQ.toLowerCase();
    const base = productTab === "pending" ? pending : products;
    return base.filter(p =>
      (p.name ?? p.title ?? "").toLowerCase().includes(q) ||
      (p.seller_name ?? "").toLowerCase().includes(q)
    );
  }, [products, pending, productTab, productQ]);

  const filteredOrders = useMemo(() => {
    const q = orderQ.toLowerCase();
    return orders.filter(o =>
      `${o.id ?? ""} ${o.buyer_name ?? ""} ${o.status ?? ""}`.toLowerCase().includes(q)
    );
  }, [orders, orderQ]);

  const filteredPayments = useMemo(() => {
    const q = payQ.toLowerCase();
    return payments.filter(p =>
      `${p.user ?? ""} ${p.reference ?? ""} ${p.status ?? ""}`.toLowerCase().includes(q)
    );
  }, [payments, payQ]);

  return {
    salesData, userStats, prodStatusData, lastProducts,
    filteredUsers, displayedProds, filteredOrders, filteredPayments,
  };
}

/* ── useActions ── */
function useActions(api, reload) {
  const [busy, setBusy] = useState(null);

  const run = useCallback(async (key, fn) => {
    setBusy(key);
    try   { await fn(); }
    catch (e) { console.error(key, e.message); }
    finally   { setBusy(null); }
  }, []);

  return {
    busy,
    banUser:        (id) => run(`bu-${id}`, async () => { await api.post(`/users/${id}/ban`);        reload.users(); }),
    banAdmin:       (id) => run(`ba-${id}`, async () => { await api.post(`/admins/${id}/ban`);       reload.admins(); }),
    approveProduct: (id) => run(`ap-${id}`, async () => { await api.post(`/products/${id}/approve`); reload.products(); }),
    rejectProduct:  (id) => run(`rp-${id}`, async () => { await api.post(`/products/${id}/reject`);  reload.products(); }),
    refundPayment:  (id) => run(`rf-${id}`, async () => { await api.post(`/payments/${id}/refund`);  reload.payments(); }),
    cancelOrder:    (id) => run(`co-${id}`, async () => { await api.post(`/orders/${id}/cancel`);    reload.orders(); }),
    toggleSystem: async (key, system) => {
      const next = { ...system, [key]: !system[key] };
      reload.system(next);
      try   { await api.post("/system", next); }
      catch { reload.system(system); }
    },
    registerAdmin: async (form) => { await api.post("/register", form); reload.admins(); },
    savePlan: async (plan) => {
      await run(`plan-${plan.id}`, () =>
        api.put(`/plans/${plan.id}`, {
          name:             plan.name,
          price:            Number(plan.price),
          discount_percent: Number(plan.discount_percent ?? 0),
          duration_days:    Number(plan.duration_days ?? 30),
          duration:         plan.duration ?? "",
          priority:         Number(plan.priority ?? 0),
          sort_order:       Number(plan.sort_order ?? 0),
          is_active:        !!plan.is_active,
          features:         safeFeatures(plan.features),
        }, PAY_BASE)
      );
      reload.plans();
    },
    togglePlan: async (plan) => {
      await run(`pt-${plan.id}`, () =>
        api.put(`/plans/${plan.id}`,
          { ...plan, is_active: !plan.is_active }, PAY_BASE)
      );
      reload.plans();
    },
  };
}

/* ══════════════════════════════════════════════
   AdminDashboard
══════════════════════════════════════════════ */
export default function AdminDashboard() {
  const token     = useMemo(() => localStorage.getItem("admin_token"), []);
  const adminName = useMemo(() => localStorage.getItem("admin_name") || "SA", []);
  const api       = useMemo(() => createApi(token), [token]);

  const [page,       setPage]       = useState("overview");
  const [productTab, setProductTab] = useState("all");
  const [userQ,      setUserQ]      = useState("");
  const [productQ,   setProductQ]   = useState("");
  const [orderQ,     setOrderQ]     = useState("");
  const [payQ,       setPayQ]       = useState("");
  const [confirmCfg, setConfirmCfg] = useState(null);

  const confirm = useCallback(cfg => setConfirmCfg(cfg), []);

  const data    = useData(api);
  const derived = useDerived({
    users:    data.users,
    products: data.products,
    pending:  data.pending,
    orders:   data.orders,
    payments: data.payments,
    stats:    data.stats,
    productTab, userQ, productQ, orderQ, payQ,
  });
  const actions = useActions(api, data.reload);

  /* stable ref for log polling */
  const logRef = useMemo(() => ({ current: data.reload.logs }), []);
  useEffect(() => { logRef.current = data.reload.logs; });

  useEffect(() => {
    data.loadAll();
    const iv = setInterval(() => logRef.current(), 5000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (data.loading) {
    return (
      <>
        <style>{css}</style>
        <div className="loading">
          <span className="live-dot"/> Loading admin panel…
        </div>
      </>
    );
  }

  const pageMap = {
    overview: (
      <Overview
        stats={data.stats}
        userStats={derived.userStats}
        salesData={derived.salesData}
        prodStatusData={derived.prodStatusData}
        logs={data.logs}
        products={data.products}
        pending={data.pending}
        lastProducts={derived.lastProducts}
        goTo={setPage}
      />
    ),
    users: (
      <Users
        filteredUsers={derived.filteredUsers}
        userQ={userQ}
        setUserQ={setUserQ}
        banUser={actions.banUser}
        busy={actions.busy}
        reloadUsers={data.reload.users}
        confirm={confirm}
      />
    ),
    admins: (
      <Admins
        admins={data.admins}
        banAdmin={actions.banAdmin}
        registerAdmin={actions.registerAdmin}
        busy={actions.busy}
        reloadAdmins={data.reload.admins}
        confirm={confirm}
      />
    ),
    products: (
      <Products
        displayedProds={derived.displayedProds}
        products={data.products}
        pending={data.pending}
        productTab={productTab}
        setProductTab={setProductTab}
        productQ={productQ}
        setProductQ={setProductQ}
        approveProduct={actions.approveProduct}
        rejectProduct={actions.rejectProduct}
        busy={actions.busy}
        reloadProducts={data.reload.products}
        confirm={confirm}
      />
    ),
    payments: (
      <Payments
        filteredPayments={derived.filteredPayments}
        payQ={payQ}
        setPayQ={setPayQ}
        refundPayment={actions.refundPayment}
        busy={actions.busy}
        reloadPayments={data.reload.payments}
        confirm={confirm}
      />
    ),
    orders: (
      <Orders
        filteredOrders={derived.filteredOrders}
        orderQ={orderQ}
        setOrderQ={setOrderQ}
        cancelOrder={actions.cancelOrder}
        busy={actions.busy}
        reloadOrders={data.reload.orders}
        confirm={confirm}
      />
    ),
    logs: (
      <Logs
        logs={data.logs}
        reloadLogs={data.reload.logs}
      />
    ),
    promotions: (
      <Promotions
        plans={data.plans}
        savePlan={actions.savePlan}
        togglePlan={actions.togglePlan}
        busy={actions.busy}
        reloadPlans={data.reload.plans}
      />
    ),
    system: (
      <System
        system={data.system}
        toggleSystem={actions.toggleSystem}
        confirm={confirm}
      />
    ),
    /* ← NEW */
    reports: (
      <Reports confirm={confirm}/>
    ),
  };

  return (
    <>
      <style>{css}</style>
      <div className="wrap">
        <Sidebar
          page={page}
          setPage={setPage}
          pendingCount={data.pending.length}
          reportCount={data.reportCount}      /* ← NEW */
        />
        <div className="main">
          <Topbar
            page={page}
            adminName={adminName}
            notifCount={data.pending.length + data.reportCount} /* ← NEW */
          />
          <div className="body">
            {pageMap[page] ?? null}
          </div>
        </div>
      </div>
      <Confirm cfg={confirmCfg} onClose={() => setConfirmCfg(null)}/>
    </>
  );
}