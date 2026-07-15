// ════════════════════════════════════════════════════════════
// FILE: src/pages/Support/SupportTickets.jsx
// ════════════════════════════════════════════════════════════

import "../../styles/help/tickets-page.css";
import "../../styles/help/ticket-list.css";
import "../../styles/help/ticket-status-badge.css";
import "../../styles/help/priority-badge.css";

import { useState, useEffect, useCallback, useRef } from "react";
import { Link }                                      from "react-router-dom";
import axios                                         from "axios";

import TicketStatusBadge from "../../components/help/TicketStatusBadge";
import PriorityBadge     from "../../components/help/PriorityBadge";
import {
  IconPlus,
  IconSearch,
  IconChevronRight,
  IconClock,
  IconMessageSquare,
  IconArrowLeft,
  IconLoader,
  IconRefresh,
} from "../../components/help/icons/HelpIcons";

/* ════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const STATUS_FILTERS = [
  { label: "All",         value: "" },
  { label: "Open",        value: "open" },
  { label: "In Progress", value: "in_progress" },
  { label: "Waiting",     value: "waiting_for_customer" },
  { label: "Resolved",    value: "resolved" },
  { label: "Closed",      value: "closed" },
];

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function timeAgo(d) {
  if (!d) return "";
  const diff  = Date.now() - new Date(d).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "Just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return formatDate(d);
}

/* ════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════ */
export default function SupportTickets({ user }) {
  const [tickets,      setTickets]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const isMounted = useRef(true);

  /* ── Fetch tickets ── */
  const loadTickets = useCallback(async () => {
    const token = getToken();

    if (!token) {
      setError("Please sign in to view your tickets.");
      setLoading(false);
      return;
    }

    try {
      setError(null);

      const { data } = await axios.get(
        `${BASE_URL}/api/support/tickets`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!isMounted.current) return;

      /*
       * API returns { success: true, tickets: [...], pagination: {} }
       * Guard against all possible response shapes.
       */
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.tickets)
        ? data.tickets
        : Array.isArray(data?.data)
        ? data.data
        : [];

      setTickets(list);
    } catch (err) {
      if (!isMounted.current) return;
      console.error("[SupportTickets] load:", err.message);
      setError("Failed to load tickets. Please try again.");
      setTickets([]);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    loadTickets();
    return () => { isMounted.current = false; };
  }, [loadTickets]);

  /* ── Client-side filter ── */
  const filtered = tickets.filter((t) => {
    const q           = search.toLowerCase();
    const matchSearch = !q ||
      (t.ticket_number ?? "").toLowerCase().includes(q) ||
      (t.subject       ?? "").toLowerCase().includes(q) ||
      (t.category      ?? "").toLowerCase().includes(q);
    const matchStatus = !statusFilter || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  /* ── Status badge counts ── */
  const counts = tickets.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  /* ════════════════════════════════════════════════════════
     LOADING
  ════════════════════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="ticket-list-page">
        <div className="ticket-list-container">
          <div className="ticket-list-loading" role="status" aria-busy="true">
            <IconLoader size={28} className="ticket-list-spinner" />
            <p>Loading your tickets…</p>
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════
     ERROR
  ════════════════════════════════════════════════════════ */
  if (error) {
    return (
      <div className="ticket-list-page">
        <div className="ticket-list-container">
          <div className="ticket-list-error" role="alert">
            <p className="ticket-list-error-text">{error}</p>
            <button
              className="ticket-list-retry-btn"
              onClick={() => { setLoading(true); loadTickets(); }}
            >
              <IconRefresh size={15} />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════
     MAIN RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div className="ticket-list-page">
      <div className="ticket-list-container">

        {/* ── Header ── */}
        <div className="ticket-list-header">
          <div className="ticket-list-header-left">
            <Link
              to="/support"
              className="ticket-list-back"
              aria-label="Back to support hub"
            >
              <IconArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="ticket-list-title">My Tickets</h1>
              <p className="ticket-list-count">
                {tickets.length}{" "}
                {tickets.length === 1 ? "request" : "requests"}
              </p>
            </div>
          </div>

          <div className="ticket-list-header-right">
            <button
              className="ticket-list-refresh-btn"
              onClick={() => { setLoading(true); loadTickets(); }}
              aria-label="Refresh tickets"
            >
              <IconRefresh size={16} />
            </button>
            <Link to="/support/contact" className="ticket-list-new-btn">
              <IconPlus size={16} />
              <span>New Ticket</span>
            </Link>
          </div>
        </div>

        {/* ── Search + filters ── */}
        <div className="ticket-list-filters">
          <div className="ticket-list-search-wrapper">
            <IconSearch size={16} className="ticket-list-search-icon" />
            <input
              type="text"
              placeholder="Search by ticket number, subject or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ticket-list-search-input"
              aria-label="Search tickets"
            />
            {search && (
              <button
                className="ticket-list-search-clear"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div
            className="ticket-list-status-filters"
            role="group"
            aria-label="Filter by status"
          >
            {STATUS_FILTERS.map((f) => {
              const count = f.value ? (counts[f.value] ?? 0) : tickets.length;
              return (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`ticket-list-status-btn ${
                    statusFilter === f.value
                      ? "ticket-list-status-active"
                      : ""
                  }`}
                  aria-pressed={statusFilter === f.value}
                >
                  {f.label}
                  {count > 0 && (
                    <span className="ticket-list-status-count">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Empty state ── */}
        {filtered.length === 0 ? (
          <div className="ticket-list-empty" role="status">
            <IconMessageSquare
              size={48}
              className="ticket-list-empty-icon"
            />
            <h3 className="ticket-list-empty-title">
              {tickets.length === 0
                ? "No support requests yet"
                : "No tickets match your filters"}
            </h3>
            <p className="ticket-list-empty-desc">
              {tickets.length === 0
                ? "When you submit a support request, it will appear here."
                : "Try adjusting your search or filter."}
            </p>
            {tickets.length === 0 && (
              <Link to="/support/contact" className="ticket-list-empty-btn">
                <IconPlus size={16} />
                Create Your First Ticket
              </Link>
            )}
            {tickets.length > 0 && search && (
              <button
                className="ticket-list-clear-btn"
                onClick={() => { setSearch(""); setStatusFilter(""); }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          /* ── Ticket cards ── */
          <div className="ticket-list-cards" role="list">
            {filtered.map((ticket) => (
              <Link
                key={ticket.id}
                /*
                 * FIX: Use ticket.id (UUID) — NOT ticket.ticket_number.
                 * The backend GET /tickets/:id query uses:
                 *   WHERE t.id = $1 AND t.user_id = $2
                 * So the URL must contain the UUID, not the display number.
                 */
                to={`/support/tickets/${ticket.id}`}
                className="ticket-card"
                role="listitem"
                aria-label={`Ticket ${ticket.ticket_number}: ${ticket.subject}`}
              >
                <div className="ticket-card-content">
                  {/* Top row: number + status */}
                  <div className="ticket-card-top-row">
                    <span className="ticket-card-number">
                      {ticket.ticket_number}
                    </span>
                    <TicketStatusBadge status={ticket.status} />
                  </div>

                  {/* Subject */}
                  <h3 className="ticket-card-subject">{ticket.subject}</h3>

                  {/* Meta */}
                  <div className="ticket-card-meta">
                    <span className="ticket-card-category">
                      {ticket.category}
                    </span>
                    <span
                      className="ticket-card-date"
                      title={formatDate(ticket.created_at)}
                    >
                      <IconClock size={12} />
                      {timeAgo(ticket.created_at)}
                    </span>
                    <PriorityBadge priority={ticket.priority} />
                  </div>

                  {/* Message count if available */}
                  {ticket.message_count > 0 && (
                    <div className="ticket-card-messages">
                      <IconMessageSquare size={12} />
                      {ticket.message_count}{" "}
                      {ticket.message_count === 1 ? "message" : "messages"}
                    </div>
                  )}
                </div>

                <IconChevronRight
                  size={20}
                  className="ticket-card-arrow"
                />
              </Link>
            ))}
          </div>
        )}

        {/* ── Footer hint ── */}
        {tickets.length > 0 && (
          <p className="ticket-list-footer-hint">
            Showing {filtered.length} of {tickets.length} tickets
          </p>
        )}

      </div>
    </div>
  );
}