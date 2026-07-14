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
      .catch((err) => setError(err?.response?.data?.message ?? "Failed to load audit log."))
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
      <div style={{ display: "flex", gap: 8, alignItems: "center", color: C.muted, fontSize: ".78rem" }}>
        <Spinner size={14} /> Loading audit log…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", gap: 10, alignItems: "center", color: C.red, fontSize: ".78rem" }}>
        {error}
        <button onClick={load} style={{ background: "none", border: "none", cursor: "pointer", color: C.red, textDecoration: "underline", fontFamily: "inherit", fontSize: ".78rem" }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {!logs.length ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: C.muted }}>
          <div style={{ fontSize: "1.8rem", marginBottom: 8 }}>📋</div>
          <p style={{ fontSize: ".78rem" }}>No admin actions recorded yet.</p>
        </div>
      ) : (
        logs.map((log, i) => (
          <div key={log.id ?? i} style={{
            display: "flex", gap: 12, padding: "12px 0",
            borderBottom: i < logs.length - 1 ? `1px solid ${C.border}` : "none",
          }}>
            {/* Admin avatar */}
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: C.orange, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: ".72rem", fontWeight: 700, flexShrink: 0,
            }}>
              {(log.admin_name ?? "?").charAt(0).toUpperCase()}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: ".8rem", fontWeight: 600, color: C.text, marginBottom: 2 }}>
                {log.action ?? "Action"}
              </div>
              <div style={{ fontSize: ".72rem", color: C.muted }}>
                Admin: <strong style={{ color: C.text }}>{log.admin_name ?? "—"}</strong>
                {log.target_user && (
                  <> · Seller: <strong style={{ color: C.text }}>{log.target_user}</strong></>
                )}
                {log.target_email && (
                  <span style={{ marginLeft: 4, color: C.muted }}>({log.target_email})</span>
                )}
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
  const [selectedSub,   setSelectedSub]   = useState(null);
  const [selected,      setSelected]      = useState(new Set());
  const [section,       setSection]       = useState("table");

  /* ── Analytics state ─────────────────────────────────────────────────── */
  const [expiring,    setExpiring]    = useState([]);
  const [revenueData, setRevenueData] = useState({ daily: [], weekly: [], monthly: [] });
  const [churn,       setChurn]       = useState({});
  const [forecast,    setForecast]    = useState({});
  const [topSubs,     setTopSubs]     = useState([]);

  /* ── Filters ─────────────────────────────────────────────────────────── */
  const [filters, setFilters] = useState({
    q:          "",
    plan:       "all",
    status:     "all",
    cycle:      "all",
    auto_renew: "all",
    date_from:  "",
    date_to:    "",
  });

  /* ════════════════════════════════════════════════════════════════════════
     FETCH SUBSCRIPTIONS
  ════════════════════════════════════════════════════════════════════════ */
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
      setError(err?.response?.data?.message ?? err.message ?? "Failed to load subscriptions.");
    } finally {
      setLoading(false);
    }
  }, [api, page, filters]);

  /* ════════════════════════════════════════════════════════════════════════
     FETCH ANALYTICS
  ════════════════════════════════════════════════════════════════════════ */
  const fetchAnalytics = useCallback(async () => {
    const safe = async (path, setter) => {
      try {
        const { data } = await api.get(path, ADM);
        setter(data);
      } catch {
        // Analytics failures are non-critical — silent
      }
    };

    await Promise.allSettled([
      safe("/subscriptions/expiring",
           (d) => setExpiring(d.subscriptions ?? [])),
      safe("/subscriptions/revenue",
           setRevenueData),
      safe("/subscriptions/churn",
           setChurn),
      safe("/subscriptions/forecast",
           setForecast),
      safe("/subscriptions/top-subscribers",
           (d) => setTopSubs(d.subscribers ?? [])),
    ]);
  }, [api]);

  /* ── Trigger fetches ─────────────────────────────────────────────────── */
  useEffect(() => { fetchSubscriptions(); }, [fetchSubscriptions]);
  useEffect(() => { fetchAnalytics();     }, [fetchAnalytics]);

  // Reset page when filters change
  useEffect(() => {
    setPage(filters._page ?? 1);
  }, [filters]);

  /* ════════════════════════════════════════════════════════════════════════
     EXPORT
  ════════════════════════════════════════════════════════════════════════ */
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

      if (!res.ok) throw new Error(`Export failed (${res.status}).`);

      const blob = await res.blob();
      const ext  = format === "pdf" ? "pdf" : format === "excel" ? "xlsx" : "csv";
      downloadBlob(blob, `subscriptions_${Date.now()}.${ext}`);
    } catch (err) {
      alert("Export failed: " + err.message);
    } finally {
      setExporting(null);
    }
  }, [filters]);

  /* ════════════════════════════════════════════════════════════════════════
     QUICK ACTION HANDLER
     Handles both single-row actions and bulk actions from the table.
  ════════════════════════════════════════════════════════════════════════ */
  const handleQuickAction = useCallback((sub, action) => {

    // ── Tab-based actions — open drawer on the right tab ─────────────────
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

    // ── Bulk: Extend ──────────────────────────────────────────────────────
    if (action === "bulkExtend") {
      confirm({
        title   : `Extend ${selected.size} subscription(s)`,
        body    : "Add 30 days to all selected subscriptions? No payment required.",
        confirm : "Extend All",
        action  : async () => {
          await api.post(
            "/subscriptions/bulk/extend",
            { ids: [...selected] },
            ADM
          );
          setSelected(new Set());
          fetchSubscriptions();
          fetchAnalytics();
          onMutation?.();
        },
      });
      return;
    }

    // ── Bulk: Cancel ──────────────────────────────────────────────────────
    if (action === "bulkCancel") {
      confirm({
        title   : `Cancel ${selected.size} subscription(s)`,
        body    : "Cancel all selected subscriptions? Sellers keep access until their expiry date.",
        danger  : true,
        confirm : "Cancel All",
        action  : async () => {
          await api.post(
            "/subscriptions/bulk/cancel",
            { ids: [...selected] },
            ADM
          );
          setSelected(new Set());
          fetchSubscriptions();
          fetchAnalytics();
          onMutation?.();
        },
      });
      return;
    }

    // ── Bulk: Email ───────────────────────────────────────────────────────
    if (action === "bulkEmail") {
      confirm({
        title   : `Send email to ${selected.size} seller(s)`,
        body    : "Send a renewal reminder email to all selected sellers?",
        confirm : "Send",
        action  : async () => {
          await api.post(
            "/subscriptions/bulk/notify",
            { ids: [...selected], type: "renewal_reminder" },
            ADM
          );
          setSelected(new Set());
        },
      });
      return;
    }

    // ── Single-row: Suspend ───────────────────────────────────────────────
    if (action === "suspend") {
      confirm({
        title   : "Suspend Subscription",
        body    : `Suspend ${sub?.user_name ?? "this seller"}'s subscription immediately? Their listings will lose search priority.`,
        danger  : true,
        confirm : "Suspend",
        action  : async () => {
          await api.post(`/subscriptions/${sub.user_id}/suspend`, {}, ADM);
          fetchSubscriptions();
          fetchAnalytics();
          onMutation?.();
        },
      });
      return;
    }

    // ── Single-row: Cancel ────────────────────────────────────────────────
    if (action === "cancel") {
      confirm({
        title   : "Cancel Subscription",
        body    : `Cancel ${sub?.user_name ?? "this seller"}'s subscription? They will retain access until the current period expires.`,
        danger  : true,
        confirm : "Cancel",
        action  : async () => {
          await api.post(`/subscriptions/${sub.user_id}/cancel`, {}, ADM);
          fetchSubscriptions();
          fetchAnalytics();
          onMutation?.();
        },
      });
      return;
    }

    // ── Single-row: Reactivate ────────────────────────────────────────────
    if (action === "reactivate") {
      confirm({
        title   : "Reactivate Subscription",
        body    : `Reactivate ${sub?.user_name ?? "this seller"}'s ${sub?.plan_slug ?? ""} subscription for 30 days? No payment will be charged.`,
        confirm : "Reactivate",
        action  : async () => {
          await api.post(`/subscriptions/${sub.user_id}/reactivate`, {}, ADM);
          fetchSubscriptions();
          fetchAnalytics();
          onMutation?.();
        },
      });
      return;
    }

    // ── Unhandled action — open drawer as fallback ────────────────────────
    if (sub) {
      setSelectedSub({ ...sub, _tab: "actions" });
    }

  }, [api, confirm, selected, fetchSubscriptions, fetchAnalytics, onMutation]);

  /* ════════════════════════════════════════════════════════════════════════
     AFTER DRAWER MUTATION
     Called by DetailDrawer after any successful action inside it.
  ════════════════════════════════════════════════════════════════════════ */
  const handleDrawerMutation = useCallback(() => {
    fetchSubscriptions();
    fetchAnalytics();
    onMutation?.();
  }, [fetchSubscriptions, fetchAnalytics, onMutation]);

  /* ════════════════════════════════════════════════════════════════════════
     STATS (merge prop stats with local shape)
  ════════════════════════════════════════════════════════════════════════ */
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
          <p style={{ fontSize: ".75rem", color: C.muted, margin: "4px 0 0" }}>
            Analytics · Assign · Upgrade · Extend · Cancel · Audit
          </p>
        </div>

        {/* Section toggle + primary action */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4 }}>
            <Btn
              variant={section === "table" ? "primary" : "ghost"}
              onClick={() => setSection("table")}
            >
              Table
            </Btn>
            <Btn
              variant={section === "audit" ? "primary" : "ghost"}
              onClick={() => setSection("audit")}
            >
              Audit Log
            </Btn>
          </div>
        </div>
      </div>

      {/* ── Analytics widgets ─────────────────────────────────────────── */}
      <AnalyticsGrid
        stats={stats}
        revenueData={revenueData}
        expiring={expiring}
        churn={churn}
        forecast={forecast}
        topSubs={topSubs}
        onFilterStatus={(status) =>
          setFilters((f) => ({ ...f, status, _page: 1 }))
        }
      />

      {/* ── Table section ─────────────────────────────────────────────── */}
      {section === "table" && (
        <SubscriptionTable
          // Data
          subscriptions={subscriptions}
          total={total}
          page={page}
          setPage={setPage}
          // States
          loading={loading}
          error={error}
          onRetry={fetchSubscriptions}
          // Filters
          filters={filters}
          setFilters={setFilters}
          // Selection
          selected={selected}
          setSelected={setSelected}
          // Actions
          onView={(sub) => setSelectedSub(sub)}
          onQuickAction={handleQuickAction}
          onExport={handleExport}
          exporting={exporting}
          // Pass api so SubscriptionTable can open AssignPlanModal
          api={api}
        />
      )}

      {/* ── Audit log section ─────────────────────────────────────────── */}
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
                All admin actions on subscriptions — changes, grants, cancellations, refunds.
              </div>
            </div>
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
          onMutation={handleDrawerMutation}
        />
      )}
    </div>
  );
}