// src/page/admin/Finance/FinanceSubscriptions.jsx

import { useEffect, useState, useMemo } from "react";
import { fmt, fmtN, fmtDate } from "../adminlayout/helpers";
import { Pill, Card, Rfr } from "../adminlayout/atoms";
import toast from "react-hot-toast";

export default function FinanceSubscriptions({
  api, subscriptionStats,
  cancelSellerSubscription, extendSubscription,
  onMutation, busy, confirm,
}) {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState("active");
  const [filterPlan,    setFilterPlan]    = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/subscriptions");
      setSubscriptions(data?.subscriptions || data || []);
    } catch (err) {
      console.warn("[finance] subs fetch:", err.message);
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const plans = useMemo(
    () => [...new Set(subscriptions.map((s) => s.plan).filter(Boolean))],
    [subscriptions],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return subscriptions.filter((s) => {
      const matchSearch =
        (s.user_name ?? "").toLowerCase().includes(q) ||
        (s.user_email ?? "").toLowerCase().includes(q);
      const matchStatus = filterStatus === "all" || s.status === filterStatus;
      const matchPlan   = filterPlan   === "all" || s.plan   === filterPlan;
      return matchSearch && matchStatus && matchPlan;
    });
  }, [subscriptions, search, filterStatus, filterPlan]);

  const stats = subscriptionStats ?? {
    total: 0, active: 0, expired: 0, cancelled: 0,
    mrr: 0, arr: 0, today: 0,
  };

  const handleCancel = (sub) => {
    confirm({
      title:   "Cancel Subscription?",
      body:    `Cancel "${sub.plan}" subscription for ${sub.user_name}? They will lose access when the current period ends.`,
      danger:  true,
      confirm: "Yes, Cancel",
      action:  async () => {
        try {
          await cancelSellerSubscription(sub.user_id);
          toast.success("Subscription cancelled");
          await load();
          if (onMutation) await onMutation();
        } catch (err) {
          toast.error(err.message || "Cancellation failed");
        }
      },
    });
  };

  const handleExtend = (sub) => {
    const days = prompt(`Extend subscription for ${sub.user_name} by how many days?`, "30");
    if (!days || isNaN(days) || Number(days) < 1) return;

    confirm({
      title:   "Extend Subscription?",
      body:    `Add ${days} days to "${sub.plan}" for ${sub.user_name}?`,
      confirm: "Yes, Extend",
      action:  async () => {
        try {
          await extendSubscription(sub.user_id, Number(days));
          toast.success(`Extended by ${days} days`);
          await load();
          if (onMutation) await onMutation();
        } catch (err) {
          toast.error(err.message || "Extension failed");
        }
      },
    });
  };

  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <h1>
            Subscriptions{" "}
            <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "1rem" }}>
              ({fmt(filtered.length)})
            </span>
          </h1>
          <p style={{ color: "var(--muted)", fontSize: ".78rem", marginTop: 4 }}>
            Manage seller subscription lifecycles and billing
          </p>
        </div>
        <div className="ph-right">
          <Rfr onClick={load} />
        </div>
      </div>

      {/* Revenue Stats */}
      <div style={{
        display             : "grid",
        gridTemplateColumns : "repeat(auto-fit, minmax(160px, 1fr))",
        gap                 : 10,
        marginBottom        : 12,
      }}>
        <StatBox label="MRR"       value={fmtN(stats.mrr)}      color="#22c55e" />
        <StatBox label="ARR"       value={fmtN(stats.arr)}      color="#3b82f6" />
        <StatBox label="Active"    value={fmt(stats.active)}    color="#22c55e" />
        <StatBox label="Expired"   value={fmt(stats.expired)}   color="#f59e42" />
        <StatBox label="Cancelled" value={fmt(stats.cancelled)} color="#ef4444" />
        <StatBox label="New Today" value={fmt(stats.today)}     color="#a855f7" />
      </div>

      {/* Filters */}
      <Card>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="input"
            style={{ flex: 2, minWidth: 200 }}
            placeholder="🔍 Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input"
            style={{ flex: 1, minWidth: 140 }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
            <option value="trial">Trial</option>
          </select>
          <select
            className="input"
            style={{ flex: 1, minWidth: 140 }}
            value={filterPlan}
            onChange={(e) => setFilterPlan(e.target.value)}
          >
            <option value="all">All Plans</option>
            {plans.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Cycle</th>
                <th>Started</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="empty">Loading subscriptions…</td>
                </tr>
              ) : filtered.map((s) => {
                const isActive  = s.status === "active";
                const isExpired = s.status === "expired";
                const daysLeft  = s.expires_at
                  ? Math.ceil((new Date(s.expires_at) - new Date()) / 86_400_000)
                  : null;

                return (
                  <tr key={s.id} style={!isActive ? { opacity: 0.65 } : {}}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{s.user_name || "—"}</div>
                      <div className="mono dim" style={{ fontSize: ".65rem" }}>
                        {s.user_email}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        padding: "2px 8px",
                        background: "#3b82f61a",
                        color: "#3b82f6",
                        borderRadius: 4,
                        fontSize: ".72rem",
                        fontWeight: 700,
                      }}>
                        {s.plan || "—"}
                      </span>
                    </td>
                    <td><Pill s={s.status || "active"} /></td>
                    <td className="mono" style={{ color: "var(--green)", fontWeight: 700 }}>
                      {fmtN(s.amount)}
                    </td>
                    <td className="dim" style={{ fontSize: ".72rem" }}>
                      {s.billing_cycle || "—"}
                    </td>
                    <td className="mono dim" style={{ fontSize: ".68rem" }}>
                      {fmtDate(s.started_at || s.created_at)}
                    </td>
                    <td className="mono dim" style={{ fontSize: ".68rem" }}>
                      {s.expires_at ? (
                        <>
                          {fmtDate(s.expires_at)}
                          {isActive && daysLeft !== null && (
                            <div style={{
                              fontSize: ".62rem",
                              color: daysLeft < 7 ? "#ef4444" : "var(--muted)",
                              fontWeight: 600,
                            }}>
                              {daysLeft > 0 ? `${daysLeft}d left` : "Expired"}
                            </div>
                          )}
                        </>
                      ) : "—"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          className="btn b-ghost"
                          style={{ fontSize: ".7rem", padding: "2px 8px" }}
                          disabled={busy === `ext-${s.user_id}`}
                          onClick={() => handleExtend(s)}
                        >
                          {busy === `ext-${s.user_id}` ? "…" : "Extend"}
                        </button>
                        {isActive && (
                          <button
                            className="btn b-red"
                            style={{ fontSize: ".7rem", padding: "2px 8px" }}
                            disabled={busy === `csub-${s.user_id}`}
                            onClick={() => handleCancel(s)}
                          >
                            {busy === `csub-${s.user_id}` ? "…" : "Cancel"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && !filtered.length && (
                <tr>
                  <td colSpan={8} className="empty">No subscriptions match.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{
      background   : "var(--card)",
      border       : "1px solid var(--border)",
      borderRadius : 10,
      padding      : "12px 14px",
    }}>
      <div style={{
        fontSize      : ".65rem",
        color         : "var(--muted)",
        textTransform : "uppercase",
        fontWeight    : 700,
      }}>
        {label}
      </div>
      <div style={{
        fontSize   : "1.3rem",
        fontWeight : 800,
        color,
        marginTop  : 4,
      }}>
        {value}
      </div>
    </div>
  );
}