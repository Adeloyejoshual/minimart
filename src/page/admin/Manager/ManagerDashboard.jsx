// src/pages/admin/Manager/ManagerDashboard.jsx

import { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";

// ── Layout ────────────────────────────────────────────────────
import Sidebar from "../adminlayout/Sidebar";
import Topbar  from "../adminlayout/Topbar";
import { css } from "../adminlayout/css";

// ── Pages reused from SuperAdmin ─────────────────────────────
import Overview           from "../SuperAdmin/Overview";
import Users              from "../SuperAdmin/Users";
import Products           from "../SuperAdmin/Products";
import MarketProducts     from "../SuperAdmin/MarketProducts";
import Orders             from "../SuperAdmin/Orders";
import Withdrawals        from "../SuperAdmin/Withdrawals";
import Reports            from "../SuperAdmin/Reports";
import Verification       from "../SuperAdmin/Verification";
import VendorVerification from "../SuperAdmin/VendorVerification";
import Leaderboard        from "../SuperAdmin/Leaderboard";
import AirtimeCoupons     from "../SuperAdmin/AirtimeCoupons";
import CouponRedemption   from "../SuperAdmin/CouponRedemption";
import AdminSubscriptions from "../SuperAdmin/AdminSubscriptions";
import Logs               from "../SuperAdmin/Logs";
import Promotions         from "../SuperAdmin/Promotions";

// ── Manager-specific pages ───────────────────────────────────
import ManagerAdmins  from "./ManagerAdmins";
import ManagerPayments from "./ManagerPayments";

// ── Helpers ───────────────────────────────────────────────────
import { safeFeatures } from "../adminlayout/helpers";

/* ════════════════════════════════════════════════════════════
   ENV + API bases
════════════════════════════════════════════════════════════ */
const BASE     = `${import.meta.env.VITE_API_BASE_URL}/api/admin`;
const PAY_BASE = `${import.meta.env.VITE_API_BASE_URL}/api/payment`;

const LOG_POLL_INTERVAL = 5_000;

/* ════════════════════════════════════════════════════════════
   createApi
════════════════════════════════════════════════════════════ */
const createApi = (token) => {
  const h = { Authorization: `Bearer ${token}` };
  return {
    get   : (p, base = BASE)         => axios.get   (base + p,     { headers: h }),
    post  : (p, b = {}, base = BASE) => axios.post  (base + p, b,  { headers: h }),
    put   : (p, b = {}, base = BASE) => axios.put   (base + p, b,  { headers: h }),
    patch : (p, b = {}, base = BASE) => axios.patch (base + p, b,  { headers: h }),
    del   : (p, base = BASE)         => axios.delete(base + p,     { headers: h }),
  };
};

/* ════════════════════════════════════════════════════════════
   CONFIRM MODAL
════════════════════════════════════════════════════════════ */
function Confirm({ cfg, onClose }) {
  if (!cfg) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
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

/* ════════════════════════════════════════════════════════════
   useData — same as SuperAdmin but limited endpoints
════════════════════════════════════════════════════════════ */
function useData(api) {
  const [stats, setStats] = useState({
    users: 0, orders: 0, revenue: 0, dailySales: [],
    activeUsers: 0, bannedUsers: 0, pendingProducts: 0,
    totalProducts: 0, todayUsers: 0, todayProducts: 0,
    todayRevenue: 0, todayOrders: 0,
    vendorsTotal: 0, vendorsPending: 0, vendorsActive: 0,
    vendorsUnderReview: 0,
    referrals: { total: 0, pending: 0, verified: 0, rewarded: 0 },
    coupons:   { total: 0, available: 0, redeemed: 0, today: 0 },
    subscriptions: {
      total: 0, active: 0, expired: 0, cancelled: 0,
      mrr: 0, arr: 0, today: 0, byPlan: {},
    },
  });

  const [users,    setUsers]    = useState([]);
  const [admins,   setAdmins]   = useState([]);
  const [products, setProducts] = useState([]);
  const [pending,  setPending]  = useState([]);
  const [payments, setPayments] = useState([]);
  const [orders,   setOrders]   = useState([]);
  const [logs,     setLogs]     = useState([]);
  const [plans,    setPlans]    = useState([]);

  const [reportCount,              setReportCount]              = useState(0);
  const [marketPendingCount,       setMarketPendingCount]       = useState(0);
  const [verificationPendingCount, setVerificationPendingCount] = useState(0);
  const [vendorPendingCount,       setVendorPendingCount]       = useState(0);
  const [withdrawalPendingCount,   setWithdrawalPendingCount]   = useState(0);
  const [airtimePendingCount,      setAirtimePendingCount]      = useState(0);
  const [subscriptionStats,        setSubscriptionStats]        = useState(null);
  const [loading,                  setLoading]                  = useState(true);

  const safe = useCallback(async (path, setter, base) => {
    try {
      const { data } = await api.get(path, base);
      setter(data);
    } catch (err) {
      console.warn("[manager] fetch:", path, err.message);
    }
  }, [api]);

  const safeList = useCallback(async (path, setter, key) => {
    try {
      const { data } = await api.get(path);
      const list = Array.isArray(data) ? data : (data?.[key] ?? []);
      setter(list);
    } catch (err) {
      console.warn("[manager] fetch:", path, err.message);
      setter([]);
    }
  }, [api]);

  const normalizePlans = useCallback((data) => {
    if (data?.plans) {
      setPlans(data.plans.map((p) => ({
        ...p, features: safeFeatures(p.features),
      })));
    }
  }, []);

  const reloadPlans = useCallback(async () => {
    try {
      const { data } = await api.get("/plans", PAY_BASE);
      normalizePlans(data);
    } catch (err) {
      console.warn("[manager] plans:", err.message);
    }
  }, [api, normalizePlans]);

  const reloadReportCount = useCallback(async () => {
    try {
      const { data } = await api.get("/reports/stats");
      setReportCount(data.pending ?? 0);
    } catch {}
  }, [api]);

  const reloadMarketPendingCount = useCallback(async () => {
    try {
      const { data } = await api.get("/market-products?status=pending");
      setMarketPendingCount(
        data?.counts?.pending ??
        (Array.isArray(data?.products) ? data.products.length : 0) ?? 0,
      );
    } catch {}
  }, [api]);

  const reloadVerificationCount = useCallback(async () => {
    try {
      const { data } = await api.get("/verification/stats");
      setVerificationPendingCount(
        (data?.identity?.pending ?? 0) + (data?.store?.pending ?? 0),
      );
    } catch {}
  }, [api]);

  const reloadVendorCount = useCallback(async () => {
    try {
      const { data } = await api.get("/vendors?status=pending&limit=1");
      setVendorPendingCount(
        data?.status_counts?.pending ?? data?.pagination?.total ?? 0,
      );
    } catch {}
  }, [api]);

  const reloadWithdrawalCount = useCallback(async () => {
    try {
      const { data } = await api.get("/withdrawals?status=pending&limit=1");
      setWithdrawalPendingCount(data?.pagination?.total ?? data?.total ?? 0);
    } catch {}
  }, [api]);

  const reloadAirtimeCount = useCallback(async () => {
    try {
      const { data } = await api.get("/airtime-coupons?status=redeemed&limit=1");
      setAirtimePendingCount(data?.total ?? 0);
    } catch {}
  }, [api]);

  const reloadSubscriptionStats = useCallback(async () => {
    try {
      const { data } = await api.get("/subscriptions/stats");
      setSubscriptionStats(data);
      setStats((prev) => ({
        ...prev,
        subscriptions: {
          total:     data.total     ?? 0,
          active:    data.active    ?? 0,
          expired:   data.expired   ?? 0,
          cancelled: data.cancelled ?? 0,
          mrr:       data.mrr       ?? 0,
          arr:       data.arr       ?? 0,
          today:     data.today     ?? 0,
          byPlan:    data.byPlan    ?? {},
        },
      }));
    } catch (err) {
      console.warn("[manager] subscription stats:", err.message);
    }
  }, [api]);

  const reload = useMemo(() => ({
    users    : () => safeList("/users",  setUsers,  "users"),
    admins   : () => safeList("/admins", setAdmins, "admins"),
    products : () => Promise.all([
      safe("/products",         setProducts),
      safe("/products/pending", setPending),
      safe("/stats",            setStats),
    ]),
    payments          : () => safe("/payments", setPayments),
    orders            : () => safe("/orders",   setOrders),
    logs              : () => safe("/logs",     setLogs),
    plans             : reloadPlans,
    reportCount       : reloadReportCount,
    marketPendingCount: reloadMarketPendingCount,
    verificationCount : reloadVerificationCount,
    vendorCount       : reloadVendorCount,
    withdrawalCount   : reloadWithdrawalCount,
    airtimeCount      : reloadAirtimeCount,
    subscriptionStats : reloadSubscriptionStats,
  }), [
    safe, safeList,
    reloadPlans, reloadReportCount, reloadMarketPendingCount,
    reloadVerificationCount, reloadVendorCount, reloadWithdrawalCount,
    reloadAirtimeCount, reloadSubscriptionStats,
  ]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      safe("/stats",            setStats),
      safeList("/users",        setUsers,  "users"),
      safeList("/admins",       setAdmins, "admins"),
      safe("/products",         setProducts),
      safe("/products/pending", setPending),
      safe("/payments",         setPayments),
      safe("/orders",           setOrders),
      safe("/logs",             setLogs),
      reloadPlans(),
      reloadReportCount(),
      reloadMarketPendingCount(),
      reloadVerificationCount(),
      reloadVendorCount(),
      reloadWithdrawalCount(),
      reloadAirtimeCount(),
      reloadSubscriptionStats(),
    ]);
    setLoading(false);
  }, [
    safe, safeList,
    reloadPlans, reloadReportCount, reloadMarketPendingCount,
    reloadVerificationCount, reloadVendorCount, reloadWithdrawalCount,
    reloadAirtimeCount, reloadSubscriptionStats,
  ]);

  return {
    stats, users, admins, products, pending,
    payments, orders, logs, plans,
    reportCount, marketPendingCount,
    verificationPendingCount, vendorPendingCount,
    withdrawalPendingCount, airtimePendingCount,
    subscriptionStats, loading, loadAll, reload,
  };
}

/* ════════════════════════════════════════════════════════════
   useDerived — same as SuperAdmin
════════════════════════════════════════════════════════════ */
function useDerived({
  users, products, pending, orders, payments, stats,
  productTab, userQ, productQ, orderQ, payQ,
}) {
  const salesData = useMemo(() =>
    (stats.dailySales ?? []).map((d) => ({
      date: d.date?.slice(5), sales: Number(d.amount),
    })),
    [stats.dailySales],
  );

  const userStats = useMemo(() => ({
    total:  users.length,
    active: users.filter((u) => u.status !== "banned").length,
    banned: users.filter((u) => u.status === "banned").length,
  }), [users]);

  const prodStatusData = useMemo(() => [
    { status: "Active",  count: products.filter((p) => p.status === "active").length  },
    { status: "Draft",   count: products.filter((p) => p.status === "draft").length   },
    { status: "Pending", count: products.filter((p) => p.status === "pending").length },
  ], [products]);

  const lastProducts = useMemo(() =>
    [...products]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8),
    [products],
  );

  const filteredUsers = useMemo(() => {
    const q = userQ.toLowerCase();
    return users.filter((u) =>
      `${u.name ?? ""} ${u.email ?? ""}`.toLowerCase().includes(q),
    );
  }, [users, userQ]);

  const displayedProds = useMemo(() => {
    const q    = productQ.toLowerCase();
    const base = productTab === "pending" ? pending : products;
    return base.filter((p) =>
      (p.name ?? p.title ?? "").toLowerCase().includes(q) ||
      (p.seller_name ?? "").toLowerCase().includes(q),
    );
  }, [products, pending, productTab, productQ]);

  const filteredOrders = useMemo(() => {
    const q = orderQ.toLowerCase();
    return orders.filter((o) =>
      `${o.id ?? ""} ${o.buyer_name ?? ""} ${o.status ?? ""}`
        .toLowerCase().includes(q),
    );
  }, [orders, orderQ]);

  const filteredPayments = useMemo(() => {
    const q = payQ.toLowerCase();
    return payments.filter((p) =>
      `${p.user ?? ""} ${p.reference ?? ""} ${p.status ?? ""}`
        .toLowerCase().includes(q),
    );
  }, [payments, payQ]);

  return {
    salesData, userStats, prodStatusData, lastProducts,
    filteredUsers, displayedProds, filteredOrders, filteredPayments,
  };
}

/* ════════════════════════════════════════════════════════════
   useActions — Manager can NOT refund payments or edit admins
════════════════════════════════════════════════════════════ */
function useActions(api, reload) {
  const [busy, setBusy] = useState(null);

  const run = useCallback(async (key, fn) => {
    setBusy(key);
    try   { await fn(); }
    catch (err) { console.error("[manager] action:", key, err.message); }
    finally    { setBusy(null); }
  }, []);

  return {
    busy,

    // ── Users (Ban / Unban allowed) ──────────────────────
    banUser: (id) => run(`bu-${id}`, async () => {
      await api.post(`/users/${id}/ban`);
      await reload.users();
    }),

    unbanUser: (id) => run(`ubu-${id}`, async () => {
      await api.post(`/users/${id}/unban`);
      await reload.users();
    }),

    // ── Products (Approve / Reject allowed) ──────────────
    approveProduct: (id) => run(`ap-${id}`, async () => {
      await api.post(`/products/${id}/approve`);
      await reload.products();
    }),

    rejectProduct: (id) => run(`rp-${id}`, async () => {
      await api.post(`/products/${id}/reject`);
      await reload.products();
    }),

    // ── Orders (Cancel allowed) ──────────────────────────
    cancelOrder: (id) => run(`co-${id}`, async () => {
      await api.post(`/orders/${id}/cancel`);
      await reload.orders();
    }),

    // ── Plans (Toggle only, no create/delete) ────────────
    togglePlan: async (plan) => {
      await run(`pt-${plan.id}`, () =>
        api.put(
          `/plans/${plan.id}`,
          { ...plan, is_active: !plan.is_active },
          PAY_BASE,
        )
      );
      await reload.plans();
    },
  };
}

/* ════════════════════════════════════════════════════════════
   MANAGER DASHBOARD
════════════════════════════════════════════════════════════ */
export default function ManagerDashboard() {
  const token = useMemo(() => localStorage.getItem("admin_token"), []);
  const api   = useMemo(() => createApi(token), [token]);

  const currentUser = useMemo(() => {
    try {
      const stored = localStorage.getItem("admin");
      if (stored) return JSON.parse(stored);
    } catch {}
    return { id: null, name: null, email: null, role: null };
  }, []);

  const adminName = currentUser?.name || "Manager";

  const [page,       setPage]       = useState("overview");
  const [productTab, setProductTab] = useState("all");
  const [userQ,      setUserQ]      = useState("");
  const [productQ,   setProductQ]   = useState("");
  const [orderQ,     setOrderQ]     = useState("");
  const [payQ,       setPayQ]       = useState("");
  const [confirmCfg, setConfirmCfg] = useState(null);

  const confirm = useCallback((cfg) => setConfirmCfg(cfg), []);

  const data    = useData(api);
  const derived = useDerived({
    users: data.users, products: data.products,
    pending: data.pending, orders: data.orders,
    payments: data.payments, stats: data.stats,
    productTab, userQ, productQ, orderQ, payQ,
  });
  const actions = useActions(api, data.reload);

  const logRef = useMemo(() => ({ current: data.reload.logs }), []);
  useEffect(() => { logRef.current = data.reload.logs; });

  useEffect(() => {
    data.loadAll();
    const iv = setInterval(() => logRef.current(), LOG_POLL_INTERVAL);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalNotifCount =
    data.pending.length           +
    data.marketPendingCount       +
    data.reportCount              +
    data.verificationPendingCount +
    data.vendorPendingCount       +
    data.withdrawalPendingCount   +
    data.airtimePendingCount;

  if (data.loading) {
    return (
      <>
        <style>{css}</style>
        <div className="loading">
          <span className="live-dot" /> Loading manager panel...
        </div>
      </>
    );
  }

  /* ── Page map — no system settings, no admin CRUD ── */
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
        unbanUser={actions.unbanUser}
        busy={actions.busy}
        reloadUsers={data.reload.users}
        confirm={confirm}
      />
    ),

    admins: (
      <ManagerAdmins
        admins={data.admins}
        reloadAdmins={data.reload.admins}
        currentUser={currentUser}
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

    market_products: (
      <MarketProducts
        confirm={confirm}
        onMutation={data.reload.marketPendingCount}
      />
    ),

    payments: (
      <ManagerPayments
        filteredPayments={derived.filteredPayments}
        payQ={payQ}
        setPayQ={setPayQ}
        reloadPayments={data.reload.payments}
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

    withdrawals: (
      <Withdrawals
        api={api}
        confirm={confirm}
        onMutation={data.reload.withdrawalCount}
        viewOnly={true}
      />
    ),

    reports: (
      <Reports confirm={confirm} />
    ),

    verification: (
      <Verification
        confirm={confirm}
        onMutation={data.reload.verificationCount}
      />
    ),

    vendor_verification: (
      <VendorVerification
        confirm={confirm}
        onMutation={data.reload.vendorCount}
      />
    ),

    subscriptions: (
      <AdminSubscriptions
        api={api}
        subscriptionStats={data.subscriptionStats ?? data.stats.subscriptions}
        onMutation={data.reload.subscriptionStats}
        confirm={confirm}
        viewOnly={true}
      />
    ),

    leaderboard: (
      <Leaderboard
        api={api}
        referralStats={data.stats.referrals}
        confirm={confirm}
      />
    ),

    airtime_coupons: (
      <AirtimeCoupons
        api={api}
        confirm={confirm}
        onMutation={data.reload.airtimeCount}
      />
    ),

    coupon_redemption: (
      <CouponRedemption
        api={api}
        couponStats={data.stats.coupons}
      />
    ),

    promotions: (
      <Promotions
        plans={data.plans}
        togglePlan={actions.togglePlan}
        busy={actions.busy}
        reloadPlans={data.reload.plans}
        viewOnly={true}
      />
    ),

    logs: (
      <Logs
        logs={data.logs}
        reloadLogs={data.reload.logs}
      />
    ),
  };

  return (
    <>
      <style>{css}</style>
      <div className="wrap">
        <Sidebar
          page={page}
          setPage={setPage}
          role="admin"
          pendingCount={data.pending.length}
          reportCount={data.reportCount}
          marketPendingCount={data.marketPendingCount}
          verificationPendingCount={data.verificationPendingCount}
          vendorPendingCount={data.vendorPendingCount}
          withdrawalPendingCount={data.withdrawalPendingCount}
          airtimePendingCount={data.airtimePendingCount}
          subscriptionActiveCount={data.subscriptionStats?.active ?? 0}
        />
        <div className="main">
          <Topbar
            page={page}
            adminName={adminName}
            notifCount={totalNotifCount}
            roleBadge="Manager"
          />
          <div className="body">
            {pageMap[page] ?? (
              <div className="empty" style={{ padding: 40, textAlign: "center" }}>
                Page not available for your role
              </div>
            )}
          </div>
        </div>
      </div>
      <Confirm cfg={confirmCfg} onClose={() => setConfirmCfg(null)} />
    </>
  );
}