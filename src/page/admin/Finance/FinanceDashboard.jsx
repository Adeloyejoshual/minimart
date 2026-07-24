// src/pages/admin/Finance/FinanceDashboard.jsx

import { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";

// ── Layout ────────────────────────────────────────────────────
import Sidebar from "../adminlayout/Sidebar";
import Topbar  from "../adminlayout/Topbar";
import { css } from "../adminlayout/css";

// ── Finance-specific pages ───────────────────────────────────
import FinanceOverview      from "./FinanceOverview";
import FinancePayments      from "./FinancePayments";
import FinanceWithdrawals   from "./FinanceWithdrawals";
import FinanceSubscriptions from "./FinanceSubscriptions";
import FinanceRevenue       from "./FinanceRevenue";
import FinanceCoupons       from "./FinanceCoupons";
import FinancePlans         from "./FinancePlans";
import AirtimeCoupons       from "../SuperAdmin/AirtimeCoupons";
import CouponRedemption     from "../SuperAdmin/CouponRedemption";
import Logs                 from "../SuperAdmin/Logs";

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
   useData — finance-focused endpoints only
════════════════════════════════════════════════════════════ */
function useData(api) {
  const [stats,    setStats]    = useState({
    revenue: 0, todayRevenue: 0, dailySales: [],
    orders: 0, todayOrders: 0,
    subscriptions: {
      total: 0, active: 0, expired: 0, cancelled: 0,
      mrr: 0, arr: 0, today: 0, byPlan: {},
    },
    coupons: { total: 0, available: 0, redeemed: 0, today: 0 },
  });

  const [payments,          setPayments]          = useState([]);
  const [withdrawals,       setWithdrawals]       = useState([]);
  const [plans,             setPlans]             = useState([]);
  const [logs,              setLogs]              = useState([]);
  const [subscriptionStats, setSubscriptionStats] = useState(null);

  const [withdrawalPendingCount, setWithdrawalPendingCount] = useState(0);
  const [airtimePendingCount,    setAirtimePendingCount]    = useState(0);
  const [loading,                setLoading]                = useState(true);

  const safe = useCallback(async (path, setter, base) => {
    try {
      const { data } = await api.get(path, base);
      setter(data);
    } catch (err) {
      console.warn("[finance] fetch:", path, err.message);
    }
  }, [api]);

  const safeList = useCallback(async (path, setter, key) => {
    try {
      const { data } = await api.get(path);
      const list = Array.isArray(data) ? data : (data?.[key] ?? []);
      setter(list);
    } catch (err) {
      console.warn("[finance] fetch:", path, err.message);
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
      console.warn("[finance] plans:", err.message);
    }
  }, [api, normalizePlans]);

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
      console.warn("[finance] subscription stats:", err.message);
    }
  }, [api]);

  const reloadWithdrawals = useCallback(async () => {
    await safeList("/withdrawals", setWithdrawals, "withdrawals");
    await reloadWithdrawalCount();
  }, [safeList, reloadWithdrawalCount]);

  const reload = useMemo(() => ({
    stats            : () => safe("/stats", setStats),
    payments         : () => safe("/payments", setPayments),
    withdrawals      : reloadWithdrawals,
    logs             : () => safe("/logs", setLogs),
    plans            : reloadPlans,
    subscriptionStats: reloadSubscriptionStats,
    airtimeCount     : reloadAirtimeCount,
  }), [
    safe, reloadWithdrawals, reloadPlans,
    reloadSubscriptionStats, reloadAirtimeCount,
  ]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      safe("/stats",     setStats),
      safe("/payments",  setPayments),
      safeList("/withdrawals", setWithdrawals, "withdrawals"),
      safe("/logs",      setLogs),
      reloadPlans(),
      reloadWithdrawalCount(),
      reloadAirtimeCount(),
      reloadSubscriptionStats(),
    ]);
    setLoading(false);
  }, [
    safe, safeList,
    reloadPlans, reloadWithdrawalCount,
    reloadAirtimeCount, reloadSubscriptionStats,
  ]);

  return {
    stats, payments, withdrawals, plans, logs,
    subscriptionStats, withdrawalPendingCount, airtimePendingCount,
    loading, loadAll, reload,
  };
}

/* ════════════════════════════════════════════════════════════
   useActions — finance-only actions
════════════════════════════════════════════════════════════ */
function useActions(api, reload) {
  const [busy, setBusy] = useState(null);

  const run = useCallback(async (key, fn) => {
    setBusy(key);
    try   { await fn(); }
    catch (err) { console.error("[finance] action:", key, err.message); }
    finally    { setBusy(null); }
  }, []);

  return {
    busy,

    // ── Payments ─────────────────────────────────────────
    refundPayment: (id) => run(`rf-${id}`, async () => {
      await api.post(`/payments/${id}/refund`);
      await reload.payments();
    }),

    // ── Withdrawals ──────────────────────────────────────
    approveWithdrawal: (id) => run(`aw-${id}`, async () => {
      await api.post(`/withdrawals/${id}/approve`);
      await reload.withdrawals();
    }),

    rejectWithdrawal: (id, reason) => run(`rw-${id}`, async () => {
      await api.post(`/withdrawals/${id}/reject`, { reason });
      await reload.withdrawals();
    }),

    markWithdrawalPaid: (id, reference) => run(`mp-${id}`, async () => {
      await api.post(`/withdrawals/${id}/mark-paid`, { reference });
      await reload.withdrawals();
    }),

    // ── Subscriptions ────────────────────────────────────
    cancelSellerSubscription: (userId) => run(`csub-${userId}`, async () => {
      await api.post(`/subscriptions/${userId}/cancel`);
      await reload.subscriptionStats();
    }),

    extendSubscription: (userId, days) => run(`ext-${userId}`, async () => {
      await api.post(`/subscriptions/${userId}/extend`, { days });
      await reload.subscriptionStats();
    }),

    // ── Plans (Finance can create / edit) ────────────────
    savePlan: async (plan) => {
      await run(`plan-${plan.id}`, () =>
        api.put(`/plans/${plan.id}`, {
          name             : plan.name,
          price            : Number(plan.price),
          discount_percent : Number(plan.discount_percent ?? 0),
          duration_days    : Number(plan.duration_days    ?? 30),
          duration         : plan.duration ?? "",
          priority         : Number(plan.priority         ?? 0),
          sort_order       : Number(plan.sort_order       ?? 0),
          is_active        : !!plan.is_active,
          features         : safeFeatures(plan.features),
        }, PAY_BASE),
      );
      await reload.plans();
    },

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
   FINANCE DASHBOARD
════════════════════════════════════════════════════════════ */
export default function FinanceDashboard() {
  const token = useMemo(() => localStorage.getItem("admin_token"), []);
  const api   = useMemo(() => createApi(token), [token]);

  const currentUser = useMemo(() => {
    try {
      const stored = localStorage.getItem("admin");
      if (stored) return JSON.parse(stored);
    } catch {}
    return { id: null, name: null, email: null, role: null };
  }, []);

  const adminName = currentUser?.name || "Finance Admin";

  const [page,       setPage]       = useState("overview");
  const [payQ,       setPayQ]       = useState("");
  const [confirmCfg, setConfirmCfg] = useState(null);

  const confirm = useCallback((cfg) => setConfirmCfg(cfg), []);

  const data    = useData(api);
  const actions = useActions(api, data.reload);

  const filteredPayments = useMemo(() => {
    const q = payQ.toLowerCase();
    return data.payments.filter((p) =>
      `${p.user ?? ""} ${p.reference ?? ""} ${p.status ?? ""}`
        .toLowerCase().includes(q),
    );
  }, [data.payments, payQ]);

  const logRef = useMemo(() => ({ current: data.reload.logs }), []);
  useEffect(() => { logRef.current = data.reload.logs; });

  useEffect(() => {
    data.loadAll();
    const iv = setInterval(() => logRef.current(), LOG_POLL_INTERVAL);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalNotifCount =
    data.withdrawalPendingCount + data.airtimePendingCount;

  if (data.loading) {
    return (
      <>
        <style>{css}</style>
        <div className="loading">
          <span className="live-dot" /> Loading finance panel...
        </div>
      </>
    );
  }

  const pageMap = {

    overview: (
      <FinanceOverview
        stats={data.stats}
        subscriptionStats={data.subscriptionStats}
        payments={data.payments}
        withdrawals={data.withdrawals}
        withdrawalPendingCount={data.withdrawalPendingCount}
        goTo={setPage}
      />
    ),

    payments: (
      <FinancePayments
        filteredPayments={filteredPayments}
        payQ={payQ}
        setPayQ={setPayQ}
        refundPayment={actions.refundPayment}
        busy={actions.busy}
        reloadPayments={data.reload.payments}
        confirm={confirm}
      />
    ),

    withdrawals: (
      <FinanceWithdrawals
        withdrawals={data.withdrawals}
        approveWithdrawal={actions.approveWithdrawal}
        rejectWithdrawal={actions.rejectWithdrawal}
        markWithdrawalPaid={actions.markWithdrawalPaid}
        busy={actions.busy}
        reloadWithdrawals={data.reload.withdrawals}
        confirm={confirm}
      />
    ),

    subscriptions: (
      <FinanceSubscriptions
        api={api}
        subscriptionStats={data.subscriptionStats ?? data.stats.subscriptions}
        cancelSellerSubscription={actions.cancelSellerSubscription}
        extendSubscription={actions.extendSubscription}
        onMutation={data.reload.subscriptionStats}
        busy={actions.busy}
        confirm={confirm}
      />
    ),

    revenue: (
      <FinanceRevenue
        stats={data.stats}
        payments={data.payments}
        subscriptionStats={data.subscriptionStats}
      />
    ),

    plans: (
      <FinancePlans
        plans={data.plans}
        savePlan={actions.savePlan}
        togglePlan={actions.togglePlan}
        busy={actions.busy}
        reloadPlans={data.reload.plans}
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
          role="finance_admin"
          withdrawalPendingCount={data.withdrawalPendingCount}
          airtimePendingCount={data.airtimePendingCount}
          subscriptionActiveCount={data.subscriptionStats?.active ?? 0}
        />
        <div className="main">
          <Topbar
            page={page}
            adminName={adminName}
            notifCount={totalNotifCount}
            roleBadge="Finance"
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