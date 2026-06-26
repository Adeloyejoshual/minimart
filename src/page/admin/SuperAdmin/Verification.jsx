/**
 * src/page/admin/SuperAdmin/Verification.jsx — v3
 *
 * Fixed:
 *  - API calls now use /user/:userId/approve|reject|reset
 *    (avoids Express route conflict with /identity and /store)
 *  - risk_score / risk_flags / flagged_for_review handled safely
 *    (columns may not exist yet — default to 0 / [] / false)
 *  - store documents_url parsed safely from jsonb string or object
 *  - loadQueue no longer depends on `offset` in its callback
 *    (prevents stale-closure infinite re-fetch)
 *  - toggleSelectAll reads displayed from closure correctly
 *  - afterMutation resets offset before reloading
 *  - Error details surfaced in toast
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import adminApi from "../../../../services/adminApi";
import { fmtDate, fmtDateS } from "../adminlayout/helpers";
import { Pill, Rfr } from "../adminlayout/atoms";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const PAGE_SIZE = 50;

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

const RISK_COLOR = {
  critical: "#dc2626",
  high:     "#ea580c",
  medium:   "#d97706",
  low:      "#6b7280",
};

/* ═══════════════════════════════════════════════════════════════
   STYLE TOKENS
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
    cursor: "pointer", fontSize: 18, color: "#555",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
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
   UTILS
═══════════════════════════════════════════════════════════════ */

/** Safely parse risk_flags — may be null, array, or JSON string */
const parseRiskFlags = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
};

/** Safely parse documents_url jsonb — may be null, object, or JSON string */
const parseDocumentsUrl = (raw) => {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return null;
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
  return <span style={S.badge(color)}>Risk {score}</span>;
}

function TrustScore({ score }) {
  const n     = score ?? 0;
  const color = n >= 60 ? "#16a34a" : n >= 30 ? "#d97706" : "#dc2626";
  return <span style={{ fontWeight: 700, color }}>{n}</span>;
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
          View PDF ↗
        </a>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img src={url} alt={label} style={{
            width: "100%", maxHeight: 220, objectFit: "cover",
            borderRadius: 10, border: "1.5px solid #e8e6e0",
            cursor: "zoom-in", display: "block",
          }} />
        </a>
      )}
    </div>
  );
}

/* ─── Toast ─── */
function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: type === "error" ? "#dc2626" : "#16a34a",
      color: "#fff", padding: "12px 20px", borderRadius: 12,
      fontSize: 13, fontWeight: 600,
      boxShadow: "0 8px 24px rgba(0,0,0,.2)",
      animation: "slideUp .25s ease",
      maxWidth: 360,
    }}>
      {message}
    </div>
  );
}

/* ─── Notes Panel ─── */
function NotesPanel({ identityId }) {
  const [notes,   setNotes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    if (!identityId) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await adminApi.get(
        `/verification/identity/${identityId}`
      );
      setNotes(data.notes ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [identityId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!newNote.trim() || !identityId) return;
    setSaving(true);
    try {
      await adminApi.post(
        `/verification/identity/${identityId}/note`,
        { note: newNote.trim() }
      );
      setNewNote("");
      await load();
    } catch (err) {
      console.error("[notes]", err.message);
    } finally { setSaving(false); }
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={S.sectionLabel}>Review Notes</div>

      {loading ? (
        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>
          Loading notes…
        </div>
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
                <span style={{ fontWeight: 700, color: "#555" }}>{n.admin_name}</span>
                <span style={{ color: "#aaa", fontSize: 11 }}>{fmtDateS(n.created_at)}</span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
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
            flex: 1, padding: "8px 12px",
            border: "1.5px solid #e8e6e0",
            borderRadius: 8, fontSize: 12, outline: "none",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
          }}
        />
        <button
          className="btn b-ghost"
          disabled={!newNote.trim() || saving}
          onClick={submit}
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
  const score = riskScore ?? 0;
  const flags = parseRiskFlags(riskFlags);
  if (score === 0 && flags.length === 0) return null;

  return (
    <div style={{
      marginBottom: 16, padding: "12px 14px",
      background: score >= 80 ? "#fef2f2" : "#fffbeb",
      border: `1px solid ${score >= 80 ? "#fecaca" : "#fde68a"}`,
      borderRadius: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: flags.length ? 8 : 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>
          Risk Score: {score}
        </span>
        <RiskBadge score={score} />
      </div>

      {flags.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {flags.map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                background: RISK_COLOR[f.severity] ?? "#6b7280",
              }} />
              <span style={{ fontWeight: 600, color: "#555" }}>
                {String(f.type ?? "").replace(/_/g, " ")}:
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
    try { await onSubmit(reason.trim()); }
    finally { setBusy(false); onClose(); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
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
          <button className="btn b-red" disabled={!reason.trim() || busy} onClick={submit}>
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
    try { await onSubmit(note.trim() || null); }
    finally { setBusy(false); onClose(); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-title">{title}</div>
        <p style={{ fontSize: ".82rem", color: "#888", marginBottom: 12 }}>
          The user's verified status will be cleared and they will be asked
          to resubmit their documents. A resubmission email will be sent.
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
   VERIFICATION DRAWER
═══════════════════════════════════════════════════════════════ */
function VerificationDrawer({ record, onClose, onApprove, onReject, onReset, busy, onToast }) {
  if (!record) return null;

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
      onToast?.(
        "Assignment failed: " + (err.response?.data?.error ?? err.message),
        "error"
      );
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

  const isBusy    = busy === `approve-${record.user_id}`;
  const isPending = record.identity_status === "pending";
  const isApproved = record.identity_status === "approved";
  const isFlagged  = record.identity_status === "flagged";
  const isRejected = record.identity_status === "rejected";

  const logoUrl = parseDocumentsUrl(record.store_documents)?.logo_url ?? null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 600, display: "flex" }}>
      {/* Backdrop */}
      <div
        style={{ flex: 1, background: "rgba(0,0,0,.45)", cursor: "pointer" }}
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div style={{
        width: "min(600px, 100%)", background: "#fff",
        overflowY: "auto", display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 32px rgba(0,0,0,.15)",
      }}>
        {/* Sticky header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #f0eeea",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, background: "#fff", zIndex: 1,
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Verification Review</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
              {record.user_name} · {record.user_email}
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn} aria-label="Close">×</button>
        </div>

        <div style={{ padding: 20 }}>

          {/* Status row */}
          <div style={{
            display: "flex", gap: 8, flexWrap: "wrap",
            alignItems: "center", marginBottom: 16,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#888" }}>Identity:</span>
            <StatusBadge status={record.identity_status} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#888", marginLeft: 8 }}>
              Store:
            </span>
            <StatusBadge status={record.store_status ?? "pending"} />
            {record.flagged_for_review && (
              <span style={S.badge("#9333ea")}>Flagged</span>
            )}
            <RiskBadge score={record.risk_score} />
            {isPending && <OverdueBadge createdAt={record.submitted_at} />}
          </div>

          {/* Risk flags */}
          <RiskFlagsPanel
            riskScore={record.risk_score}
            riskFlags={record.risk_flags}
          />

          {/* Rejection reason */}
          {record.rejection_reason && (
            <div style={{
              background: "#fff5f5", border: "1px solid #fecaca",
              borderRadius: 10, padding: "10px 14px",
              fontSize: 12, color: "#991b1b", marginBottom: 16,
            }}>
              <strong>Rejection reason:</strong> {record.rejection_reason}
            </div>
          )}

          {/* Face match result */}
          {record.face_match !== null && record.face_match !== undefined && (
            <div style={{
              marginBottom: 16, padding: "10px 14px", borderRadius: 10, fontSize: 12,
              background: record.face_match ? "#f0fdf4" : record.face_skipped ? "#fffbeb" : "#fef2f2",
              border: `1px solid ${record.face_match ? "#bbf7d0" : record.face_skipped ? "#fde68a" : "#fecaca"}`,
            }}>
              {record.face_skipped ? (
                <span style={{ color: "#d97706" }}>⚠ Face check skipped — manual review required</span>
              ) : record.face_match ? (
                <span style={{ color: "#16a34a" }}>
                  ✓ Face match confirmed
                  {record.face_confidence != null &&
                    ` (${Math.round(record.face_confidence * 100)}% confidence)`}
                </span>
              ) : (
                <span style={{ color: "#dc2626" }}>✗ Face mismatch detected</span>
              )}
            </div>
          )}

          {/* Submission details */}
          <div style={S.infoBox}>
            <div style={S.sectionLabel}>Submission Details</div>
            <div style={{ display: "grid", gap: 6 }}>
              <div>
                <span style={{ color: "#888" }}>Document type: </span>
                <strong>{DOC_LABELS[record.document_type] ?? record.document_type}</strong>
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
              {record.liveness_passed !== null &&
               record.liveness_passed !== undefined && (
                <div>
                  <span style={{ color: "#888" }}>Liveness check: </span>
                  <strong>{record.liveness_passed ? "Passed" : "Not passed"}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Identity documents */}
          <div style={S.sectionLabel}>Identity Documents</div>
          <ImageViewer url={record.front_image_url} label="Document Front" />
          <ImageViewer url={record.back_image_url}  label="Document Back"  />
          <ImageViewer url={record.selfie_url}       label="Selfie Photo"  />
          {record.liveness_frame_url && (
            <ImageViewer url={record.liveness_frame_url} label="Liveness Frame" />
          )}

          {/* Store document */}
          {logoUrl && (
            <>
              <div style={{ ...S.sectionLabel, marginTop: 8 }}>Store Document</div>
              <ImageViewer url={logoUrl} label="Store Logo / Business Document" />
            </>
          )}

          {/* User info */}
          <div style={{ ...S.infoBox, fontSize: 12 }}>
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
                <strong style={{ color: record.email_verified ? "#16a34a" : "#dc2626" }}>
                  {record.email_verified ? "Yes" : "No"}
                </strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#888" }}>Trust score: </span>
                <TrustScore score={record.trust_score} />
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

          {/* Notes */}
          {record.identity_id && (
            <NotesPanel identityId={record.identity_id} />
          )}

          {/* Assign to me */}
          {!record.assigned_admin_id && isPending && (
            <div style={{ marginBottom: 14 }}>
              <button
                className="btn b-ghost"
                onClick={handleAssign}
                style={{ fontSize: 11, padding: "4px 12px", height: 28 }}
              >
                Assign to me
              </button>
            </div>
          )}

          {/* ── Action buttons ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Pending → Approve + Reject */}
            {isPending && (
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  disabled={isBusy}
                  onClick={() => onApprove(record.user_id)}
                  style={{
                    flex: 1, height: 48, fontSize: 14, fontWeight: 800,
                    background: isBusy
                      ? "#9ca3af"
                      : "linear-gradient(135deg, #16a34a, #15803d)",
                    color: "#fff", border: "none", borderRadius: 10,
                    cursor: isBusy ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center",
                    justifyContent: "center", gap: 6,
                  }}
                >
                  {isBusy ? "Approving…" : "✓  Approve — Identity & Store"}
                </button>
                <button
                  onClick={() => onReject(record)}
                  style={{
                    flex: 1, height: 48, fontSize: 14, fontWeight: 700,
                    background: "#fff", color: "#dc2626",
                    border: "2px solid #dc2626", borderRadius: 10, cursor: "pointer",
                  }}
                >
                  Reject
                </button>
              </div>
            )}

            {/* Approved / Flagged → Revoke */}
            {(isApproved || isFlagged) && (
              <button
                onClick={() => onReset(record)}
                style={{
                  width: "100%", height: 40, fontSize: 13, fontWeight: 600,
                  background: "#fffbeb", color: "#d97706",
                  border: "1.5px solid #fde68a", borderRadius: 10, cursor: "pointer",
                }}
              >
                Revoke & Request Resubmission
              </button>
            )}

            {/* Rejected → Approve anyway + Allow resubmit */}
            {isRejected && (
              <>
                <button
                  disabled={isBusy}
                  onClick={() => onApprove(record.user_id)}
                  style={{
                    width: "100%", height: 48, fontSize: 14, fontWeight: 800,
                    background: isBusy
                      ? "#9ca3af"
                      : "linear-gradient(135deg, #16a34a, #15803d)",
                    color: "#fff", border: "none", borderRadius: 10,
                    cursor: isBusy ? "not-allowed" : "pointer",
                  }}
                >
                  {isBusy ? "Approving…" : "✓  Approve Anyway"}
                </button>
                <button
                  onClick={() => onReset(record)}
                  style={{
                    width: "100%", height: 40, fontSize: 13, fontWeight: 600,
                    background: "#fffbeb", color: "#d97706",
                    border: "1.5px solid #fde68a", borderRadius: 10, cursor: "pointer",
                  }}
                >
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
  const [list,        setList]        = useState([]);
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [busy,        setBusy]        = useState(null);
  const [drawer,      setDrawer]      = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [resetModal,  setResetModal]  = useState(null);
  const [q,           setQ]           = useState("");
  const [toast,       setToast]       = useState(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [selected,    setSelected]    = useState(new Set());

  // Use ref to track current offset without triggering re-renders
  const offsetRef = useRef(0);

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

  /* ── Load unified queue ── */
  const loadQueue = useCallback(async (append = false) => {
    if (!append) {
      setLoading(true);
      setSelected(new Set());
      offsetRef.current = 0;
    }

    const currentOffset = offsetRef.current;

    try {
      // 1. Fetch identity list (primary queue driver)
      const { data: idData } = await adminApi.get(
        `/verification/identity?status=${activeTab}&limit=${PAGE_SIZE}&offset=${currentOffset}`
      );
      const idList = idData.verifications ?? [];

      // 2. Fetch all store records for merge (status=all)
      let storeMap = {};
      if (idList.length > 0) {
        try {
          const { data: stData } = await adminApi.get(
            `/verification/store?status=all&limit=200&offset=0`
          );
          (stData.verifications ?? []).forEach((s) => {
            // Keep the most recent store record per user
            if (
              !storeMap[s.user_id] ||
              new Date(s.created_at) > new Date(storeMap[s.user_id].created_at)
            ) {
              storeMap[s.user_id] = s;
            }
          });
        } catch {
          // Store queue may be empty — that's fine
        }
      }

      // 3. Merge into unified rows
      const merged = idList.map((id) => {
        const st   = storeMap[id.user_id] ?? {};
        const docs = parseDocumentsUrl(st.documents_url);
        return {
          // identity
          identity_id        : id.id,
          identity_status    : id.status,
          document_type      : id.document_type,
          // safe fallbacks for columns that may not exist yet
          risk_score         : id.risk_score         ?? 0,
          risk_flags         : id.risk_flags         ?? [],
          flagged_for_review : id.flagged_for_review ?? false,
          rejection_reason   : id.rejection_reason,
          reviewed_at        : id.reviewed_at,
          assigned_admin_id  : id.assigned_admin_id,
          assigned_admin_name: id.assigned_admin_name,
          front_image_url    : id.front_image_url,
          back_image_url     : id.back_image_url,
          selfie_url         : id.selfie_url,
          liveness_frame_url : id.liveness_frame_url,
          liveness_passed    : id.liveness_passed,
          face_match         : id.face_match,
          face_confidence    : id.face_confidence,
          face_skipped       : id.face_skipped,
          submitted_at       : id.created_at,
          // store
          store_id           : st.id      ?? null,
          store_status       : st.status  ?? null,
          store_documents    : docs,
          // user (from identity JOIN)
          user_id            : id.user_id,
          user_name          : id.user_name,
          user_email         : id.user_email,
          user_phone         : id.user_phone,
          user_status        : id.user_status,
          email_verified     : id.email_verified,
          identity_verified  : id.identity_verified,
          trust_score        : id.trust_score,
        };
      });

      if (append) {
        setList((prev) => [...prev, ...merged]);
      } else {
        setList(merged);
      }

      offsetRef.current = currentOffset + idList.length;
      setHasMore(idList.length === PAGE_SIZE);

    } catch (err) {
      console.error("[queue] load error:", err.message);
      showToast("Failed to load queue: " + (err.response?.data?.error ?? err.message), "error");
    } finally {
      setLoading(false);
    }
  }, [activeTab, showToast]);

  // Reload when tab changes
  useEffect(() => {
    loadQueue();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load stats on mount
  useEffect(() => { loadStats(); }, [loadStats]);

  const afterMutation = useCallback(async () => {
    setSelected(new Set());
    setDrawer(null);
    setRejectModal(null);
    setResetModal(null);
    offsetRef.current = 0;
    await Promise.all([loadQueue(), loadStats()]);
    onMutation?.();
  }, [loadQueue, loadStats, onMutation]);

  /* ═══════════════════════════════════════════════════════════
     ACTIONS
     All unified routes use /user/:userId/... prefix
     to avoid Express conflict with /identity and /store routes.
  ═══════════════════════════════════════════════════════════ */

  const handleApprove = useCallback(async (userId) => {
    setBusy(`approve-${userId}`);
    try {
      await adminApi.post(`/verification/user/${userId}/approve`, {
        note: "Approved via admin panel.",
      });
      showToast("✓ Approved — identity & store verified. Email sent to user.");
      await afterMutation();
    } catch (err) {
      showToast(
        "Approval failed: " + (err.response?.data?.error ?? err.message),
        "error"
      );
    } finally {
      setBusy(null);
    }
  }, [afterMutation, showToast]);

  const handleReject = useCallback(async (userId, reason) => {
    setBusy(`reject-${userId}`);
    try {
      await adminApi.post(`/verification/user/${userId}/reject`, { reason });
      showToast("✗ Rejected — rejection email sent to user.");
      await afterMutation();
    } catch (err) {
      showToast(
        "Rejection failed: " + (err.response?.data?.error ?? err.message),
        "error"
      );
    } finally {
      setBusy(null);
    }
  }, [afterMutation, showToast]);

  const handleReset = useCallback(async (userId, note) => {
    setBusy(`reset-${userId}`);
    try {
      await adminApi.post(`/verification/user/${userId}/reset`, { note });
      showToast("↺ Reset — resubmission email sent to user.");
      await afterMutation();
    } catch (err) {
      showToast(
        "Reset failed: " + (err.response?.data?.error ?? err.message),
        "error"
      );
    } finally {
      setBusy(null);
    }
  }, [afterMutation, showToast]);

  /* ── Bulk approve ── */
  const handleBulkApprove = useCallback(async () => {
    if (!selected.size) return;
    setBusy("bulk-approve");
    let ok = 0;
    for (const userId of selected) {
      try {
        await adminApi.post(`/verification/user/${userId}/approve`, {
          note: "Bulk approved via admin panel.",
        });
        ok++;
      } catch { /* continue rest */ }
    }
    showToast(`✓ Approved ${ok} of ${selected.size} submissions`);
    await afterMutation();
    setBusy(null);
  }, [selected, afterMutation, showToast]);

  /* ── Bulk reject ── */
  const handleBulkReject = useCallback(async (reason) => {
    if (!selected.size) return;
    setBusy("bulk-reject");
    let ok = 0;
    for (const userId of selected) {
      try {
        await adminApi.post(`/verification/user/${userId}/reject`, { reason });
        ok++;
      } catch { /* continue rest */ }
    }
    showToast(`✗ Rejected ${ok} of ${selected.size} submissions`);
    await afterMutation();
    setBusy(null);
  }, [selected, afterMutation, showToast]);

  /* ── Filter ── */
  const displayed = useMemo(() => {
    const lq = q.toLowerCase().trim();
    if (!lq) return list;
    return list.filter((r) =>
      (r.user_name    ?? "").toLowerCase().includes(lq) ||
      (r.user_email   ?? "").toLowerCase().includes(lq) ||
      (r.document_type ?? "").toLowerCase().includes(lq)
    );
  }, [list, q]);

  /* ── Selection ── */
  const toggleSelect = useCallback((userId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === displayed.length && displayed.length > 0
        ? new Set()
        : new Set(displayed.map((r) => r.user_id))
    );
  }, [displayed]);

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
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 20, flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
            Verification Queue
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
            One click approves identity + store together and emails the user
          </p>
        </div>
        <Rfr onClick={() => { loadQueue(); loadStats(); }} />
      </div>

      {/* Stats grid */}
      {stats && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: 10, marginBottom: 20,
        }}>
          {[
            { label: "Pending",          value: stats.identity?.pending          ?? 0, color: "#d97706" },
            { label: "Approved",          value: stats.identity?.approved         ?? 0, color: "#16a34a" },
            { label: "Overdue (>24h)",    value: stats.identity?.overdue          ?? 0, color: "#dc2626" },
            { label: "Flagged",           value: stats.identity?.flagged          ?? 0, color: "#9333ea" },
            { label: "Email Verified",    value: stats.users?.email_verified      ?? 0, color: "#0369a1" },
            { label: "Fully Verified",    value: stats.users?.identity_verified   ?? 0, color: "#15803d" },
            { label: "Limited Listings",  value: stats.limited_listings?.total    ?? 0, color: "#9333ea" },
          ].map(({ label, value, color }) => (
            <div key={label} style={S.statCard}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: "#aaa",
                textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 4,
              }}>
                {label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color }}>
                {(value ?? 0).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {QUEUE_TABS.map((t) => {
          const cnt   = stats?.identity?.[t.key] ?? 0;
          const isAct = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: "6px 16px", borderRadius: 999, cursor: "pointer",
                border     : isAct ? "none" : "1.5px solid #e8e6e0",
                background : isAct ? "#1a1a1a" : "#fafaf8",
                color      : isAct ? "#fff"    : "#555",
                fontWeight : 700, fontSize: 12,
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              {t.label}
              {t.key !== "all" && cnt > 0 && (
                <span style={{
                  background   : isAct ? "rgba(255,255,255,.2)" : "#e8e6e0",
                  color        : isAct ? "#fff" : "#555",
                  borderRadius : 999, fontSize: 10, padding: "1px 6px",
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

        {activeTab === "pending" && selected.size > 0 && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#555" }}>
              {selected.size} selected
            </span>
            <button
              className="btn b-solid"
              disabled={busy === "bulk-approve"}
              onClick={() => confirm({
                title:   `Bulk approve ${selected.size} submissions?`,
                body:    "Identity and store will be approved. Approval emails will be sent.",
                confirm: "Approve All",
                action:  handleBulkApprove,
              })}
              style={{ fontSize: 11, padding: "4px 12px", height: 28 }}
            >
              {busy === "bulk-approve" ? "…" : "Approve All"}
            </button>
            <button
              className="btn b-red"
              disabled={busy === "bulk-reject"}
              onClick={() => setRejectModal({ type: "bulk" })}
              style={{ fontSize: 11, padding: "4px 12px", height: 28 }}
            >
              Reject All
            </button>
            <button
              className="btn b-ghost"
              onClick={() => setSelected(new Set())}
              style={{ fontSize: 11, padding: "4px 10px", height: 28 }}
            >
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
              fontSize: 13, minWidth: 720,
            }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #f0eeea" }}>
                  {activeTab === "pending" && (
                    <th style={{ padding: "10px 6px", width: 32 }}>
                      <input
                        type="checkbox"
                        checked={selected.size === displayed.length && displayed.length > 0}
                        onChange={toggleSelectAll}
                        style={{ cursor: "pointer" }}
                      />
                    </th>
                  )}
                  {[
                    "User", "Document", "Identity",
                    "Store", "Risk", "Trust", "Submitted", "Actions",
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
                  const rowBusy    = busy === `approve-${r.user_id}`;
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
                        <td
                          style={{ padding: "10px 6px" }}
                          onClick={(e) => e.stopPropagation()}
                        >
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

                      {/* Document */}
                      <td style={{ padding: "10px 10px" }}>
                        <span style={S.badge("#6b7280")}>
                          {DOC_LABELS[r.document_type] ?? r.document_type ?? "—"}
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
                        <TrustScore score={r.trust_score} />
                      </td>

                      {/* Submitted */}
                      <td style={{ padding: "10px 10px", color: "#888", whiteSpace: "nowrap" }}>
                        {fmtDateS(r.submitted_at)}
                      </td>

                      {/* Actions */}
                      <td
                        style={{ padding: "10px 10px" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ display: "flex", gap: 6 }}>
                          {r.identity_status === "pending" && (
                            <>
                              <button
                                className="btn b-solid"
                                disabled={rowBusy}
                                onClick={() => confirm({
                                  title:   "Approve submission?",
                                  body:    `Approve ${r.user_name}'s identity and store together? An approval email will be sent.`,
                                  confirm: "Approve",
                                  action:  () => handleApprove(r.user_id),
                                })}
                                style={{ fontSize: 11, padding: "4px 10px", height: 28 }}
                              >
                                {rowBusy ? "…" : "Approve"}
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

      {/* Drawer */}
      {drawer && (
        <VerificationDrawer
          record={drawer}
          onClose={() => setDrawer(null)}
          onApprove={(userId) => confirm({
            title:   "Approve submission?",
            body:    `Approve ${drawer.user_name}'s identity and store? An approval email will be sent.`,
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