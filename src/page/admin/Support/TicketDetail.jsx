// ════════════════════════════════════════════════════════════
// FILE: src/pages/admin/Support/TicketDetail.jsx
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

const BASE  = `${import.meta.env.VITE_API_BASE_URL}/api/admin/support`;
const token = () => localStorage.getItem("admin_token");
const auth  = () => ({ headers: { Authorization: `Bearer ${token()}` } });

const Ic = {
  back:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  send:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  lock:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  escalate: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="17 11 21 7 17 3"/><line x1="21" y1="7" x2="9" y2="7"/></svg>,
  user:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  agent:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16l-.06.92z"/></svg>,
  note:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  refresh:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  timeline: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="2" x2="12" y2="22"/><polyline points="17 7 12 2 7 7"/><polyline points="17 17 12 22 7 17"/></svg>,
  attach:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
};

const STATUS_OPTIONS = ["open","waiting_for_customer","in_progress","escalated","resolved","closed"];
const STATUS_CFG = {
  open:                 { bg: "#EFF6FF", fg: "#2563EB" },
  waiting_for_customer: { bg: "#FEF9C3", fg: "#D97706" },
  in_progress:          { bg: "#F3E8FF", fg: "#7C3AED" },
  escalated:            { bg: "#FEF2F2", fg: "#DC2626" },
  resolved:             { bg: "#DCFCE7", fg: "#15803D" },
  closed:               { bg: "#F3F4F6", fg: "#6B7280" },
};

function fmtFull(d) {
  if (!d) return "";
  return new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function TicketDetail({ ticketId, setPage }) {
  const [ticket,     setTicket]     = useState(null);
  const [agents,     setAgents]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState("messages"); // messages | timeline
  const [reply,      setReply]      = useState("");
  const [internal,   setInternal]   = useState(false);
  const [sending,    setSending]    = useState(false);
  const threadRef = useRef(null);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`${BASE}/tickets/${ticketId}`, auth());
      setTicket(data.ticket ?? null);
      setAgents(data.agents ?? []);
    } catch (e) {
      console.warn("[TicketDetail]", e.message);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  /* scroll to bottom on new message */
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [ticket?.messages]);

  async function sendReply() {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await axios.post(`${BASE}/tickets/${ticketId}/reply`, { message: reply.trim(), is_internal: internal }, auth());
      setReply("");
      await load();
    } finally {
      setSending(false);
    }
  }

  async function changeStatus(s) {
    await axios.patch(`${BASE}/tickets/${ticketId}`, { status: s }, auth());
    load();
  }

  async function assignAgent(agentId) {
    await axios.post(`${BASE}/tickets/${ticketId}/assign`, { agent_id: agentId }, auth());
    load();
  }

  async function closeTicket() {
    await axios.post(`${BASE}/tickets/${ticketId}/close`, {}, auth());
    load();
  }

  async function escalate() {
    await axios.post(`${BASE}/tickets/${ticketId}/escalate`, { reason: "Escalated by admin" }, auth());
    load();
  }

  if (loading) return <div className="sp-wrap"><div className="sp-loading">Loading ticket…</div></div>;
  if (!ticket) return (
    <div className="sp-wrap">
      <button className="sp-btn-ghost sp-btn-sm" onClick={() => setPage("tickets")}>{Ic.back} Back</button>
      <p className="sp-empty" style={{ marginTop: 24 }}>Ticket not found.</p>
    </div>
  );

  const sc     = STATUS_CFG[ticket.status] ?? STATUS_CFG.closed;
  const isClosed = ticket.status === "closed";
  const msgs   = ticket.messages  ?? [];
  const acts   = ticket.activity  ?? [];

  return (
    <div className="sp-wrap">

      {/* ── header ── */}
      <div className="sp-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="sp-btn-ghost sp-btn-sm" onClick={() => setPage("tickets")}>
            {Ic.back} Back
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="sp-mono">{ticket.ticket_number}</span>
              <span style={{ background: sc.bg, color: sc.fg, padding: "2px 10px", borderRadius: 100, fontSize: 11, fontWeight: 700, textTransform: "capitalize" }}>
                {ticket.status.replace(/_/g, " ")}
              </span>
            </div>
            <h1 className="sp-title" style={{ margin: 0 }}>{ticket.subject}</h1>
            <p className="sp-sub">{ticket.category} · {fmtFull(ticket.created_at)}</p>
          </div>
        </div>
        <button className="sp-btn-ghost sp-btn-sm" onClick={load}>{Ic.refresh} Refresh</button>
      </div>

      <div className="sp-td-layout">

        {/* ── left: messages / timeline ── */}
        <div className="sp-td-main">

          {/* tabs */}
          <div className="sp-tabs">
            <button className={`sp-tab${tab === "messages" ? " sp-tab-active" : ""}`} onClick={() => setTab("messages")}>
              Messages ({msgs.filter((m) => !m.is_internal_note).length})
            </button>
            <button className={`sp-tab${tab === "timeline" ? " sp-tab-active" : ""}`} onClick={() => setTab("timeline")}>
              {Ic.timeline} Timeline ({acts.length})
            </button>
          </div>

          {tab === "messages" && (
            <>
              {/* thread */}
              <div className="sp-thread" ref={threadRef}>
                {msgs.length === 0
                  ? <p className="sp-empty-sm">No messages yet</p>
                  : msgs.map((m) => {
                      const isAgent   = m.sender_id !== ticket.user_id;
                      const isIntNote = m.is_internal_note;
                      return (
                        <div key={m.id} className={`sp-msg ${isAgent ? "sp-msg-right" : "sp-msg-left"} ${isIntNote ? "sp-msg-internal" : ""}`}>
                          <div className="sp-msg-meta">
                            <span className="sp-msg-sender">
                              {isIntNote ? `🔒 Internal · ${m.sender_name ?? "Agent"}` : (m.sender_name ?? (isAgent ? "Agent" : "User"))}
                            </span>
                            <span className="sp-msg-time">{fmtFull(m.created_at)}</span>
                          </div>
                          <div className="sp-msg-bubble">{m.message}</div>
                          {m.attachments?.length > 0 && (
                            <div className="sp-msg-atts">
                              {m.attachments.map((a) => (
                                <a key={a.id} href={a.file_url} target="_blank" rel="noopener noreferrer" className="sp-att">
                                  {Ic.attach} {a.file_name}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                }
              </div>

              {/* reply box */}
              {!isClosed && (
                <div className="sp-reply">
                  <div className="sp-reply-toggle">
                    <label className="sp-toggle">
                      <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                      <span>{Ic.note} Internal note only</span>
                    </label>
                  </div>
                  <textarea
                    className="sp-reply-ta"
                    rows={4}
                    placeholder={internal ? "Internal note — not visible to user…" : "Reply to user…"}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    style={{ borderColor: internal ? "#D97706" : undefined }}
                    onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) sendReply(); }}
                  />
                  <div className="sp-reply-foot">
                    <span className="sp-reply-hint">
                      {internal ? "Not sent to user" : "Will notify user"}
                    </span>
                    <button
                      className="sp-btn-solid sp-btn-sm"
                      disabled={!reply.trim() || sending}
                      onClick={sendReply}
                    >
                      {Ic.send} {sending ? "Sending…" : internal ? "Add Note" : "Send Reply"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === "timeline" && (
            <div className="sp-timeline">
              {acts.length === 0
                ? <p className="sp-empty-sm">No activity yet</p>
                : acts.map((a, i) => (
                    <div key={a.id} className="sp-tl-item">
                      <div className="sp-tl-line">
                        <div className="sp-tl-dot" />
                        {i < acts.length - 1 && <div className="sp-tl-connector" />}
                      </div>
                      <div className="sp-tl-body">
                        <p className="sp-tl-action">{a.action.replace(/_/g, " ")}</p>
                        {a.description && <p className="sp-tl-desc">{a.description}</p>}
                        <p className="sp-tl-time">{a.performed_by_name ?? "System"} · {fmtFull(a.created_at)}</p>
                      </div>
                    </div>
                  ))
              }
            </div>
          )}
        </div>

        {/* ── right: sidebar ── */}
        <div className="sp-td-sidebar">

          {/* status */}
          <div className="sp-si-panel">
            <p className="sp-si-title">Status</p>
            <select value={ticket.status} onChange={(e) => changeStatus(e.target.value)} className="sp-sel" style={{ width: "100%" }}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
            </select>
          </div>

          {/* ticket details */}
          <div className="sp-si-panel">
            <p className="sp-si-title">Details</p>
            {[
              ["Priority", ticket.priority],
              ["Category", ticket.category],
              ["Created",  fmtFull(ticket.created_at)],
              ["Resolved", ticket.resolved_at ? fmtFull(ticket.resolved_at) : "—"],
            ].map(([k, v]) => (
              <div key={k} className="sp-si-row">
                <span className="sp-si-key">{k}</span>
                <span className="sp-si-val">{v}</span>
              </div>
            ))}
          </div>

          {/* user */}
          <div className="sp-si-panel">
            <p className="sp-si-title">User</p>
            <div className="sp-si-row"><span className="sp-si-key">{Ic.user} Name</span><span className="sp-si-val">{ticket.user_name ?? "—"}</span></div>
            <div className="sp-si-row"><span className="sp-si-key">Email</span><span className="sp-si-val">{ticket.user_email ?? "—"}</span></div>
            <div className="sp-si-row"><span className="sp-si-key">Phone</span><span className="sp-si-val">{ticket.user_phone ?? "—"}</span></div>
          </div>

          {/* assign agent */}
          <div className="sp-si-panel">
            <p className="sp-si-title">{Ic.agent} Assigned Agent</p>
            <select
              value={ticket.assigned_to ?? ""}
              onChange={(e) => assignAgent(e.target.value)}
              className="sp-sel"
              style={{ width: "100%" }}
            >
              <option value="">Unassigned</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
              ))}
            </select>
          </div>

          {/* actions */}
          <div className="sp-si-panel">
            <p className="sp-si-title">Actions</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {!["escalated","closed","resolved"].includes(ticket.status) && (
                <button className="sp-btn-ghost sp-btn-sm" onClick={escalate} style={{ width: "100%", justifyContent: "center" }}>
                  {Ic.escalate} Escalate
                </button>
              )}
              {!isClosed && (
                <button className="sp-btn-danger sp-btn-sm" onClick={closeTicket} style={{ width: "100%", justifyContent: "center" }}>
                  {Ic.lock} Close Ticket
                </button>
              )}
            </div>
          </div>

          {/* user history */}
          {ticket.user_history?.length > 0 && (
            <div className="sp-si-panel">
              <p className="sp-si-title">User's Other Tickets</p>
              {ticket.user_history.map((h) => (
                <div key={h.id} className="sp-si-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                  <span className="sp-mono" style={{ fontSize: 11 }}>{h.ticket_number}</span>
                  <span className="sp-tag" style={{ fontSize: 10 }}>{h.status}</span>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}