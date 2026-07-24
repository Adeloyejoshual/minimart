// src/page/admin/Moderator/ModeratorDashboard.jsx

import { useEffect, useState, useMemo, useCallback } from "react";
import axios from "axios";

// ── Layout ────────────────────────────────────────────────────
import Sidebar from "../adminlayout/Sidebar";
import Topbar  from "../adminlayout/Topbar";
import { css } from "../adminlayout/css";

// ── Reused SuperAdmin pages ──────────────────────────────────
import MarketProducts     from "../SuperAdmin/MarketProducts";
import Verification       from "../SuperAdmin/Verification";
import VendorVerification from "../SuperAdmin/VendorVerification";
import Logs               from "../SuperAdmin/Logs";

// ── Moderator-specific pages ─────────────────────────────────
import ModeratorOverview from "./ModeratorOverview";
import ModeratorProducts from "./ModeratorProducts";
import ModeratorReports  from "./ModeratorReports";

/* ════════════════════════════════════════════════════════════
   ENV + API bases
════════════════════════════════════════════════════════════ */
const BASE = `${import.meta.env.VITE_API_BASE_URL}/api/admin`;

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
   useData — moderator only sees moderation-related data
════════════════════════════════════════════════════════════ */
function useData(api) {
  const [products,        setProducts]        = useState([]);
  const [pending,         setPending]         = useState([]);
  const [marketProducts,  setMarketProducts]  = useState([]);
  const [marketPending,   setMarketPending]   = useState([]);
  const [logs,            setLogs]            = useState([]);

  const [reportCount,              setReportCount]              = useState(0);
  const [marketPendingCount,       setMarketPendingCount]       = useState(0);
  const [verificationPendingCount, setVerificationPendingCount] = useState(0);
  const [vendorPendingCount,       setVendorPendingCount]       = useState(0);
  const [loading,                  setLoading]                  = useState(true);

  const [stats, setStats] = useState({
    totalProducts: 0, pendingProducts: 0, todayProducts: 0,
    marketTotalProducts: 0, marketPendingProducts: 0, marketTodayProducts: 0,
    vendorsTotal: 0, vendorsPending: 0, vendorsActive: 0, vendorsUnderReview: 0,
  });

  const safe = useCallback(async (path, setter) => {
    try {
      const { data } = await api.get(path);
      setter(data);
    } catch (err) {
      console.warn("[moderator] fetch:", path, err.message);
    }
  }, [api]);

  const safeList = useCallback(async (path, setter, key) => {
    try {
      const { data } = await api.get(path);
      const list = Array.isArray(data) ? data : (data?.[key] ?? []);
      setter(list);
    } catch (err) {
      console.warn("[moderator] fetch:", path, err.message);
      setter([]);
    }
  }, [api]);

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

  const reload = useMemo(() => ({
    products : () => Promise.all([
      safe("/products",         setProducts),
      safe("/products/pending", setPending),
      safe("/stats",            setStats),
    ]),
    logs              : () => safe("/logs", setLogs),
    reportCount       : reloadReportCount,
    marketPendingCount: reloadMarketPendingCount,
    verificationCount : reloadVerificationCount,
    vendorCount       : reloadVendorCount,
  }), [
    safe, reloadReportCount, reloadMarketPendingCount,
    reloadVerificationCount, reloadVendorCount,
  ]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      safe("/stats",            setStats),
      safe("/products",         setProducts),
      safe("/products/pending", setPending),
      safe("/logs",             setLogs),
      reloadReportCount(),
      reloadMarketPendingCount(),
      reloadVerificationCount(),
      reloadVendorCount(),
    ]);
    setLoading(false);
  }, [
    safe, reloadReportCount, reloadMarketPendingCount,
    reloadVerificationCount, reloadVendorCount,
  ]);

  return {
    stats, products, pending, marketProducts, marketPending, logs,
    reportCount, marketPendingCount, verificationPendingCount,
    vendorPendingCount, loading, loadAll, reload,
  };
}

/* ════════════════════════════════════════════════════════════
   useActions — moderator can approve/reject products only
════════════════════════════════════════════════════════════ */
function useActions(api, reload) {
  const [busy, setBusy] = useState(null);

  const run = useCallback(async (key, fn) => {
    setBusy(key);
    try   { await fn(); }
    catch (err) { console.error("[moderator] action:", key, err.message); }
    finally    { setBusy(null); }
  }, []);

  return {
    busy,

    approveProduct: (id) => run(`ap-${id}`, async () => {
      await api.post(`/products/${id}/approve`);
      await reload.products();
    }),

    rejectProduct: (id, reason) => run(`rp-${id}`, async () => {
      await api.post(`/products/${id}/reject`, { reason });
      await reload.products();
    }),

    flagProduct: (id, reason) => run(`fp-${id}`, async () => {
      await api.post(`/products/${id}/flag`, { reason });
      await reload.products();
    }),
  };
}

/* ════════════════════════════════════════════════════════════
   MODERATOR DASHBOARD
════════════════════════════════════════════════════════════ */
export default function ModeratorDashboard() {
  const token = useMemo(() => localStorage.getItem("admin_token"), []);
  const api   = useMemo(() => createApi(token), [token]);

  const currentUser = useMemo(() => {
    try {
      const stored = localStorage.getItem("admin");
      if (stored) return JSON.parse(stored);
    } catch {}
    return { id: null, name: null, email: null, role: null };
  }, []);

  const adminName = currentUser?.name || "Moderator";

  const [page,       setPage]       = useState("overview");
  const [productTab, setProductTab] = useState("pending");
  const [productQ,   setProductQ]   = useState("");
  const [confirmCfg, setConfirmCfg] = useState(null);

  const confirm = useCallback((cfg) => setConfirmCfg(cfg), []);

  const data    = useData(api);
  const actions = useActions(api, data.reload);

  const displayedProds = useMemo(() => {
    const q    = productQ.toLowerCase();
    const base = productTab === "pending" ? data.pending : data.products;
    return base.filter((p) =>
      (p.name ?? p.title ?? "").toLowerCase().includes(q) ||
      (p.seller_name ?? "").toLowerCase().includes(q),
    );
  }, [data.products, data.pending, productTab, productQ]);

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
    data.vendorPendingCount;

  if (data.loading) {
    return (
      <>
        <style>{css}</style>
        <div className="loading">
          <span className="live-dot" /> Loading moderator panel...
        </div>
      </>
    );
  }

  const pageMap = {

    overview: (
      <ModeratorOverview
        stats={data.stats}
        pending={data.pending}
        marketPendingCount={data.marketPendingCount}
        reportCount={data.reportCount}
        verificationPendingCount={data.verificationPendingCount}
        vendorPendingCount={data.vendorPendingCount}
        goTo={setPage}
      />
    ),

    products: (
      <ModeratorProducts
        displayedProds={displayedProds}
        products={data.products}
        pending={data.pending}
        productTab={productTab}
        setProductTab={setProductTab}
        productQ={productQ}
        setProductQ={setProductQ}
        approveProduct={actions.approveProduct}
        rejectProduct={actions.rejectProduct}
        flagProduct={actions.flagProduct}
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

    reports: (
      <ModeratorReports
        api={api}
        confirm={confirm}
        onMutation={data.reload.reportCount}
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
          role="content_moderator"
          pendingCount={data.pending.length}
          reportCount={data.reportCount}
          marketPendingCount={data.marketPendingCount}
          verificationPendingCount={data.verificationPendingCount}
          vendorPendingCount={data.vendorPendingCount}
        />
        <div className="main">
          <Topbar
            page={page}
            adminName={adminName}
            notifCount={totalNotifCount}
            roleBadge="Moderator"
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