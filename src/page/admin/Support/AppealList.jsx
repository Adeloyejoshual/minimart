// ════════════════════════════════════════════════════════════
// FILE: src/pages/admin/Support/AppealList.jsx
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const BASE  = `${import.meta.env.VITE_API_BASE_URL}/api/admin/support`;
const token = () => localStorage.getItem("admin_token");
const auth  = () => ({ headers: { Authorization: `Bearer ${token()}` } });

const STATUS_OPTIONS = ["","pending","under_review","approved","rejected","closed"];
const TYPE_OPTIONS   = ["","suspended_account","removed_listing","rejected_listing","enforcement_action","other"];

const STATUS_CFG = {
  pending:      { bg: "#FEF9C3", fg: "#D97706" },
  under_review: { bg: "#EFF6FF", fg: "#2563EB" },
  approved:     { bg: "#DCFCE7", fg: "#15803D" },
  rejected:     { bg: "#FEF2F2", fg: "#DC2626" },
  closed:       { bg: "#F3F4F6", fg: "#6B7280" },
};

function Chip({ value, map }) {
  const c = (map ?? {})[value] ?? { bg: "#F3F4F6", fg: "#6B7280" };
  return <span style={{ background: c.bg, color: c.fg, padding: "2px 9px", borderRadius: 100, fontSize: 11, fontWeight: 700, textTransform: "capitalize" }}>{String(value ?? "").replace(/_/g, " ")}</span>;
}

function fmt(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }

export default function AppealList() {
  const [appeals,    setAppeals]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [total,      setTotal]      = useState(0);
  const [page,       setPageNum]    = useState(1);
  const [status,     setStatus]     = useState("");
  const [appealType, setAppealType] = useState("");
  const [expanded,   setExpanded]   = useState(null);
  const [notes,      setNotes]      = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit: 20 });
      if (status)     p.set("status",      status);
      if (appealType) p.set("appeal_type", appealType);
      const { data } = await axios.get(`${BASE}/appeals?${p}`, auth());
      setAppeals(data.appeals ?? []);
      setTotal(data.pagination?.total ?? 0);
    } catch (e) { console.warn("[AppealList]", e.message); }
    finally     { setLoading(false); }
  }, [page, status, appealType]);

  useEffect(() => { load(); }, [load]);

  async function decide(id, decision) {
    await axios.patch(`${BASE}/appeals/${id}`, { status: decision, decision_notes: notes[id] ?? null }, auth());
    load();
  }

  const pages = Math.ceil(total / 20);

  return (
    <div className="sp-wrap">
      <div className="sp-header">
        <div><h1 className="sp-title">Appeals</h1><p className="sp-sub">{total} total</p></div>
      </div>

      <div className="sp-filters">
        <select value={status}     onChange={(e) => { setStatus(e.target.value);     setPageNum(1); }}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s ? s.replace(/_/g, " ") : "All Statuses"}</option>)}
        </select>
        <select value={appealType} onChange={(e) => { setAppealType(e.target.value); setPageNum(1); }}>
          {TYPE_OPTIONS.map((t)   => <option key={t} value={t}>{t ? t.replace(/_/g, " ") : "All Types"}</option>)}
        </select>
      </div>

      {loading ? <div className="sp-loading">Loading appeals…</div> : (
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead>
              <tr><th>Reference</th><th>User</th><th>Type</th><th>Subject</th><th>Status</th><th>Date</th><th>Review</th></tr>
            </thead>
            <tbody>
              {appeals.length === 0
                ? <tr><td colSpan={7} className="sp-empty">No appeals found</td></tr>
                : appeals.map((a) => (
                    <>
                      <tr key={a.id}>
                        <td><span className="sp-mono">{a.appeal_number}</span></td>
                        <td><p className="sp-name">{a.user_name ?? "—"}</p><p className="sp-email">{a.user_email ?? ""}</p></td>
                        <td><span className="sp-tag">{a.appeal_type?.replace(/_/g, " ")}</span></td>
                        <td className="sp-subject">{a.subject}</td>
                        <td><Chip value={a.status} map={STATUS_CFG} /></td>
                        <td className="sp-date">{fmt(a.created_at)}</td>
                        <td>
                          <button className="sp-btn-ghost sp-btn-xs" onClick={() => setExpanded(expanded === a.id ? null : a.id)}>
                            {expanded === a.id ? "Collapse" : "Review"}
                          </button>
                        </td>
                      </tr>
                      {expanded === a.id && (
                        <tr key={`${a.id}-exp`}>
                          <td colSpan={7}>
                            <div className="sp-expanded">
                              <p className="sp-exp-label">Description</p>
                              <p className="sp-exp-text">{a.description}</p>
                              {a.reference_id && (
                                <p className="sp-exp-label" style={{ marginTop: 6 }}>Reference: <strong>{a.reference_id}</strong></p>
                              )}
                              <p className="sp-exp-label" style={{ marginTop: 10 }}>Decision Notes</p>
                              <textarea
                                className="sp-reply-ta"
                                rows={2}
                                placeholder="Explain your decision…"
                                value={notes[a.id] ?? ""}
                                onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                              />
                              {["pending","under_review"].includes(a.status) && (
                                <div className="sp-actions" style={{ marginTop: 8 }}>
                                  <button className="sp-btn-ghost sp-btn-xs" onClick={() => decide(a.id, "under_review")}>Under Review</button>
                                  <button className="sp-btn-solid sp-btn-xs" onClick={() => decide(a.id, "approved")}>Approve</button>
                                  <button className="sp-btn-danger sp-btn-xs" onClick={() => decide(a.id, "rejected")}>Reject</button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
              }
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="sp-pagination">
          <button className="sp-btn-ghost sp-btn-sm" disabled={page === 1} onClick={() => setPageNum((p) => p - 1)}>Prev</button>
          <span className="sp-page-info">Page {page} of {pages}</span>
          <button className="sp-btn-ghost sp-btn-sm" disabled={page >= pages} onClick={() => setPageNum((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}