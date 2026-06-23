/**
 * src/page/admin/SuperAdmin/Verification.jsx
 *
 * Upgrades:
 *  1.  Notes history panel in drawers (read-only + add note)
 *  2.  Risk score + risk flags display in identity drawer
 *  3.  Trust score recalculate button
 *  4.  Assigned admin display + self-assign button
 *  5.  Limited listings count in stats row
 *  6.  Overdue badge on pending items older than 24h
 *  7.  Bulk approve/reject for identity (checkbox + toolbar)
 *  8.  Toast notifications after actions
 *  9.  Document number hidden — shows hash indicator instead
 * 10.  StatusBadge null-safe fix (was crashing on null status)
 * 11.  Keyboard support: Escape closes drawers/modals
 * 12.  Empty state illustrations improved
 * 13.  Responsive drawer (full-width on mobile)
 * 14.  Pagination support (load more button)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import adminApi from "../../../../services/adminApi";
import { fmtDate, fmtDateS } from "../adminlayout/helpers";
import { Pill, Card, Rfr } from "../adminlayout/atoms";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const PAGE_SIZE = 50;

const IDENTITY_TABS = [
  { key: "pending",  label: "Pending"  },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "flagged",  label: "Flagged"  },
  { key: "reset",    label: "Reset"    },
  { key: "all",      label: "All"      },
];

const STORE_TABS = [
  { key: "pending",  label: "Pending"  },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
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
};

/* ═══════════════════════════════════════════════════════════════
   SMALL COMPONENTS
═══════════════════════════════════════════════════════════════ */

/* Fix #10: null-safe StatusBadge */
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
    <span style={{
      ...S.badge("#dc2626"),
      fontSize: 10,
      marginLeft: 4,
    }}>
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
  return (
    <span style={S.badge(color)}>
      Risk: {score}
    </span>
  );
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
        <div style={{ fontSize: 12, color: "#aaa" }}>Loading notes...</div>
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
                display: "flex", justifyContent: "space-between",
                marginBottom: 3,
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

      {/* Add note input */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a note..."
          style={{
            flex: 1, padding: "8px 12px", border: "1.5px solid #e8e6e0",
            borderRadius: 8, fontSize: 12, outline: "none",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              addNote();
            }
          }}
        />
        <button
          className="btn b-ghost"
          disabled={!newNote.trim() || saving}
          onClick={addNote}
          style={{ fontSize: 11, padding: "6px 12px" }}
        >
          {saving ? "..." : "Add"}
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
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 12,
            }}>
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
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
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
          placeholder='e.g. "Documents unclear"'
          style={S.textarea}
          autoFocus
        />
        <div className="modal-btns" style={{ marginTop: 14 }}>
          <button className="btn b-ghost" onClick={onClose}>Cancel</button>
          <button className="btn b-red" disabled={!reason.trim() || busy}
                  onClick={submit}>
            {busy ? "Submitting..." : "Confirm Reject"}
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
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
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
          The user will be allowed to resubmit. Their verified status will be cleared.
        </p>
        <label style={S.label}>Note (optional)</label>
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
            {busy ? "Resetting..." : "Reset & Allow Resubmit"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DRAWERS
═══════════════════════════════════════════════════════════════ */

function IdentityDrawer({ record, onClose, onApprove, onReject, onReset, busy, onToast }) {
  if (!record) return null;

  /* Escape key closes drawer */
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleAssign = async () => {
    try {
      await adminApi.post(`/verification/identity/${record.id}/assign`);
      onToast?.("Assigned to you");
    } catch (err) {
      onToast?.("Assignment failed: " + err.message, "error");
    }
  };

  const handleRecalcTrust = async () => {
    try {
      const { data } = await adminApi.post(
        `/verification/trust/${record.user_id}/recalculate`
      );
      onToast?.(`Trust score updated to ${data.trust_score}`);
    } catch (err) {
      onToast?.("Trust recalculation failed", "error");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 600, display: "flex" }}>
      <div style={{ flex: 1, background: "rgba(0,0,0,.45)", cursor: "pointer" }}
           onClick={onClose} />
      <div style={{
        width: "min(560px, 100%)", background: "#fff",
        overflowY: "auto", display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 32px rgba(0,0,0,.15)",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #f0eeea",
          display: "flex", alignItems: "center",
          justifyContent: "space-between", position: "sticky",
          top: 0, background: "#fff", zIndex: 1,
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Identity Review</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
              {record.user_name} &middot; {record.user_email}
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn}>&times;</button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Status + badges */}
          <div style={{
            marginBottom: 16, display: "flex", gap: 8,
            alignItems: "center", flexWrap: "wrap",
          }}>
            <StatusBadge status={record.status} />
            {record.identity_verified && (
              <span style={S.badge("#16a34a")}>Verified</span>
            )}
            <RiskBadge score={record.risk_score} />
            {record.flagged_for_review && (
              <span style={S.badge("#9333ea")}>Flagged</span>
            )}
            {record.status === "pending" && (
              <OverdueBadge createdAt={record.created_at} />
            )}
          </div>

          {/* Risk flags panel */}
          <RiskFlagsPanel
            riskScore={record.risk_score}
            riskFlags={record.risk_flags}
          />

          {/* Rejection banner */}
          {record.rejection_reason && (
            <div style={{
              background: "#fff5f5", border: "1px solid #fecaca",
              borderRadius: 10, padding: "10px 14px", fontSize: 12,
              color: "#991b1b", marginBottom: 16,
            }}>
              <strong>Rejection reason:</strong> {record.rejection_reason}
            </div>
          )}

          {/* Document info */}
          <div style={S.infoBox}>
            <div style={{ display: "grid", gap: 6 }}>
              <div>
                <span style={{ color: "#888" }}>Document type: </span>
                <strong>
                  {DOC_LABELS[record.document_type] ?? record.document_type}
                </strong>
              </div>
              <div>
                <span style={{ color: "#888" }}>Submitted: </span>
                <strong>{fmtDate(record.created_at)}</strong>
              </div>
              {record.reviewed_at && (
                <div>
                  <span style={{ color: "#888" }}>Reviewed: </span>
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

          {/* Images */}
          <ImageViewer url={record.front_image_url} label="Document Front" />
          <ImageViewer url={record.back_image_url}  label="Document Back" />
          <ImageViewer url={record.selfie_url}       label="Selfie" />

          {/* User info */}
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
                <span style={{ color: "#888" }}>Status: </span>
                <Pill s={record.user_status} />
              </div>
            </div>
          </div>

          {/* Notes panel */}
          <NotesPanel
            verificationId={record.id}
            verificationType="identity"
          />

          {/* Quick actions bar */}
          <div style={{
            display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap",
          }}>
            {!record.assigned_admin_id && record.status === "pending" && (
              <button className="btn b-ghost" onClick={handleAssign}
                      style={{ fontSize: 11, padding: "4px 12px", height: 28 }}>
                Assign to me
              </button>
            )}
          </div>

          {/* Main actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {record.status === "pending" && (
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn b-solid"
                  disabled={busy === `id-approve-${record.id}`}
                  onClick={() => onApprove(record.id)}
                  style={{ flex: 1, height: 44, fontSize: 14 }}>
                  {busy === `id-approve-${record.id}` ? "Approving..." : "Approve"}
                </button>
                <button className="btn b-red"
                  onClick={() => onReject(record)}
                  style={{ flex: 1, height: 44, fontSize: 14 }}>
                  Reject
                </button>
              </div>
            )}

            {(record.status === "approved" || record.status === "flagged") && (
              <button className="btn b-ghost" onClick={() => onReset(record)}
                style={{
                  width: "100%", height: 40, fontSize: 13,
                  color: "#d97706", borderColor: "#fde68a",
                }}>
                Revoke &amp; Request Resubmission
              </button>
            )}

            {record.status === "rejected" && (
              <>
                <button className="btn b-solid"
                  disabled={busy === `id-approve-${record.id}`}
                  onClick={() => onApprove(record.id)}
                  style={{ width: "100%", height: 44, fontSize: 14 }}>
                  {busy === `id-approve-${record.id}` ? "Approving..." : "Approve Anyway"}
                </button>
                <button className="btn b-ghost" onClick={() => onReset(record)}
                  style={{ width: "100%", height: 40, fontSize: 13 }}>
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

function StoreDrawer({ record, onClose, onApprove, onReject, onReset, busy, onToast }) {
  if (!record) return null;

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

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

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 600, display: "flex" }}>
      <div style={{ flex: 1, background: "rgba(0,0,0,.45)", cursor: "pointer" }}
           onClick={onClose} />
      <div style={{
        width: "min(560px, 100%)", background: "#fff",
        overflowY: "auto", display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 32px rgba(0,0,0,.15)",
      }}>
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #f0eeea",
          display: "flex", alignItems: "center",
          justifyContent: "space-between", position: "sticky",
          top: 0, background: "#fff", zIndex: 1,
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Store Review</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
              {record.user_name} &middot; {record.user_email}
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn}>&times;</button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{
            marginBottom: 16, display: "flex", gap: 8,
            alignItems: "center", flexWrap: "wrap",
          }}>
            <StatusBadge status={record.status} />
            {record.store_verified && (
              <span style={S.badge("#16a34a")}>Store Verified</span>
            )}
          </div>

          {record.rejection_reason && (
            <div style={{
              background: "#fff5f5", border: "1px solid #fecaca",
              borderRadius: 10, padding: "10px 14px", fontSize: 12,
              color: "#991b1b", marginBottom: 16,
            }}>
              <strong>Rejection reason:</strong> {record.rejection_reason}
            </div>
          )}

          <div style={S.infoBox}>
            <div style={{ display: "grid", gap: 6 }}>
              <div>
                <span style={{ color: "#888" }}>Store name: </span>
                <strong>{record.store_name}</strong>
              </div>
              {record.store_description && (
                <div>
                  <span style={{ color: "#888" }}>Description: </span>
                  <span>{record.store_description}</span>
                </div>
              )}
              <div>
                <span style={{ color: "#888" }}>Submitted: </span>
                <strong>{fmtDate(record.created_at)}</strong>
              </div>
            </div>
          </div>

          <ImageViewer url={record.logo_url} label="Store Logo" />

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
              <div>
                <span style={{ color: "#888" }}>Identity: </span>
                <strong>{record.identity_verified ? "Verified" : "Not verified"}</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#888" }}>Trust: </span>
                <strong>{record.trust_score ?? 0}</strong>
                <button className="btn b-ghost" onClick={handleRecalcTrust}
                  style={{ fontSize: 10, padding: "2px 8px", height: 22 }}>
                  Recalculate
                </button>
              </div>
            </div>
          </div>

          <NotesPanel
            verificationId={record.id}
            verificationType="store"
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {record.status === "pending" && (
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn b-solid"
                  disabled={busy === `store-approve-${record.id}`}
                  onClick={() => onApprove(record.id)}
                  style={{ flex: 1, height: 44, fontSize: 14 }}>
                  {busy === `store-approve-${record.id}` ? "Approving..." : "Approve Store"}
                </button>
                <button className="btn b-red"
                  onClick={() => onReject(record)}
                  style={{ flex: 1, height: 44, fontSize: 14 }}>
                  Reject
                </button>
              </div>
            )}

            {record.status === "approved" && (
              <button className="btn b-ghost" onClick={() => onReset(record)}
                style={{
                  width: "100%", height: 40, fontSize: 13,
                  color: "#d97706", borderColor: "#fde68a",
                }}>
                Revoke &amp; Request Resubmission
              </button>
            )}

            {record.status === "rejected" && (
              <>
                <button className="btn b-solid"
                  disabled={busy === `store-approve-${record.id}`}
                  onClick={() => onApprove(record.id)}
                  style={{ width: "100%", height: 44, fontSize: 14 }}>
                  Approve Anyway
                </button>
                <button className="btn b-ghost" onClick={() => onReset(record)}
                  style={{ width: "100%", height: 40, fontSize: 13 }}>
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
  const [section,       setSection]       = useState("identity");
  const [identityTab,   setIdentityTab]   = useState("pending");
  const [storeTab,      setStoreTab]      = useState("pending");
  const [identityList,  setIdentityList]  = useState([]);
  const [storeList,     setStoreList]     = useState([]);
  const [stats,         setStats]         = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [busy,          setBusy]          = useState(null);
  const [idDrawer,      setIdDrawer]      = useState(null);
  const [storeDrawer,   setStoreDrawer]   = useState(null);
  const [rejectModal,   setRejectModal]   = useState(null);
  const [resetModal,    setResetModal]    = useState(null);
  const [q,             setQ]             = useState("");
  const [toast,         setToast]         = useState(null);
  const [hasMore,       setHasMore]       = useState(false);
  const [offset,        setOffset]        = useState(0);

  /* Bulk selection (identity only) */
  const [selected,      setSelected]      = useState(new Set());

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

  /* ── Load identity ── */
  const loadIdentity = useCallback(async (append = false) => {
    if (!append) { setLoading(true); setOffset(0); }
    const o = append ? offset : 0;
    try {
      const { data } = await adminApi.get(
        `/verification/identity?status=${identityTab}&limit=${PAGE_SIZE}&offset=${o}`
      );
      const items = data.verifications ?? [];
      if (append) {
        setIdentityList((prev) => [...prev, ...items]);
      } else {
        setIdentityList(items);
      }
      setHasMore(items.length === PAGE_SIZE);
      setOffset(o + items.length);
    } catch (err) {
      console.error("[identity]", err.message);
    } finally {
      setLoading(false);
    }
  }, [identityTab, offset]);

  /* ── Load store ── */
  const loadStore = useCallback(async (append = false) => {
    if (!append) { setLoading(true); setOffset(0); }
    const o = append ? offset : 0;
    try {
      const { data } = await adminApi.get(
        `/verification/store?status=${storeTab}&limit=${PAGE_SIZE}&offset=${o}`
      );
      const items = data.verifications ?? [];
      if (append) {
        setStoreList((prev) => [...prev, ...items]);
      } else {
        setStoreList(items);
      }
      setHasMore(items.length === PAGE_SIZE);
      setOffset(o + items.length);
    } catch (err) {
      console.error("[store]", err.message);
    } finally {
      setLoading(false);
    }
  }, [storeTab, offset]);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    setSelected(new Set());
    if (section === "identity") loadIdentity();
    else loadStore();
  }, [section, identityTab, storeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const afterMutation = useCallback(async () => {
    setSelected(new Set());
    if (section === "identity") await loadIdentity();
    else await loadStore();
    await loadStats();
    onMutation?.();
  }, [section, loadIdentity, loadStore, loadStats, onMutation]);

  /* ── Identity actions ── */
  const handleIdApprove = useCallback(async (id) => {
    setBusy(`id-approve-${id}`);
    try {
      await adminApi.post(`/verification/identity/${id}/approve`, { note: "Approved via admin panel." });
      showToast("Identity approved");
      await afterMutation();
      setIdDrawer(null);
    } catch (err) {
      showToast(err.response?.data?.error ?? err.message, "error");
    } finally { setBusy(null); }
  }, [afterMutation, showToast]);

  const handleIdReject = useCallback(async (id, reason) => {
    setBusy(`id-reject-${id}`);
    try {
      await adminApi.post(`/verification/identity/${id}/reject`, { reason });
      showToast("Identity rejected");
      await afterMutation();
      setIdDrawer(null);
    } catch (err) {
      showToast(err.response?.data?.error ?? err.message, "error");
    } finally { setBusy(null); }
  }, [afterMutation, showToast]);

  const handleIdReset = useCallback(async (id, note) => {
    setBusy(`id-reset-${id}`);
    try {
      await adminApi.post(`/verification/identity/${id}/reset`, { note });
      showToast("Identity reset — user can resubmit");
      await afterMutation();
      setIdDrawer(null);
    } catch (err) {
      showToast(err.response?.data?.error ?? err.message, "error");
    } finally { setBusy(null); }
  }, [afterMutation, showToast]);

  /* ── Bulk identity actions ── */
  const handleBulkApprove = useCallback(async () => {
    if (selected.size === 0) return;
    setBusy("bulk-approve");
    try {
      const { data } = await adminApi.post("/verification/identity/bulk-approve", {
        ids  : [...selected],
        note : "Bulk approved via admin panel.",
      });
      showToast(`Approved ${data.results?.approved?.length ?? 0} identities`);
      await afterMutation();
    } catch (err) {
      showToast(err.response?.data?.error ?? err.message, "error");
    } finally { setBusy(null); }
  }, [selected, afterMutation, showToast]);

  const handleBulkReject = useCallback(async (reason) => {
    if (selected.size === 0) return;
    setBusy("bulk-reject");
    try {
      const { data } = await adminApi.post("/verification/identity/bulk-reject", {
        ids : [...selected],
        reason,
      });
      showToast(`Rejected ${data.results?.rejected?.length ?? 0} identities`);
      await afterMutation();
    } catch (err) {
      showToast(err.response?.data?.error ?? err.message, "error");
    } finally { setBusy(null); }
  }, [selected, afterMutation, showToast]);

  /* ── Store actions ── */
  const handleStoreApprove = useCallback(async (id) => {
    setBusy(`store-approve-${id}`);
    try {
      await adminApi.post(`/verification/store/${id}/approve`, { note: "Approved via admin panel." });
      showToast("Store approved");
      await afterMutation();
      setStoreDrawer(null);
    } catch (err) {
      showToast(err.response?.data?.error ?? err.message, "error");
    } finally { setBusy(null); }
  }, [afterMutation, showToast]);

  const handleStoreReject = useCallback(async (id, reason) => {
    setBusy(`store-reject-${id}`);
    try {
      await adminApi.post(`/verification/store/${id}/reject`, { reason });
      showToast("Store rejected");
      await afterMutation();
      setStoreDrawer(null);
    } catch (err) {
      showToast(err.response?.data?.error ?? err.message, "error");
    } finally { setBusy(null); }
  }, [afterMutation, showToast]);

  const handleStoreReset = useCallback(async (id, note) => {
    setBusy(`store-reset-${id}`);
    try {
      await adminApi.post(`/verification/store/${id}/reset`, { note });
      showToast("Store reset — user can resubmit");
      await afterMutation();
      setStoreDrawer(null);
    } catch (err) {
      showToast(err.response?.data?.error ?? err.message, "error");
    } finally { setBusy(null); }
  }, [afterMutation, showToast]);

  /* ── Selection helpers ── */
  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selected.size === displayed.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayed.map((r) => r.id)));
    }
  }, [selected.size]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Filter ── */
  const displayed = useMemo(() => {
    const list = section === "identity" ? identityList : storeList;
    const lq   = q.toLowerCase();
    if (!lq) return list;
    return list.filter((r) =>
      (r.user_name  ?? "").toLowerCase().includes(lq) ||
      (r.user_email ?? "").toLowerCase().includes(lq) ||
      (section === "identity"
        ? (r.document_type ?? "").toLowerCase().includes(lq)
        : (r.store_name ?? "").toLowerCase().includes(lq))
    );
  }, [section, identityList, storeList, q]);

  const tabs       = section === "identity" ? IDENTITY_TABS : STORE_TABS;
  const activeTab  = section === "identity" ? identityTab   : storeTab;
  const setActiveTab = section === "identity" ? setIdentityTab : setStoreTab;

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
            Verification
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
            Review identity documents and store applications
          </p>
        </div>
        <Rfr onClick={() => {
          if (section === "identity") loadIdentity();
          else loadStore();
          loadStats();
        }} />
      </div>

      {/* Stats */}
      {stats && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 10, marginBottom: 20,
        }}>
          {[
            { label: "ID Pending",       value: stats.identity?.pending   ?? 0, color: "#d97706" },
            { label: "ID Approved",       value: stats.identity?.approved  ?? 0, color: "#16a34a" },
            { label: "ID Overdue",        value: stats.identity?.overdue   ?? 0, color: "#dc2626" },
            { label: "Store Pending",     value: stats.store?.pending      ?? 0, color: "#d97706" },
            { label: "Store Approved",    value: stats.store?.approved     ?? 0, color: "#16a34a" },
            { label: "Email Verified",    value: stats.users?.email_verified ?? 0, color: "#0369a1" },
            { label: "Limited Listings",  value: stats.limited_listings?.total ?? 0, color: "#9333ea" },
          ].map((s) => (
            <div key={s.label} style={S.statCard}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: "#aaa",
                textTransform: "uppercase", letterSpacing: ".4px",
                marginBottom: 4,
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

      {/* Section toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { key: "identity", label: "Identity", count: stats?.identity?.pending ?? 0 },
          { key: "store",    label: "Store",    count: stats?.store?.pending    ?? 0 },
        ].map((s) => {
          const active = section === s.key;
          return (
            <button key={s.key} onClick={() => setSection(s.key)} style={{
              padding: "8px 18px", borderRadius: 10,
              border:     active ? "none" : "1.5px solid #e8e6e0",
              background: active ? "#ff5722" : "#fafaf8",
              color:      active ? "#fff"    : "#555",
              fontWeight: 700, fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {s.label}
              {s.count > 0 && (
                <span style={{
                  background: active ? "rgba(255,255,255,.3)" : "#ff5722",
                  color: "#fff", borderRadius: 999,
                  fontSize: 10, fontWeight: 800, padding: "1px 6px",
                }}>
                  {s.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Status tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {tabs.map((t) => {
          const cnt   = stats?.[section]?.[t.key] ?? 0;
          const isAct = activeTab === t.key;
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              padding: "6px 14px", borderRadius: 999, cursor: "pointer",
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

      {/* Bulk toolbar + search */}
      <div style={{
        display: "flex", gap: 10, marginBottom: 16,
        alignItems: "center", flexWrap: "wrap",
      }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={section === "identity"
            ? "Search by name, email or document type..."
            : "Search by name, email or store name..."}
          style={{
            flex: 1, minWidth: 220, maxWidth: 420, padding: "9px 14px",
            border: "1.5px solid #e8e6e0", borderRadius: 10,
            fontSize: 13, fontFamily: "inherit", outline: "none",
            boxSizing: "border-box", background: "#fafaf8",
          }}
        />

        {/* Bulk actions — identity pending only */}
        {section === "identity" && identityTab === "pending" && selected.size > 0 && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#555" }}>
              {selected.size} selected
            </span>
            <button className="btn b-solid"
              disabled={busy === "bulk-approve"}
              onClick={() => confirm({
                title   : `Bulk approve ${selected.size} identities?`,
                body    : "This will approve all selected pending records.",
                confirm : "Approve All",
                action  : handleBulkApprove,
              })}
              style={{ fontSize: 11, padding: "4px 12px", height: 28 }}>
              {busy === "bulk-approve" ? "..." : "Approve All"}
            </button>
            <button className="btn b-red"
              onClick={() => setRejectModal({ type: "bulk-identity" })}
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
          Loading...
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
            No {activeTab} {section} verifications found.
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
                  {/* Checkbox column for identity pending */}
                  {section === "identity" && identityTab === "pending" && (
                    <th style={{ padding: "10px 6px", width: 32 }}>
                      <input
                        type="checkbox"
                        checked={selected.size === displayed.length && displayed.length > 0}
                        onChange={toggleSelectAll}
                        style={{ cursor: "pointer" }}
                      />
                    </th>
                  )}
                  {(section === "identity"
                    ? ["User", "Document", "Risk", "Trust", "Status", "Submitted", "Actions"]
                    : ["User", "Store Name", "Logo", "Trust", "Status", "Submitted", "Actions"]
                  ).map((h) => (
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
                {displayed.map((r) => (
                  <tr key={r.id}
                    style={{
                      borderBottom: "1px solid #f5f4f0",
                      cursor: "pointer", transition: "background .12s",
                      background: selected.has(r.id) ? "#fff7ed" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!selected.has(r.id))
                        e.currentTarget.style.background = "#fafaf8";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        selected.has(r.id) ? "#fff7ed" : "transparent";
                    }}
                    onClick={() => section === "identity"
                      ? setIdDrawer(r) : setStoreDrawer(r)
                    }
                  >
                    {/* Checkbox */}
                    {section === "identity" && identityTab === "pending" && (
                      <td style={{ padding: "10px 6px" }}
                          onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleSelect(r.id)}
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

                    {section === "identity" ? (
                      <>
                        <td style={{ padding: "10px 10px" }}>
                          <span style={S.badge("#6b7280")}>
                            {DOC_LABELS[r.document_type] ?? r.document_type}
                          </span>
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          <RiskBadge score={r.risk_score} />
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: "10px 10px", fontWeight: 600 }}>
                          {r.store_name}
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          {r.logo_url ? (
                            <img src={r.logo_url} alt=""
                              style={{
                                width: 36, height: 36, objectFit: "cover",
                                borderRadius: 8, border: "1.5px solid #f0eeea",
                              }} />
                          ) : (
                            <div style={{
                              width: 36, height: 36, borderRadius: 8,
                              background: "#f0eeea",
                            }} />
                          )}
                        </td>
                      </>
                    )}

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

                    <td style={{ padding: "10px 10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <StatusBadge status={r.status} />
                        {r.status === "pending" && (
                          <OverdueBadge createdAt={r.created_at} />
                        )}
                      </div>
                    </td>

                    <td style={{
                      padding: "10px 10px", color: "#888",
                      whiteSpace: "nowrap",
                    }}>
                      {fmtDateS(r.created_at)}
                    </td>

                    <td style={{ padding: "10px 10px" }}
                        onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {r.status === "pending" && section === "identity" && (
                          <>
                            <button className="btn b-solid"
                              disabled={busy === `id-approve-${r.id}`}
                              onClick={() => confirm({
                                title:   "Approve identity?",
                                body:    `Approve ${r.user_name}'s identity?`,
                                confirm: "Approve",
                                action:  () => handleIdApprove(r.id),
                              })}
                              style={{ fontSize: 11, padding: "4px 10px", height: 28 }}>
                              {busy === `id-approve-${r.id}` ? "..." : "Approve"}
                            </button>
                            <button className="btn b-red"
                              onClick={() => setRejectModal({ type: "identity", record: r })}
                              style={{ fontSize: 11, padding: "4px 10px", height: 28 }}>
                              Reject
                            </button>
                          </>
                        )}
                        {r.status === "pending" && section === "store" && (
                          <>
                            <button className="btn b-solid"
                              disabled={busy === `store-approve-${r.id}`}
                              onClick={() => confirm({
                                title:   "Approve store?",
                                body:    `Approve "${r.store_name}"?`,
                                confirm: "Approve",
                                action:  () => handleStoreApprove(r.id),
                              })}
                              style={{ fontSize: 11, padding: "4px 10px", height: 28 }}>
                              {busy === `store-approve-${r.id}` ? "..." : "Approve"}
                            </button>
                            <button className="btn b-red"
                              onClick={() => setRejectModal({ type: "store", record: r })}
                              style={{ fontSize: 11, padding: "4px 10px", height: 28 }}>
                              Reject
                            </button>
                          </>
                        )}
                        <button className="btn b-ghost"
                          onClick={() => section === "identity"
                            ? setIdDrawer(r) : setStoreDrawer(r)
                          }
                          style={{ fontSize: 11, padding: "4px 10px", height: 28 }}>
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Load more */}
          {hasMore && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button className="btn b-ghost" onClick={() => {
                if (section === "identity") loadIdentity(true);
                else loadStore(true);
              }} style={{ fontSize: 13, padding: "8px 24px" }}>
                Load more
              </button>
            </div>
          )}
        </>
      )}

      {/* Drawers */}
      {idDrawer && (
        <IdentityDrawer
          record={idDrawer}
          onClose={() => setIdDrawer(null)}
          onApprove={(id) => confirm({
            title:   "Approve identity?",
            body:    `Approve ${idDrawer.user_name}'s documents?`,
            confirm: "Approve",
            action:  () => handleIdApprove(id),
          })}
          onReject={(r) => setRejectModal({ type: "identity", record: r })}
          onReset={(r)  => setResetModal({ type: "identity", record: r })}
          busy={busy}
          onToast={showToast}
        />
      )}

      {storeDrawer && (
        <StoreDrawer
          record={storeDrawer}
          onClose={() => setStoreDrawer(null)}
          onApprove={(id) => confirm({
            title:   "Approve store?",
            body:    `Approve "${storeDrawer.store_name}"?`,
            confirm: "Approve",
            action:  () => handleStoreApprove(id),
          })}
          onReject={(r) => setRejectModal({ type: "store", record: r })}
          onReset={(r)  => setResetModal({ type: "store", record: r })}
          busy={busy}
          onToast={showToast}
        />
      )}

      {/* Reject modal */}
      {rejectModal && (
        <RejectModal
          title={
            rejectModal.type === "bulk-identity"
              ? `Bulk Reject ${selected.size} Identities`
              : `Reject ${rejectModal.type === "identity" ? "Identity" : "Store"}`
          }
          onSubmit={(reason) => {
            if (rejectModal.type === "bulk-identity") {
              return handleBulkReject(reason);
            }
            return rejectModal.type === "identity"
              ? handleIdReject(rejectModal.record.id, reason)
              : handleStoreReject(rejectModal.record.id, reason);
          }}
          onClose={() => setRejectModal(null)}
        />
      )}

      {/* Reset modal */}
      {resetModal && (
        <ResetModal
          title={`Reset ${resetModal.type === "identity" ? "Identity" : "Store"} Verification`}
          onSubmit={(note) =>
            resetModal.type === "identity"
              ? handleIdReset(resetModal.record.id, note)
              : handleStoreReset(resetModal.record.id, note)
          }
          onClose={() => setResetModal(null)}
        />
      )}

      {/* Slide-up animation for toast */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}