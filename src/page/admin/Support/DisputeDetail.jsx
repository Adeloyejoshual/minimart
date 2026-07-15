// ════════════════════════════════════════════════════════════
// FILE: src/pages/admin/Support/DisputeDetail.jsx
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const BASE  = `${import.meta.env.VITE_API_BASE_URL}/api/admin/support`;
const token = () => localStorage.getItem("admin_token");
const auth  = () => ({ headers: { Authorization: `Bearer ${token()}` } });

const Ic = {
  back:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  send:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
};

const STATUS_OPTIONS     = ["open","under_review","awaiting_seller","awaiting_buyer","resolved","closed","escalated"];
const RESOLUTION_OPTIONS = ["","refund_approved","refund_rejected","replacement_approved","dismissed","other"];

const STATUS_CFG = {
  open:            { bg: "#EFF6FF", fg: "#2563EB" },
  under_review:    { bg: "#F3E8FF", fg: "#7C3AED" },
  awaiting_seller: { bg: "#FEF9C3", fg: "#D97706" },
  awaiting_buyer:  { bg: "#FEF9C3", fg: "#D97706" },
  resolved:        { bg: "#DCFCE7", fg: "#15803D" },
  closed:          { bg: "#F3F4F6", fg: "#6B7280" },
  escalated:       { bg: "#FEF2F2", fg: "#DC2626" },
};

function fmtFull(d) { if (!d) return ""; return new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

export default function DisputeDetail({ disputeId, setPage }) {
  const [dispute,    setDispute]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [resolution, setResolution] = useState("");
  const [notes,      setNotes]      = useState("");
  const [msg,        setMsg]        = useState("");
  const [sending,    setSending]    = useState(false);

  const load = useCallback(async () => {
    if (!disputeId) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`${BASE}/disputes/${disputeId}`, auth());
      setDispute(data.dispute ?? null);
    } catch (e) { console.warn("[DisputeDetail]", e.message); }
    finally     { setLoading(false); }
  }, [disputeId]);

  useEffect(() => { load(); }, [load]);

  async function update(status) {
    await axios.patch(`${BASE}/disputes/${disputeId}`, {
      status,
      resolution:       resolution || undefined,
      resolution_notes: notes      || undefined,
    }, auth());
    load();
  }

  async function sendMessage() {
    if (!msg.trim()) return;
    setSending(true);
    try {
      await axios.post(`${BASE}/disputes/${disputeId}/message`, { message: msg.trim() }, auth());
      setMsg("");
      load();
    } finally { setSending(false); }
  }

  if (loading)  return <div className="sp-wrap"><div className="sp-loading">Loading dispute…</div></div>;
  if (!dispute) return (
    <div className="sp-wrap">
      <button className="sp-btn-ghost sp-btn-sm" onClick={() => setPage("disputes")}>{Ic.back} Back</button>
      <p className="sp-empty" style={{ marginTop: 24 }}>Dispute not found.</p>
    </div>
  );

  const sc   = STATUS_CFG[dispute.status] ?? STATUS_CFG.open;
  const msgs = dispute.messages ?? [];

  return (
    <div className="sp-wrap">
      <div className="sp-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="sp-btn-ghost sp-btn-sm" onClick={() => setPage("disputes")}>{Ic.back} Back</button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="sp-mono">{dispute.dispute_number}</span>
              <span style={{ background: sc.bg, color: sc.fg, padding: "2px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, textTransform: "capitalize" }}>
                {dispute.status.replace(/_/g, " ")}
              </span>
            </div>
            <h1 className="sp-title" style={{ margin: 0 }}>{dispute.subject}</h1>
            <p className="sp-sub">{dispute.dispute_type?.replace(/_/g, " ")} · {fmtFull(dispute.created_at)}</p>
          </div>
        </div>
      </div>

      <div className="sp-td-layout">

        {/* ── left ── */}
        <div className="sp-td-main">
          {/* description */}
          <div className="sp-panel">
            <div className="sp-panel-head"><span className="sp-panel-title">Description</span></div>
            <div style={{ padding: "12px 16px" }}>
              <p style={{ fontSize: ".84rem", lineHeight: 1.6, color: "var(--sp-fg)" }}>{dispute.description}</p>
            </div>
          </div>

          {/* messages */}
          <div className="sp-panel">
            <div className="sp-panel-head"><span className="sp-panel-title">Messages ({msgs.length})</span></div>
            <div className="sp-thread" style={{ maxHeight: 300 }}>
              {msgs.length === 0
                ? <p className="sp-empty-sm">No messages</p>
                : msgs.map((m) => (
                    <div key={m.id} className="sp-msg sp-msg-left">
                      <div className="sp-msg-meta">
                        <span className="sp-msg-sender">{m.sender_name ?? "—"}</span>
                        <span className="sp-msg-time">{fmtFull(m.created_at)}</span>
                      </div>
                      <div className="sp-msg-bubble">{m.message}</div>
                    </div>
                  ))
              }
            </div>
            <div className="sp-reply" style={{ borderTop: "1px solid var(--sp-border)" }}>
              <textarea
                className="sp-reply-ta"
                rows={3}
                placeholder="Send message to both parties…"
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
              />
              <div className="sp-reply-foot">
                <span className="sp-reply-hint">Sent to buyer and seller</span>
                <button className="sp-btn-solid sp-btn-sm" disabled={!msg.trim() || sending} onClick={sendMessage}>
                  {Ic.send} {sending ? "Sending…" : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── right ── */}
        <div className="sp-td-sidebar">

          {/* parties */}
          <div className="sp-si-panel">
            <p className="sp-si-title">Buyer</p>
            <div className="sp-si-row"><span className="sp-si-key">Name</span><span className="sp-si-val">{dispute.buyer_name ?? "—"}</span></div>
            <div className="sp-si-row"><span className="sp-si-key">Email</span><span className="sp-si-val">{dispute.buyer_email ?? "—"}</span></div>
          </div>

          <div className="sp-si-panel">
            <p className="sp-si-title">Seller</p>
            <div className="sp-si-row"><span className="sp-si-key">Name</span><span className="sp-si-val">{dispute.seller_name ?? "—"}</span></div>
            <div className="sp-si-row"><span className="sp-si-key">Email</span><span className="sp-si-val">{dispute.seller_email ?? "—"}</span></div>
          </div>

          {/* update status */}
          <div className="sp-si-panel">
            <p className="sp-si-title">Update Status</p>
            <select value={dispute.status} onChange={(e) => update(e.target.value)} className="sp-sel" style={{ width: "100%", marginBottom: 8 }}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
            <p className="sp-si-title" style={{ marginTop: 8 }}>Resolution</p>
            <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="sp-sel" style={{ width: "100%", marginBottom: 8 }}>
              {RESOLUTION_OPTIONS.map((r) => <option key={r} value={r}>{r ? r.replace(/_/g, " ") : "Select resolution"}</option>)}
            </select>
            <p className="sp-si-title" style={{ marginTop: 8 }}>Notes</p>
            <textarea className="sp-reply-ta" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Decision notes…" />
            <div className="sp-actions" style={{ marginTop: 8 }}>
              <button className="sp-btn-solid sp-btn-sm" onClick={() => update("resolved")}>Mark Resolved</button>
              <button className="sp-btn-danger sp-btn-sm" onClick={() => update("closed")}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}