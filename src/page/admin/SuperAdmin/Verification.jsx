import { useState, useEffect, useCallback, useMemo } from "react";
import adminApi from "../../../../services/adminApi";
import { fmtDate, fmtDateS } from "../adminlayout/helpers";
import { Pill, Card, Rfr } from "../adminlayout/atoms";

/* ── Constants ── */
const IDENTITY_TABS = [
  { key: "pending",  label: "Pending"  },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
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
};

const STATUS_COLOR = {
  pending:  "#d97706",
  approved: "#16a34a",
  rejected: "#dc2626",
  reset:    "#6b7280",
};

/* ── StatusBadge ── */
function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] ?? "#6b7280";
  return (
    <span style={S.badge(color)}>
      {status?.charAt(0).toUpperCase() + status?.slice(1) ?? "—"}
    </span>
  );
}

/* ── ImageViewer ── */
function ImageViewer({ url, label }) {
  if (!url) return null;
  const isPdf = url.endsWith(".pdf") || url.includes("/pdf");
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={S.label}>{label}</label>
      {isPdf ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block", padding: "8px 14px",
            background: "#f5f4f0", borderRadius: 8, fontSize: 13,
            color: "#ff5722", textDecoration: "none", border: "1.5px solid #e8e6e0",
          }}
        >
          View PDF
        </a>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url} alt={label}
            style={{
              width: "100%", maxHeight: 220, objectFit: "cover",
              borderRadius: 10, border: "1.5px solid #e8e6e0", cursor: "zoom-in",
            }}
          />
        </a>
      )}
    </div>
  );
}

/* ── RejectModal ── */
function RejectModal({ title, onSubmit, onClose }) {
  const [reason, setReason] = useState("");
  const [busy,   setBusy]   = useState(false);

  const submit = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    await onSubmit(reason.trim());
    setBusy(false);
    onClose();
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
          placeholder='e.g. "Documents unclear" or "Store name already taken"'
          style={S.textarea}
        />
        <div className="modal-btns" style={{ marginTop: 14 }}>
          <button className="btn b-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn b-red"
            disabled={!reason.trim() || busy}
            onClick={submit}
          >
            {busy ? "Submitting..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── ResetModal ── */
function ResetModal({ title, onSubmit, onClose }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    await onSubmit(note.trim() || null);
    setBusy(false);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
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

/* ── IdentityDrawer ── */
function IdentityDrawer({ record, onClose, onApprove, onReject, onReset, busy }) {
  if (!record) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 600, display: "flex" }}>
      <div
        style={{ flex: 1, background: "rgba(0,0,0,.45)", cursor: "pointer" }}
        onClick={onClose}
      />
      <div style={{
        width: "min(520px, 100%)", background: "#fff",
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
              {record.user_name} · {record.user_email}
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn}>x</button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Status */}
          <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
            <StatusBadge status={record.status} />
            {record.identity_verified && (
              <span style={S.badge("#16a34a")}>✓ Verified</span>
            )}
          </div>

          {/* Rejection / notes banners */}
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
          <div style={{
            background: "#fafaf8", border: "1.5px solid #f0eeea",
            borderRadius: 12, padding: "14px 16px", marginBottom: 16, fontSize: 13,
          }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div>
                <span style={{ color: "#888" }}>Document type: </span>
                <strong>{DOC_LABELS[record.document_type] ?? record.document_type}</strong>
              </div>
              <div>
                <span style={{ color: "#888" }}>Document number: </span>
                <strong>{record.document_number}</strong>
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
            </div>
          </div>

          {/* Images */}
          <ImageViewer url={record.front_image_url} label="Document Front" />
          <ImageViewer url={record.back_image_url}  label="Document Back"  />
          <ImageViewer url={record.selfie_url}       label="Selfie"         />

          {/* Seller info */}
          <div style={{
            background: "#fafaf8", border: "1.5px solid #f0eeea",
            borderRadius: 12, padding: "14px 16px", marginBottom: 20, fontSize: 12,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#aaa",
              textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>
              User Info
            </div>
            <div style={{ display: "grid", gap: 5 }}>
              <div><span style={{ color: "#888" }}>Name: </span><strong>{record.user_name}</strong></div>
              <div><span style={{ color: "#888" }}>Email: </span><strong>{record.user_email}</strong></div>
              {record.user_phone && (
                <div><span style={{ color: "#888" }}>Phone: </span><strong>{record.user_phone}</strong></div>
              )}
              <div><span style={{ color: "#888" }}>Trust score: </span><strong>{record.trust_score ?? 0}</strong></div>
              <div><span style={{ color: "#888" }}>Account status: </span><Pill s={record.user_status} /></div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {record.status === "pending" && (
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="btn b-solid"
                  disabled={busy === `id-approve-${record.id}`}
                  onClick={() => onApprove(record.id)}
                  style={{ flex: 1, height: 44, fontSize: 14 }}
                >
                  {busy === `id-approve-${record.id}` ? "Approving..." : "Approve Identity"}
                </button>
                <button
                  className="btn b-red"
                  disabled={busy === `id-reject-${record.id}`}
                  onClick={() => onReject(record)}
                  style={{ flex: 1, height: 44, fontSize: 14 }}
                >
                  Reject
                </button>
              </div>
            )}

            {record.status === "approved" && (
              <button
                className="btn b-ghost"
                onClick={() => onReset(record)}
                style={{ width: "100%", height: 40, fontSize: 13, color: "#d97706", borderColor: "#fde68a" }}
              >
                Revoke & Request Resubmission
              </button>
            )}

            {record.status === "rejected" && (
              <>
                <button
                  className="btn b-solid"
                  disabled={busy === `id-approve-${record.id}`}
                  onClick={() => onApprove(record.id)}
                  style={{ width: "100%", height: 44, fontSize: 14 }}
                >
                  {busy === `id-approve-${record.id}` ? "Approving..." : "Approve Anyway"}
                </button>
                <button
                  className="btn b-ghost"
                  onClick={() => onReset(record)}
                  style={{ width: "100%", height: 40, fontSize: 13 }}
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

/* ── StoreDrawer ── */
function StoreDrawer({ record, onClose, onApprove, onReject, onReset, busy }) {
  if (!record) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 600, display: "flex" }}>
      <div
        style={{ flex: 1, background: "rgba(0,0,0,.45)", cursor: "pointer" }}
        onClick={onClose}
      />
      <div style={{
        width: "min(520px, 100%)", background: "#fff",
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
            <div style={{ fontWeight: 800, fontSize: 15 }}>Store Review</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
              {record.user_name} · {record.user_email}
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn}>x</button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Status */}
          <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
            <StatusBadge status={record.status} />
            {record.store_verified && (
              <span style={S.badge("#16a34a")}>✓ Store Verified</span>
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

          {/* Store info */}
          <div style={{
            background: "#fafaf8", border: "1.5px solid #f0eeea",
            borderRadius: 12, padding: "14px 16px", marginBottom: 16, fontSize: 13,
          }}>
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
              {record.updated_at && (
                <div>
                  <span style={{ color: "#888" }}>Last updated: </span>
                  <strong>{fmtDate(record.updated_at)}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Logo */}
          <ImageViewer url={record.logo_url} label="Store Logo" />

          {/* User info */}
          <div style={{
            background: "#fafaf8", border: "1.5px solid #f0eeea",
            borderRadius: 12, padding: "14px 16px", marginBottom: 20, fontSize: 12,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#aaa",
              textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>
              User Info
            </div>
            <div style={{ display: "grid", gap: 5 }}>
              <div><span style={{ color: "#888" }}>Name: </span><strong>{record.user_name}</strong></div>
              <div><span style={{ color: "#888" }}>Email: </span><strong>{record.user_email}</strong></div>
              {record.user_phone && (
                <div><span style={{ color: "#888" }}>Phone: </span><strong>{record.user_phone}</strong></div>
              )}
              <div>
                <span style={{ color: "#888" }}>Identity verified: </span>
                <strong>{record.identity_verified ? "Yes" : "No"}</strong>
              </div>
              <div><span style={{ color: "#888" }}>Trust score: </span><strong>{record.trust_score ?? 0}</strong></div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {record.status === "pending" && (
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="btn b-solid"
                  disabled={busy === `store-approve-${record.id}`}
                  onClick={() => onApprove(record.id)}
                  style={{ flex: 1, height: 44, fontSize: 14 }}
                >
                  {busy === `store-approve-${record.id}` ? "Approving..." : "Approve Store"}
                </button>
                <button
                  className="btn b-red"
                  disabled={busy === `store-reject-${record.id}`}
                  onClick={() => onReject(record)}
                  style={{ flex: 1, height: 44, fontSize: 14 }}
                >
                  Reject
                </button>
              </div>
            )}

            {record.status === "approved" && (
              <button
                className="btn b-ghost"
                onClick={() => onReset(record)}
                style={{ width: "100%", height: 40, fontSize: 13, color: "#d97706", borderColor: "#fde68a" }}
              >
                Revoke & Request Resubmission
              </button>
            )}

            {record.status === "rejected" && (
              <>
                <button
                  className="btn b-solid"
                  disabled={busy === `store-approve-${record.id}`}
                  onClick={() => onApprove(record.id)}
                  style={{ width: "100%", height: 44, fontSize: 14 }}
                >
                  {busy === `store-approve-${record.id}` ? "Approving..." : "Approve Anyway"}
                </button>
                <button
                  className="btn b-ghost"
                  onClick={() => onReset(record)}
                  style={{ width: "100%", height: 40, fontSize: 13 }}
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

/* ══════════════════════════════════════════════
   Verification — main component
══════════════════════════════════════════════ */
export default function Verification({ confirm, onMutation }) {
  const [section,       setSection]       = useState("identity"); // "identity" | "store"
  const [identityTab,   setIdentityTab]   = useState("pending");
  const [storeTab,      setStoreTab]      = useState("pending");
  const [identityList,  setIdentityList]  = useState([]);
  const [storeList,     setStoreList]     = useState([]);
  const [stats,         setStats]         = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [busy,          setBusy]          = useState(null);
  const [idDrawer,      setIdDrawer]      = useState(null);
  const [storeDrawer,   setStoreDrawer]   = useState(null);
  const [rejectModal,   setRejectModal]   = useState(null); // { type, record }
  const [resetModal,    setResetModal]    = useState(null); // { type, record }
  const [q,             setQ]             = useState("");

  /* ── Load stats ── */
  const loadStats = useCallback(async () => {
    try {
      const { data } = await adminApi.get("/verification/stats");
      setStats(data);
    } catch (err) {
      console.error("[verification stats]", err.message);
    }
  }, []);

  /* ── Load identity ── */
  const loadIdentity = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get(`/verification/identity?status=${identityTab}&limit=100`);
      setIdentityList(data.verifications ?? []);
    } catch (err) {
      console.error("[identity load]", err.message);
    } finally {
      setLoading(false);
    }
  }, [identityTab]);

  /* ── Load store ── */
  const loadStore = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get(`/verification/store?status=${storeTab}&limit=100`);
      setStoreList(data.verifications ?? []);
    } catch (err) {
      console.error("[store load]", err.message);
    } finally {
      setLoading(false);
    }
  }, [storeTab]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (section === "identity") loadIdentity();
    else loadStore();
  }, [section, loadIdentity, loadStore]);

  const afterMutation = useCallback(async () => {
    if (section === "identity") await loadIdentity();
    else await loadStore();
    await loadStats();
    onMutation?.();
  }, [section, loadIdentity, loadStore, loadStats, onMutation]);

  /* ── Identity actions ── */
  const handleIdApprove = useCallback(async (id) => {
    setBusy(`id-approve-${id}`);
    try {
      await adminApi.post(`/verification/identity/${id}/approve`);
      await afterMutation();
      setIdDrawer(null);
    } catch (err) { console.error("[id approve]", err.message); }
    finally { setBusy(null); }
  }, [afterMutation]);

  const handleIdReject = useCallback(async (id, reason) => {
    setBusy(`id-reject-${id}`);
    try {
      await adminApi.post(`/verification/identity/${id}/reject`, { reason });
      await afterMutation();
      setIdDrawer(null);
    } catch (err) { console.error("[id reject]", err.message); }
    finally { setBusy(null); }
  }, [afterMutation]);

  const handleIdReset = useCallback(async (id, note) => {
    setBusy(`id-reset-${id}`);
    try {
      await adminApi.post(`/verification/identity/${id}/reset`, { note });
      await afterMutation();
      setIdDrawer(null);
    } catch (err) { console.error("[id reset]", err.message); }
    finally { setBusy(null); }
  }, [afterMutation]);

  /* ── Store actions ── */
  const handleStoreApprove = useCallback(async (id) => {
    setBusy(`store-approve-${id}`);
    try {
      await adminApi.post(`/verification/store/${id}/approve`);
      await afterMutation();
      setStoreDrawer(null);
    } catch (err) { console.error("[store approve]", err.message); }
    finally { setBusy(null); }
  }, [afterMutation]);

  const handleStoreReject = useCallback(async (id, reason) => {
    setBusy(`store-reject-${id}`);
    try {
      await adminApi.post(`/verification/store/${id}/reject`, { reason });
      await afterMutation();
      setStoreDrawer(null);
    } catch (err) { console.error("[store reject]", err.message); }
    finally { setBusy(null); }
  }, [afterMutation]);

  const handleStoreReset = useCallback(async (id, note) => {
    setBusy(`store-reset-${id}`);
    try {
      await adminApi.post(`/verification/store/${id}/reset`, { note });
      await afterMutation();
      setStoreDrawer(null);
    } catch (err) { console.error("[store reset]", err.message); }
    finally { setBusy(null); }
  }, [afterMutation]);

  /* ── Filter ── */
  const displayed = useMemo(() => {
    const list = section === "identity" ? identityList : storeList;
    const lq   = q.toLowerCase();
    if (!lq) return list;
    return list.filter((r) =>
      (r.user_name  ?? "").toLowerCase().includes(lq) ||
      (r.user_email ?? "").toLowerCase().includes(lq) ||
      (section === "identity"
        ? (r.document_number ?? "").toLowerCase().includes(lq)
        : (r.store_name ?? "").toLowerCase().includes(lq))
    );
  }, [section, identityList, storeList, q]);

  const tabs     = section === "identity" ? IDENTITY_TABS : STORE_TABS;
  const activeTab = section === "identity" ? identityTab : storeTab;
  const setActiveTab = section === "identity" ? setIdentityTab : setStoreTab;

  /* ══════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════ */
  return (
    <div>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 20, flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Verification</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
            Review identity documents and store applications
          </p>
        </div>
        <Rfr onClick={section === "identity" ? loadIdentity : loadStore} />
      </div>

      {/* Stats row */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Identity Pending",  value: stats.identity?.pending  ?? 0, color: "#d97706" },
            { label: "Identity Approved", value: stats.identity?.approved ?? 0, color: "#16a34a" },
            { label: "Identity Rejected", value: stats.identity?.rejected ?? 0, color: "#dc2626" },
            { label: "Store Pending",     value: stats.store?.pending     ?? 0, color: "#d97706" },
            { label: "Store Approved",    value: stats.store?.approved    ?? 0, color: "#16a34a" },
            { label: "Email Verified",    value: stats.users?.email_verified ?? 0, color: "#0369a1" },
          ].map((s) => (
            <div key={s.label} style={{
              background: "#fafaf8", border: "1.5px solid #f0eeea",
              borderRadius: 12, padding: "14px 16px",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#aaa",
                textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 4 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>
                {s.value.toLocaleString()}
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
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              style={{
                padding: "8px 18px", borderRadius: 10,
                border:     active ? "none" : "1.5px solid #e8e6e0",
                background: active ? "#ff5722" : "#fafaf8",
                color:      active ? "#fff"    : "#555",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
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
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: "6px 14px", borderRadius: 999, cursor: "pointer",
                border:     isAct ? "none" : "1.5px solid #e8e6e0",
                background: isAct ? "#1a1a1a" : "#fafaf8",
                color:      isAct ? "#fff"    : "#555",
                fontWeight: 700, fontSize: 12,
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
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

      {/* Search */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={section === "identity"
          ? "Search by name, email or document number..."
          : "Search by name, email or store name..."}
        style={{
          width: "100%", maxWidth: 420, padding: "9px 14px",
          border: "1.5px solid #e8e6e0", borderRadius: 10,
          fontSize: 13, fontFamily: "inherit", outline: "none",
          boxSizing: "border-box", background: "#fafaf8", marginBottom: 16,
        }}
      />

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>Loading...</div>
      ) : displayed.length === 0 ? (
        <div style={{
          textAlign: "center", padding: 60, color: "#aaa",
          background: "#fafaf8", borderRadius: 14,
          border: "1.5px dashed #e8e6e0",
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Nothing here</div>
          <div style={{ fontSize: 13 }}>No {activeTab} {section} verifications.</div>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #f0eeea" }}>
                {(section === "identity"
                  ? ["User", "Document", "Doc Number", "Trust", "Status", "Submitted", "Actions"]
                  : ["User", "Store Name", "Logo", "Trust", "Status", "Submitted", "Actions"]
                ).map((h) => (
                  <th key={h} style={{
                    padding: "10px 10px", textAlign: "left",
                    fontSize: 11, fontWeight: 700, color: "#aaa",
                    textTransform: "uppercase", letterSpacing: ".4px", whiteSpace: "nowrap",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((r) => (
                <tr
                  key={r.id}
                  style={{
                    borderBottom: "1px solid #f5f4f0",
                    cursor: "pointer", transition: "background .12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fafaf8")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  onClick={() => section === "identity" ? setIdDrawer(r) : setStoreDrawer(r)}
                >
                  {/* User */}
                  <td style={{ padding: "10px 10px" }}>
                    <div style={{ fontWeight: 700 }}>{r.user_name}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{r.user_email}</div>
                  </td>

                  {section === "identity" ? (
                    <>
                      <td style={{ padding: "10px 10px" }}>
                        <span style={S.badge("#6b7280")}>
                          {DOC_LABELS[r.document_type] ?? r.document_type}
                        </span>
                      </td>
                      <td style={{ padding: "10px 10px", fontFamily: "monospace", fontSize: 12 }}>
                        {r.document_number}
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: "10px 10px", fontWeight: 600 }}>
                        {r.store_name}
                      </td>
                      <td style={{ padding: "10px 10px" }}>
                        {r.logo_url ? (
                          <img src={r.logo_url} alt="" style={{
                            width: 36, height: 36, objectFit: "cover",
                            borderRadius: 8, border: "1.5px solid #f0eeea",
                          }} />
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: "#f0eeea" }} />
                        )}
                      </td>
                    </>
                  )}

                  {/* Trust score */}
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

                  {/* Status */}
                  <td style={{ padding: "10px 10px" }}>
                    <StatusBadge status={r.status} />
                  </td>

                  {/* Date */}
                  <td style={{ padding: "10px 10px", color: "#888", whiteSpace: "nowrap" }}>
                    {fmtDateS(r.created_at)}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: "10px 10px" }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {r.status === "pending" && section === "identity" && (
                        <>
                          <button
                            className="btn b-solid"
                            disabled={busy === `id-approve-${r.id}`}
                            onClick={() => confirm({
                              title:   "Approve identity?",
                              body:    `Approve ${r.user_name}'s identity documents?`,
                              confirm: "Approve",
                              action:  () => handleIdApprove(r.id),
                            })}
                            style={{ fontSize: 11, padding: "4px 10px", height: 28 }}
                          >
                            {busy === `id-approve-${r.id}` ? "..." : "Approve"}
                          </button>
                          <button
                            className="btn b-red"
                            onClick={() => setRejectModal({ type: "identity", record: r })}
                            style={{ fontSize: 11, padding: "4px 10px", height: 28 }}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {r.status === "pending" && section === "store" && (
                        <>
                          <button
                            className="btn b-solid"
                            disabled={busy === `store-approve-${r.id}`}
                            onClick={() => confirm({
                              title:   "Approve store?",
                              body:    `Approve "${r.store_name}" for ${r.user_name}?`,
                              confirm: "Approve",
                              action:  () => handleStoreApprove(r.id),
                            })}
                            style={{ fontSize: 11, padding: "4px 10px", height: 28 }}
                          >
                            {busy === `store-approve-${r.id}` ? "..." : "Approve"}
                          </button>
                          <button
                            className="btn b-red"
                            onClick={() => setRejectModal({ type: "store", record: r })}
                            style={{ fontSize: 11, padding: "4px 10px", height: 28 }}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        className="btn b-ghost"
                        onClick={() => section === "identity" ? setIdDrawer(r) : setStoreDrawer(r)}
                        style={{ fontSize: 11, padding: "4px 10px", height: 28 }}
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawers */}
      {idDrawer && (
        <IdentityDrawer
          record={idDrawer}
          onClose={() => setIdDrawer(null)}
          onApprove={(id) => confirm({
            title:   "Approve identity?",
            body:    `Approve ${idDrawer.user_name}'s identity documents?`,
            confirm: "Approve",
            action:  () => handleIdApprove(id),
          })}
          onReject={(r) => setRejectModal({ type: "identity", record: r })}
          onReset={(r)  => setResetModal({ type: "identity", record: r })}
          busy={busy}
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
        />
      )}

      {/* Reject modal */}
      {rejectModal && (
        <RejectModal
          title={`Reject ${rejectModal.type === "identity" ? "Identity" : "Store"}`}
          onSubmit={(reason) =>
            rejectModal.type === "identity"
              ? handleIdReject(rejectModal.record.id, reason)
              : handleStoreReject(rejectModal.record.id, reason)
          }
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
    </div>
  );
}