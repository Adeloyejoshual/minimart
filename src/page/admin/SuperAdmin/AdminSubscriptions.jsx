import { useState, useEffect, useCallback, useMemo } from "react";

import { AnalyticsGrid }     from "../components/subscriptions/DashboardWidgets.jsx";
import { DetailDrawer }      from "../components/subscriptions/DetailDrawer.jsx";
import { SubscriptionTable } from "../components/subscriptions/SubscriptionTable.jsx";
import {
  C, GLOBAL_CSS, downloadBlob,
  Btn, Spinner,
} from "../components/subscriptions/SubscriptionUI.jsx";

const ADM   = `${import.meta.env.VITE_API_BASE_URL}/api/admin`;
const LIMIT = 20;

/* ─── Section config ─────────────────────────────────────────────────────── */
const SECTIONS = [
  { id: "analytics", label: "Analytics", icon: "📊" },
  { id: "table",     label: "Subscriptions", icon: "📋" },
  { id: "audit",     label: "Audit Log",  icon: "🔍" },
];

/* ═══════════════════════════════════════════════════════════════════════════
   AUDIT LOG PANEL
═══════════════════════════════════════════════════════════════════════════ */
function AuditLog({ api }) {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get("/subscriptions/audit-log", ADM)
      .then(({ data }) => setLogs(data.logs ?? []))
      .catch((err) => setError(err?.response?.data?.message ?? "Failed to load."))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const fmtTime = (d) =>
    d ? new Date(d).toLocaleString("en-NG", {
          year: "numeric", month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit",
        })
      : "—";

  if (loading) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", color: C.muted, fontSize: ".78rem", padding: "20px 0" }}>
        <Spinner size={14} /> Loading audit log…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", gap: 10, alignItems: "center", color: C.red, fontSize: ".78rem", padding: "12px 0" }}>
        ⚠ {error}
        <button onClick={load} style={{ background: "none", border: "none", cursor: "pointer", color: C.red, textDecoration: "underline", fontFamily: "inherit", fontSize: ".78rem" }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {!logs.length ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>📋</div>
          <p style={{ fontSize: ".78rem" }}>No admin actions recorded yet.</p>
          <p style={{ fontSize: ".7rem", color: C.muted }}>Actions like assign, upgrade, extend, cancel will appear here.</p>
        </div>
      ) : (
        logs.map((log, i) => (
          <div key={log.id ?? i} style={{
            display: "flex", gap: 12, padding: "12px 0",
            borderBottom: i < logs.length - 1 ? `1px solid ${C.border}` : "none",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: C.orange, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: ".72rem", fontWeight: 700, flexShrink: 0,
            }}>
              {(log.admin_name ?? "?").charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: ".8rem", fontWeight: 600, color: C.text, marginBottom: 2 }}>
                {log.action ?? "Action"}
              </div>
              <div style={{ fontSize: ".72rem", color: C.muted }}>
                Admin: <strong style={{ color: C.text }}>{log.admin_name ?? "—"}</strong>
                {log.target_user && <> · Seller: <strong style={{ color: C.text }}>{log.target_user}</strong></>}
              </div>
              {log.detail && (
                <div style={{ fontSize: ".68rem", color: C.muted, marginTop: 2, fontStyle: "italic" }}>
                  {log.detail}
                </div>
              )}
              <div style={{ fontSize: ".65rem", color: C.muted, marginTop: 3 }}>
                {fmtTime(log.created_at)}
              </div>
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
  /* ── Core state ──────────────────────────────────────────────────────── */
  const [subscriptions, setSubscriptions] = useState([]);
  const [total,         setTotal]         = useState(0);
  const [page,          setPage]          = useState(1);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [exporting,     setExporting]     = useState(null);

  /* ── UI state ────────────────────────────────────────────────────────── */
  const [selectedSub, setSelectedSub] = useState(null);
  const [selected,    setSelected]    = useState(new Set());
  const [section,     setSection]     = useState("table");

  /* ── Analytics state ─────────────────────────────────────────────────── */
  const [expiring,    setExpiring]    = useState([]);
  const [revenueData, setRevenueData] = useState({ daily: [], weekly: [], monthly: [] });
  const [churn,       setChurn]       = useState({});
  const [forecast,    setForecast]    = useState({});
  const [topSubs,     setTopSubs]     = useState([]);

  /* ── Filters ─────────────────────────────────────────────────────────── */
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
    } finally {
      setLoading(false);
    }
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

  /* ── Refresh all ─────────────────────────────────────────────────────── */
  const refreshAll = useCallback(() => {
    fetchSubscriptions();
    fetchAnalytics();
    onMutation?.();
  }, [fetchSubscriptions, fetchAnalytics, onMutation]);

  /* ── Export ──────────────────────────────────────────────────────────── */
  const handleExport = useCallback(async (format, ids = null) => {
    setExporting(format);
    try {
      const params = new URLSearchParams({ format });
      if (filters.plan   !== "all") params.set("plan",   filters.plan);
      if (filters.status !== "all") params.set("status", filters.status);
      if (filters.q?.trim())        params.set("q",      filters.q.trim());
      if (ids)                      params.set("ids",    ids.join(","));

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
      changePlan:  "actions",
      extend:      "actions",
      toggleRenew: "actions",
      grant:       "actions",
      payments:    "payments",
      overrides:   "overrides",
      sendEmail:   "actions",
    };

    if (tabMap[action]) {
      setSelectedSub({ ...sub, _tab: tabMap[action] });
      return;
    }

    // Bulk actions
    const bulkActions = {
      bulkExtend: {
        title: `Extend ${selected.size} subscription(s)`,
        body: "Add 30 days to all selected? No payment required.",
        confirm: "Extend All",
        fn: () => api.post("/subscriptions/bulk/extend", { ids: [...selected] }, ADM),
      },
      bulkCancel: {
        title: `Cancel ${selected.size} subscription(s)`,
        body: "Cancel all selected? Sellers keep access until expiry.",
        danger: true, confirm: "Cancel All",
        fn: () => api.post("/subscriptions/bulk/cancel", { ids: [...selected] }, ADM),
      },
      bulkEmail: {
        title: `Email ${selected.size} seller(s)`,
        body: "Send renewal reminder to all selected sellers?",
        confirm: "Send",
        fn: () => api.post("/subscriptions/bulk/notify", { ids: [...selected], type: "renewal_reminder" }, ADM),
      },
    };

    if (bulkActions[action]) {
      const cfg = bulkActions[action];
      confirm({
        ...cfg,
        action: async () => {
          await cfg.fn();
          setSelected(new Set());
          refreshAll();
        },
      });
      return;
    }

    // Single row actions
    const singleActions = {
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
    };

    const cfg = singleActions[action];
    if (cfg) {
      confirm({
        ...cfg,
        action: async () => { await cfg.fn(); refreshAll(); },
      });
      return;
    }

    // Fallback — open drawer on actions tab
    if (sub) setSelectedSub({ ...sub, _tab: "actions" });
  }, [api, confirm, selected, refreshAll]);

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

      {/* ── Page header ───────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 20, flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <h2 style={{ fontSize: "1.08rem", fontWeight: 700, margin: 0, color: C.text }}>
            Seller Subscriptions
          </h2>

          {/* ── Quick nav links — THESE ARE NOW CLICKABLE ────────────── */}
          <div style={{
            display: "flex", gap: 4, alignItems: "center",
            marginTop: 6, flexWrap: "wrap",
          }}>
            {[
              { label: "Analytics",  action: () => setSection("analytics") },
              { label: "Assign",     action: () => {
                // Switch to table section and trigger assign modal
                setSection("table");
                // Delay slightly so table renders first
                setTimeout(() => {
                  document.querySelector("[data-assign-btn]")?.click();
                }, 100);
              }},
              { label: "Upgrade",    action: () => {
                if (subscriptions.length) {
                  setSelectedSub({ ...subscriptions[0], _tab: "actions" });
                } else {
                  setSection("table");
                }
              }},
              { label: "Extend",     action: () => {
                if (subscriptions.length) {
                  setSelectedSub({ ...subscriptions[0], _tab: "actions" });
                } else {
                  setSection("table");
                }
              }},
              { label: "Cancel",     action: () => {
                if (subscriptions.length) {
                  setSelectedSub({ ...subscriptions[0], _tab: "actions" });
                } else {
                  setSection("table");
                }
              }},
              { label: "Audit",      action: () => setSection("audit") },
            ].map((item, i, arr) => (
              <span key={item.label} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={item.action}
                  style={{
                    background: "none", border: "none", padding: 0,
                    cursor: "pointer", fontFamily: "inherit",
                    fontSize: ".72rem", fontWeight: 500,
                    color: C.orange,
                    textDecoration: "none",
                    transition: "color .12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                >
                  {item.label}
                </button>
                {i < arr.length - 1 && (
                  <span style={{ color: C.muted, fontSize: ".65rem" }}>·</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Section tabs */}
        <div style={{ display: "flex", gap: 4 }}>
          {SECTIONS.map((s) => (
            <Btn
              key={s.id}
              variant={section === s.id ? "primary" : "ghost"}
              onClick={() => setSection(s.id)}
              style={{ fontSize: ".72rem", padding: "5px 12px" }}
            >
              {s.icon} {s.label}
            </Btn>
          ))}
        </div>
      </div>

      {/* ── Analytics section ─────────────────────────────────────────── */}
      {section === "analytics" && (
        <AnalyticsGrid
          stats={stats}
          revenueData={revenueData}
          expiring={expiring}
          churn={churn}
          forecast={forecast}
          topSubs={topSubs}
          onFilterStatus={(status) => {
            setFilters((f) => ({ ...f, status, _page: 1 }));
            setSection("table");
          }}
        />
      )}

      {/* ── Table section ─────────────────────────────────────────────── */}
      {section === "table" && (
        <SubscriptionTable
          subscriptions={subscriptions}
          total={total}
          page={page}
          setPage={setPage}
          loading={loading}
          error={error}
          onRetry={refreshAll}
          filters={filters}
          setFilters={setFilters}
          selected={selected}
          setSelected={setSelected}
          onView={(sub) => setSelectedSub(sub)}
          onQuickAction={handleQuickAction}
          onExport={handleExport}
          exporting={exporting}
          api={api}
        />
      )}

      {/* ── Audit section ─────────────────────────────────────────────── */}
      {section === "audit" && (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 10, padding: "18px 20px",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 16,
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: ".88rem" }}>🔍 Admin Audit Log</div>
              <div style={{ fontSize: ".72rem", color: C.muted, marginTop: 2 }}>
                All admin actions — assign, upgrade, extend, cancel, refund.
              </div>
            </div>
            <Btn variant="ghost" onClick={() => setSection("table")} style={{ fontSize: ".72rem" }}>
              ← Back to Table
            </Btn>
          </div>
          <AuditLog api={api} />
        </div>
      )}

      {/* ── Detail drawer ─────────────────────────────────────────────── */}
      {selectedSub && (
        <DetailDrawer
          sub={selectedSub}
          api={api}
          confirm={confirm}
          onClose={() => setSelectedSub(null)}
          onMutation={refreshAll}
        />
      )}
    </div>
  );
}