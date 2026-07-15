// ════════════════════════════════════════════════════════════
// FILE: src/pages/admin/Support/TicketList.jsx
// ════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";

const BASE  = `${import.meta.env.VITE_API_BASE_URL}/api/admin/support`;
const token = () => localStorage.getItem("admin_token");
const auth  = () => ({ headers: { Authorization: `Bearer ${token()}` } });

const Ic = {
  search:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  eye:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  escalate: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="17 11 21 7 17 3"/><line x1="21" y1="7" x2="9" y2="7"/><polyline points="7 21 3 17 7 13"/><line x1="15" y1="17" x2="3" y2="17"/></svg>,
  close:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  refresh:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  prev:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>,
  next:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>,
};

const STATUS_CFG = {
  open:                 { bg: "#EFF6FF", fg: "#2563EB" },
  waiting_for_customer: { bg: "#FEF9C3", fg: "#D97706" },
  in_progress:          { bg: "#F3E8FF", fg: "#7C3AED" },
  escalated:            { bg: "#FEF2F2", fg: "#DC2626" },
  resolved:             { bg: "#DCFCE7", fg: "#15803D" },
  closed:               { bg: "#F3F4F6", fg: "#6B7280" },
};

const PRIORITY_CFG = {
  low:    { bg: "#DCFCE7", fg: "#15803D" },
  medium: { bg: "#FEF9C3", fg: "#D97706" },
  high:   { bg: "#FEF2F2", fg: "#DC2626" },
  urgent: { bg: "#DC2626", fg: "#FFFFFF" },
};

const STATUS_OPTIONS   = ["", "open","waiting_for_customer","in_progress","escalated","resolved","closed"];
const PRIORITY_OPTIONS = ["", "low","medium","high","urgent"];

function Chip({ value, map }) {
  const c = map[value] ?? { bg: "#F3F4F6", fg: "#6B7280" };
  return (
    <span style={{ background: c.bg, color: c.fg, padding: "2px 9px", borderRadius: 100, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", textTransform: "capitalize" }}>
      {String(value ?? "").replace(/_/g, " ")}
    </span>
  );
}

function fmt(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function TicketList({ setPage, setDetailId }) {
  const [tickets,  setTickets]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [total,    setTotal]    = useState(0);
  const [page,     setPageNum]  = useState(1);
  const [search,   setSearch]   = useState("");
  const [status,   setStatus]   = useState("");
  const [priority, setPriority] = useState("");
  const searchRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit: 20 });
      if (search)   p.set("search",   search);
      if (status)   p.set("status",   status);
      if (priority) p.set("priority", priority);

      const { data } = await axios.get(`${BASE}/tickets?${p}`, auth());
      setTickets(data.tickets ?? []);
      setTotal(data.pagination?.total ?? 0);
    } catch (e) {
      console.warn("[TicketList]", e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, status, priority]);

  useEffect(() => { load(); }, [load]);

  /* debounced search */
  useEffect(() => {
    const t = setTimeout(() => setPageNum(1), 350);
    return () => clearTimeout(t);
  }, [search]);

  const pages = Math.ceil(total / 20);

  async function changeStatus(ticketId, newStatus) {
    try {
      await axios.patch(`${BASE}/tickets/${ticketId}`, { status: newStatus }, auth());
      load();
    } catch (e) {
      console.warn("[TicketList] changeStatus:", e.message);
    }
  }

  async function escalate(ticketId) {
    try {
      await axios.post(`${BASE}/tickets/${ticketId}/escalate`, { reason: "Escalated by admin" }, auth());
      load();
    } catch (e) {
      console.warn("[TicketList] escalate:", e.message);
    }
  }

  async function closeTicket(ticketId) {
    try {
      await axios.post(`${BASE}/tickets/${ticketId}/close`, {}, auth());
      load();
    } catch (e) {
      console.warn("[TicketList] close:", e.message);
    }
  }

  return (
    <div className="sp-wrap">

      <div className="sp-header">
        <div>
          <h1 className="sp-title">Support Tickets</h1>
          <p className="sp-sub">{total} total tickets</p>
        </div>
        <button className="sp-btn-ghost sp-btn-sm" onClick={load}>{Ic.refresh} Refresh</button>
      </div>

      {/* filters */}
      <div className="sp-filters">
        <div className="sp-search">
          {Ic.search}
          <input
            ref={searchRef}
            placeholder="Search ticket, subject, user…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={status}   onChange={(e) => { setStatus(e.target.value);   setPageNum(1); }}>
          {STATUS_OPTIONS.map((s)   => <option key={s} value={s}>{s ? s.replace(/_/g, " ") : "All Statuses"}</option>)}
        </select>
        <select value={priority} onChange={(e) => { setPriority(e.target.value); setPageNum(1); }}>
          {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p ? p : "All Priorities"}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="sp-loading">Loading tickets…</div>
      ) : (
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>User</th>
                <th>Subject</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0
                ? <tr><td colSpan={8} className="sp-empty">No tickets found</td></tr>
                : tickets.map((t) => (
                    <tr key={t.id}>
                      <td><span className="sp-mono">{t.ticket_number}</span></td>
                      <td>
                        <p className="sp-name">{t.user_name ?? "—"}</p>
                        <p className="sp-email">{t.user_email ?? ""}</p>
                      </td>
                      <td className="sp-subject">{t.subject}</td>
                      <td><span className="sp-tag">{t.category}</span></td>
                      <td><Chip value={t.priority} map={PRIORITY_CFG} /></td>
                      <td>
                        <select
                          defaultValue={t.status}
                          onChange={(e) => changeStatus(t.id, e.target.value)}
                          className="sp-sel"
                        >
                          {STATUS_OPTIONS.filter(Boolean).map((s) => (
                            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                          ))}
                        </select>
                      </td>
                      <td className="sp-date">{fmt(t.created_at)}</td>
                      <td>
                        <div className="sp-actions">
                          <button
                            className="sp-btn-solid sp-btn-xs"
                            onClick={() => { setDetailId(t.id); setPage("ticket_detail"); }}
                          >
                            {Ic.eye} View
                          </button>
                          {!["escalated","closed","resolved"].includes(t.status) && (
                            <button className="sp-btn-ghost sp-btn-xs" onClick={() => escalate(t.id)}>
                              {Ic.escalate} Escalate
                            </button>
                          )}
                          {t.status !== "closed" && (
                            <button className="sp-btn-danger sp-btn-xs" onClick={() => closeTicket(t.id)}>
                              {Ic.close} Close
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* pagination */}
      {pages > 1 && (
        <div className="sp-pagination">
          <button className="sp-btn-ghost sp-btn-sm" disabled={page === 1} onClick={() => setPageNum((p) => p - 1)}>
            {Ic.prev} Prev
          </button>
          <span className="sp-page-info">Page {page} of {pages}</span>
          <button className="sp-btn-ghost sp-btn-sm" disabled={page >= pages} onClick={() => setPageNum((p) => p + 1)}>
            Next {Ic.next}
          </button>
        </div>
      )}
    </div>
  );
}