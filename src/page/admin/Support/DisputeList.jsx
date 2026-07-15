// ════════════════════════════════════════════════════════════
// FILE: src/pages/admin/Support/DisputeList.jsx
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const BASE  = `${import.meta.env.VITE_API_BASE_URL}/api/admin/support`;
const token = () => localStorage.getItem("admin_token");
const auth  = () => ({ headers: { Authorization: `Bearer ${token()}` } });

const Ic = {
  eye: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
};

const STATUS_OPTIONS = ["","open","under_review","awaiting_seller","awaiting_buyer","resolved","closed","escalated"];
const TYPE_OPTIONS   = ["","wrong_item","item_not_received","damaged_item","refund_request","delivery_dispute","other"];

const STATUS_CFG = {
  open:            { bg: "#EFF6FF", fg: "#2563EB" },
  under_review:    { bg: "#F3E8FF", fg: "#7C3AED" },
  awaiting_seller: { bg: "#FEF9C3", fg: "#D97706" },
  awaiting_buyer:  { bg: "#FEF9C3", fg: "#D97706" },
  resolved:        { bg: "#DCFCE7", fg: "#15803D" },
  closed:          { bg: "#F3F4F6", fg: "#6B7280" },
  escalated:       { bg: "#FEF2F2", fg: "#DC2626" },
};

const RESOLUTION_OPTIONS = ["refund_approved","refund_rejected","replacement_approved","dismissed","other"];

function Chip({ value, map }) {
  const c = (map ?? {})[value] ?? { bg: "#F3F4F6", fg: "#6B7280" };
  return <span style={{ background: c.bg, color: c.fg, padding: "2px 9px", borderRadius: 100, fontSize: 11, fontWeight: 700, textTransform: "capitalize" }}>{String(value ?? "").replace(/_/g, " ")}</span>;
}

function fmt(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }

export default function DisputeList({ setPage, setDetailId }) {
  const [disputes,    setDisputes]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [total,       setTotal]       = useState(0);
  const [page,        setPageNum]     = useState(1);
  const [status,      setStatus]      = useState("");
  const [disputeType, setDisputeType] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit: 20 });
      if (status)      p.set("status",       status);
      if (disputeType) p.set("dispute_type", disputeType);
      const { data } = await axios.get(`${BASE}/disputes?${p}`, auth());
      setDisputes(data.disputes ?? []);
      setTotal(data.pagination?.total ?? 0);
    } catch (e) { console.warn("[DisputeList]", e.message); }
    finally     { setLoading(false); }
  }, [page, status, disputeType]);

  useEffect(() => { load(); }, [load]);

  const pages = Math.ceil(total / 20);

  return (
    <div className="sp-wrap">
      <div className="sp-header">
        <div><h1 className="sp-title">Disputes</h1><p className="sp-sub">{total} total</p></div>
      </div>

      <div className="sp-filters">
        <select value={status}      onChange={(e) => { setStatus(e.target.value);      setPageNum(1); }}>
          {STATUS_OPTIONS.map((s)  => <option key={s} value={s}>{s ? s.replace(/_/g, " ") : "All Statuses"}</option>)}
        </select>
        <select value={disputeType} onChange={(e) => { setDisputeType(e.target.value); setPageNum(1); }}>
          {TYPE_OPTIONS.map((t)    => <option key={t} value={t}>{t ? t.replace(/_/g, " ") : "All Types"}</option>)}
        </select>
      </div>

      {loading ? <div className="sp-loading">Loading disputes…</div> : (
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead>
              <tr><th>Reference</th><th>Buyer</th><th>Seller</th><th>Type</th><th>Status</th><th>Deadline</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {disputes.length === 0
                ? <tr><td colSpan={7} className="sp-empty">No disputes found</td></tr>
                : disputes.map((d) => (
                    <tr key={d.id}>
                      <td><span className="sp-mono">{d.dispute_number}</span></td>
                      <td><p className="sp-name">{d.buyer_name ?? "—"}</p><p className="sp-email">{d.buyer_email ?? ""}</p></td>
                      <td><p className="sp-name">{d.seller_name ?? "—"}</p><p className="sp-email">{d.seller_email ?? ""}</p></td>
                      <td><span className="sp-tag">{d.dispute_type?.replace(/_/g, " ")}</span></td>
                      <td><Chip value={d.status} map={STATUS_CFG} /></td>
                      <td className="sp-date">{fmt(d.deadline)}</td>
                      <td>
                        <button
                          className="sp-btn-solid sp-btn-xs"
                          onClick={() => { setDetailId(d.id); setPage("dispute_detail"); }}
                        >
                          {Ic.eye} View
                        </button>
                      </td>
                    </tr>
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