import { useState, useEffect, useCallback, useMemo } from "react";

import { AnalyticsGrid }     from "../components/subscriptions/DashboardWidgets.jsx";
import { DetailDrawer }      from "../components/subscriptions/DetailDrawer.jsx";
import { SubscriptionTable } from "../components/subscriptions/SubscriptionTable.jsx";
import {
  C, GLOBAL_CSS, naira, downloadBlob,
  Btn, Spinner,
} from "../components/subscriptions/SubscriptionUI.jsx";

const ADM   = `${import.meta.env.VITE_API_BASE_URL}/api/admin`;
const LIMIT = 20;

/* ─── Audit Log panel ────────────────────────────────────────────────────── */
function AuditLog({ api }) {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/subscriptions/audit-log", ADM)
      .then(({ data }) => setLogs(data.logs ?? []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [api]);

  const fmtTime = (d) =>
    d ? new Date(d).toLocaleString("en-NG", {
          year: "numeric", month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit",
        })
      : "—";

  if (loading) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", color: C.muted, fontSize: ".78rem" }}>
        <Spinner size={14} /> Loading audit log…
      </div>
    );
  }

  return (
    <div>
      {!logs.length ? (
        <p style={{ color: C.muted, fontSize: ".78rem" }}>No audit entries yet.</p>
      ) : (
        logs.map((log, i) => (
          <div key={i} style={{
            display: "flex", gap: 12, padding: "10px 0",
            borderBottom: i < logs.length - 1 ? `1px solid ${C.border}` : "none",
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%", background: C.bg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: ".72rem", fontWeight: 700, color: C.orange, flexShrink: 0,
            }}>
              {(log.admin_name ?? "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: ".78rem", fontWeight: 600 }}>{log.action ?? "Action"}</div>
              <div style={{ fontSize: ".7rem", color: C.muted }}>
                Admin: <strong>{log.admin_name ?? "—"}</strong>
                {log.target_user && <> · Seller: <strong>{log.target_user}</strong></>}
              </div>
              {log.detail && <div style={{ fontSize: ".68rem", color: C.muted }}>{log.detail}</div>}
              <div style={{ fontSize: ".66rem", color: C.muted, marginTop: 2 }}>{fmtTime(log.created_at)}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export default function AdminSubscriptions({
  api,
  subscriptionStats,
  onMutation,
  confirm,
}) {
  /* ── State ──────────────────────────────────────────────────────────── */
  const [subscriptions, setSubscriptions] = useState([]);
  const [total,         setTotal]         = useState(0);
  const [page,          setPage]          = useState(1);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [exporting,     setExporting]     = useState(null);

  const [selectedSub,   setSelectedSub]   = useState(null);
  const [selected,      setSelected]      = useState(new Set());
  const [section,       setSection]       = useState("table");

  const [expiring,     setExpiring]     = useState([]);
  const [revenueData,  setRevenueData]  = useState({ daily: [], weekly: [], monthly: [] });
  const [churn,        setChurn]        = useState({});
  const [forecast,     setForecast]     = useState({});
  const [topSubs,      setTopSubs]      = useState([]);

  const [filters, setFilters] = useState({
    q: "", plan: "all", status: "all",
    cycle: "all", auto_renew: "all",
    date_from: "", date_to: "",
  });

  /* ── Fetch subscriptions ─────────────────────────────────────────────── */
  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      const f = filters;
      if (f.plan       && f.plan       !== "all") params.set("plan",       f.plan);
      if (f.status     && f.status     !== "all") params.set("status",     f.status);
      if (f.cycle      && f.cycle      !== "all") params.set("cycle",      f.cycle);
      if (f.auto_renew && f.auto_renew !== "all") params.set("auto_renew", f.auto_renew);
      if (f.date_from)                             params.set("date_from",  f.date_from);
      if (f.date_to)                               params.set("date_to",    f.date_to);
      if (f.q?.trim())                             params.set("q",          f.q.trim());

      const { data } = await api.get(`/subscriptions?${params}`, ADM);
      setSubscriptions(data.subscriptions ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err?.response?.data?.message ?? err.message ?? "Failed to load.");
    } finally { setLoading(false); }
  }, [api, page, filters]);

  /* ── Fetch analytics ─────────────────────────────────────────────────── */
  const fetchAnalytics = useCallback(async () => {
    const safe = async (path, setter) => {
      try { const { data } = await api.get(path, ADM); setter(data); } catch {}
    };
    await Promise.allSettled([
      safe("/subscriptions/expiring",        (d) => setExpiring(d.subscriptions ?? [])),
      safe("/subscriptions/revenue",         setRevenueData),
      safe("/subscriptions/churn",           setChurn),
      safe("/subscriptions/forecast",        setForecast),
      safe("/subscriptions/top-subscribers", (d) => setTopSubs(d.subscribers   ?? [])),
    ]);
  }, [api]);

  useEffect(() => { fetchSubscriptions(); }, [fetchSubscriptions]);
  useEffect(() => { fetchAnalytics();     }, [fetchAnalytics]);
  useEffect(() => { setPage(filters._page ?? 1); }, [filters]);

  /* ── Export ──────────────────────────────────────────────────────────── */
  const handleExport = useCallback(async (format, ids = null) => {
    setExporting(format);
    try {
      const params = new URLSearchParams({ format,
        ...(filters.plan   !== "all" && { plan:   filters.plan   }),
        ...(filters.status !== "all" && { status: filters.status }),
        ...(filters.q?.trim()        && { q:      filters.q.trim()}),
        ...(ids                      && { ids:    ids.join(",")   }),
      });
      const token = localStorage.getItem("admin_token");
      const res   = await fetch(`${ADM}/subscriptions/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed.");
      const blob = await res.blob();
      const ext  = format === "pdf" ? "pdf" : format === "excel" ? "xlsx" : "csv";
      downloadBlob(blob, `subscriptions_${Date.now()}.${ext}`);
    } catch (err) { alert("Export failed: " + err.message); }
    finally { setExporting(null); }
  }, [filters]);

  /* ── Quick action handler ────────────────────────────────────────────── */
  const handleQuickAction = useCallback((sub, action) => {
    const tabMap = {
      changePlan : "actions",
      extend     : "actions",
      toggleRenew: "actions",
      grant      : "actions",
      payments   : "payments",
      overrides  : "overrides",
      sendEmail  : "actions",
    };

    if (tabMap[action]) {
      setSelectedSub({ ...sub, _tab: tabMap[action] });
      return;
    }

    // Bulk actions
    if (action === "bulkExtend") {
      confirm({
        title: `Extend ${selected.size} subscriptions`,
        body: "Extend all selected subscriptions by 30 days?",
        confirm: "Extend",
        action: async () => {
          await api.post("/subscriptions/bulk/extend", { ids: [...selected] }, ADM);
          setSelected(new Set());
          fetchSubscriptions();
          onMutation?.();
        },
      });
      return;
    }

    if (action === "bulkCancel") {
      confirm({
        title: `Cancel ${selected.size} subscriptions`, danger: true,
        body: "Cancel all selected subscriptions?",
        confirm: "Cancel All",
        action: async () => {
          await api.post("/subscriptions/bulk/cancel", { ids: [...selected] }, ADM);
          setSelected(new Set());
          fetchSubscriptions();
          onMutation?.();
        },
      });
      return;
    }

    if (action === "bulkEmail") {
      confirm({
        title: `Email ${selected.size} sellers`,
        body: "Send a renewal reminder to all selected sellers?",
        confirm: "Send",
        action: async () => {
          await api.post("/subscriptions/bulk/notify", { ids: [...selected], type: "renewal_reminder" }, ADM);
          setSelected(new Set());
        },
      });
      return;
    }

    // Single-row actions
    const cfg = {
      suspend: {
        title: "Suspend Subscription", danger: true, confirm: "Suspend",
        body: `Suspend ${sub?.user_name}'s subscription immediately?`,
        fn: () => api.post(`/subscriptions/${sub.user_id}/suspend`, {}, ADM),
      },
      cancel: {
        title: "Cancel Subscription", danger: true, confirm: "Cancel",
        body: `Cancel ${sub?.user_name}'s subscription?`,
        fn: () => api.post(`/subscriptions/${sub.user_id}/cancel`, {}, ADM),
      },
      reactivate: {
        title: "Reactivate Subscription", confirm: "Reactivate",
        body: `Reactivate ${sub?.user_name}'s subscription for 30 days?`,
        fn: () => api.post(`/subscriptions/${sub.user_id}/reactivate`, {}, ADM),
      },
    }[action];

    if (cfg) {
      confirm({
        ...cfg,
        action: async () => {
          await cfg.fn();
          fetchSubscriptions();
          fetchAnalytics();
          onMutation?.();
        },
      });
    }
  }, [api, confirm, selected, fetchSubscriptions, fetchAnalytics, onMutation]);

  /* ── Stats ───────────────────────────────────────────────────────────── */
  const stats = useMemo(() => ({
    ...(subscriptionStats ?? {}),
    byPlan: subscriptionStats?.byPlan ?? {},
  }), [subscriptionStats]);

  /* ════════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════════ */
  return (
    <div>
      <style>{GLOBAL_CSS}</style>

      {/* Page header */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        marginBottom: 20, flexWrap: "wrap", gap: 10,
      }}>
        <div>
          <h2 style={{ fontSize: "1.08rem", fontWeight: 700, margin: 0 }}>Seller Subscriptions</h2>
          <p style={{ fontSize: ".75rem", color: C.muted, margin: "3px 0 0" }}>
            Analytics · Upgrade · Extend · Cancel · Audit
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Btn variant={section === "table" ? "primary" : "ghost"} onClick={() => setSection("table")}>
            Table
          </Btn>
          <Btn variant={section === "audit" ? "primary" : "ghost"} onClick={() => setSection("audit")}>
            Audit Log
          </Btn>
        </div>
      </div>

      {/* Analytics */}
      <AnalyticsGrid
        stats={stats}
        revenueData={revenueData}
        expiring={expiring}
        churn={churn}
        forecast={forecast}
        topSubs={topSubs}
        onFilterStatus={(status) => setFilters((f) => ({ ...f, status, _page: 1 }))}
      />

      {/* Table / Audit */}
      {section === "audit" ? (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 10, padding: "16px 18px",
        }}>
          <div style={{ fontWeight: 700, fontSize: ".85rem", marginBottom: 14 }}>🔍 Admin Audit Log</div>
          <AuditLog api={api} />
        </div>
      ) : (
        <SubscriptionTable
          subscriptions={subscriptions}
          total={total}
          page={page}
          setPage={setPage}
          loading={loading}
          error={error}
          onRetry={fetchSubscriptions}
          filters={filters}
          setFilters={setFilters}
          selected={selected}
          setSelected={setSelected}
          onView={(sub) => setSelectedSub(sub)}
          onQuickAction={handleQuickAction}
          onExport={handleExport}
          exporting={exporting}
        />
      )}

      {/* Detail drawer */}
      {selectedSub && (
        <DetailDrawer
          sub={selectedSub}
          api={api}
          confirm={confirm}
          onClose={() => setSelectedSub(null)}
          onMutation={() => {
            fetchSubscriptions();
            fetchAnalytics();
            onMutation?.();
          }}
        />
      )}
    </div>
  );
}