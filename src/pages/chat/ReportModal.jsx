/**
 * src/pages/chat/ReportModal.jsx
 *
 * Report a seller from within a chat thread.
 * Steps: pick reason → add details → success
 */

import { useState, useCallback, memo } from "react";
import { Icon }   from "./icons";
import axios      from "axios";
import { authH }  from "./constants";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const API = `${import.meta.env.VITE_API_BASE_URL}/api`;

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const REASONS = [
  {
    id    : "scam",
    label : "Scam / Fraud",
    desc  : "Fake products, payment fraud, or deceptive listing",
    icon  : "💸",
  },
  {
    id    : "fake_payment",
    label : "Fake Payment Proof",
    desc  : "Sent false payment screenshot or receipt",
    icon  : "🧾",
  },
  {
    id    : "harassment",
    label : "Harassment",
    desc  : "Abusive, threatening, or offensive messages",
    icon  : "🚨",
  },
  {
    id    : "threats",
    label : "Threats",
    desc  : "Physical threats or intimidation",
    icon  : "⚠️",
  },
  {
    id    : "spam",
    label : "Spam",
    desc  : "Unsolicited messages or irrelevant content",
    icon  : "🗑️",
  },
  {
    id    : "inappropriate_content",
    label : "Inappropriate Content",
    desc  : "Offensive images or illegal material",
    icon  : "🔞",
  },
  {
    id    : "other",
    label : "Other",
    desc  : "Something else not listed above",
    icon  : "📋",
  },
];

/** Placeholder text per reason */
const PLACEHOLDERS = {
  scam        : "e.g. They sent a fake payment screenshot and disappeared…",
  harassment  : "e.g. They sent threatening messages after I declined…",
  default     : "Describe what happened in detail…",
};

const getPlaceholder = (reasonId) =>
  PLACEHOLDERS[reasonId] ?? PLACEHOLDERS.default;

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════ */
function ReportModal({ threadId, userId, otherUserName, onClose, onSuccess }) {
  const [step,    setStep]    = useState("pick");  // pick | details | done
  const [reason,  setReason]  = useState(null);
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const selectedReason = REASONS.find((r) => r.id === reason);

  // ── Handlers ──────────────────────────────────────────────
  const handleReasonSelect = useCallback((id) => {
    setReason(id);
    setStep("details");
  }, []);

  const handleBack = useCallback(() => {
    setStep("pick");
    setError("");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!reason) return;

    setLoading(true);
    setError("");

    try {
      await axios.post(
        `${API}/conversations/${threadId}/report`,
        { reason, details: details.trim(), userId },
        { headers: authH() }
      );

      setStep("done");

      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2_800);

    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Failed to submit report. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [reason, details, threadId, userId, onClose, onSuccess]);

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-sheet report-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-handle" />

        {/* ══════════════════════════════════════════════
            STEP 1 — Pick Reason
        ══════════════════════════════════════════════ */}
        {step === "pick" && (
          <>
            <div className="report-header">
              <div className="report-header-icon">🚩</div>
              <div>
                <div className="report-title">Report Seller</div>
                <div className="report-subtitle">
                  What's the issue with{" "}
                  <strong>{otherUserName}</strong>?
                </div>
              </div>
              <button className="modal-close" onClick={onClose}>
                {Icon.close}
              </button>
            </div>

            <div className="report-reasons">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  className="report-reason-btn"
                  onClick={() => handleReasonSelect(r.id)}
                >
                  <span className="report-reason-icon">{r.icon}</span>
                  <div className="report-reason-text">
                    <div className="report-reason-label">{r.label}</div>
                    <div className="report-reason-desc">{r.desc}</div>
                  </div>
                  <span className="report-reason-arrow">›</span>
                </button>
              ))}
            </div>

            <p className="report-note">
              Reports are reviewed within 24–48 hours.
              False reports may result in account action.
            </p>
          </>
        )}

        {/* ══════════════════════════════════════════════
            STEP 2 — Add Details
        ══════════════════════════════════════════════ */}
        {step === "details" && (
          <>
            <div className="report-header">
              <button className="report-back-btn" onClick={handleBack}>
                {Icon.back}
              </button>
              <div>
                <div className="report-title">Add Details</div>
                <div className="report-subtitle">
                  {selectedReason?.icon} {selectedReason?.label}
                </div>
              </div>
              <button className="modal-close" onClick={onClose}>
                {Icon.close}
              </button>
            </div>

            {/* Selected reason card */}
            <div className="report-selected-card">
              <span className="report-selected-icon">
                {selectedReason?.icon}
              </span>
              <div>
                <div className="report-selected-label">
                  {selectedReason?.label}
                </div>
                <div className="report-selected-desc">
                  {selectedReason?.desc}
                </div>
              </div>
            </div>

            <div className="modal-field">
              <label className="modal-label">
                Additional details{" "}
                <span className="modal-optional">(optional)</span>
              </label>
              <textarea
                className="modal-textarea report-textarea"
                rows={4}
                maxLength={1000}
                placeholder={getPlaceholder(reason)}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                autoFocus
              />
              <div className="report-char-count">
                {details.length} / 1000
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="report-error">
                {Icon.warn} {error}
              </div>
            )}

            {/* Warning */}
            <div className="report-warning-box">
              <span>⚠️</span>
              <div>
                <strong>This conversation will be preserved</strong> for
                review. Our team will investigate and take action within
                24–48 hours.
              </div>
            </div>

            <div className="modal-actions">
              <button className="modal-cancel" onClick={handleBack}>
                Back
              </button>
              <button
                className="report-submit-btn"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="mini-spinner" />
                    Submitting…
                  </>
                ) : (
                  "Submit Report"
                )}
              </button>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════
            STEP 3 — Success
        ══════════════════════════════════════════════ */}
        {step === "done" && (
          <div className="report-success">
            <div className="report-success-icon">✅</div>
            <div className="report-success-title">Report Submitted</div>
            <div className="report-success-body">
              Thank you for keeping Loemart safe.
              Our team will review this conversation within{" "}
              <strong>24–48 hours</strong>.
            </div>
            <div className="report-success-note">
              You'll receive a notification when the review is complete.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default memo(ReportModal);