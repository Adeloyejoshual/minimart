/**
 * pages/seller/Products.jsx
 *
 * Seller product management page.
 * - Grid / list view
 * - Search + filter by status
 * - Pagination
 * - Edit modal (redirects to PostAds update flow)
 * - Delete modal (soft delete)
 * - Pause / resume toggle
 * - Aligned with market.products schema
 */

import {
  useState, useEffect, useCallback,
  useRef, memo,
} from "react";
import { useNavigate }          from "react-router-dom";
import { sellerApi, useDashboard } from "./SellerDashboard";

/* ══════════════════════════════════════════════════════════════
   SVG ICONS
══════════════════════════════════════════════════════════════ */
const IconRefresh = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const IconGrid = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <rect x="3"  y="3"  width="7" height="7" />
    <rect x="14" y="3"  width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3"  y="14" width="7" height="7" />
  </svg>
);

const IconList = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <line x1="8"  y1="6"  x2="21" y2="6"  />
    <line x1="8"  y1="12" x2="21" y2="12" />
    <line x1="8"  y1="18" x2="21" y2="18" />
    <line x1="3"  y1="6"  x2="3.01" y2="6"  />
    <line x1="3"  y1="12" x2="3.01" y2="12" />
    <line x1="3"  y1="18" x2="3.01" y2="18" />
  </svg>
);

const IconPlus = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    aria-hidden="true">
    <line x1="12" y1="5"  x2="12" y2="19" />
    <line x1="5"  y1="12" x2="19" y2="12" />
  </svg>
);

const IconEdit = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconTrash = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const IconPause = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <rect x="6"  y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
);

const IconPlay = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const IconSearch = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconX = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
    aria-hidden="true">
    <line x1="18" y1="6"  x2="6"  y2="18" />
    <line x1="6"  y1="6"  x2="18" y2="18" />
  </svg>
);

const IconPackage = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <line x1="16.5" y1="9.4"  x2="7.5"  y2="4.21" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const IconAlertTriangle = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9"  x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconCheck = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconTag = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const IconWarehouse = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35z" />
    <path d="M6 18h12M6 14h12M6 10h12" />
  </svg>
);

const IconActivity = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
const fmt = (v) =>
  `₦${Number(v ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/* Resolve cover image from market.products schema */
function getCoverImage(p) {
  if (Array.isArray(p.images) && p.images.length) {
    const primary = p.images.find((img) => img.is_primary) ?? p.images[0];
    return primary?.url ?? primary?.image_url ?? null;
  }
  return p.image_url ?? null;
}

/* Resolve total stock across variants */
function getTotalStock(p) {
  if (Array.isArray(p.variants) && p.variants.length) {
    return p.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
  }
  return Number(p.stock ?? p.quantity ?? 0);
}

/* Status display config — aligned with market.products status values */
const STATUS_CONFIG = {
  pending    : { bg: "#fffbeb", color: "#92400e", dot: "#f59e0b", label: "Pending Review" },
  approved   : { bg: "#ecfdf5", color: "#065f46", dot: "#10b981", label: "Approved"       },
  active     : { bg: "#ecfdf5", color: "#065f46", dot: "#10b981", label: "Active"         },
  rejected   : { bg: "#fef2f2", color: "#991b1b", dot: "#ef4444", label: "Rejected"       },
  paused     : { bg: "#f3f4f6", color: "#6b7280", dot: "#9ca3af", label: "Paused"         },
  archived   : { bg: "#f3f4f6", color: "#6b7280", dot: "#9ca3af", label: "Archived"       },
};

function getStatusCfg(p) {
  if (p.is_paused) return STATUS_CONFIG.paused;
  return STATUS_CONFIG[p.status] ?? { bg:"#f3f4f6", color:"#6b7280", dot:"#9ca3af", label: p.status ?? "—" };
}

/* ══════════════════════════════════════════════════════════════
   SPINNER
══════════════════════════════════════════════════════════════ */
const Spin = memo(function Spin({ size = 20, color = "#6366f1" }) {
  const t = Math.max(2, Math.ceil(size / 10));
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      border:    `${t}px solid #e5e7eb`,
      borderTop: `${t}px solid ${color}`,
      borderRadius: "50%",
      animation: "sp-spin 0.7s linear infinite",
    }} />
  );
});

/* ══════════════════════════════════════════════════════════════
   STOCK BADGE
══════════════════════════════════════════════════════════════ */
const StockBadge = memo(function StockBadge({ stock }) {
  const n = Number(stock ?? 0);
  const cfg =
    n <= 0  ? { bg:"#fef2f2", color:"#991b1b", dot:"#ef4444", text:"Out of stock"    } :
    n <= 5  ? { bg:"#fffbeb", color:"#92400e", dot:"#f59e0b", text:`Low — ${n} left` } :
    n <= 20 ? { bg:"#fff7ed", color:"#c2410c", dot:"#f97316", text:`${n} in stock`   } :
              { bg:"#ecfdf5", color:"#065f46", dot:"#10b981", text:`${n} in stock`   };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.3rem",
      padding: "0.22rem 0.6rem", borderRadius: "100px",
      fontSize: "0.68rem", fontWeight: 700,
      background: cfg.bg, color: cfg.color,
    }}>
      <span style={{ width:6, height:6, borderRadius:"50%",
        background: cfg.dot, flexShrink: 0 }} />
      {cfg.text}
    </span>
  );
});

/* ══════════════════════════════════════════════════════════════
   STATUS CHIP
══════════════════════════════════════════════════════════════ */
const StatusChip = memo(function StatusChip({ product }) {
  const cfg = getStatusCfg(product);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.3rem",
      padding: "0.2rem 0.6rem", borderRadius: "100px",
      fontSize: "0.65rem", fontWeight: 700,
      background: cfg.bg, color: cfg.color,
    }}>
      <span style={{ width:5, height:5, borderRadius:"50%",
        background: cfg.dot, flexShrink:0 }} />
      {cfg.label}
    </span>
  );
});

/* ══════════════════════════════════════════════════════════════
   SKELETON
══════════════════════════════════════════════════════════════ */
const shimmer = {
  background: "linear-gradient(90deg,#f3f4f6 25%,#e9eaf0 50%,#f3f4f6 75%)",
  backgroundSize: "400px 100%",
  animation: "sp-shimmer 1.4s infinite",
};

const SkeletonCard = () => (
  <div style={{ background:"white", borderRadius:"16px",
    border:"1px solid #f3f4f6", overflow:"hidden" }}>
    <div style={{ height:155, ...shimmer }} />
    <div style={{ padding:"0.9rem", display:"flex",
      flexDirection:"column", gap:"0.5rem" }}>
      {[75, 50, 90].map((w, i) => (
        <div key={i} style={{ height:11, width:`${w}%`,
          borderRadius:"100px", ...shimmer }} />
      ))}
    </div>
  </div>
);

const SkeletonRow = () => (
  <div style={{ display:"flex", alignItems:"center", gap:"0.875rem",
    padding:"0.875rem 1.25rem", borderBottom:"1px solid #f3f4f6" }}>
    <div style={{ width:48, height:48, borderRadius:10,
      flexShrink:0, ...shimmer }} />
    <div style={{ flex:1, display:"flex",
      flexDirection:"column", gap:"0.4rem" }}>
      {[60, 40].map((w, i) => (
        <div key={i} style={{ height:11, width:`${w}%`,
          borderRadius:"100px", ...shimmer }} />
      ))}
    </div>
    <div style={{ width:70, height:22, borderRadius:8, ...shimmer }} />
  </div>
);

/* ══════════════════════════════════════════════════════════════
   DELETE MODAL
══════════════════════════════════════════════════════════════ */
const DeleteModal = memo(function DeleteModal({ product, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const { data } = await sellerApi.delete(`/api/products/${product.id}`);
      if (data.success) { onDeleted?.(); onClose(); }
      else setError(data.message ?? "Delete failed");
    } catch (err) {
      setError(err.response?.data?.message ?? "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={MS.overlay} onClick={onClose} role="dialog"
      aria-modal="true" aria-label="Delete product">
      <div style={{ ...MS.modal, maxWidth: 380 }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ padding:"2rem 1.75rem",
          display:"flex", flexDirection:"column", gap:"1.1rem" }}>

          {/* Icon */}
          <div style={{ width:56, height:56, borderRadius:"50%",
            background:"#fef2f2", display:"flex", alignItems:"center",
            justifyContent:"center", margin:"0 auto" }}>
            <IconTrash size={24} />
          </div>

          <div style={{ textAlign:"center" }}>
            <h3 style={{ fontWeight:800, color:"#1f2937",
              margin:"0 0 0.4rem", fontSize:"1.1rem" }}>
              Delete Listing?
            </h3>
            <p style={{ color:"#6b7280", fontSize:"0.875rem",
              margin:0, lineHeight:1.6 }}>
              <strong>"{product.name}"</strong> will be permanently removed.
              This cannot be undone.
            </p>
          </div>

          {error && (
            <div style={{ background:"#fef2f2", border:"1px solid #fecaca",
              borderRadius:"10px", padding:"0.75rem 1rem",
              color:"#991b1b", fontSize:"0.85rem",
              display:"flex", alignItems:"center", gap:"0.5rem" }}>
              <IconAlertTriangle size={15} />
              {error}
            </div>
          )}

          <div style={{ display:"flex", gap:"0.75rem" }}>
            <button onClick={onClose} style={MS.cancelBtn}>Keep It</button>
            <button onClick={handleDelete} disabled={deleting}
              style={{ ...MS.dangerBtn, opacity: deleting ? 0.7 : 1 }}>
              {deleting ? (
                <span style={{ display:"flex", alignItems:"center",
                  gap:"0.4rem", justifyContent:"center" }}>
                  <Spin size={15} color="white" /> Deleting...
                </span>
              ) : "Yes, Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   PAUSE MODAL
══════════════════════════════════════════════════════════════ */
const PauseModal = memo(function PauseModal({ product, onClose, onToggled }) {
  const isPaused = product.is_paused;
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const handleToggle = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await sellerApi.patch(`/api/products/${product.id}/pause`);
      if (data.success) { onToggled?.(); onClose(); }
      else setError(data.message ?? "Failed");
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={MS.overlay} onClick={onClose} role="dialog"
      aria-modal="true"
      aria-label={isPaused ? "Resume listing" : "Pause listing"}>
      <div style={{ ...MS.modal, maxWidth:380 }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ padding:"2rem 1.75rem",
          display:"flex", flexDirection:"column", gap:"1.1rem" }}>

          <div style={{ width:56, height:56, borderRadius:"50%",
            background: isPaused ? "#ecfdf5" : "#fffbeb",
            display:"flex", alignItems:"center",
            justifyContent:"center", margin:"0 auto" }}>
            {isPaused ? <IconPlay size={22} /> : <IconPause size={22} />}
          </div>

          <div style={{ textAlign:"center" }}>
            <h3 style={{ fontWeight:800, color:"#1f2937",
              margin:"0 0 0.4rem", fontSize:"1.1rem" }}>
              {isPaused ? "Resume Listing?" : "Pause Listing?"}
            </h3>
            <p style={{ color:"#6b7280", fontSize:"0.875rem",
              margin:0, lineHeight:1.6 }}>
              {isPaused
                ? "Buyers will be able to see and purchase this listing again."
                : "This listing will be hidden from buyers until you resume it."}
            </p>
          </div>

          {error && (
            <div style={{ background:"#fef2f2", border:"1px solid #fecaca",
              borderRadius:"10px", padding:"0.75rem 1rem",
              color:"#991b1b", fontSize:"0.85rem",
              display:"flex", alignItems:"center", gap:"0.5rem" }}>
              <IconAlertTriangle size={15} />
              {error}
            </div>
          )}

          <div style={{ display:"flex", gap:"0.75rem" }}>
            <button onClick={onClose} style={MS.cancelBtn}>Cancel</button>
            <button onClick={handleToggle} disabled={loading}
              style={{
                ...MS.primaryBtn,
                opacity: loading ? 0.7 : 1,
                background: isPaused
                  ? "linear-gradient(135deg,#10b981,#059669)"
                  : "linear-gradient(135deg,#f59e0b,#d97706)",
              }}>
              {loading ? (
                <span style={{ display:"flex", alignItems:"center",
                  gap:"0.4rem", justifyContent:"center" }}>
                  <Spin size={15} color="white" />
                  {isPaused ? "Resuming..." : "Pausing..."}
                </span>
              ) : isPaused ? "Resume Listing" : "Pause Listing"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   PRODUCT CARD (grid)
══════════════════════════════════════════════════════════════ */
const ProductCard = memo(function ProductCard({
  product: p, mobile,
  onEdit, onDelete, onPause,
}) {
  const cover      = getCoverImage(p);
  const totalStock = getTotalStock(p);
  const [imgErr,   setImgErr] = useState(false);

  return (
    <div className="sp-card">
      {/* Image */}
      <div style={{ height: mobile ? 130 : 155, background:"#f8fafc",
        position:"relative", overflow:"hidden",
        display:"flex", alignItems:"center", justifyContent:"center" }}>
        {cover && !imgErr ? (
          <img
            src={cover}
            alt={p.name}
            style={{ width:"100%", height:"100%",
              objectFit:"cover", display:"block" }}
            onError={() => setImgErr(true)}
          />
        ) : (
          <span style={{ color:"#d1d5db" }}>
            <IconPackage size={36} />
          </span>
        )}

        {/* Status overlay */}
        <div style={{ position:"absolute", top:8, left:8 }}>
          <StatusChip product={p} />
        </div>

        {/* Paused overlay */}
        {p.is_paused && (
          <div style={{
            position:"absolute", inset:0,
            background:"rgba(0,0,0,0.35)",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <span style={{ color:"white", fontSize:"0.75rem",
              fontWeight:800, background:"rgba(0,0,0,0.5)",
              padding:"0.25rem 0.6rem", borderRadius:"6px" }}>
              PAUSED
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: mobile ? "0.7rem" : "0.875rem",
        display:"flex", flexDirection:"column", gap:"0.35rem" }}>

        <p style={{ fontWeight:700, color:"#1f2937", margin:0,
          fontSize: mobile ? "0.8rem" : "0.875rem",
          overflow:"hidden", textOverflow:"ellipsis",
          whiteSpace:"nowrap" }}
          title={p.name}>
          {p.name}
        </p>

        {p.category && (
          <p style={{ color:"#9ca3af", fontSize:"0.68rem", margin:0 }}>
            {p.category}
          </p>
        )}

        <div style={{ display:"flex", justifyContent:"space-between",
          alignItems:"center", marginTop:"0.15rem",
          flexWrap:"wrap", gap:"0.25rem" }}>
          <span style={{ fontWeight:800, color:"#1f2937",
            fontSize: mobile ? "0.95rem" : "1rem" }}>
            {fmt(p.price)}
          </span>
          <StockBadge stock={totalStock} />
        </div>

        {/* Variant count */}
        {Array.isArray(p.variants) && p.variants.length > 1 && (
          <p style={{ color:"#9ca3af", fontSize:"0.65rem", margin:0 }}>
            {p.variants.length} variants
          </p>
        )}

        {/* Actions */}
        <div style={{ display:"flex", gap:"0.4rem", marginTop:"0.5rem" }}>
          <button
            onClick={() => onEdit(p)}
            className="sp-action-btn sp-action-btn--blue"
            style={{ flex:1 }}
            aria-label={`Edit ${p.name}`}>
            <IconEdit size={13} />
            <span>Edit</span>
          </button>

          {p.status === "approved" && (
            <button
              onClick={() => onPause(p)}
              className="sp-action-btn sp-action-btn--amber"
              aria-label={p.is_paused ? "Resume listing" : "Pause listing"}>
              {p.is_paused ? <IconPlay size={13} /> : <IconPause size={13} />}
            </button>
          )}

          <button
            onClick={() => onDelete(p)}
            className="sp-action-btn sp-action-btn--red"
            aria-label={`Delete ${p.name}`}>
            <IconTrash size={13} />
          </button>
        </div>
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   PRODUCT ROW (list view)
══════════════════════════════════════════════════════════════ */
const ProductRow = memo(function ProductRow({
  product: p, onEdit, onDelete, onPause,
}) {
  const cover      = getCoverImage(p);
  const totalStock = getTotalStock(p);
  const [imgErr,   setImgErr] = useState(false);

  return (
    <div className="sp-row"
      style={{ display:"grid",
        gridTemplateColumns:"2.5fr 1fr 1fr 1fr auto",
        gap:"0.5rem", alignItems:"center",
        padding:"0.875rem 1.25rem" }}>

      {/* Product info */}
      <div style={{ display:"flex", alignItems:"center",
        gap:"0.75rem", minWidth:0 }}>
        <div style={{ width:48, height:48, borderRadius:10,
          background:"#f8fafc", flexShrink:0, overflow:"hidden",
          display:"flex", alignItems:"center", justifyContent:"center" }}>
          {cover && !imgErr ? (
            <img src={cover} alt=""
              style={{ width:"100%", height:"100%", objectFit:"cover" }}
              onError={() => setImgErr(true)} />
          ) : (
            <span style={{ color:"#d1d5db" }}>
              <IconPackage size={20} />
            </span>
          )}
        </div>
        <div style={{ minWidth:0 }}>
          <p style={{ fontWeight:600, color:"#1f2937", margin:0,
            fontSize:"0.875rem", overflow:"hidden",
            textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {p.name}
          </p>
          {p.category && (
            <p style={{ color:"#9ca3af", fontSize:"0.7rem",
              margin:"0.1rem 0 0" }}>
              {p.category}
            </p>
          )}
          {Array.isArray(p.variants) && p.variants.length > 1 && (
            <p style={{ color:"#c4b5fd", fontSize:"0.65rem",
              margin:"0.1rem 0 0" }}>
              {p.variants.length} variants
            </p>
          )}
        </div>
      </div>

      {/* Price */}
      <span style={{ fontWeight:700, color:"#1f2937", fontSize:"0.9rem" }}>
        {fmt(p.price)}
      </span>

      {/* Stock */}
      <StockBadge stock={totalStock} />

      {/* Status */}
      <StatusChip product={p} />

      {/* Actions */}
      <div style={{ display:"flex", gap:"0.4rem" }}>
        <button
          onClick={() => onEdit(p)}
          className="sp-action-btn sp-action-btn--blue"
          aria-label={`Edit ${p.name}`}>
          <IconEdit size={13} />
          <span>Edit</span>
        </button>

        {p.status === "approved" && (
          <button
            onClick={() => onPause(p)}
            className="sp-action-btn sp-action-btn--amber"
            aria-label={p.is_paused ? "Resume" : "Pause"}>
            {p.is_paused ? <IconPlay size={13} /> : <IconPause size={13} />}
          </button>
        )}

        <button
          onClick={() => onDelete(p)}
          className="sp-action-btn sp-action-btn--red"
          aria-label={`Delete ${p.name}`}>
          <IconTrash size={13} />
        </button>
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
const LIMIT = 12;

const FILTERS = [
  { key:"",          label:"All"            },
  { key:"pending",   label:"Pending"        },
  { key:"approved",  label:"Approved"       },
  { key:"rejected",  label:"Rejected"       },
  { key:"paused",    label:"Paused"         },
];

export default function Products() {
  const navigate       = useNavigate();
  const { vendor }     = useDashboard();

  const [products,       setProducts]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState("");
  const [debouncedSearch,setDebouncedSearch]= useState("");
  const [filter,         setFilter]         = useState("");
  const [page,           setPage]           = useState(1);
  const [pagination,     setPagination]     = useState(null);
  const [viewMode,       setViewMode]       = useState("grid");
  const [deleteTarget,   setDeleteTarget]   = useState(null);
  const [pauseTarget,    setPauseTarget]    = useState(null);
  const [refreshing,     setRefreshing]     = useState(false);
  const [screenW,        setScreenW]        = useState(window.innerWidth);

  const searchRef = useRef();

  /* ── Responsive ── */
  useEffect(() => {
    const fn = () => setScreenW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const mobile = screenW < 640;
  const tablet = screenW < 1024;

  /* ── Debounce search ── */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  /* ── Fetch ── */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (filter)          params.status = filter;
      if (debouncedSearch) params.search = debouncedSearch;

      const { data } = await sellerApi.get("/api/seller/mine", params);
      if (data.success) {
        setProducts(data.data?.products ?? []);
        setPagination(data.data?.pagination ?? null);
      }
    } catch (err) {
      console.error("[Products]", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, filter, debouncedSearch]);

  useEffect(() => { load(); },         [load]);
  useEffect(() => { setPage(1); },     [filter, debouncedSearch]);

  const refresh = () => { setRefreshing(true); load(true); };

  /* ── Summary stats ── */
  const totalStock  = products.reduce((s, p) => s + getTotalStock(p), 0);
  const lowStock    = products.filter((p) => getTotalStock(p) <= 5).length;
  const activeCount = products.filter((p) =>
    (p.status === "approved" || p.status === "active") && !p.is_paused
  ).length;

  /* ── Edit — redirect to update route ── */
  const handleEdit = useCallback((p) => {
    navigate(`/minimart/edit-ad/${p.id}`);
  }, [navigate]);

  /* ── Render ── */
  return (
    <>
      {/* Global keyframes */}
      <style>{`
        @keyframes sp-spin    { to { transform: rotate(360deg); } }
        @keyframes sp-shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        @keyframes sp-fadeup  {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0);   }
        }

        .sp-card {
          background:white; border-radius:16px;
          border:1px solid #f3f4f6; overflow:hidden;
          box-shadow:0 1px 4px rgba(0,0,0,0.04);
          transition:box-shadow 0.2s, transform 0.2s;
          animation:sp-fadeup 0.22s ease;
        }
        .sp-card:hover {
          box-shadow:0 8px 24px rgba(99,102,241,0.1);
          transform:translateY(-2px);
        }

        .sp-row {
          border-bottom:1px solid #f9fafb;
          background:white;
          transition:background 0.15s;
          animation:sp-fadeup 0.2s ease;
        }
        .sp-row:last-child { border-bottom:none; }
        .sp-row:hover      { background:#fafafa; }

        .sp-action-btn {
          display:inline-flex; align-items:center;
          justify-content:center; gap:0.3rem;
          padding:0.42rem 0.65rem; border-radius:8px;
          font-size:0.75rem; font-weight:600;
          cursor:pointer; font-family:inherit;
          border:1px solid transparent;
          transition:opacity 0.15s, transform 0.1s;
        }
        .sp-action-btn:hover  { opacity:0.82; }
        .sp-action-btn:active { transform:scale(0.96); }

        .sp-action-btn--blue  { background:#eff6ff; border-color:#bfdbfe; color:#1e40af; }
        .sp-action-btn--amber { background:#fffbeb; border-color:#fde68a; color:#92400e; }
        .sp-action-btn--red   { background:#fef2f2; border-color:#fecaca; color:#ef4444; }

        .sp-filter-pill {
          padding:0.38rem 0.875rem; border-radius:100px;
          font-size:0.78rem; cursor:pointer;
          font-family:inherit; white-space:nowrap;
          transition:all 0.15s;
        }
        .sp-filter-pill:hover {
          border-color:#6366f1 !important;
          color:#6366f1 !important;
        }

        .sp-page-btn:hover:not(:disabled) {
          border-color:#6366f1;
          color:#6366f1;
        }

        input:focus, select:focus, textarea:focus {
          border-color:#6366f1 !important;
          box-shadow:0 0 0 3px rgba(99,102,241,0.08);
          outline:none;
        }
      `}</style>

      <div style={{ display:"flex", flexDirection:"column", gap:"1.25rem" }}>

        {/* ══ HEADER ══════════════════════════════════════════ */}
        <div style={{ display:"flex", justifyContent:"space-between",
          alignItems:"flex-start", flexWrap:"wrap", gap:"0.75rem" }}>
          <div>
            <h2 style={{ fontWeight:800, fontSize:"1.35rem",
              color:"#1f2937", margin:0,
              display:"flex", alignItems:"center", gap:"0.5rem" }}>
              <IconTag size={22} />
              My Listings
            </h2>
            <p style={{ color:"#9ca3af", fontSize:"0.85rem",
              margin:"0.2rem 0 0" }}>
              {pagination?.total ?? products.length} products in your store
            </p>
          </div>

          <div style={{ display:"flex", gap:"0.5rem",
            alignItems:"center", flexWrap:"wrap" }}>

            {/* Refresh */}
            <button
              onClick={refresh}
              disabled={refreshing}
              style={{
                background:"white", border:"1px solid #e5e7eb",
                borderRadius:"10px", padding:"0.6rem 0.875rem",
                cursor:"pointer", color:"#6b7280",
                display:"flex", alignItems:"center", gap:"0.4rem",
                fontSize:"0.8rem", fontWeight:600,
                fontFamily:"inherit", transition:"background 0.15s",
              }}
              aria-label="Refresh listings">
              <span style={{
                display:"inline-block",
                animation: refreshing ? "sp-spin 0.7s linear infinite" : "none",
              }}>
                <IconRefresh size={15} />
              </span>
              {!mobile && <span>Refresh</span>}
            </button>

            {/* View toggle */}
            {!mobile && (
              <div style={{ display:"flex", background:"white",
                border:"1px solid #e5e7eb", borderRadius:"10px",
                padding:"3px", gap:"2px" }}>
                {[
                  { mode:"grid", Icon: IconGrid },
                  { mode:"list", Icon: IconList },
                ].map(({ mode, Icon }) => (
                  <button key={mode}
                    onClick={() => setViewMode(mode)}
                    aria-label={`${mode} view`}
                    aria-pressed={viewMode === mode}
                    style={{
                      padding:"0.35rem 0.65rem",
                      borderRadius:"7px", border:"none",
                      cursor:"pointer",
                      background: viewMode === mode ? "#6366f1" : "transparent",
                      color:      viewMode === mode ? "white"   : "#9ca3af",
                      display:"flex", alignItems:"center",
                      transition:"all 0.15s",
                    }}>
                    <Icon size={15} />
                  </button>
                ))}
              </div>
            )}

            {/* Post new */}
            <button
              onClick={() => navigate("/minimart/post-ad")}
              style={{
                padding:"0.68rem 1.25rem",
                background:"linear-gradient(135deg,#ff5722,#ff8a00)",
                color:"white", border:"none", borderRadius:"11px",
                fontWeight:700, cursor:"pointer", fontSize:"0.875rem",
                whiteSpace:"nowrap", fontFamily:"inherit",
                display:"flex", alignItems:"center", gap:"0.4rem",
                boxShadow:"0 2px 8px rgba(255,87,34,0.3)",
                transition:"opacity 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <IconPlus size={15} />
              {mobile ? "Post Ad" : "Post New Product"}
            </button>
          </div>
        </div>

        {/* ══ SUMMARY STRIP ═══════════════════════════════════ */}
        {!loading && products.length > 0 && (
          <div style={{ display:"grid",
            gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3,1fr)",
            gap:"0.75rem" }}>
            {[
              { label:"Active Listings", value:activeCount,
                Icon:IconActivity,  color:"#10b981", bg:"#ecfdf5" },
              { label:"Total Stock",     value:totalStock,
                Icon:IconWarehouse, color:"#6366f1", bg:"#eff6ff" },
              { label:"Low Stock Items", value:lowStock,
                Icon:IconAlertTriangle, color:"#f59e0b", bg:"#fffbeb" },
            ].map(({ label, value, Icon, color, bg }) => (
              <div key={label} style={{ background:"white",
                borderRadius:"14px", padding:"0.875rem 1rem",
                border:"1px solid #f3f4f6",
                display:"flex", alignItems:"center", gap:"0.75rem" }}>
                <div style={{ width:38, height:38, borderRadius:"10px",
                  background:bg, display:"flex", alignItems:"center",
                  justifyContent:"center", color, flexShrink:0 }}>
                  <Icon size={18} />
                </div>
                <div>
                  <p style={{ fontWeight:800, color,
                    margin:0, fontSize:"1.15rem", lineHeight:1 }}>
                    {value.toLocaleString()}
                  </p>
                  <p style={{ color:"#9ca3af", fontSize:"0.72rem",
                    margin:"0.2rem 0 0", lineHeight:1 }}>
                    {label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══ SEARCH + FILTERS ════════════════════════════════ */}
        <div style={{ display:"flex", flexDirection:"column", gap:"0.6rem" }}>

          {/* Search */}
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:"0.9rem",
              top:"50%", transform:"translateY(-50%)",
              color:"#9ca3af", pointerEvents:"none",
              display:"flex" }}>
              <IconSearch size={16} />
            </span>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search by name or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search products"
              style={{
                width:"100%", padding:"0.75rem 2.5rem 0.75rem 2.4rem",
                border:"1.5px solid #e5e7eb", borderRadius:"12px",
                fontSize:"0.875rem", background:"white",
                color:"#374151", boxSizing:"border-box",
                fontFamily:"inherit", outline:"none",
                transition:"border-color 0.15s",
              }}
            />
            {search && (
              <button
                onClick={() => { setSearch(""); searchRef.current?.focus(); }}
                aria-label="Clear search"
                style={{ position:"absolute", right:"0.8rem",
                  top:"50%", transform:"translateY(-50%)",
                  background:"#f3f4f6", border:"none", cursor:"pointer",
                  color:"#6b7280", width:22, height:22,
                  borderRadius:"50%", display:"flex",
                  alignItems:"center", justifyContent:"center" }}>
                <IconX size={11} />
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}
            role="group" aria-label="Filter by status">
            {FILTERS.map(({ key, label }) => {
              const active = filter === key;
              return (
                <button key={key}
                  className="sp-filter-pill"
                  onClick={() => setFilter(key)}
                  aria-pressed={active}
                  style={{
                    border:      `1.5px solid ${active ? "#6366f1" : "#e5e7eb"}`,
                    fontWeight:  active ? 700 : 500,
                    background:  active ? "#6366f1" : "white",
                    color:       active ? "white"   : "#6b7280",
                  }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ══ PRODUCT GRID / LIST ════════════════════════════ */}

        {/* Loading */}
        {loading ? (
          viewMode === "grid" || mobile ? (
            <div style={{ display:"grid", gap:"1rem",
              gridTemplateColumns: mobile
                ? "repeat(2,1fr)"
                : tablet ? "repeat(3,1fr)" : "repeat(4,1fr)" }}>
              {Array.from({ length:8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div style={{ background:"white", borderRadius:"16px",
              border:"1px solid #f3f4f6", overflow:"hidden" }}>
              {Array.from({ length:6 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          )

        /* Empty */
        ) : products.length === 0 ? (
          <div style={{ background:"white", borderRadius:"20px",
            border:"1px solid #f3f4f6",
            padding: mobile ? "3rem 1.5rem" : "5rem 2rem",
            textAlign:"center", display:"flex",
            flexDirection:"column", alignItems:"center", gap:"0.75rem" }}>
            <span style={{ color:"#d1d5db" }}>
              <IconPackage size={56} />
            </span>
            <h3 style={{ fontWeight:700, color:"#374151",
              margin:0, fontSize:"1.1rem" }}>
              {search || filter ? "No products found" : "No listings yet"}
            </h3>
            <p style={{ color:"#9ca3af", fontSize:"0.875rem",
              margin:0, maxWidth:280, lineHeight:1.5 }}>
              {search || filter
                ? "Try a different search term or clear the filter"
                : "Post your first product to start selling"}
            </p>
            {!search && !filter ? (
              <button
                onClick={() => navigate("/minimart/post-ad")}
                style={{ marginTop:"0.5rem", padding:"0.75rem 1.5rem",
                  background:"linear-gradient(135deg,#ff5722,#ff8a00)",
                  color:"white", border:"none", borderRadius:"12px",
                  fontWeight:700, cursor:"pointer", fontSize:"0.9rem",
                  fontFamily:"inherit",
                  boxShadow:"0 2px 8px rgba(255,87,34,0.3)",
                  display:"flex", alignItems:"center", gap:"0.4rem" }}>
                <IconPlus size={15} />
                Post Your First Product
              </button>
            ) : (
              <button
                onClick={() => { setSearch(""); setFilter(""); }}
                style={{ marginTop:"0.5rem", padding:"0.6rem 1.25rem",
                  background:"white", color:"#6366f1",
                  border:"1.5px solid #6366f1", borderRadius:"10px",
                  fontWeight:600, cursor:"pointer", fontSize:"0.875rem",
                  fontFamily:"inherit" }}>
                Clear filters
              </button>
            )}
          </div>

        /* Grid */
        ) : viewMode === "grid" || mobile ? (
          <div style={{ display:"grid", gap:"1rem",
            gridTemplateColumns: mobile
              ? "repeat(2,1fr)"
              : tablet ? "repeat(3,1fr)" : "repeat(4,1fr)" }}>
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                mobile={mobile}
                onEdit={handleEdit}
                onDelete={setDeleteTarget}
                onPause={setPauseTarget}
              />
            ))}
          </div>

        /* List */
        ) : (
          <div style={{ background:"white", borderRadius:"16px",
            border:"1px solid #f3f4f6", overflow:"hidden" }}>
            {/* Table header */}
            <div style={{ display:"grid",
              gridTemplateColumns:"2.5fr 1fr 1fr 1fr auto",
              gap:"0.5rem", padding:"0.75rem 1.25rem",
              background:"#f9fafb",
              borderBottom:"1px solid #f3f4f6" }}>
              {["Product","Price","Stock","Status","Actions"].map((h) => (
                <span key={h} style={{ fontSize:"0.72rem", fontWeight:700,
                  color:"#9ca3af", textTransform:"uppercase",
                  letterSpacing:"0.05em" }}>
                  {h}
                </span>
              ))}
            </div>

            {products.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                onEdit={handleEdit}
                onDelete={setDeleteTarget}
                onPause={setPauseTarget}
              />
            ))}
          </div>
        )}

        {/* ══ PAGINATION ══════════════════════════════════════ */}
        {(pagination?.totalPages ?? pagination?.total_pages) > 1 && (
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"center", flexWrap:"wrap", gap:"0.75rem",
            background:"white", borderRadius:"14px",
            padding:"0.875rem 1.25rem",
            border:"1px solid #f3f4f6" }}>

            <p style={{ fontSize:"0.78rem", color:"#9ca3af", margin:0 }}>
              Page {pagination.page} of{" "}
              {pagination.totalPages ?? pagination.total_pages} ·{" "}
              {pagination.total} products
            </p>

            <div style={{ display:"flex", gap:"0.35rem", flexWrap:"wrap" }}>
              <button
                className="sp-page-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={paginationBtnStyle(false, page === 1)}>
                ← Prev
              </button>

              {buildPageNumbers(
                page,
                pagination.totalPages ?? pagination.total_pages
              ).map((p2) => (
                <button key={p2} onClick={() => setPage(p2)}
                  style={paginationBtnStyle(page === p2, false)}>
                  {p2}
                </button>
              ))}

              <button
                className="sp-page-btn"
                onClick={() => setPage((p) =>
                  Math.min(pagination.totalPages ?? pagination.total_pages, p + 1))}
                disabled={page === (pagination.totalPages ?? pagination.total_pages)}
                style={paginationBtnStyle(false,
                  page === (pagination.totalPages ?? pagination.total_pages))}>
                Next →
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ══ MODALS ══════════════════════════════════════════ */}
      {deleteTarget && (
        <DeleteModal
          product={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); load(); }}
        />
      )}
      {pauseTarget && (
        <PauseModal
          product={pauseTarget}
          onClose={() => setPauseTarget(null)}
          onToggled={() => { setPauseTarget(null); load(); }}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   UTILS
══════════════════════════════════════════════════════════════ */
function buildPageNumbers(current, total) {
  const pages = [];
  const max   = Math.min(total, 5);
  let   start;

  if (total <= 5)          start = 1;
  else if (current <= 3)   start = 1;
  else if (current >= total - 2) start = total - 4;
  else start = current - 2;

  for (let i = 0; i < max; i++) pages.push(start + i);
  return pages;
}

function paginationBtnStyle(active, disabled) {
  return {
    padding:"0.4rem 0", minWidth:36,
    border:`1px solid ${active ? "#6366f1" : "#e5e7eb"}`,
    borderRadius:"8px", cursor: disabled ? "default" : "pointer",
    fontSize:"0.78rem",
    fontWeight: active ? 700 : 500,
    background:  active   ? "#6366f1" : "white",
    color:       active   ? "white"   : "#374151",
    opacity:     disabled ? 0.4       : 1,
    transition:  "all 0.15s",
    fontFamily:  "inherit",
  };
}

/* ══════════════════════════════════════════════════════════════
   MODAL STYLES
══════════════════════════════════════════════════════════════ */
const MS = {
  overlay: {
    position:"fixed", inset:0,
    background:"rgba(0,0,0,0.45)",
    display:"flex", alignItems:"center", justifyContent:"center",
    zIndex:1000, padding:"1rem",
    backdropFilter:"blur(4px)",
  },
  modal: {
    background:"white", borderRadius:"20px",
    width:"100%", maxWidth:420,
    maxHeight:"92vh", overflowY:"auto",
    boxShadow:"0 24px 64px rgba(0,0,0,0.18)",
  },
  cancelBtn: {
    flex:1, padding:"0.8rem",
    background:"white", border:"1px solid #e5e7eb",
    borderRadius:"12px", fontWeight:600,
    cursor:"pointer", color:"#374151",
    fontSize:"0.9rem", fontFamily:"inherit",
  },
  primaryBtn: {
    flex:2, padding:"0.8rem",
    background:"linear-gradient(135deg,#6366f1,#8b5cf6)",
    color:"white", border:"none",
    borderRadius:"12px", fontWeight:700,
    cursor:"pointer", fontSize:"0.9rem",
    fontFamily:"inherit", transition:"opacity 0.15s",
  },
  dangerBtn: {
    flex:1, padding:"0.8rem",
    background:"#ef4444", color:"white",
    border:"none", borderRadius:"12px",
    fontWeight:700, cursor:"pointer",
    fontSize:"0.9rem", fontFamily:"inherit",
  },
};