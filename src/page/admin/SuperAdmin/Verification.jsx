/**
 * src/page/admin/SuperAdmin/Verification.jsx — v2
 *
 * Single unified approval flow:
 *   Admin reviews submitted documents once →
 *   clicks "Approve" → identity + store approved in one request
 *   POST /api/admin/verification/:userId/approve
 *   POST /api/admin/verification/:userId/reject
 *   POST /api/admin/verification/:userId/reset
 *
 * Removed:
 *  - Separate identity / store tabs
 *  - Granular /identity/:id and /store/:id endpoints
 *  - Step-by-step flow
 *  - store_name / logo_url / store_description (not in schema)
 *
 * Kept:
 *  - Notes history + add note (uses /identity/:id/note)
 *  - Risk score + flags display
 *  - Trust score recalculate
 *  - Assigned admin display + self-assign
 *  - Stats row
 *  - Overdue badge
 *  - Bulk approve / reject
 *  - Toast notifications
 *  - Keyboard Escape closes drawers
 *  - Pagination
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import adminApi from "../../../../services/adminApi";
import { fmtDate, fmtDateS } from "../adminlayout/helpers";
import { Pill, Card, Rfr } from "../adminlayout/atoms";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const PAGE_SIZE = 50;

/* Single queue tabs — pending submissions only */
const QUEUE_TABS = [
  { key: "pending",  label: "Pending"  },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "flagged",  label: "Flagged"  },
  { key: "reset",    label: "Reset"    },
  { key: "all",      label: "All"      },
];

const DOC_LABELS = {
  nin:             "NIN",
  passport:        "Passport",
  drivers_license: "Driver's License",
  voters_card:     "Voter's Card",
};

const STATUS_COLOR = {
  pending:  "#d97706",
  approved: "#16a34a",
  rejected: "#dc2626",
  flagged:  "#9333ea",
  reset:    "#6b7280",
  unknown:  "#6b7280",
};

const RISK_SEVERITY_COLOR = {
  critical: "#dc2626",
  high:     "#ea580c",
  medium:   "#d97706",
  low:      "#6b7280",
};

/* ═══════════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════════ */
const S = {
  label: {
    display: "block", fontSize: ".75rem", fontWeight: 700,
    color: "#888", textTransform: "uppercase",
    letterSpacing: ".5px", marginBottom: 4,
  },
  textarea: {
    width: "100%", padding: "10px 12px",
    border: "1.5px solid #e8e6e0", borderRadius: 10,
    fontSize: 13, fontFamily: "inherit", resize: "vertical",
    outline: "none", boxSizing: "border-box", background: "#fff",
  },
  closeBtn: {
    border: "1.5px solid #e8e6e0", background: "#fafaf8",
    borderRadius: "50%", width: 32, height: 32,
    cursor: "pointer", fontSize: 16, color: "#555",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  badge: (color) => ({
    display: "inline-block", padding: "2px 8px",
    borderRadius: 999, fontSize: 11, fontWeight: 700,
    background: `${color}18`, color,
    border: `1px solid ${color}40`,
  }),
  infoBox: {
    background: "#fafaf8", border: "1.5px solid #f0eeea",
    borderRadius: 12, padding: "14px 16px", marginBottom: 16, fontSize: 13,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: 700, color: "#aaa",
    textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8,
  },
  statCard: {
    background: "#fafaf8", border: "1.5px solid #f0eeea",
    borderRadius: 12, padding: "14px 16px",
  },
  approveBtn: {
    flex: 1, height: 48, fontSize: 15, fontWeight: 800,
    background: "linear-gradient(135deg,#16a34a,#15803d)",
    color: "#fff", border: "none", borderRadius: 10, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  },
  rejectBtn: {
    flex: 1, height: 48, fontSize: 15, fontWeight: 700,
    background: "#fff", color: "#dc2626",
    border: "2px solid #dc2626", borderRadius: 10, cursor: "pointer",
  },
  resetBtn: {
    width: "100%", height: 40, fontSize: 13, fontWeight: 600,
    background: "#fffbeb", color: "#d97706",
    border: "1.5px solid #fde68a", borderRadius: 10, cursor: "pointer",
  },
};

/* ═══════════════════════════════════════════════════════════════
   SMALL COMPONENTS
═══════════════════════════════════════════════════════════════ */
function StatusBadge({ status }) {
  const s     = status ?? "unknown";
  const color = STATUS_COLOR[s] ?? "#6b7280";
  return (
    <span style={S.badge(color)}>
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

function OverdueBadge({ createdAt }) {
  if (!createdAt) return null;
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
  if (hours < 24) return null;
  const days = Math.floor(hours / 24);
  return (
    <span style={{ ...S.badge("#dc2626"), fontSize: 10, marginLeft: 4 }}>
      {days}d overdue
    </span>
  );
}

function RiskBadge({ score }) {
  if (!score || score === 0) return null;
  const color = score >= 80 ? "#dc2626"
    : score >= 50 ? "#ea580c"
    : score >= 20 ? "#d97706"
    : "#6b7280";
  return <span style={S.badge(color)}>Risk: {score}</span>;
}

function ImageViewer({ url, label }) {
  if (!url) return null;
  const isPdf = url.endsWith(".pdf") || url.includes("/pdf");
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={S.label}>{label}</label>
      {isPdf ? (
        <a href={url} target="_blank" rel="noopener noreferrer"
           style={{
             display: "inline-block", padding: "8px 14px",
             background: "#f5f4f0", borderRadius: 8, fontSize: 13,
             color: "#ff5722", textDecoration: "none",
             border: "1.5px solid #e8e6e0",
           }}>
          View PDF
        </a>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img src={url} alt={label} style={{
            width: "100%", maxHeight: 220, objectFit: "cover",
            borderRadius: 10, border: "1.5px solid #e8e6e0",
            cursor: "zoom-in",
          }} />
        </a>
      )}
    </div>
  );
}

/* ─── Toast ─── */
function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  const bg = type === "error" ? "#dc2626" : "#16a34a";
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: bg, color: "#fff", padding: "12px 20px",
      borderRadius: 12, fontSize: 13, fontWeight: 600,
      boxShadow: "0 8px 24px rgba(0,0,0,.2)",
      animation: "slideUp .25s ease",
    }}>
      {message}
    </div>
  );
}

/* ─── Notes Panel ─── */
function NotesPanel({ verificationId, verificationType }) {
  const [notes,   setNotes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [saving,  setSaving]  = useState(false);

  const loadNotes = useCallback(async () => {
    try {
      const { data } = await adminApi.get(
        `/verification/${verificationType}/${verificationId}`
      );
      setNotes(data.notes ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [verificationId, verificationType]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const addNote = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      await adminApi.post(
        `/verification/${verificationType}/${verificationId}/note`,
        { note: newNote.trim() }
      );
      setNewNote("");
      await loadNotes();
    } catch (err) {
      console.error("[addNote]", err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={S.sectionLabel}>Review Notes</div>

      {loading ? (
        <div style={{ fontSize: 12, color: "#aaa" }}>Loading notes…</div>
      ) : notes.length === 0 ? (
        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>
          No notes yet.
        </div>
      ) : (
        <div style={{
          maxHeight: 200, overflowY: "auto",
          marginBottom: 10, display: "flex", flexDirection: "column", gap: 6,
        }}>
          {notes.map((n) => (
            <div key={n.id} style={{
              padding: "8px 12px", background: "#f9f8f5",
              border: "1px solid #f0eeea", borderRadius: 8, fontSize: 12,
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between", marginBottom: 3,
              }}>
                <span style={{ fontWeight: 700, color: "#555" }}>
                  {n.admin_name}
                </span>
                <span style={{ color: "#aaa", fontSize: 11 }}>
                  {fmtDateS(n.created_at)}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <StatusBadge status={n.action} />
                <span style={{ color: "#333" }}>{n.note}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note…"
          style={{
            flex: 1, padding: "8px 12px", border: "1.5px solid #e8e6e0",
            borderRadius: 8, fontSize: 12, outline: "none",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault(); addNote();
            }
          }}
        />
        <button
          className="btn b-ghost"
          disabled={!newNote.trim() || saving}
          onClick={addNote}
          style={{ fontSize: 11, padding: "6px 12px" }}
        >
          {saving ? "…" : "Add"}
        </button>
      </div>
    </div>
  );
}

/* ─── Risk Flags Panel ─── */
function RiskFlagsPanel({ riskScore, riskFlags }) {
  if ((!riskScore || riskScore === 0) && (!riskFlags || riskFlags.length === 0))
    return null;

  const flags = Array.isArray(riskFlags) ? riskFlags
    : (typeof riskFlags === "string" ? JSON.parse(riskFlags) : []);

  return (
    <div style={{
      marginBottom: 16, padding: "12px 14px",
      background: riskScore >= 80 ? "#fef2f2" : "#fffbeb",
      border: `1px solid ${riskScore >= 80 ? "#fecaca" : "#fde68a"}`,
      borderRadius: 10,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>
          Risk Score: {riskScore}
        </span>
        <RiskBadge score={riskScore} />
      </div>

      {flags.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {flags.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: RISK_SEVERITY_COLOR[f.severity] ?? "#6b7280",
                flexShrink: 0,
              }} />
              <span style={{ fontWeight: 600, color: "#555" }}>
                {f.type?.replace(/_/g, " ")}:
              </span>
              <span style={{ color: "#888" }}>{f.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MODALS
═══════════════════════════════════════════════════════════════ */
function RejectModal({ title, onSubmit, onClose }) {
  const [reason, setReason] = useState("");
  const [busy,   setBusy]   = useState(false);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const submit = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    await onSubmit(reason.trim());
    setBusy(false);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}
           style={{ maxWidth: 460 }}>
        <div className="modal-title" style={{ color: "#dc2626" }}>{title}</div>
        <label style={S.label}>Reason (required)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder='e.g. "Documents are unclear or unreadable"'
          style={S.textarea}
          autoFocus
        />
        <div className="modal-btns" style={{ marginTop: 14 }}>
          <button className="btn b-ghost" onClick={onClose}>Cancel</button>
          <button className="btn b-red"
            disabled={!reason.trim() || busy}
            onClick={submit}>
            {busy ? "Submitting…" : "Confirm Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetModal({ title, onSubmit, onClose }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const submit = async () => {
    setBusy(true);
    await onSubmit(note.trim() || null);
    setBusy(false);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}
           style={{ maxWidth: 460 }}>
        <div className="modal-title">{title}</div>
        <p style={{ fontSize: ".82rem", color: "#888", marginBottom: 12 }}>
          The user's verified status will be cleared and they will be asked to
          resubmit their documents.
        </p>
        <label style={S.label}>Note to user (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="e.g. Resubmit with clearer photos"
          style={S.textarea}
          autoFocus
        />
        <div className="modal-btns" style={{ marginTop: 14 }}>
          <button className="btn b-ghost" onClick={onClose}>Cancel</button>
          <button className="btn b-solid" disabled={busy} onClick={submit}>
            {busy ? "Resetting…" : "Reset & Allow Resubmit"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   UNIFIED DRAWER
   Shows identity docs + store docs_url + user info all at once.
   Admin clicks ONE approve button → both approved via /:userId/approve
═══════════════════════════════════════════════════════════════ */
function VerificationDrawer({
  record,
  onClose,
  onApprove,
  onReject,
  onReset,
  busy,
  onToast,
}) {
  if (!record) return null;

  /* Escape closes */
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const handleAssign = async () => {
    try {
      await adminApi.post(`/verification/identity/${record.identity_id}/assign`);
      onToast?.("Assigned to you");
    } catch (err) {
      onToast?.("Assignment failed: " + (err.response?.data?.error ?? err.message), "error");
    }
  };

  const handleRecalcTrust = async () => {
    try {
      const { data } = await adminApi.post(
        `/verification/trust/${record.user_id}/recalculate`
      );
      onToast?.(`Trust score updated to ${data.trust_score}`);
    } catch {
      onToast?.("Trust recalculation failed", "error");
    }
  };

  const isBusy   = busy === `approve-${record.user_id}`;
  const isPending = record.identity_status === "pending" ||
                    record.store_status    === "pending";

  /* Extract logo_url from documents_url jsonb if present */
  const logoUrl = record.store_documents?.logo_url ?? null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 600, display: "flex" }}>
      {/* Backdrop */}
      <div
        style={{ flex: 1, background: "rgba(0,0,0,.45)", cursor: "pointer" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div style={{
        width: "min(580px, 100%)", background: "#fff",
        overflowY: "auto", display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 32px rgba(0,0,0,.15)",
      }}>
        {/* Sticky header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #f0eeea",
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          position: "sticky", top: 0, background: "#fff", zIndex: 1,
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>
              Verification Review
            </div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
              {record.user_name} &middot; {record.user_email}
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn}>&times;</button>
        </div>

        <div style={{ padding: 20 }}>

          {/* ── Status badges ── */}
          <div style={{
            display: "flex", gap: 8, flexWrap: "wrap",
            alignItems: "center", marginBottom: 16,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#888" }}>
              Identity:
            </span>
            <StatusBadge status={record.identity_status} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#888", marginLeft: 8 }}>
              Store:
            </span>
            <StatusBadge status={record.store_status} />
            {record.flagged_for_review && (
              <span style={S.badge("#9333ea")}>Flagged</span>
            )}
            <RiskBadge score={record.risk_score} />
            {isPending && (
              <OverdueBadge createdAt={record.submitted_at} />
            )}
          </div>

          {/* ── Risk flags ── */}
          <RiskFlagsPanel
            riskScore={record.risk_score}
            riskFlags={record.risk_flags}
          />

          {/* ── Rejection reason ── */}
          {record.rejection_reason && (
            <div style={{
              background: "#fff5f5", border: "1px solid #fecaca",
              borderRadius: 10, padding: "10px 14px", fontSize: 12,
              color: "#991b1b", marginBottom: 16,
            }}>
              <strong>Rejection reason:</strong> {record.rejection_reason}
            </div>
          )}

          {/* ── Submission info ── */}
          <div style={S.infoBox}>
            <div style={S.sectionLabel}>Submission Details</div>
            <div style={{ display: "grid", gap: 6 }}>
              <div>
                <span style={{ color: "#888" }}>Document type: </span>
                <strong>
                  {DOC_LABELS[record.document_type] ?? record.document_type}
                </strong>
              </div>
              <div>
                <span style={{ color: "#888" }}>Submitted: </span>
                <strong>{fmtDate(record.submitted_at)}</strong>
              </div>
              {record.reviewed_at && (
                <div>
                  <span style={{ color: "#888" }}>Last reviewed: </span>
                  <strong>{fmtDate(record.reviewed_at)}</strong>
                </div>
              )}
              {record.assigned_admin_name && (
                <div>
                  <span style={{ color: "#888" }}>Assigned to: </span>
                  <strong>{record.assigned_admin_name}</strong>
                </div>
              )}
            </div>
          </div>

          {/* ── Identity documents ── */}
          <div style={S.sectionLabel}>Identity Documents</div>
          <ImageViewer url={record.front_image_url} label="Document Front" />
          <ImageViewer url={record.back_image_url}  label="Document Back" />
          <ImageViewer url={record.selfie_url}       label="Selfie" />

          {/* ── Store document (logo from documents_url jsonb) ── */}
          {logoUrl && (
            <>
              <div style={{ ...S.sectionLabel, marginTop: 8 }}>
                Store Document
              </div>
              <ImageViewer url={logoUrl} label="Store Logo / Business Document" />
            </>
          )}

          {/* ── User info ── */}
          <div style={{ ...S.infoBox, marginBottom: 16, fontSize: 12 }}>
            <div style={S.sectionLabel}>User Info</div>
            <div style={{ display: "grid", gap: 5 }}>
              <div>
                <span style={{ color: "#888" }}>Name: </span>
                <strong>{record.user_name}</strong>
              </div>
              <div>
                <span style={{ color: "#888" }}>Email: </span>
                <strong>{record.user_email}</strong>
              </div>
              {record.user_phone && (
                <div>
                  <span style={{ color: "#888" }}>Phone: </span>
                  <strong>{record.user_phone}</strong>
                </div>
              )}
              <div>
                <span style={{ color: "#888" }}>Email verified: </span>
                <strong>{record.email_verified ? "Yes" : "No"}</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#888" }}>Trust score: </span>
                <strong>{record.trust_score ?? 0}</strong>
                <button
                  className="btn b-ghost"
                  onClick={handleRecalcTrust}
                  style={{ fontSize: 10, padding: "2px 8px", height: 22 }}
                >
                  Recalculate
                </button>
              </div>
              <div>
                <span style={{ color: "#888" }}>Account status: </span>
                <Pill s={record.user_status} />
              </div>
            </div>
          </div>

          {/* ── Notes ── */}
          {record.identity_id && (
            <NotesPanel
              verificationId={record.identity_id}
              verificationType="identity"
            />
          )}

          {/* ── Quick assign ── */}
          {!record.assigned_admin_id && isPending && (
            <div style={{ marginBottom: 12 }}>
              <button
                className="btn b-ghost"
                onClick={handleAssign}
                style={{ fontSize: 11, padding: "4px 12px", height: 28 }}
              >
                Assign to me
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              SINGLE ACTION BLOCK
              Admin presses one button — done.
          ══════════════════════════════════════════════════════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* APPROVE + REJECT — shown when pending */}
            {isPending && (
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  style={{
                    ...S.approveBtn,
                    opacity: isBusy ? .6 : 1,
                    cursor: isBusy ? "not-allowed" : "pointer",
                  }}
                  disabled={isBusy}
                  onClick={() => onApprove(record.user_id)}
                >
                  {isBusy ? "Approving…" : "✓  Approve — Identity & Store"}
                </button>
                <button
                  style={S.rejectBtn}
                  onClick={() => onReject(record)}
                >
                  Reject
                </button>
              </div>
            )}

            {/* RESET — shown when approved or flagged */}
            {(record.identity_status === "approved" ||
              record.identity_status === "flagged") && (
              <button style={S.resetBtn} onClick={() => onReset(record)}>
                Revoke &amp; Request Resubmission
              </button>
            )}

            {/* APPROVE ANYWAY + RESET — shown when rejected */}
            {record.identity_status === "rejected" && (
              <>
                <button
                  style={{
                    ...S.approveBtn,
                    opacity: isBusy ? .6 : 1,
                    cursor: isBusy ? "not-allowed" : "pointer",
                  }}
                  disabled={isBusy}
                  onClick={() => onApprove(record.user_id)}
                >
                  {isBusy ? "Approving…" : "✓  Approve Anyway"}
                </button>
                <button style={S.resetBtn} onClick={() => onReset(record)}>
                  Allow Resubmission
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function Verification({ confirm, onMutation }) {
  const [activeTab,   setActiveTab]   = useState("pending");
  const [list,        setList]        = useState([]);   // merged queue
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [busy,        setBusy]        = useState(null);
  const [drawer,      setDrawer]      = useState(null); // single drawer
  const [rejectModal, setRejectModal] = useState(null);
  const [resetModal,  setResetModal]  = useState(null);
  const [q,           setQ]           = useState("");
  const [toast,       setToast]       = useState(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [offset,      setOffset]      = useState(0);
  const [selected,    setSelected]    = useState(new Set());

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
  }, []);

  /* ── Load stats ── */
  const loadStats = useCallback(async () => {
    try {
      const { data } = await adminApi.get("/verification/stats");
      setStats(data);
    } catch (err) {
      console.error("[stats]", err.message);
    }
  }, []);

  /* ── Load unified queue ──
     We load identity verifications and join with store data client-side.
     The queue is identity-driven because that's the primary record.
  ── */
  const loadQueue = useCallback(async (append = false) => {
    if (!append) { setLoading(true); setOffset(0); setSelected(new Set()); }
    const o = append ? offset : 0;
    try {
      /* Fetch identity queue */
      const { data: idData } = await adminApi.get(
        `/verification/identity?status=${activeTab}&limit=${PAGE_SIZE}&offset=${o}`
      );
      const idList = idData.verifications ?? [];

      /* For each identity record try to find the matching store record.
         We fetch store list for the same user in batch. */
      const userIds   = [...new Set(idList.map((r) => r.user_id))];
      let storeMap    = {};

      if (userIds.length > 0) {
        try {
          const { data: stData } = await adminApi.get(
            `/verification/store?status=all&limit=200&offset=0`
          );
          const stList = stData.verifications ?? [];
          stList.forEach((s) => {
            if (!storeMap[s.user_id]) storeMap[s.user_id] = s;
          });
        } catch { /* store queue may be empty */ }
      }

      /* Merge into unified rows */
      const merged = idList.map((id) => {
        const st = storeMap[id.user_id] ?? {};
        return {
          /* identity fields */
          identity_id      : id.id,
          identity_status  : id.status,
          document_type    : id.document_type,
          risk_score       : id.risk_score,
          risk_flags       : id.risk_flags,
          flagged_for_review: id.flagged_for_review,
          rejection_reason : id.rejection_reason,
          reviewed_at      : id.reviewed_at,
          assigned_admin_id  : id.assigned_admin_id,
          assigned_admin_name: id.assigned_admin_name,
          front_image_url  : id.front_image_url,
          back_image_url   : id.back_image_url,
          selfie_url       : id.selfie_url,
          submitted_at     : id.created_at,
          /* store fields */
          store_id         : st.id         ?? null,
          store_status     : st.status     ?? null,
          store_documents  : st.documents_url ?? null,
          /* user fields (from identity join) */
          user_id          : id.user_id,
          user_name        : id.user_name,
          user_email       : id.user_email,
          user_phone       : id.user_phone,
          user_status      : id.user_status,
          email_verified   : id.email_verified,
          identity_verified: id.identity_verified,
          store_verified   : st.store_verified ?? false,
          trust_score      : id.trust_score,
        };
      });

      if (append) {
        setList((prev) => [...prev, ...merged]);
      } else {
        setList(merged);
      }

      setHasMore(idList.length === PAGE_SIZE);
      setOffset(o + idList.length);
    } catch (err) {
      console.error("[queue]", err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, offset]);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    loadQueue();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const afterMutation = useCallback(async () => {
    setSelected(new Set());
    setDrawer(null);
    await loadQueue();
    await loadStats();
    onMutation?.();
  }, [loadQueue, loadStats, onMutation]);

  /* ═══════════════════════════════════════════════════════════
     ACTIONS — all hit /:userId/approve|reject|reset
  ═══════════════════════════════════════════════════════════ */

  /* Approve — identity + store in one request */
  const handleApprove = useCallback(async (userId) => {
    setBusy(`approve-${userId}`);
    try {
      await adminApi.post(`/verification/${userId}/approve`, {
        note: "Approved via admin panel.",
      });
      showToast("Verified — identity and store approved");
      await afterMutation();
    } catch (err) {
      const msg = err.response?.data?.error ?? err.message;
      showToast(msg, "error");
    } finally {
      setBusy(null);
    }
  }, [afterMutation, showToast]);

  /* Reject — identity + store rejected */
  const handleReject = useCallback(async (userId, reason) => {
    setBusy(`reject-${userId}`);
    try {
      await adminApi.post(`/verification/${userId}/reject`, { reason });
      showToast("Verification rejected — user notified by email");
      await afterMutation();
    } catch (err) {
      showToast(err.response?.data?.error ?? err.message, "error");
    } finally {
      setBusy(null);
    }
  }, [afterMutation, showToast]);

  /* Reset — ask user to resubmit */
  const handleReset = useCallback(async (userId, note) => {
    setBusy(`reset-${userId}`);
    try {
      await adminApi.post(`/verification/${userId}/reset`, { note });
      showToast("Reset — user can now resubmit documents");
      await afterMutation();
    } catch (err) {
      showToast(err.response?.data?.error ?? err.message, "error");
    } finally {
      setBusy(null);
    }
  }, [afterMutation, showToast]);

  /* Bulk approve */
  const handleBulkApprove = useCallback(async () => {
    if (selected.size === 0) return;
    setBusy("bulk-approve");
    let approved = 0;
    for (const userId of selected) {
      try {
        await adminApi.post(`/verification/${userId}/approve`, {
          note: "Bulk approved via admin panel.",
        });
        approved++;
      } catch { /* continue */ }
    }
    showToast(`Approved ${approved} of ${selected.size} submissions`);
    await afterMutation();
    setBusy(null);
  }, [selected, afterMutation, showToast]);

  /* Bulk reject */
  const handleBulkReject = useCallback(async (reason) => {
    if (selected.size === 0) return;
    setBusy("bulk-reject");
    let rejected = 0;
    for (const userId of selected) {
      try {
        await adminApi.post(`/verification/${userId}/reject`, { reason });
        rejected++;
      } catch { /* continue */ }
    }
    showToast(`Rejected ${rejected} of ${selected.size} submissions`);
    await afterMutation();
    setBusy(null);
  }, [selected, afterMutation, showToast]);

  /* ── Selection helpers ── */
  const toggleSelect = useCallback((userId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === displayed.length
        ? new Set()
        : new Set(displayed.map((r) => r.user_id))
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Filter ── */
  const displayed = useMemo(() => {
    const lq = q.toLowerCase();
    if (!lq) return list;
    return list.filter((r) =>
      (r.user_name  ?? "").toLowerCase().includes(lq) ||
      (r.user_email ?? "").toLowerCase().includes(lq) ||
      (r.document_type ?? "").toLowerCase().includes(lq)
    );
  }, [list, q]);

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  return (
    <div>
      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20, flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
            Verification Queue
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
            Review and approve submitted documents in one click
          </p>
        </div>
        <Rfr onClick={() => { loadQueue(); loadStats(); }} />
      </div>

      {/* Stats */}
      {stats && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 10, marginBottom: 20,
        }}>
          {[
            { label: "Pending",         value: stats.identity?.pending   ?? 0, color: "#d97706" },
            { label: "Approved",         value: stats.identity?.approved  ?? 0, color: "#16a34a" },
            { label: "Overdue (>24h)",   value: stats.identity?.overdue   ?? 0, color: "#dc2626" },
            { label: "Flagged",          value: stats.identity?.flagged   ?? 0, color: "#9333ea" },
            { label: "Email Verified",   value: stats.users?.email_verified ?? 0, color: "#0369a1" },
            { label: "Fully Verified",   value: stats.users?.identity_verified ?? 0, color: "#15803d" },
            { label: "Limited Listings", value: stats.limited_listings?.total ?? 0, color: "#9333ea" },
          ].map((s) => (
            <div key={s.label} style={S.statCard}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: "#aaa",
                textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 4,
              }}>
                {s.label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>
                {(s.value ?? 0).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {QUEUE_TABS.map((t) => {
          const cnt   = stats?.identity?.[t.key] ?? 0;
          const isAct = activeTab === t.key;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              padding: "6px 16px", borderRadius: 999, cursor: "pointer",
              border:     isAct ? "none" : "1.5px solid #e8e6e0",
              background: isAct ? "#1a1a1a" : "#fafaf8",
              color:      isAct ? "#fff"    : "#555",
              fontWeight: 700, fontSize: 12,
              display: "flex", alignItems: "center", gap: 5,
            }}>
              {t.label}
              {t.key !== "all" && cnt > 0 && (
                <span style={{
                  background: isAct ? "rgba(255,255,255,.2)" : "#e8e6e0",
                  color: isAct ? "#fff" : "#555",
                  borderRadius: 999, fontSize: 10, padding: "1px 6px",
                }}>
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search + bulk toolbar */}
      <div style={{
        display: "flex", gap: 10, marginBottom: 16,
        alignItems: "center", flexWrap: "wrap",
      }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email or document type…"
          style={{
            flex: 1, minWidth: 220, maxWidth: 420, padding: "9px 14px",
            border: "1.5px solid #e8e6e0", borderRadius: 10,
            fontSize: 13, fontFamily: "inherit", outline: "none",
            background: "#fafaf8", boxSizing: "border-box",
          }}
        />

        {/* Bulk actions — pending only */}
        {activeTab === "pending" && selected.size > 0 && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#555" }}>
              {selected.size} selected
            </span>
            <button className="btn b-solid"
              disabled={busy === "bulk-approve"}
              onClick={() => confirm({
                title:   `Bulk approve ${selected.size} submissions?`,
                body:    "Identity and store will be approved for all selected users.",
                confirm: "Approve All",
                action:  handleBulkApprove,
              })}
              style={{ fontSize: 11, padding: "4px 12px", height: 28 }}>
              {busy === "bulk-approve" ? "…" : "Approve All"}
            </button>
            <button className="btn b-red"
              onClick={() => setRejectModal({ type: "bulk" })}
              style={{ fontSize: 11, padding: "4px 12px", height: 28 }}>
              Reject All
            </button>
            <button className="btn b-ghost"
              onClick={() => setSelected(new Set())}
              style={{ fontSize: 11, padding: "4px 10px", height: 28 }}>
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>
          Loading…
        </div>
      ) : displayed.length === 0 ? (
        <div style={{
          textAlign: "center", padding: 60, color: "#aaa",
          background: "#fafaf8", borderRadius: 14,
          border: "1.5px dashed #e8e6e0",
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
            Nothing here
          </div>
          <div style={{ fontSize: 13 }}>
            No {activeTab} verifications found.
          </div>
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%", borderCollapse: "collapse",
              fontSize: 13, minWidth: 700,
            }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #f0eeea" }}>
                  {/* Checkbox — pending only */}
                  {activeTab === "pending" && (
                    <th style={{ padding: "10px 6px", width: 32 }}>
                      <input
                        type="checkbox"
                        checked={
                          selected.size === displayed.length &&
                          displayed.length > 0
                        }
                        onChange={toggleSelectAll}
                        style={{ cursor: "pointer" }}
                      />
                    </th>
                  )}
                  {[
                    "User", "Document", "Identity", "Store",
                    "Risk", "Trust", "Submitted", "Actions",
                  ].map((h) => (
                    <th key={h} style={{
                      padding: "10px 10px", textAlign: "left",
                      fontSize: 11, fontWeight: 700, color: "#aaa",
                      textTransform: "uppercase", letterSpacing: ".4px",
                      whiteSpace: "nowrap",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((r) => {
                  const isBusy = busy === `approve-${r.user_id}`;
                  const isSelected = selected.has(r.user_id);
                  return (
                    <tr
                      key={r.identity_id}
                      style={{
                        borderBottom: "1px solid #f5f4f0",
                        cursor: "pointer",
                        background: isSelected ? "#fff7ed" : "transparent",
                        transition: "background .12s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected)
                          e.currentTarget.style.background = "#fafaf8";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          isSelected ? "#fff7ed" : "transparent";
                      }}
                      onClick={() => setDrawer(r)}
                    >
                      {/* Checkbox */}
                      {activeTab === "pending" && (
                        <td style={{ padding: "10px 6px" }}
                            onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(r.user_id)}
                            style={{ cursor: "pointer" }}
                          />
                        </td>
                      )}

                      {/* User */}
                      <td style={{ padding: "10px 10px" }}>
                        <div style={{ fontWeight: 700 }}>{r.user_name}</div>
                        <div style={{ fontSize: 11, color: "#888" }}>
                          {r.user_email}
                        </div>
                      </td>

                      {/* Document type */}
                      <td style={{ padding: "10px 10px" }}>
                        <span style={S.badge("#6b7280")}>
                          {DOC_LABELS[r.document_type] ?? r.document_type}
                        </span>
                      </td>

                      {/* Identity status */}
                      <td style={{ padding: "10px 10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <StatusBadge status={r.identity_status} />
                          {r.identity_status === "pending" && (
                            <OverdueBadge createdAt={r.submitted_at} />
                          )}
                        </div>
                      </td>

                      {/* Store status */}
                      <td style={{ padding: "10px 10px" }}>
                        <StatusBadge status={r.store_status ?? "pending"} />
                      </td>

                      {/* Risk */}
                      <td style={{ padding: "10px 10px" }}>
                        <RiskBadge score={r.risk_score} />
                      </td>

                      {/* Trust */}
                      <td style={{ padding: "10px 10px" }}>
                        <span style={{
                          fontWeight: 700,
                          color: (r.trust_score ?? 0) >= 60 ? "#16a34a"
                            : (r.trust_score ?? 0) >= 30 ? "#d97706"
                            : "#dc2626",
                        }}>
                          {r.trust_score ?? 0}
                        </span>
                      </td>

                      {/* Submitted */}
                      <td style={{ padding: "10px 10px", color: "#888", whiteSpace: "nowrap" }}>
                        {fmtDateS(r.submitted_at)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "10px 10px" }}
                          onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 6 }}>
                          {r.identity_status === "pending" && (
                            <>
                              <button
                                className="btn b-solid"
                                disabled={isBusy}
                                onClick={() => confirm({
                                  title:   "Approve submission?",
                                  body:    `Approve ${r.user_name}'s identity and store together?`,
                                  confirm: "Approve",
                                  action:  () => handleApprove(r.user_id),
                                })}
                                style={{ fontSize: 11, padding: "4px 10px", height: 28 }}
                              >
                                {isBusy ? "…" : "Approve"}
                              </button>
                              <button
                                className="btn b-red"
                                onClick={() => setRejectModal({
                                  type   : "single",
                                  userId : r.user_id,
                                  name   : r.user_name,
                                })}
                                style={{ fontSize: 11, padding: "4px 10px", height: 28 }}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            className="btn b-ghost"
                            onClick={() => setDrawer(r)}
                            style={{ fontSize: 11, padding: "4px 10px", height: 28 }}
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Load more */}
          {hasMore && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button
                className="btn b-ghost"
                onClick={() => loadQueue(true)}
                style={{ fontSize: 13, padding: "8px 24px" }}
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}

      {/* Unified drawer */}
      {drawer && (
        <VerificationDrawer
          record={drawer}
          onClose={() => setDrawer(null)}
          onApprove={(userId) => confirm({
            title:   "Approve submission?",
            body:    `Approve ${drawer.user_name}'s identity and store in one action?`,
            confirm: "Approve",
            action:  () => handleApprove(userId),
          })}
          onReject={(r) => setRejectModal({
            type   : "single",
            userId : r.user_id,
            name   : r.user_name,
          })}
          onReset={(r) => setResetModal({
            userId : r.user_id,
            name   : r.user_name,
          })}
          busy={busy}
          onToast={showToast}
        />
      )}

      {/* Reject modal */}
      {rejectModal && (
        <RejectModal
          title={
            rejectModal.type === "bulk"
              ? `Bulk Reject ${selected.size} Submissions`
              : `Reject Verification — ${rejectModal.name}`
          }
          onSubmit={(reason) =>
            rejectModal.type === "bulk"
              ? handleBulkReject(reason)
              : handleReject(rejectModal.userId, reason)
          }
          onClose={() => setRejectModal(null)}
        />
      )}

      {/* Reset modal */}
      {resetModal && (
        <ResetModal
          title={`Reset Verification — ${resetModal.name}`}
          onSubmit={(note) => handleReset(resetModal.userId, note)}
          onClose={() => setResetModal(null)}
        />
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}