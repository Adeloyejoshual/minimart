// ════════════════════════════════════════════════════════════
// FILE: src/pages/admin/Support/ReportList.jsx
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const BASE  = `${import.meta.env.VITE_API_BASE_URL}/api/admin/support`;
const token = () => localStorage.getItem("admin_token");
const auth  = () => ({ headers: { Authorization: `Bearer ${token()}` } });

const STATUS_OPTIONS = ["","pending","under_review","resolved","dismissed"];
const TYPE_OPTIONS   = ["","scam","fraud","fake_product","fake_seller","fake_buyer","offensive_content","copyright_violation","payment_issue","delivery_issue","technical_bug","other"];

const STATUS_CFG = {
  pending:      { bg: "#FEF9C3", fg: "#D97706" },
  under_review: { bg: "#EFF6FF", fg: "#2563EB" },
  resolved:     { bg: "#DCFCE7", fg: "#15803D" },
  dismissed:    { bg: "#F3F4F6", fg: "#6B7280" },
};

function Chip({ value, map }) {
  const c = (map ?? {})[value] ?? { bg: "#F3F4F6", fg: "#6B7280" };
  return <span style={{ background: c.bg, color: c.fg, padding: "2px 9px", borderRadius: 100, fontSize: 11, fontWeight: 700, textTransform: "capitalize" }}>{String(value ?? "").replace(/_/g, " ")}</span>;
}

function fmt(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }

export default function ReportList() {
  const [reports,    setReports]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [total,      setTotal]      = useState(0);
  const [page,       setPageNum]    = useState(1);
  const [status,     setStatus]     = useState("");
  const [reportType, setReportType] = useState("");
  const [expanded,   setExpanded]   = useState(null);
  const [notes,      setNotes]      = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit: 20 });
      if (status)     p.set("status",      status);
      if (reportType) p.set("report_type", reportType);
      const { data } = await axios.get(`${BASE}/reports?${p}`, auth());
      setReports(data.reports ?? []);
      setTotal(data.pagination?.total ?? 0);
    } catch (e) { console.warn("[ReportList]", e.message); }
    finally     { setLoading(false); }
  }, [page, status, reportType]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id, s) {
    await axios.patch(`${BASE}/reports/${id}`, { status: s, resolution_notes: notes[id] ?? null }, auth());
    load();
  }

  const pages = Math.ceil(total / 20);

  return (
    <div className="sp-wrap">
      <div className="sp-header">
        <div><h1 className="sp-title">Reports</h1><p className="sp-sub">{total} total</p></div>
      </div>

      <div className="sp-filters">
        <select value={status}     onChange={(e) => { setStatus(e.target.value);     setPageNum(1); }}>
          {STATUS_OPTIONS.map((s)  => <option key={s} value={s}>{s ? s.replace(/_/g, " ") : "All Statuses"}</option>)}
        </select>
        <select value={reportType} onChange={(e) => { setReportType(e.target.value); setPageNum(1); }}>
          {TYPE_OPTIONS.map((t)    => <option key={t} value={t}>{t ? t.replace(/_/g, " ") : "All Types"}</option>)}
        </select>
      </div>

      {loading ? <div className="sp-loading">Loading reports…</div> : (
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead>
              <tr><th>Reference</th><th>Reporter</th><th>Type</th><th>Subject</th><th>Status</th><th>Date</th><th>Review</th></tr>
            </thead>
            <tbody>
              {reports.length === 0
                ? <tr><td colSpan={7} className="sp-empty">No reports found</td></tr>
                : reports.map((r) => (
                    <>
                      <tr key={r.id}>
                        <td><span className="sp-mono">{r.report_number}</span></td>
                        <td>
                          <p className="sp-name">{r.reporter_name ?? "—"}</p>
                          <p className="sp-email">{r.reporter_email ?? ""}</p>
                        </td>
                        <td><span className="sp-tag">{r.report_type?.replace(/_/g, " ")}</span></td>
                        <td className="sp-subject">{r.subject}</td>
                        <td><Chip value={r.status} map={STATUS_CFG} /></td>
                        <td className="sp-date">{fmt(r.created_at)}</td>
                        <td>
                          <button
                            className="sp-btn-ghost sp-btn-xs"
                            onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                          >
                            {expanded === r.id ? "Collapse" : "Review"}
                          </button>
                        </td>
                      </tr>
                      {expanded === r.id && (
                        <tr key={`${r.id}-exp`}>
                          <td colSpan={7}>
                            <div className="sp-expanded">
                              <p className="sp-exp-label">Description</p>
                              <p className="sp-exp-text">{r.description}</p>
                              {r.reported_user_name && (
                                <p className="sp-exp-label" style={{ marginTop: 8 }}>
                                  Reported User: <strong>{r.reported_user_name}</strong>
                                </p>
                              )}
                              <p className="sp-exp-label" style={{ marginTop: 10 }}>Resolution Notes</p>
                              <textarea
                                className="sp-reply-ta"
                                rows={2}
                                placeholder="Optional notes…"
                                value={notes[r.id] ?? ""}
                                onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))}
                              />
                              <div className="sp-actions" style={{ marginTop: 8 }}>
                                {["under_review","resolved","dismissed"].map((s) => (
                                  <button key={s} className={`sp-btn-xs ${s === "resolved" ? "sp-btn-solid" : s === "dismissed" ? "sp-btn-danger" : "sp-btn-ghost"}`} onClick={() => updateStatus(r.id, s)}>
                                    {s.replace(/_/g, " ")}
                                  </button>
                                ))}
                              </div>
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