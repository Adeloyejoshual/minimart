import {
  useState, useEffect, useCallback, useMemo, useRef,
} from "react";
import adminApi from "../../services/adminApi";

/* ═══════════════════════════════════════════
   Constants
═══════════════════════════════════════════ */
const STATUS_META = {
  pending_review: {
    label: "Under Review",
    color: "#d97706",
    bg:    "#fffbeb",
    border:"#fde68a",
  },
  active: {
    label: "Live",
    color: "#16a34a",
    bg:    "#f0fdf4",
    border:"#bbf7d0",
  },
  rejected: {
    label: "Rejected",
    color: "#dc2626",
    bg:    "#fff5f5",
    border:"#fecaca",
  },
  flagged: {
    label: "Flagged",
    color: "#9333ea",
    bg:    "#fdf4ff",
    border:"#e9d5ff",
  },
  paused: {
    label: "Paused",
    color: "#6b7280",
    bg:    "#f9fafb",
    border:"#e5e7eb",
  },
  sold: {
    label: "Sold",
    color: "#0369a1",
    bg:    "#f0f9ff",
    border:"#bae6fd",
  },
  deleted: {
    label: "Removed",
    color: "#dc2626",
    bg:    "#fff5f5",
    border:"#fecaca",
  },
};

const TABS = [
  { key: "pending_review", label: "Pending Review" },
  { key: "active",         label: "Active"         },
  { key: "rejected",       label: "Rejected"       },
  { key: "flagged",        label: "Flagged"        },
  { key: "paused",         label: "Paused"         },
  { key: "sold",           label: "Sold"           },
  { key: "",               label: "All"            },
];

const FLAG_OPTIONS = [
  { key: "is_featured",  label: "Featured",  color: "#d97706" },
  { key: "is_trending",  label: "Trending",  color: "#dc2626" },
  { key: "is_sponsored", label: "Sponsored", color: "#9333ea" },
  { key: "is_hidden",    label: "Hidden",    color: "#6b7280" },
];

const STATUS_OPTIONS = [
  { value: "pending_review", label: "Pending Review" },
  { value: "active",         label: "Active (Live)"  },
  { value: "rejected",       label: "Rejected"       },
  { value: "flagged",        label: "Flagged"        },
  { value: "paused",         label: "Paused"         },
  { value: "sold",           label: "Sold Out"       },
];

/* ═══════════════════════════════════════════
   Shared micro-styles
═══════════════════════════════════════════ */
const S = {
  sectionTitle: {
    fontSize: 11, fontWeight: 700, color: "#aaa",
    textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8,
  },
  label: {
    display: "block", fontSize: ".78rem", fontWeight: 700,
    color: "#888", textTransform: "uppercase",
    letterSpacing: ".5px", marginBottom: 4,
  },
  input: {
    width: "100%", padding: "10px 12px",
    border: "1.5px solid #e8e6e0", borderRadius: 10,
    fontSize: 13, fontFamily: "inherit", outline: "none",
    boxSizing: "border-box", background: "#fff",
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
  variantRow: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", padding: "8px 12px",
    background: "#f5f4f0", borderRadius: 10, marginBottom: 6, fontSize: 12,
  },
  list: {
    margin: 0, paddingLeft: 18,
    fontSize: 13, color: "#555", lineHeight: 1.7,
  },
};

const alertBox = (bg, border, color) => ({
  background: bg, border: `1px solid ${border}`, borderRadius: 10,
  padding: "10px 14px", fontSize: 12, color,
  marginBottom: 16, lineHeight: 1.5,
});

/* ═══════════════════════════════════════════
   Debounce hook
═══════════════════════════════════════════ */
function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ═══════════════════════════════════════════
   Small UI components
═══════════════════════════════════════════ */
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={S.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function StatusPill({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.active;
  return (
    <span style={{
      padding: "3px 9px", borderRadius: 999,
      fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
      background: meta.bg, color: meta.color,
      border: `1px solid ${meta.border}`,
    }}>
      {meta.label}
    </span>
  );
}

function FlagChip({ label, color }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 999,
      fontSize: 10, fontWeight: 700,
      background: `${color}18`,
      color, border: `1px solid ${color}40`,
    }}>
      {label}
    </span>
  );
}

function EmptyState({ tab }) {
  return (
    <div style={{
      textAlign: "center", padding: 60, color: "#aaa",
      background: "#fafaf8", borderRadius: 14,
      border: "1.5px dashed #e8e6e0",
    }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
        No listings found
      </div>
      <div style={{ fontSize: 13 }}>
        {tab === "pending_review"
          ? "The review queue is empty."
          : "Nothing matches your current filter."}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   RejectModal
═══════════════════════════════════════════ */
function RejectModal({ product, onReject, onClose }) {
  const [reason, setReason] = useState("");
  const [busy,   setBusy]   = useState(false);

  const submit = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    await onReject(product.id, reason.trim());
    setBusy(false);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460 }}>
        <div className="modal-title">Reject Listing</div>
        <p style={{ fontSize: ".82rem", color: "#888", marginBottom: 12 }}>
          <strong>{product.name}</strong> by {product.seller_name}
        </p>
        <label style={S.label}>Reason for rejection (required)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder='e.g. "Fake product photos" or "Prohibited item"'
          rows={3}
          style={S.textarea}
        />
        <div className="modal-btns" style={{ marginTop: 14 }}>
          <button className="btn b-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn b-red"
            disabled={!reason.trim() || busy}
            onClick={submit}
          >
            {busy ? "Rejecting..." : "Reject Listing"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   RemoveModal
═══════════════════════════════════════════ */
function RemoveModal({ product, onRemove, onClose }) {
  const [reason, setReason] = useState("");
  const [busy,   setBusy]   = useState(false);

  const submit = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    await onRemove(product.id, reason.trim());
    setBusy(false);
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460 }}>
        <div className="modal-title" style={{ color: "#dc2626" }}>
          Remove Listing
        </div>
        <p style={{ fontSize: ".82rem", color: "#888", marginBottom: 8 }}>
          This will soft-delete <strong>{product.name}</strong>.
          The seller will be notified.
        </p>
        <label style={S.label}>Removal reason (required)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder='e.g. "Scam product" or "Prohibited item"'
          rows={3}
          style={S.textarea}
        />
        <div className="modal-btns" style={{ marginTop: 14 }}>
          <button className="btn b-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn b-red"
            disabled={!reason.trim() || busy}
            onClick={submit}
          >
            {busy ? "Removing..." : "Remove Listing"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   ProductDrawer
═══════════════════════════════════════════ */
function ProductDrawer({
  product,
  onClose,
  onApprove,
  onRejectOpen,
  onRemoveOpen,
  onPause,
  onFlag,
  onStatusChange,
  onSaveEdit,
  onPermanentDelete,
  busy,
  confirm,
}) {
  const [editing,    setEditing]    = useState(false);
  const [editName,   setEditName]   = useState("");
  const [editDesc,   setEditDesc]   = useState("");
  const [editNotes,  setEditNotes]  = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  /*
   * FIXED: was incorrectly using useState as useEffect.
   * useEffect correctly resets fields whenever the product
   * changes (different product opened in drawer).
   */
  useEffect(() => {
    if (!product) return;
    setEditName(product.name ?? "");
    setEditDesc(product.description ?? "");
    setEditNotes(product.admin_notes ?? "");
    setEditing(false);
  }, [product?.id]);

  if (!product) return null;

  const meta      = STATUS_META[product.status] ?? STATUS_META.active;
  const images    = product.images ?? [];
  const variants  = product.variants ?? [];
  const features  = product.key_features  ?? product.keyFeatures  ?? [];
  const specs     = product.specifications ?? [];
  const box       = product.whats_in_box  ?? product.whatsInBox   ?? [];
  const isPending = product.status === "pending_review"
                 || product.status === "flagged";

  const handleSave = async () => {
    if (!editName.trim()) return;
    setSavingEdit(true);
    await onSaveEdit(product.id, {
      name:        editName.trim(),
      description: editDesc.trim(),
      admin_notes: editNotes.trim(),
    });
    setSavingEdit(false);
    setEditing(false);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 600,
      display: "flex", alignItems: "stretch",
    }}>
      {/* backdrop */}
      <div
        style={{ flex: 1, background: "rgba(0,0,0,.45)", cursor: "pointer" }}
        onClick={onClose}
      />

      {/* panel */}
      <div style={{
        width: "min(560px, 100%)", background: "#fff",
        overflowY: "auto", display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 32px rgba(0,0,0,.15)",
      }}>
        {/* header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #f0eeea",
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", flexShrink: 0,
          position: "sticky", top: 0, background: "#fff", zIndex: 1,
        }}>
          <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
            <div style={{
              fontWeight: 800, fontSize: 15,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {product.name}
            </div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
              {product.seller_name} · {product.seller_email}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <button
              className="btn b-ghost"
              onClick={() => setEditing((v) => !v)}
              style={{ fontSize: 12, padding: "4px 10px", height: 28 }}
            >
              {editing ? "Cancel" : "Edit"}
            </button>
            <button onClick={onClose} style={S.closeBtn}>x</button>
          </div>
        </div>

        {/* body */}
        <div style={{ padding: 20, flex: 1 }}>

          {/* status + flags */}
          <div style={{
            display: "flex", gap: 6, flexWrap: "wrap",
            marginBottom: 16, alignItems: "center",
          }}>
            <StatusPill status={product.status} />
            {product.is_featured  && <FlagChip label="Featured"  color="#d97706" />}
            {product.is_trending  && <FlagChip label="Trending"  color="#dc2626" />}
            {product.is_sponsored && <FlagChip label="Sponsored" color="#9333ea" />}
            {product.is_hidden    && <FlagChip label="Hidden"    color="#6b7280" />}
            {product.is_paused    && <FlagChip label="Paused"    color="#6b7280" />}
            {product.is_flagged   && (
              <span style={{
                padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca",
              }}>
                Spam detected · score {product.fraud_score}
              </span>
            )}
          </div>

          {/* alert banners */}
          {product.rejection_reason && (
            <div style={alertBox("#fff5f5", "#fecaca", "#991b1b")}>
              <strong>Rejection reason:</strong> {product.rejection_reason}
            </div>
          )}
          {product.removed_reason && (
            <div style={alertBox("#fff5f5", "#fecaca", "#991b1b")}>
              <strong>Removal reason:</strong> {product.removed_reason}
            </div>
          )}
          {product.admin_notes && !editing && (
            <div style={alertBox("#f0f9ff", "#bae6fd", "#0369a1")}>
              <strong>Admin notes:</strong> {product.admin_notes}
            </div>
          )}

          {/* EDIT PANEL */}
          {editing && (
            <div style={{
              border: "1.5px solid #ff5722", borderRadius: 14,
              padding: 16, marginBottom: 16, background: "#fffbf5",
            }}>
              <div style={{
                fontSize: 12, fontWeight: 800,
                color: "#ff5722", marginBottom: 12,
              }}>
                Edit Mode
              </div>

              <label style={S.label}>Product Title</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={80}
                style={S.input}
              />
              <div style={{
                fontSize: 11, color: "#bbb",
                textAlign: "right", marginTop: 2, marginBottom: 12,
              }}>
                {editName.length}/80
              </div>

              <label style={S.label}>Description</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                maxLength={2000}
                rows={5}
                style={S.textarea}
              />

              <label style={{ ...S.label, marginTop: 12 }}>
                Admin Notes (internal — not visible to seller)
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                placeholder="Internal notes only"
                style={S.textarea}
              />

              <button
                className="btn b-solid"
                disabled={savingEdit || !editName.trim()}
                onClick={handleSave}
                style={{ width: "100%", height: 40, marginTop: 14, fontSize: 13 }}
              >
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}

          {/* DETAIL VIEW */}
          {!editing && (
            <>
              {/* images */}
              {images.length > 0 && (
                <Section title={`Photos (${images.length})`}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {images.map((img, i) => {
                      const url = typeof img === "string"
                        ? img
                        : img?.image_url ?? img?.url;
                      return url ? (
                        <img key={i} src={url} alt=""
                          style={{
                            width:       i === 0 ? "100%" : "calc(33% - 6px)",
                            aspectRatio: i === 0 ? "16/9" : "1",
                            objectFit: "cover", borderRadius: 10,
                            border: "1.5px solid #f0eeea",
                          }}
                        />
                      ) : null;
                    })}
                  </div>
                </Section>
              )}

              {/* price */}
              <div style={{
                background: "#fafaf8", border: "1.5px solid #f0eeea",
                borderRadius: 12, padding: "14px 16px", marginBottom: 16,
              }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: "#ff5722" }}>
                    {Number(product.base_price ?? product.price ?? 0).toLocaleString("en-NG", {
                      style: "currency", currency: "NGN", maximumFractionDigits: 0,
                    })}
                  </span>
                  {product.original_price && (
                    <span style={{
                      fontSize: 13, color: "#bbb", textDecoration: "line-through",
                    }}>
                      {Number(product.original_price).toLocaleString("en-NG", {
                        style: "currency", currency: "NGN", maximumFractionDigits: 0,
                      })}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                  Category: <strong>{product.category}</strong>
                </div>
              </div>

              {/* description */}
              {product.description && (
                <Section title="Description">
                  <p style={{ fontSize: 13, color: "#555", lineHeight: 1.6, margin: 0 }}>
                    {product.description}
                  </p>
                </Section>
              )}

              {/* variants */}
              {variants.length > 0 && (
                <Section title={`Variants (${variants.length})`}>
                  {variants.map((v, i) => (
                    <div key={v.id ?? i} style={S.variantRow}>
                      <div>
                        <strong>{v.name}</strong>
                        <span style={{ color: "#888", marginLeft: 6 }}>{v.sku}</span>
                      </div>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <span style={{ fontWeight: 800, color: "#ff5722" }}>
                          {Number(v.price ?? 0).toLocaleString("en-NG", {
                            style: "currency", currency: "NGN", maximumFractionDigits: 0,
                          })}
                        </span>
                        <span style={{ color: "#888" }}>{v.stock} in stock</span>
                      </div>
                    </div>
                  ))}
                </Section>
              )}

              {/* features */}
              {features.length > 0 && (
                <Section title="Key Features">
                  <ul style={S.list}>
                    {features.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </Section>
              )}

              {/* specs */}
              {specs.length > 0 && (
                <Section title="Specifications">
                  <table style={{
                    width: "100%", borderCollapse: "collapse", fontSize: 13,
                  }}>
                    <tbody>
                      {specs.map((s, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #f0eeea" }}>
                          <td style={{
                            padding: "5px 6px", color: "#888",
                            fontWeight: 600, width: "40%",
                          }}>
                            {s.key ?? s.spec_key}
                          </td>
                          <td style={{ padding: "5px 6px", color: "#555" }}>
                            {s.value ?? s.spec_value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}

              {/* box */}
              {box.length > 0 && (
                <Section title="What is in the Box">
                  <ul style={S.list}>
                    {box.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </Section>
              )}
            </>
          )}

          {/* FLAGS */}
          <Section title="Product Flags">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {FLAG_OPTIONS.map((f) => {
                const isOn  = !!product[f.key];
                const bKey  = `flag-${product.id}-${f.key}`;
                return (
                  <button
                    key={f.key}
                    className={`btn ${isOn ? "b-solid" : "b-ghost"}`}
                    disabled={busy === bKey}
                    onClick={() => onFlag(product.id, f.key, !isOn)}
                    style={{
                      fontSize: 12, padding: "5px 12px", height: 30,
                      ...(isOn && {
                        background:  f.color,
                        borderColor: f.color,
                        color:       "#fff",
                      }),
                    }}
                  >
                    {busy === bKey ? "..." : f.label}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* STATUS CHANGE */}
          <Section title="Change Status">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {STATUS_OPTIONS.map((s) => {
                const isCurrent = product.status === s.value;
                const sm        = STATUS_META[s.value] ?? {};
                return (
                  <button
                    key={s.value}
                    disabled={isCurrent || busy === `status-${product.id}`}
                    onClick={() => {
                      if (s.value === "rejected") {
                        onRejectOpen(product);
                      } else {
                        confirm({
                          title:   `Change status to "${s.label}"?`,
                          body:    `"${product.name}" will be updated to ${s.label}.`,
                          confirm: "Change",
                          action:  () => onStatusChange(product.id, s.value),
                        });
                      }
                    }}
                    style={{
                      padding: "5px 12px", height: 30, borderRadius: 8,
                      border: `1.5px solid ${isCurrent ? sm.border : "#e8e6e0"}`,
                      background: isCurrent ? sm.bg   : "#fff",
                      color:      isCurrent ? sm.color : "#555",
                      fontWeight: isCurrent ? 700 : 500,
                      fontSize: 12,
                      cursor: isCurrent ? "default" : "pointer",
                    }}
                  >
                    {isCurrent ? "Current" : s.label}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* SELLER INFO */}
          <div style={{
            background: "#fafaf8", border: "1.5px solid #f0eeea",
            borderRadius: 12, padding: "14px 16px", marginBottom: 20, fontSize: 12,
          }}>
            <div style={S.sectionTitle}>Seller Info</div>
            <div style={{ display: "grid", gap: 5 }}>
              <div>
                <span style={{ color: "#888" }}>Name: </span>
                <strong>{product.seller_name}</strong>
              </div>
              <div>
                <span style={{ color: "#888" }}>Email: </span>
                <strong>{product.seller_email}</strong>
              </div>
              {product.seller_phone && (
                <div>
                  <span style={{ color: "#888" }}>Phone: </span>
                  <strong>{product.seller_phone}</strong>
                </div>
              )}
              <div style={{ color: "#aaa", marginTop: 4 }}>
                Submitted:{" "}
                {new Date(product.created_at).toLocaleString("en-GB", {
                  day: "numeric", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

            {/* Approve / Reject */}
            {isPending && (
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="btn b-solid"
                  disabled={busy === `ap-${product.id}`}
                  onClick={() => confirm({
                    title:   "Approve listing?",
                    body:    `"${product.name}" will go live immediately.`,
                    confirm: "Approve",
                    action:  () => onApprove(product.id),
                  })}
                  style={{ flex: 1, height: 44, fontSize: 14 }}
                >
                  {busy === `ap-${product.id}` ? "Approving..." : "Approve"}
                </button>
                <button
                  className="btn b-red"
                  disabled={busy === `rp-${product.id}`}
                  onClick={() => onRejectOpen(product)}
                  style={{ flex: 1, height: 44, fontSize: 14 }}
                >
                  Reject
                </button>
              </div>
            )}

            {/* Re-approve */}
            {product.status === "rejected" && (
              <button
                className="btn b-solid"
                disabled={busy === `ap-${product.id}`}
                onClick={() => confirm({
                  title:   "Re-approve this listing?",
                  body:    `"${product.name}" will go live.`,
                  confirm: "Approve",
                  action:  () => onApprove(product.id),
                })}
                style={{ width: "100%", height: 44, fontSize: 14 }}
              >
                {busy === `ap-${product.id}` ? "Approving..." : "Re-approve Listing"}
              </button>
            )}

            {/* Pause / Resume */}
            {(product.status === "active" || product.status === "paused") && (
              <button
                className={`btn ${product.is_paused ? "b-solid" : "b-ghost"}`}
                disabled={busy === `pause-${product.id}`}
                onClick={() => onPause(product.id)}
                style={{ width: "100%", height: 40, fontSize: 13 }}
              >
                {busy === `pause-${product.id}`
                  ? "..."
                  : product.is_paused
                  ? "Resume Listing"
                  : "Pause Listing"}
              </button>
            )}

            {/* Remove (soft) */}
            <button
              className="btn b-ghost"
              onClick={() => onRemoveOpen(product)}
              style={{
                width: "100%", height: 38, fontSize: 12,
                color: "#dc2626", borderColor: "#fecaca",
              }}
            >
              Remove Listing (fake / scam)
            </button>

            {/* Permanent delete — super admin only */}
            <button
              className="btn b-ghost"
              onClick={() => confirm({
                title:   "Permanently delete this listing?",
                body:    `This will permanently destroy "${product.name}" and all its data including images, variants, and specifications. This action cannot be undone.`,
                confirm: "Delete Permanently",
                danger:  true,
                action:  () => onPermanentDelete(product.id),
              })}
              style={{
                width: "100%", height: 36, fontSize: 11,
                color: "#991b1b", borderColor: "#fca5a5", background: "#fff5f5",
              }}
            >
              Permanent Delete (super admin only)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MarketProducts — main component
═══════════════════════════════════════════ */
export default function MarketProducts({ confirm }) {
  const [tab,          setTab]          = useState("pending_review");
  const [products,     setProducts]     = useState([]);
  const [counts,       setCounts]       = useState({});
  const [loading,      setLoading]      = useState(true);
  const [q,            setQ]            = useState("");
  const [busy,         setBusy]         = useState(null);
  const [drawer,       setDrawer]       = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);

  /*
   * Debounce search input so filtering does not run on
   * every single keystroke.
   */
  const debouncedQ = useDebounce(q, 300);

  /* ── Load ── */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get(
        `/products${tab ? `?status=${tab}` : ""}`
      );
      setProducts(Array.isArray(data) ? data : (data.products ?? []));
      if (data.counts) setCounts(data.counts);
    } catch (err) {
      console.error("[MarketProducts load]", err.message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  /* ── Local patch helpers ── */
  const updateLocal = useCallback((id, patch) => {
    setProducts((prev) =>
      prev.map((p) => p.id === id ? { ...p, ...patch } : p)
    );
    setDrawer((d) => d?.id === id ? { ...d, ...patch } : d);
  }, []);

  const removeLocal = useCallback((id) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setDrawer((d) => d?.id === id ? null : d);
  }, []);

  /* ── Approve ── */
  const handleApprove = useCallback(async (id) => {
    setBusy(`ap-${id}`);
    try {
      await adminApi.post(`/products/${id}/approve`);
      /*
       * Reload from server after every mutation so counts
       * are always accurate and never drift.
       */
      await load();
      setDrawer(null);
    } catch (err) {
      console.error("[approve]", err.message);
    } finally {
      setBusy(null);
    }
  }, [load]);

  /* ── Reject ── */
  const handleReject = useCallback(async (id, reason) => {
    setBusy(`rp-${id}`);
    try {
      await adminApi.post(`/products/${id}/reject`, { rejectionReason: reason });
      await load();
      setDrawer(null);
    } catch (err) {
      console.error("[reject]", err.message);
    } finally {
      setBusy(null);
    }
  }, [load]);

  /* ── Flag toggle ── */
  const handleFlag = useCallback(async (id, flag, value) => {
    const bKey = `flag-${id}-${flag}`;
    setBusy(bKey);
    try {
      await adminApi.post(`/products/${id}/flag`, { flag, value });
      /* Optimistic local update — no need to refetch for a toggle */
      updateLocal(id, { [flag]: value });
    } catch (err) {
      console.error("[flag]", err.message);
    } finally {
      setBusy(null);
    }
  }, [updateLocal]);

  /* ── Pause toggle ── */
  const handlePause = useCallback(async (id) => {
    setBusy(`pause-${id}`);
    try {
      const { data } = await adminApi.post(`/products/${id}/pause`);
      updateLocal(id, {
        is_paused: data.is_paused,
        status:    data.status,
        is_active: !data.is_paused,
      });
    } catch (err) {
      console.error("[pause]", err.message);
    } finally {
      setBusy(null);
    }
  }, [updateLocal]);

  /* ── Status change ── */
  const handleStatusChange = useCallback(async (id, status) => {
    setBusy(`status-${id}`);
    try {
      await adminApi.patch(`/products/${id}`, { status });
      await load();
      setDrawer(null);
    } catch (err) {
      console.error("[statusChange]", err.message);
    } finally {
      setBusy(null);
    }
  }, [load]);

  /* ── Edit (title, description, notes) ── */
  const handleSaveEdit = useCallback(async (id, fields) => {
    try {
      await adminApi.patch(`/products/${id}`, fields);
      updateLocal(id, fields);
    } catch (err) {
      console.error("[saveEdit]", err.message);
    }
  }, [updateLocal]);

  /* ── Remove (soft delete) ── */
  const handleRemove = useCallback(async (id, reason) => {
    setBusy(`rm-${id}`);
    try {
      await adminApi.post(`/products/${id}/remove`, { reason });
      await load();
      setDrawer(null);
    } catch (err) {
      console.error("[remove]", err.message);
    } finally {
      setBusy(null);
    }
  }, [load]);

  /* ── Permanent delete ── */
  const handlePermanentDelete = useCallback(async (id) => {
    setBusy(`perm-${id}`);
    try {
      await adminApi.delete(`/products/${id}/permanent`);
      removeLocal(id);
    } catch (err) {
      console.error("[permanentDelete]", err.message);
    } finally {
      setBusy(null);
    }
  }, [removeLocal]);

  /* ── Filter — uses debounced query ── */
  const displayed = useMemo(() => {
    const lq = debouncedQ.toLowerCase();
    if (!lq) return products;
    return products.filter((p) =>
      (p.name         ?? "").toLowerCase().includes(lq) ||
      (p.seller_name  ?? "").toLowerCase().includes(lq) ||
      (p.seller_email ?? "").toLowerCase().includes(lq) ||
      (p.category     ?? "").toLowerCase().includes(lq)
    );
  }, [products, debouncedQ]);

  const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
      })
    : "—";

  /* ═══════════════════════════════════════
     RENDER
  ═══════════════════════════════════════ */
  return (
    <div>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20, flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
            Market Products
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
            Review, approve, edit and manage all marketplace listings
          </p>
        </div>
        <button
          className="btn b-ghost"
          onClick={load}
          disabled={loading}
          style={{ fontSize: 13 }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {TABS.map((t) => {
          const count  = t.key
            ? (counts[t.key] ?? 0)
            : (counts.total ?? products.length);
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "7px 14px", borderRadius: 999,
                border:      active ? "none" : "1.5px solid #e8e6e0",
                background:  active ? "#ff5722" : "#fafaf8",
                color:       active ? "#fff" : "#555",
                fontWeight:  700, fontSize: 12, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                transition: "all .15s",
              }}
            >
              {t.label}
              {count > 0 && (
                <span style={{
                  borderRadius: 999, fontSize: 10, fontWeight: 800,
                  padding: "1px 6px", minWidth: 18, textAlign: "center",
                  background: active
                    ? "rgba(255,255,255,.25)"
                    : t.key === "pending_review" ? "#ff5722" : "#e8e6e0",
                  color: active
                    ? "#fff"
                    : t.key === "pending_review" ? "#fff" : "#555",
                }}>
                  {count}
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
        placeholder="Search by name, seller, email or category..."
        style={{
          width: "100%", maxWidth: 420, padding: "9px 14px",
          border: "1.5px solid #e8e6e0", borderRadius: 10,
          fontSize: 13, fontFamily: "inherit", outline: "none",
          boxSizing: "border-box", background: "#fafaf8", marginBottom: 16,
        }}
      />

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#aaa" }}>
          Loading listings...
        </div>
      ) : displayed.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%", borderCollapse: "collapse",
            fontSize: 13, minWidth: 820,
          }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #f0eeea" }}>
                {[
                  "", "Product", "Seller", "Price",
                  "Status", "Flags", "Fraud", "Date", "Actions",
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
              {displayed.map((p) => {
                const coverUrl = (() => {
                  if (p.cover_image) return p.cover_image;
                  const imgs  = p.images ?? [];
                  if (!imgs.length) return null;
                  const first = imgs[0];
                  return typeof first === "string"
                    ? first
                    : first?.image_url ?? first?.url;
                })();
                const isPending = p.status === "pending_review"
                               || p.status === "flagged";

                return (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: "1px solid #f5f4f0",
                      background: p.is_flagged ? "#fffbeb" : "transparent",
                      cursor: "pointer", transition: "background .12s",
                    }}
                    onMouseEnter={(e) =>
                      e.currentTarget.style.background = "#fafaf8"
                    }
                    onMouseLeave={(e) =>
                      e.currentTarget.style.background =
                        p.is_flagged ? "#fffbeb" : "transparent"
                    }
                    onClick={() => setDrawer(p)}
                  >
                    {/* Photo */}
                    <td style={{ padding: "8px 10px", width: 56 }}>
                      {coverUrl ? (
                        <img src={coverUrl} alt="" style={{
                          width: 44, height: 44, objectFit: "cover",
                          borderRadius: 8, border: "1.5px solid #f0eeea",
                        }} />
                      ) : (
                        <div style={{
                          width: 44, height: 44, borderRadius: 8,
                          background: "#f0eeea", display: "flex",
                          alignItems: "center", justifyContent: "center",
                          fontSize: 16, color: "#ccc",
                        }}>
                          --
                        </div>
                      )}
                    </td>

                    {/* Product */}
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ fontWeight: 700, color: "#1a1a1a", marginBottom: 2 }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: 11, color: "#aaa" }}>
                        {p.category}
                      </div>
                    </td>

                    {/* Seller */}
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ fontWeight: 600 }}>
                        {p.seller_name ?? "—"}
                      </div>
                      <div style={{ fontSize: 11, color: "#aaa" }}>
                        {p.seller_email ?? ""}
                      </div>
                    </td>

                    {/* Price */}
                    <td style={{
                      padding: "8px 10px", fontWeight: 800,
                      color: "#ff5722", whiteSpace: "nowrap",
                    }}>
                      {Number(p.base_price ?? p.price ?? 0).toLocaleString("en-NG", {
                        style: "currency", currency: "NGN",
                        maximumFractionDigits: 0,
                      })}
                    </td>

                    {/* Status */}
                    <td style={{ padding: "8px 10px" }}>
                      <StatusPill status={p.status} />
                    </td>

                    {/* Flags */}
                    <td style={{ padding: "8px 10px" }}>
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                        {p.is_featured  && <FlagChip label="Featured"  color="#d97706" />}
                        {p.is_trending  && <FlagChip label="Trending"  color="#dc2626" />}
                        {p.is_sponsored && <FlagChip label="Sponsored" color="#9333ea" />}
                        {p.is_hidden    && <FlagChip label="Hidden"    color="#6b7280" />}
                        {p.is_paused    && <FlagChip label="Paused"    color="#6b7280" />}
                      </div>
                    </td>

                    {/* Fraud score */}
                    <td style={{ padding: "8px 10px" }}>
                      {p.fraud_score != null ? (
                        <span style={{
                          fontWeight: 700,
                          color: p.fraud_score > 50 ? "#dc2626"
                               : p.fraud_score > 20 ? "#d97706"
                               : "#16a34a",
                        }}>
                          {p.fraud_score}
                        </span>
                      ) : (
                        <span style={{ color: "#ccc" }}>—</span>
                      )}
                    </td>

                    {/* Date */}
                    <td style={{
                      padding: "8px 10px", color: "#888", whiteSpace: "nowrap",
                    }}>
                      {fmtDate(p.created_at)}
                    </td>

                    {/* Actions */}
                    <td
                      style={{ padding: "8px 10px" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ display: "flex", gap: 6 }}>
                        {isPending && (
                          <>
                            <button
                              className="btn b-solid"
                              disabled={busy === `ap-${p.id}`}
                              onClick={() => confirm({
                                title:   "Approve listing?",
                                body:    `"${p.name}" will go live immediately.`,
                                confirm: "Approve",
                                action:  () => handleApprove(p.id),
                              })}
                              style={{
                                fontSize: 11, padding: "4px 10px", height: 28,
                              }}
                            >
                              {busy === `ap-${p.id}` ? "..." : "Approve"}
                            </button>
                            <button
                              className="btn b-red"
                              disabled={busy === `rp-${p.id}`}
                              onClick={() => setRejectTarget(p)}
                              style={{
                                fontSize: 11, padding: "4px 10px", height: 28,
                              }}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          className="btn b-ghost"
                          onClick={() => setDrawer(p)}
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
      )}

      {/* Drawer */}
      <ProductDrawer
        product={drawer}
        onClose={() => setDrawer(null)}
        onApprove={handleApprove}
        onRejectOpen={(p) => { setDrawer(null); setRejectTarget(p); }}
        onRemoveOpen={(p) => { setDrawer(null); setRemoveTarget(p); }}
        onPause={handlePause}
        onFlag={handleFlag}
        onStatusChange={handleStatusChange}
        onSaveEdit={handleSaveEdit}
        onPermanentDelete={handlePermanentDelete}
        busy={busy}
        confirm={confirm}
      />

      {/* Modals */}
      {rejectTarget && (
        <RejectModal
          product={rejectTarget}
          onReject={handleReject}
          onClose={() => setRejectTarget(null)}
        />
      )}
      {removeTarget && (
        <RemoveModal
          product={removeTarget}
          onRemove={handleRemove}
          onClose={() => setRemoveTarget(null)}
        />
      )}
    </div>
  );
}