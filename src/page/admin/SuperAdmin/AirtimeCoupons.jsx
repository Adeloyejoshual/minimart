// src/pages/admin/SuperAdmin/AirtimeCoupons.jsx

import { useState, useEffect, useCallback, useRef } from "react";

/* ════════════════════════════════════════════════════════════
   CONSTANTS
════════════════════════════════════════════════════════════ */
const CLAIM_STATUS = {
  PENDING   : "pending",
  APPROVED  : "approved",
  SENT      : "sent",
  COMPLETED : "completed",
  REJECTED  : "rejected",
  FAILED    : "failed",
};

const STATUS_CFG = {
  pending   : { label: "Pending",   color: "#d97706", bg: "#fffbeb", icon: "⏳" },
  approved  : { label: "Approved",  color: "#2563eb", bg: "#eff6ff", icon: "✓"  },
  sent      : { label: "Sending",   color: "#0891b2", bg: "#f0f9ff", icon: "📤" },
  completed : { label: "Completed", color: "#16a34a", bg: "#f0fdf4", icon: "✅" },
  rejected  : { label: "Rejected",  color: "#dc2626", bg: "#fef2f2", icon: "❌" },
  failed    : { label: "Failed",    color: "#dc2626", bg: "#fef2f2", icon: "⚠️" },
};

const NETWORK_COLORS = {
  MTN     : { bg: "#fef9c3", color: "#854d0e" },
  Airtel  : { bg: "#fee2e2", color: "#991b1b" },
  Glo     : { bg: "#dcfce7", color: "#166534" },
  "9mobile":{ bg: "#e0f2fe", color: "#075985" },
};

const FRAUD_COLORS = {
  clean     : { color: "#16a34a", label: "Clean" },
  warned    : { color: "#f59e0b", label: "Warned" },
  review    : { color: "#f97316", label: "Review" },
  suspended : { color: "#dc2626", label: "Suspended" },
};

/* Next status in the flow */
const NEXT_STATUS = {
  pending  : "approved",
  approved : "sent",
  sent     : "completed",
};

/* Action name for each transition */
const NEXT_ACTION = {
  pending  : "approve",
  approved : "send",
  sent     : "complete",
};

const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const fmtRelative = (d) => {
  if (!d) return "—";
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
};

/* ════════════════════════════════════════════════════════════
   ASSIGN MODAL
════════════════════════════════════════════════════════════ */
function AssignModal({ api, onClose, onSuccess }) {
  const [userId,  setUserId]  = useState("");
  const [amount,  setAmount]  = useState("100");
  const [code,    setCode]    = useState("");
  const [expiry,  setExpiry]  = useState("30");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const submit = async () => {
    if (!userId.trim())         { setError("User ID is required."); return; }
    if (!amount || Number(amount) <= 0) { setError("Enter a valid amount."); return; }

    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post("/airtime-coupons/assign", {
        user_id         : userId.trim(),
        amount          : Number(amount),
        code            : code.trim() || undefined,
        expires_in_days : Number(expiry),
      });
      onSuccess(data.message);
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || "Failed to assign coupon.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-title">📱 Assign Airtime Coupon</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "12px 0" }}>
          <input
            className="inp"
            placeholder="User ID (UUID)"
            value={userId}
            onChange={(e) => { setUserId(e.target.value); setError(null); }}
            autoFocus
          />

          <div style={{ display: "flex", gap: 8 }}>
            <select
              className="inp"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ flex: 1 }}
            >
              {[50, 100, 200, 500, 1000, 2000, 5000].map((a) => (
                <option key={a} value={a}>{naira(a)}</option>
              ))}
            </select>

            <select
              className="inp"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              style={{ width: 130 }}
            >
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
            </select>
          </div>

          <input
            className="inp"
            placeholder="Custom code (optional)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </div>

        {error && (
          <p style={{ fontSize: ".8rem", color: "#dc2626", margin: "0 0 10px" }}>
            ❌ {error}
          </p>
        )}

        <div className="modal-btns">
          <button className="btn b-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="btn b-solid" onClick={submit} disabled={loading}>
            {loading ? "Assigning…" : "Assign Coupon"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   NOTE MODAL — reject/fail with mandatory note
════════════════════════════════════════════════════════════ */
function NoteModal({ claim, action, api, onClose, onSuccess }) {
  const [note,    setNote]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, []);

  const cfg = {
    reject: {
      title    : "❌ Reject Claim",
      body     : "The user will be notified. Their coupon will be restored so they can retry.",
      btnLabel : "Reject Claim",
      btnClass : "b-red",
      hint     : "e.g. 'Phone number invalid', 'Suspicious activity detected'",
    },
    fail: {
      title    : "⚠️ Mark as Failed",
      body     : "Use this for technical failures (network error, provider timeout). The claim cannot be retried.",
      btnLabel : "Mark Failed",
      btnClass : "b-red",
      hint     : "e.g. 'Airtime provider API returned error 500'",
    },
  }[action];

  const submit = async () => {
    if (!note.trim()) { setError("A note is required."); return; }

    setLoading(true);
    setError(null);
    try {
      await api.post(`/airtime-coupons/${claim.id}/${action}`, { note: note.trim() });
      onSuccess(`Claim ${action === "reject" ? "rejected" : "marked as failed"}.`);
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || "Action failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="modal-title">{cfg.title}</div>

        <div style={{
          padding: "10px 12px", background: "#fff7ed",
          border: "1px solid #fed7aa", borderRadius: 8,
          fontSize: ".78rem", color: "#9a3412", marginBottom: 12,
        }}>
          {cfg.body}
        </div>

        <div style={{ fontSize: ".82rem", marginBottom: 10 }}>
          <div><strong>Code:</strong> {claim.coupon_code}</div>
          <div><strong>Amount:</strong> {naira(claim.amount)}</div>
          <div><strong>User:</strong> {claim.user?.name} ({claim.user?.email})</div>
          <div><strong>Phone:</strong> {claim.phone}</div>
        </div>

        <textarea
          ref={textareaRef}
          className="inp"
          rows={4}
          placeholder={cfg.hint}
          value={note}
          onChange={(e) => { setNote(e.target.value); setError(null); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
          }}
          style={{ resize: "vertical", width: "100%" }}
        />
        <div style={{ fontSize: ".7rem", color: "var(--muted)", marginTop: 4 }}>
          Ctrl/Cmd + Enter to submit
        </div>

        {error && (
          <p style={{ fontSize: ".8rem", color: "#dc2626", margin: "6px 0 0" }}>
            ❌ {error}
          </p>
        )}

        <div className="modal-btns">
          <button className="btn b-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className={`btn ${cfg.btnClass}`} onClick={submit} disabled={loading}>
            {loading ? "Saving…" : cfg.btnLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   ⚡ FAST CASCADE MODAL — auto-advances through approve→send→complete
   
   FEATURES:
   • Auto-focuses primary button (press Enter to advance)
   • Optimistic UI (advances immediately, syncs in background)
   • Keyboard shortcuts: Enter=next, Esc=close, A=complete-all
   • "Complete All" button skips all steps at once
   • Auto-closes when done
════════════════════════════════════════════════════════════ */
function FastCascadeModal({ claim, api, onClose, onSuccess, showToast }) {
  const [step,        setStep]        = useState(claim.status);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const buttonRef = useRef(null);

  /* Auto-focus primary button on step change */
  useEffect(() => {
    setTimeout(() => buttonRef.current?.focus(), 50);
  }, [step]);

  /* Keyboard shortcuts */
  useEffect(() => {
    const onKey = (e) => {
      if (loading) return;
      if (e.key === "Escape")      onClose();
      if (e.key === "a" || e.key === "A") completeAll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, step]);

  const stepConfig = {
    pending: {
      title: "Approve",
      btnLabel: "✓ Approve & Continue",
      btnColor: "#2563eb",
      action: "approve",
    },
    approved: {
      title: "Mark as Sent",
      btnLabel: "📤 Sent & Continue",
      btnColor: "#0891b2",
      action: "send",
    },
    sent: {
      title: "Complete",
      btnLabel: "✅ Complete",
      btnColor: "#16a34a",
      action: "complete",
    },
  };

  const cfg = stepConfig[step];

  /* Show success screen when done */
  useEffect(() => {
    if (!cfg && !showSuccess) {
      setShowSuccess(true);
      setTimeout(() => onClose(), 1200);
    }
  }, [cfg, showSuccess, onClose]);

  /* Single-step advance */
  const advance = async () => {
    if (!cfg || loading) return;
    setLoading(true);
    setError(null);

    try {
      await api.post(`/airtime-coupons/${claim.id}/${cfg.action}`);
      showToast("success", `${cfg.title}: ${claim.coupon_code}`);
      onSuccess();

      /* Advance to next step */
      const next = NEXT_STATUS[step];
      if (next && stepConfig[next]) {
        setStep(next);
      } else {
        setStep("done");
      }
    } catch (e) {
      setError(e.response?.data?.message || "Action failed.");
    } finally {
      setLoading(false);
    }
  };

  /* ⚡ COMPLETE ALL — sends approve → send → complete in sequence */
  const completeAll = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    const stepsToRun = [];
    let current = step;
    while (stepConfig[current]) {
      stepsToRun.push(stepConfig[current].action);
      current = NEXT_STATUS[current];
    }

    try {
      for (const action of stepsToRun) {
        await api.post(`/airtime-coupons/${claim.id}/${action}`);
      }
      showToast("success", `${claim.coupon_code} fully processed! (${stepsToRun.length} steps)`);
      onSuccess();
      setStep("done");
    } catch (e) {
      setError(e.response?.data?.message || "Failed mid-flow. Refresh to see current state.");
      onSuccess(); /* Refresh anyway to see partial progress */
    } finally {
      setLoading(false);
    }
  };

  /* Success screen */
  if (showSuccess || step === "done") {
    return (
      <div className="overlay" onClick={onClose}>
        <div
          className="modal"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: 340, textAlign: "center", padding: "24px 20px" }}
        >
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "#dcfce7", color: "#16a34a",
            fontSize: 40, fontWeight: "bold",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 12px",
            animation: "pop 0.3s ease",
          }}>
            ✓
          </div>
          <div style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: 4 }}>
            Done!
          </div>
          <p style={{ fontSize: ".82rem", color: "var(--muted)", margin: "0 0 4px" }}>
            {claim.coupon_code} completed
          </p>
          <p style={{ fontSize: ".7rem", color: "var(--muted)" }}>
            Closing…
          </p>
        </div>
        <style>{`
          @keyframes pop {
            0%   { transform: scale(0);   opacity: 0; }
            60%  { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1);   opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  const steps = ["pending", "approved", "sent"];
  const currentIdx = steps.indexOf(step);

  return (
    <div className="overlay" onClick={loading ? null : onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 420 }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 8,
        }}>
          <div className="modal-title" style={{ margin: 0 }}>
            {cfg.title}
          </div>
          <span style={{
            fontSize: ".7rem", color: "var(--muted)", fontWeight: 600,
          }}>
            Step {currentIdx + 1}/3
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ display: "flex", gap: 3, marginBottom: 14 }}>
          {steps.map((s, i) => (
            <div
              key={s}
              style={{
                flex: 1, height: 3, borderRadius: 2,
                background: currentIdx >= i ? cfg.btnColor : "#e5e7eb",
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>

        {/* Compact claim info */}
        <div style={{
          background: "#f9fafb", padding: "10px 12px",
          borderRadius: 8, fontSize: ".82rem", marginBottom: 12,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontWeight: 800, color: "#e8630a", fontSize: "1.05rem" }}>
              {naira(claim.amount)}
            </div>
            <div style={{ fontSize: ".75rem", color: "var(--muted)" }}>
              {claim.user?.name}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <code style={{ fontSize: ".82rem", fontWeight: 700 }}>{claim.phone}</code>
            <div style={{ fontSize: ".72rem", color: "var(--muted)" }}>
              {claim.network} · <code>{claim.coupon_code}</code>
            </div>
          </div>
        </div>

        {error && (
          <p style={{
            padding: "6px 10px", background: "#fef2f2",
            border: "1px solid #fecaca", borderRadius: 6,
            fontSize: ".78rem", color: "#dc2626", margin: "0 0 10px",
          }}>
            ❌ {error}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            ref={buttonRef}
            className="btn b-solid"
            onClick={advance}
            disabled={loading}
            style={{
              background: cfg.btnColor,
              fontSize: ".9rem", padding: "10px",
              fontWeight: 700,
            }}
          >
            {loading ? "Processing…" : cfg.btnLabel}
          </button>

          <button
            className="btn b-solid"
            onClick={completeAll}
            disabled={loading}
            style={{
              background: "#16a34a",
              fontSize: ".8rem", padding: "8px",
              fontWeight: 600,
            }}
            title="Press A"
          >
            ⚡ Complete All Steps (A)
          </button>

          <button
            className="btn b-ghost"
            onClick={onClose}
            disabled={loading}
            style={{ fontSize: ".78rem", padding: "6px" }}
          >
            Close (Esc)
          </button>
        </div>

        <div style={{
          fontSize: ".68rem", color: "var(--muted)",
          textAlign: "center", marginTop: 8,
        }}>
          💡 Press <kbd style={kbdStyle}>Enter</kbd> for next step ·{" "}
          <kbd style={kbdStyle}>A</kbd> for all
        </div>
      </div>
    </div>
  );
}

const kbdStyle = {
  background: "#f5f3ef",
  padding: "1px 6px",
  borderRadius: 3,
  fontSize: ".68rem",
  fontFamily: "monospace",
  border: "1px solid #e5e7eb",
};

/* ════════════════════════════════════════════════════════════
   BULK ACTION BAR
════════════════════════════════════════════════════════════ */
function BulkActionBar({ selected, api, onClear, onSuccess, showToast, confirm }) {
  const [busy, setBusy] = useState(false);
  const [noteAction, setNoteAction] = useState(null);
  const [note, setNote] = useState("");

  const doBulkAction = async (action, noteText = null) => {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await api.post("/airtime-coupons/bulk-action", {
        ids    : Array.from(selected),
        action,
        note   : noteText,
      });

      showToast(
        data.failed === 0 ? "success" : "warning",
        `Processed ${data.processed} of ${selected.size}${data.failed ? ` (${data.failed} failed)` : ""}.`
      );

      onSuccess();
      setNoteAction(null);
      setNote("");
    } catch (e) {
      showToast("error", e.response?.data?.message || "Bulk action failed.");
    } finally {
      setBusy(false);
    }
  };

  /* ⚡ COMPLETE ALL SELECTED — approve, send, complete for all */
  const bulkCompleteAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ids = Array.from(selected);
      let successCount = 0;
      let failCount = 0;

      /* Run all 3 steps sequentially for each */
      for (const action of ["approve", "send", "complete"]) {
        try {
          const { data } = await api.post("/airtime-coupons/bulk-action", {
            ids, action,
          });
          successCount = data.processed;
          failCount    = data.failed;
        } catch { /* continue to next step */ }
      }

      showToast(
        failCount === 0 ? "success" : "warning",
        `⚡ Completed ${successCount} of ${selected.size}${failCount ? ` (${failCount} skipped)` : ""}.`
      );
      onSuccess();
    } catch (e) {
      showToast("error", e.response?.data?.message || "Bulk complete failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 16px", background: "#0891b2", color: "#fff",
        borderRadius: 10, flexWrap: "wrap",
        position: "sticky", top: 0, zIndex: 10,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}>
        <span style={{ fontWeight: 700, fontSize: ".9rem" }}>
          ✓ {selected.size} selected
        </span>

        <div style={{ display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
          <button
            className="btn b-solid"
            style={{ fontSize: ".78rem", padding: "6px 14px", background: "#16a34a", fontWeight: 700 }}
            disabled={busy}
            onClick={() => confirm({
              title  : `⚡ Complete all ${selected.size} claims?`,
              body   : "Approves, sends, and completes all selected claims in one go. Users get emails at each step.",
              confirm: "⚡ Complete All",
              action : bulkCompleteAll,
            })}
          >
            ⚡ Complete All
          </button>

          <button
            className="btn b-ghost"
            style={{ fontSize: ".76rem", padding: "6px 12px", background: "#fff", color: "#2563eb" }}
            disabled={busy}
            onClick={() => confirm({
              title  : `Approve ${selected.size} claims?`,
              body   : "Selected claims will move to 'approved' status.",
              confirm: "✓ Approve",
              action : () => doBulkAction("approve"),
            })}
          >
            ✓ Approve
          </button>

          <button
            className="btn b-ghost"
            style={{ fontSize: ".76rem", padding: "6px 12px", background: "#fff", color: "#0891b2" }}
            disabled={busy}
            onClick={() => confirm({
              title  : `Send ${selected.size} claims?`,
              body   : "Confirm the airtime has been dispatched.",
              confirm: "📤 Mark Sent",
              action : () => doBulkAction("send"),
            })}
          >
            📤 Send
          </button>

          <button
            className="btn b-ghost"
            style={{ fontSize: ".76rem", padding: "6px 12px", background: "#fff", color: "#dc2626" }}
            disabled={busy}
            onClick={() => setNoteAction("reject")}
          >
            ❌ Reject
          </button>

          <button
            className="btn b-ghost"
            style={{ fontSize: ".76rem", padding: "6px 12px", background: "#fff", color: "#374151" }}
            onClick={onClear}
          >
            Clear
          </button>
        </div>
      </div>

      {noteAction && (
        <div className="overlay" onClick={() => setNoteAction(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-title">Reject {selected.size} claims</div>
            <p style={{ fontSize: ".82rem", color: "var(--muted)", margin: "6px 0 10px" }}>
              This reason will be sent to all {selected.size} users.
            </p>
            <textarea
              className="inp"
              rows={3}
              placeholder="Reason for rejection…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ resize: "vertical", width: "100%" }}
              autoFocus
            />
            <div className="modal-btns">
              <button className="btn b-ghost" onClick={() => setNoteAction(null)} disabled={busy}>
                Cancel
              </button>
              <button
                className="btn b-red"
                onClick={() => note.trim() && doBulkAction(noteAction, note.trim())}
                disabled={busy || !note.trim()}
              >
                {busy ? "Rejecting…" : `Reject ${selected.size}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   CLAIM DETAIL MODAL
════════════════════════════════════════════════════════════ */
function ClaimDetailModal({ claim, api, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/airtime-coupons/${claim.id}`);
        setDetail(data.claim);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [claim.id, api]);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 620, maxHeight: "90vh", overflowY: "auto" }}
      >
        <div className="modal-title">
          🔍 Claim Details
          <button
            onClick={onClose}
            style={{
              float: "right", background: "none", border: "none",
              fontSize: 22, cursor: "pointer", color: "var(--muted)",
            }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}>Loading…</div>
        ) : detail ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>

            <div style={{ background: "#f9fafb", padding: 14, borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
                <div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#e8630a" }}>
                    {naira(detail.amount)}
                  </div>
                  <div style={{ fontSize: ".78rem", color: "var(--muted)", marginTop: 2 }}>
                    <code>{detail.coupon_code}</code>
                  </div>
                </div>
                <span style={{
                  padding: "4px 12px", borderRadius: 20,
                  fontSize: ".78rem", fontWeight: 700,
                  background: STATUS_CFG[detail.status]?.bg,
                  color: STATUS_CFG[detail.status]?.color,
                }}>
                  {STATUS_CFG[detail.status]?.icon} {STATUS_CFG[detail.status]?.label}
                </span>
              </div>
            </div>

            <Section title="👤 User">
              <Row label="Name"      value={detail.user?.name} />
              <Row label="Email"     value={detail.user?.email} />
              <Row label="Verified"  value={detail.user?.email_verified ? "✓ Yes" : "✗ No"} />
              {detail.user?.fraud_score > 0 && (
                <Row
                  label="Fraud Score"
                  value={
                    <span style={{
                      padding: "2px 10px", borderRadius: 20,
                      fontSize: ".75rem", fontWeight: 700,
                      background: FRAUD_COLORS[detail.user.fraud_status]?.color + "20",
                      color: FRAUD_COLORS[detail.user.fraud_status]?.color,
                    }}>
                      {detail.user.fraud_score} · {FRAUD_COLORS[detail.user.fraud_status]?.label}
                    </span>
                  }
                />
              )}
              {detail.user?.suspended && (
                <Row label="Status" value={<span style={{ color: "#dc2626" }}>🚫 SUSPENDED</span>} />
              )}
            </Section>

            <Section title="📱 Airtime Details">
              <Row label="Phone"    value={<code>{detail.phone}</code>} />
              <Row label="Network"  value={detail.network} />
              <Row label="Claimed"  value={fmtDate(detail.claimed_at)} />
              {detail.approved_at && <Row label="Approved" value={fmtDate(detail.approved_at)} />}
              {detail.credited_at && <Row label="Credited" value={fmtDate(detail.credited_at)} />}
              {detail.admin_note && (
                <Row label="Admin Note" value={<em>{detail.admin_note}</em>} />
              )}
            </Section>

            <Section title="🔍 Metadata">
              <Row label="IP Address"  value={<code>{detail.ip_address || "—"}</code>} />
              <Row label="Device Hash" value={<code style={{ fontSize: ".7rem" }}>{detail.device_hash || "—"}</code>} />
              <Row label="User Agent"  value={<span style={{ fontSize: ".7rem" }}>{detail.user_agent || "—"}</span>} />
            </Section>

            {detail.recent_claims?.length > 0 && (
              <Section title={`📋 Recent Claims (${detail.recent_claims.length})`}>
                {detail.recent_claims.map((c) => (
                  <div key={c.id} style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "6px 0", borderBottom: "1px solid #f3f4f6",
                    fontSize: ".78rem",
                  }}>
                    <span>{naira(c.amount)} · {fmtDate(c.claimed_at)}</span>
                    <span style={{ color: STATUS_CFG[c.status]?.color, fontWeight: 700 }}>
                      {STATUS_CFG[c.status]?.label}
                    </span>
                  </div>
                ))}
              </Section>
            )}

          </div>
        ) : (
          <div style={{ padding: 40, textAlign: "center", color: "#dc2626" }}>
            Failed to load claim details
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: "#fff", padding: 12, borderRadius: 10, border: "1px solid #ede9e3" }}>
      <div style={{ fontSize: ".85rem", fontWeight: 700, marginBottom: 8, color: "#111" }}>
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", padding: "5px 0", fontSize: ".82rem" }}>
      <span style={{ minWidth: 100, color: "var(--muted)" }}>{label}:</span>
      <span style={{ fontWeight: 500 }}>{value || "—"}</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
export default function AirtimeCoupons({ api, confirm, onMutation }) {
  const [claims,       setClaims]       = useState([]);
  const [summary,      setSummary]      = useState({});
  const [stats,        setStats]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [statusTab,    setStatusTab]    = useState("pending");
  const [search,       setSearch]       = useState("");
  const [sort,         setSort]         = useState("oldest");
  const [page,         setPage]         = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);
  const [total,        setTotal]        = useState(0);
  const [pendingAmt,   setPendingAmt]   = useState(0);
  const [toast,        setToast]        = useState(null);
  const [showAssign,   setShowAssign]   = useState(false);
  const [noteModal,    setNoteModal]    = useState(null);
  const [detailModal,  setDetailModal]  = useState(null);
  const [cascadeModal, setCascadeModal] = useState(null);
  const [busy,         setBusy]         = useState(null);
  const [selected,     setSelected]     = useState(new Set());

  const toastRef  = useRef(null);
  const searchRef = useRef(null);

  /* ── Toast ── */
  const showToast = useCallback((type, text) => {
    setToast({ type, text });
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 3_000);
  }, []);

  /* ── Load ── */
  const load = useCallback(async (pg = page, opts = {}) => {
    const { silent = false } = opts;
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({
        status : statusTab,
        page   : pg,
        limit  : 20,
        sort,
        ...(search ? { search } : {}),
      });

      const [listRes, statsRes] = await Promise.all([
        api.get(`/airtime-coupons?${params}`),
        api.get("/airtime-coupons/stats/summary"),
      ]);

      setClaims(listRes.data.claims        || []);
      setSummary(listRes.data.summary      || {});
      setTotal(listRes.data.total          || 0);
      setTotalPages(listRes.data.pages     || 1);
      setPendingAmt(listRes.data.pending_amount || 0);
      setStats(statsRes.data);

      if (!silent) setSelected(new Set());
    } catch (e) {
      showToast("error", e.response?.data?.message || "Failed to load data.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [api, statusTab, search, sort, page, showToast]);

  useEffect(() => {
    setPage(1);
    load(1);
  }, [statusTab, search, sort]);

  useEffect(() => {
    load(page);
  }, [page]);

  useEffect(() => () => clearTimeout(toastRef.current), []);

  /* ── Global keyboard shortcuts ── */
  useEffect(() => {
    const onKey = (e) => {
      /* Don't hijack when typing in inputs */
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (cascadeModal || noteModal || detailModal || showAssign) return;

      if (e.key === "/" || e.key === "s") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "r") {
        e.preventDefault();
        load(page);
      }
      if (e.key === "1") setStatusTab("pending");
      if (e.key === "2") setStatusTab("approved");
      if (e.key === "3") setStatusTab("sent");
      if (e.key === "4") setStatusTab("completed");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cascadeModal, noteModal, detailModal, showAssign, load, page]);

  /* ── Optimistic single action ── */
  const doAction = async (id, action, note) => {
    setBusy(id);

    /* Optimistic update — remove from current tab if status changes */
    const nextStatusMap = {
      approve  : "approved",
      send     : "sent",
      complete : "completed",
      reject   : "rejected",
      fail     : "failed",
    };
    const newStatus = nextStatusMap[action];

    if (newStatus && newStatus !== statusTab && statusTab !== "all") {
      setClaims((prev) => prev.filter((c) => c.id !== id));
    }

    try {
      await api.post(`/airtime-coupons/${id}/${action}`, note ? { note } : {});
      showToast("success", `Claim ${action}d.`);
      onMutation?.();
      /* Silent refresh to sync summary counts */
      load(page, { silent: true });
    } catch (e) {
      showToast("error", e.response?.data?.message || "Action failed.");
      /* Rollback by reloading */
      load(page);
    } finally {
      setBusy(null);
    }
  };

  /* ── Selection helpers ── */
  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else              next.add(id);
      return next;
    });
  };
  const selectAll       = () => setSelected(new Set(claims.map((c) => c.id)));
  const clearSelection  = () => setSelected(new Set());

  /* ── Tabs ── */
  const TABS = [
    { key: "pending",   label: "Pending",   badge: summary.pending?.count,   hint: "1" },
    { key: "approved",  label: "Approved",  badge: summary.approved?.count,  hint: "2" },
    { key: "sent",      label: "Sent",      badge: summary.sent?.count,      hint: "3" },
    { key: "completed", label: "Completed", badge: summary.completed?.count, hint: "4" },
    { key: "rejected",  label: "Rejected",  badge: summary.rejected?.count },
    { key: "failed",    label: "Failed",    badge: summary.failed?.count    },
    { key: "all",       label: "All",       badge: null                     },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 10,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>
            📱 Airtime Claims
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: ".8rem", color: "var(--muted)" }}>
            Press <kbd style={kbdStyle}>/</kbd> to search ·{" "}
            <kbd style={kbdStyle}>1-4</kbd> switch tabs ·{" "}
            <kbd style={kbdStyle}>R</kbd> refresh
          </p>
        </div>
        <button className="btn b-solid" onClick={() => setShowAssign(true)}>
          + Assign Coupon
        </button>
      </div>

      {/* ── Stats row ── */}
      {stats && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
        }}>
          {[
            { label: "Total Sent",       value: naira(stats.total_sent),            color: "#16a34a" },
            { label: "Pending Amount",   value: naira(pendingAmt),                  color: "#d97706" },
            { label: "Today's Requests", value: stats.today?.claims || 0,           color: "#2563eb" },
            { label: "Completed Today",  value: `${stats.today?.completed || 0} · ${naira(stats.today?.completed_amount || 0)}`, color: "#0891b2" },
          ].map((s) => (
            <div key={s.label} className="stat-card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.3rem", fontWeight: 900, color: s.color }}>
                {s.value}
              </div>
              <div style={{ fontSize: ".72rem", color: "var(--muted)", marginTop: 2 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Network breakdown ── */}
      {stats?.by_network?.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {stats.by_network.map((n) => {
            const c = NETWORK_COLORS[n.network] || { bg: "#f5f3ef", color: "#555" };
            return (
              <span key={n.network} style={{
                padding: "4px 12px", borderRadius: 20,
                background: c.bg, fontSize: ".76rem",
                fontWeight: 700, color: c.color,
              }}>
                {n.network}: {naira(n.total)} ({n.count})
              </span>
            );
          })}
        </div>
      )}

      {/* ── Shared phones warning ── */}
      {stats?.shared_phones?.length > 0 && (
        <div style={{
          padding: "10px 14px", background: "#fff7ed",
          border: "1px solid #fed7aa", borderRadius: 10,
          fontSize: ".8rem", color: "#9a3412",
        }}>
          <strong>⚠️ {stats.shared_phones.length} phone{stats.shared_phones.length !== 1 ? "s" : ""} shared across accounts:</strong>{" "}
          {stats.shared_phones.slice(0, 5).map((p) => `${p.phone} (${p.user_count})`).join(", ")}
        </div>
      )}

      {/* ── Bulk action bar ── */}
      {selected.size > 0 && (
        <BulkActionBar
          selected={selected}
          api={api}
          onClear={clearSelection}
          onSuccess={() => { onMutation?.(); load(page); }}
          showToast={showToast}
          confirm={confirm}
        />
      )}

      {/* ── Tabs ── */}
      <div className="tabs" style={{ gap: 0, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab${statusTab === t.key ? " active" : ""}`}
            onClick={() => { setStatusTab(t.key); setPage(1); }}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              position: "relative",
            }}
            title={t.hint ? `Press ${t.hint}` : ""}
          >
            {t.label}
            {t.badge > 0 && (
              <span style={{
                background: statusTab === t.key ? "#e8630a" : "#e5e7eb",
                color: statusTab === t.key ? "#fff" : "#555",
                fontSize: ".7rem", fontWeight: 700,
                padding: "1px 7px", borderRadius: 20,
              }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Filters row ── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          ref={searchRef}
          className="inp"
          placeholder="Search by code, name, email or phone… ( / )"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ flex: 1, minWidth: 240 }}
        />
        <select
          className="inp"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          style={{ width: 160 }}
        >
          <option value="oldest">Oldest first</option>
          <option value="newest">Newest first</option>
          <option value="highest">Highest amount</option>
          <option value="lowest">Lowest amount</option>
        </select>
      </div>

      {/* ── Table ── */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
            Loading…
          </div>
        ) : claims.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--muted)" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📱</div>
            <p style={{ margin: 0, fontWeight: 600 }}>No {statusTab} claims</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={selected.size === claims.length && claims.length > 0}
                      onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                    />
                  </th>
                  <th>User</th>
                  <th>Code</th>
                  <th>Amount</th>
                  <th>Phone</th>
                  <th>Network</th>
                  <th>Status</th>
                  <th>Claimed</th>
                  <th style={{ minWidth: 140 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((r) => {
                  const cfg     = STATUS_CFG[r.status] || STATUS_CFG.pending;
                  const netCfg  = NETWORK_COLORS[r.network] || { bg: "#f5f3ef", color: "#555" };
                  const isBusy  = busy === r.id;
                  const canAct  = (r.allowed_transitions || []).length > 0;
                  const inFlow  = [CLAIM_STATUS.PENDING, CLAIM_STATUS.APPROVED, CLAIM_STATUS.SENT].includes(r.status);

                  return (
                    <tr key={r.id} style={selected.has(r.id) ? { background: "#eff6ff" } : {}}>
                      <td>
                        {canAct && (
                          <input
                            type="checkbox"
                            checked={selected.has(r.id)}
                            onChange={() => toggleSelect(r.id)}
                          />
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: ".82rem" }}>
                          {r.user?.name || "—"}
                        </div>
                        <div style={{ fontSize: ".74rem", color: "var(--muted)" }}>
                          {r.user?.email}
                        </div>
                      </td>
                      <td>
                        <code style={{
                          fontSize: ".76rem", background: "#f5f3ef",
                          padding: "2px 8px", borderRadius: 6,
                        }}>
                          {r.coupon_code}
                        </code>
                      </td>
                      <td style={{ fontWeight: 800, color: "#e8630a" }}>
                        {r.amount_fmt || naira(r.amount)}
                      </td>
                      <td style={{ fontSize: ".82rem", fontFamily: "monospace" }}>
                        <div>{r.phone}</div>
                      </td>
                      <td>
                        <span style={{
                          padding: "2px 10px", borderRadius: 20,
                          fontSize: ".74rem", fontWeight: 700,
                          background: netCfg.bg, color: netCfg.color,
                        }}>
                          {r.network || "—"}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          padding: "3px 10px", borderRadius: 20,
                          fontSize: ".74rem", fontWeight: 700,
                          background: cfg.bg, color: cfg.color,
                        }}>
                          {cfg.icon} {cfg.label}
                        </span>
                        {r.admin_note && (
                          <div style={{
                            fontSize: ".7rem", color: "#6b7280",
                            marginTop: 2, fontStyle: "italic",
                            maxWidth: 200, whiteSpace: "nowrap",
                            overflow: "hidden", textOverflow: "ellipsis",
                          }} title={r.admin_note}>
                            {r.admin_note}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: ".76rem", color: "var(--muted)" }}>
                        <div>{fmtRelative(r.claimed_at)}</div>
                        <div style={{ fontSize: ".68rem" }}>{fmtDate(r.claimed_at)}</div>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>

                          <button
                            className="btn b-ghost"
                            style={{ fontSize: ".72rem", padding: "3px 8px" }}
                            onClick={() => setDetailModal(r)}
                            title="View details"
                          >
                            👁
                          </button>

                          {/* ⚡ ONE-CLICK PROCESS — opens cascade modal */}
                          {inFlow && (
                            <button
                              className="btn b-solid"
                              style={{
                                fontSize: ".72rem",
                                padding: "3px 10px",
                                background: r.status === CLAIM_STATUS.PENDING  ? "#2563eb"
                                          : r.status === CLAIM_STATUS.APPROVED ? "#0891b2"
                                          : "#16a34a",
                                fontWeight: 700,
                              }}
                              disabled={isBusy}
                              onClick={() => setCascadeModal(r)}
                              title="Fast track through steps"
                            >
                              {r.status === CLAIM_STATUS.PENDING  ? "⚡ Process" :
                               r.status === CLAIM_STATUS.APPROVED ? "▶ Continue" :
                               "✅ Finish"}
                            </button>
                          )}

                          {/* Reject */}
                          {inFlow && (
                            <button
                              className="btn b-red"
                              style={{ fontSize: ".72rem", padding: "3px 8px" }}
                              disabled={isBusy}
                              onClick={() => setNoteModal({ claim: r, action: "reject" })}
                              title="Reject claim"
                            >
                              ❌
                            </button>
                          )}

                          {/* Fail (from approved, sent) */}
                          {[CLAIM_STATUS.APPROVED, CLAIM_STATUS.SENT].includes(r.status) && (
                            <button
                              className="btn b-red"
                              style={{ fontSize: ".72rem", padding: "3px 8px", background: "#9a3412" }}
                              disabled={isBusy}
                              onClick={() => setNoteModal({ claim: r, action: "fail" })}
                              title="Mark as failed"
                            >
                              ⚠️
                            </button>
                          )}

                          {/* Retry failed */}
                          {r.status === CLAIM_STATUS.FAILED && (
                            <button
                              className="btn b-solid"
                              style={{ fontSize: ".72rem", padding: "3px 8px", background: "#2563eb" }}
                              disabled={isBusy}
                              onClick={() => confirm({
                                title  : "Retry claim?",
                                body   : "Move this claim back to approved for retry.",
                                confirm: "🔄 Retry",
                                action : () => doAction(r.id, "approve"),
                              })}
                            >
                              🔄
                            </button>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          justifyContent: "center",
        }}>
          <button
            className="btn b-ghost"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Prev
          </button>
          <span style={{ fontSize: ".82rem", color: "var(--muted)" }}>
            Page {page} of {totalPages} · {total} total
          </span>
          <button
            className="btn b-ghost"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next →
          </button>
        </div>
      )}

      {/* ── Modals ── */}
      {showAssign && (
        <AssignModal
          api={api}
          onClose={() => setShowAssign(false)}
          onSuccess={(msg) => {
            showToast("success", msg);
            onMutation?.();
            load(page);
          }}
        />
      )}

      {noteModal && (
        <NoteModal
          claim={noteModal.claim}
          action={noteModal.action}
          api={api}
          onClose={() => setNoteModal(null)}
          onSuccess={(msg) => {
            showToast("success", msg);
            onMutation?.();
            load(page);
          }}
        />
      )}

      {detailModal && (
        <ClaimDetailModal
          claim={detailModal}
          api={api}
          onClose={() => setDetailModal(null)}
        />
      )}

      {cascadeModal && (
        <FastCascadeModal
          claim={cascadeModal}
          api={api}
          showToast={showToast}
          onClose={() => {
            setCascadeModal(null);
            load(page);
          }}
          onSuccess={() => {
            onMutation?.();
            /* Advance cascade modal to next step */
            setCascadeModal((prev) => {
              if (!prev) return null;
              const nextStatus = NEXT_STATUS[prev.status];
              return nextStatus ? { ...prev, status: nextStatus } : prev;
            });
          }}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24,
          padding: "12px 20px", borderRadius: 12,
          background: toast.type === "success" ? "#111"
                    : toast.type === "warning" ? "#f59e0b"
                    : "#dc2626",
          color: "#fff", fontWeight: 700, fontSize: ".84rem",
          boxShadow: "0 4px 20px rgba(0,0,0,.25)",
          zIndex: 9999, maxWidth: 400,
        }}>
          {toast.type === "success" ? "✅"
            : toast.type === "warning" ? "⚠️"
            : "❌"} {toast.text}
        </div>
      )}
    </div>
  );
}