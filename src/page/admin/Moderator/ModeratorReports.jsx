// src/page/admin/Moderator/ModeratorReports.jsx

import { useEffect, useState, useMemo } from "react";
import { fmt, fmtDate } from "../adminlayout/helpers";
import { Pill, Card, Rfr } from "../adminlayout/atoms";
import toast from "react-hot-toast";

export default function ModeratorReports({ api, confirm, onMutation }) {
  const [reports,      setReports]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [busy,         setBusy]         = useState(null);
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("pending");
  const [filterType,   setFilterType]   = useState("all");
  const [selected,     setSelected]     = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/reports");
      setReports(data?.reports || data || []);
    } catch (err) {
      console.warn("[moderator] reports fetch:", err.message);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const stats = useMemo(() => {
    const pending    = reports.filter((r) => r.status === "pending").length;
    const resolved   = reports.filter((r) => r.status === "resolved").length;
    const dismissed  = reports.filter((r) => r.status === "dismissed").length;
    const escalated  = reports.filter((r) => r.status === "escalated").length;
    return { total: reports.length, pending, resolved, dismissed, escalated };
  }, [reports]);

  const types = useMemo(
    () => [...new Set(reports.map((r) => r.report_type || r.type).filter(Boolean))],
    [reports],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return reports.filter((r) => {
      const matchSearch =
        (r.reason ?? "").toLowerCase().includes(q) ||
        (r.reporter_name ?? "").toLowerCase().includes(q) ||
        (r.target_name ?? "").toLowerCase().includes(q);
      const matchStatus = filterStatus === "all" || r.status === filterStatus;
      const matchType   = filterType   === "all" || (r.report_type || r.type) === filterType;
      return matchSearch && matchStatus && matchType;
    });
  }, [reports, search, filterStatus, filterType]);

  const runAction = async (id, action, extra = {}) => {
    setBusy(`${action}-${id}`);
    try {
      await api.post(`/reports/${id}/${action}`, extra);
      toast.success(`Report ${action}d`);
      await load();
      if (onMutation) await onMutation();
      setSelected(null);
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to ${action}`);
    } finally {
      setBusy(null);
    }
  };

  const handleResolve = (r) => {
    const note = prompt("Resolution note (optional):");
    confirm({
      title:   "Resolve Report?",
      body:    `Mark this report as resolved?${note ? `\n\nNote: ${note}` : ""}`,
      confirm: "Yes, Resolve",
      action:  () => runAction(r.id, "resolve", { note }),
    });
  };

  const handleDismiss = (r) => {
    confirm({
      title:   "Dismiss Report?",
      body:    `Dismiss this report as invalid or unfounded?`,
      danger:  true,
      confirm: "Yes, Dismiss",
      action:  () => runAction(r.id, "dismiss"),
    });
  };

  const handleEscalate = (r) => {
    const reason = prompt("Why are you escalating this to senior admins?");
    if (!reason?.trim()) return;

    confirm({
      title:   "Escalate Report?",
      body:    `Send this to senior admins?\n\nReason: ${reason}`,
      confirm: "Yes, Escalate",
      action:  () => runAction(r.id, "escalate", { reason }),
    });
  };

  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <h1>
            🚩 Reports{" "}
            <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "1rem" }}>
              ({fmt(filtered.length)})
            </span>
          </h1>
          <p style={{ color: "var(--muted)", fontSize: ".78rem", marginTop: 4 }}>
            Review and resolve user reports on content and behavior
          </p>
        </div>
        <div className="ph-right">
          <Rfr onClick={load} />
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display             : "grid",
        gridTemplateColumns : "repeat(auto-fit, minmax(140px, 1fr))",
        gap                 : 10,
        marginBottom        : 12,
      }}>
        <StatBox label="Pending"   value={fmt(stats.pending)}   color="#f59e42" />
        <StatBox label="Resolved"  value={fmt(stats.resolved)}  color="#22c55e" />
        <StatBox label="Dismissed" value={fmt(stats.dismissed)} color="#ef4444" />
        <StatBox label="Escalated" value={fmt(stats.escalated)} color="#a855f7" />
        <StatBox label="Total"     value={fmt(stats.total)}     color="#3b82f6" />
      </div>

      {/* Filters */}
      <Card>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            className="input"
            style={{ flex: 2, minWidth: 200 }}
            placeholder="🔍 Search reason, reporter or target…"
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
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
            <option value="escalated">Escalated</option>
          </select>
          <select
            className="input"
            style={{ flex: 1, minWidth: 140 }}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All Types</option>
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
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
                <th>Type</th>
                <th>Target</th>
                <th>Reporter</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Reported</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="empty">Loading reports…</td>
                </tr>
              ) : filtered.map((r) => (
                <tr key={r.id} style={r.status !== "pending" ? { opacity: 0.65 } : {}}>
                  <td>
                    <span style={{
                      padding: "2px 8px",
                      background: "#a855f71a",
                      color: "#a855f7",
                      borderRadius: 4,
                      fontSize: ".7rem",
                      fontWeight: 700,
                      textTransform: "capitalize",
                    }}>
                      {r.report_type || r.type || "other"}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{r.target_name || "—"}</div>
                    <div className="dim" style={{ fontSize: ".65rem" }}>
                      {r.target_type} #{r.target_id?.slice(0, 8)}
                    </div>
                  </td>
                  <td className="dim" style={{ fontSize: ".72rem" }}>
                    {r.reporter_name || "Anonymous"}
                  </td>
                  <td style={{
                    maxWidth: 260,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: ".8rem",
                    cursor: "pointer",
                  }}
                    onClick={() => setSelected(r)}
                    title="Click to see full details"
                  >
                    {r.reason || "—"}
                  </td>
                  <td><Pill s={r.status || "pending"} /></td>
                  <td className="mono dim" style={{ fontSize: ".68rem" }}>
                    {fmtDate(r.created_at)}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {r.status === "pending" && (
                        <>
                          <button
                            className="btn b-solid"
                            style={{ fontSize: ".68rem", padding: "2px 8px" }}
                            disabled={busy === `resolve-${r.id}`}
                            onClick={() => handleResolve(r)}
                          >
                            {busy === `resolve-${r.id}` ? "…" : "Resolve"}
                          </button>
                          <button
                            className="btn b-red"
                            style={{ fontSize: ".68rem", padding: "2px 8px" }}
                            disabled={busy === `dismiss-${r.id}`}
                            onClick={() => handleDismiss(r)}
                          >
                            {busy === `dismiss-${r.id}` ? "…" : "Dismiss"}
                          </button>
                          <button
                            className="btn b-ghost"
                            style={{ fontSize: ".68rem", padding: "2px 8px" }}
                            disabled={busy === `escalate-${r.id}`}
                            onClick={() => handleEscalate(r)}
                            title="Escalate to senior admin"
                          >
                            {busy === `escalate-${r.id}` ? "…" : "⬆"}
                          </button>
                        </>
                      )}
                      <button
                        className="btn b-ghost"
                        style={{ fontSize: ".68rem", padding: "2px 8px" }}
                        onClick={() => setSelected(r)}
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !filtered.length && (
                <tr>
                  <td colSpan={7} className="empty">
                    {filterStatus === "pending"
                      ? "🎉 No pending reports!"
                      : "No reports found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail Modal */}
      {selected && (
        <div
          className="overlay"
          onClick={() => setSelected(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-title">Report Details</div>
            <div style={{ display: "grid", gap: 10, marginTop: 12, fontSize: ".85rem" }}>
              <DetailRow label="Type"       value={selected.report_type || selected.type || "—"} />
              <DetailRow label="Status"     value={<Pill s={selected.status} />} />
              <DetailRow label="Target"     value={`${selected.target_name || "—"} (${selected.target_type})`} />
              <DetailRow label="Reporter"   value={selected.reporter_name || "Anonymous"} />
              <DetailRow label="Reported"   value={fmtDate(selected.created_at)} />
              <div>
                <div style={{ color: "var(--muted)", fontSize: ".72rem", marginBottom: 4 }}>
                  Reason:
                </div>
                <div style={{
                  background: "var(--card2)",
                  padding: "10px 12px",
                  borderRadius: 8,
                  fontSize: ".85rem",
                  lineHeight: 1.5,
                }}>
                  {selected.reason || "No reason provided"}
                </div>
              </div>
              {selected.evidence_url && (
                <div>
                  <div style={{ color: "var(--muted)", fontSize: ".72rem", marginBottom: 4 }}>
                    Evidence:
                  </div>
                  <a
                    href={selected.evidence_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--accent)", fontSize: ".82rem" }}
                  >
                    View evidence →
                  </a>
                </div>
              )}
            </div>
            <div className="modal-btns" style={{ marginTop: 16 }}>
              <button className="btn b-ghost" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "var(--muted)", fontSize: ".78rem" }}>{label}:</span>
      <span style={{ fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
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