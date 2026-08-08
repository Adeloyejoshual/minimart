/**
 * pages/seller/Products.jsx
 *
 * Seller product management page.
 * - Grid / list view toggle
 * - Search + filter by status
 * - Pagination
 * - Edit  → redirects to PostAds update flow
 * - Delete modal (soft delete)
 * - Pause / resume toggle modal
 * - Aligned with /api/seller/products routes
 */

import {
  useState, useEffect, useCallback,
  useRef, useMemo, memo,
} from "react";
import { useNavigate }             from "react-router-dom";
import { sellerApi, useDashboard } from "./SellerDashboard";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const PAGE_SIZE           = 12;
const LOW_STOCK_THRESHOLD = 5;

const STATUS_FILTERS = [
  { key: "",         label: "All"      },
  { key: "pending",  label: "Pending"  },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "paused",   label: "Paused"   },
];

const STATUS_CONFIG = {
  pending  : { bg: "#fffbeb", color: "#92400e", dot: "#f59e0b", label: "Pending"  },
  approved : { bg: "#ecfdf5", color: "#065f46", dot: "#10b981", label: "Approved" },
  active   : { bg: "#ecfdf5", color: "#065f46", dot: "#10b981", label: "Active"   },
  rejected : { bg: "#fef2f2", color: "#991b1b", dot: "#ef4444", label: "Rejected" },
  paused   : { bg: "#f3f4f6", color: "#6b7280", dot: "#9ca3af", label: "Paused"   },
  archived : { bg: "#f3f4f6", color: "#6b7280", dot: "#9ca3af", label: "Archived" },
};

/*
 * Server mounts seller routes at:
 *   app.use("/api/seller", sellerProfileRouter)
 *   app.use("/api/seller/payout", sellerPayoutRoutes)
 *   app.use("/api/seller/settings", sellerSettingsRouter)
 *
 * Our new product router must be mounted at /api/seller as well
 * so all product paths resolve under /api/seller/products/...
 *
 * In server.js add:
 *   import sellerProductRouter from "./routes/seller/product.js";
 *   app.use("/api/seller", sellerProductRouter);
 *
 * Every sellerApi call below already uses the correct full path.
 */
const PRODUCTS_BASE = "/api/seller/products";

/* ══════════════════════════════════════════════════════════════
   PURE HELPERS
══════════════════════════════════════════════════════════════ */
const fmt = (v) =>
  `₦${Number(v ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function getCoverImage(p) {
  if (Array.isArray(p.images) && p.images.length) {
    const primary = p.images.find((img) => img.is_primary) ?? p.images[0];
    return primary?.url ?? primary?.image_url ?? null;
  }
  return p.image_url ?? null;
}

function getTotalStock(p) {
  if (Array.isArray(p.variants) && p.variants.length) {
    return p.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
  }
  return Number(p.stock ?? p.quantity ?? 0);
}

function getStatusCfg(p) {
  if (p.is_paused) return STATUS_CONFIG.paused;
  return (
    STATUS_CONFIG[p.status] ?? {
      bg: "#f3f4f6", color: "#6b7280",
      dot: "#9ca3af", label: p.status ?? "—",
    }
  );
}

function buildPageNumbers(current, total) {
  const max = Math.min(total, 5);
  let start;
  if      (total <= 5)           start = 1;
  else if (current <= 3)         start = 1;
  else if (current >= total - 2) start = total - 4;
  else                           start = current - 2;
  return Array.from({ length: max }, (_, i) => start + i);
}

/* ══════════════════════════════════════════════════════════════
   SVG ICONS
══════════════════════════════════════════════════════════════ */
const Icon = {
  Refresh: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  Grid: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <rect x="3"  y="3"  width="7" height="7" />
      <rect x="14" y="3"  width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3"  y="14" width="7" height="7" />
    </svg>
  ),
  List: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <line x1="8"  y1="6"  x2="21" y2="6"  />
      <line x1="8"  y1="12" x2="21" y2="12" />
      <line x1="8"  y1="18" x2="21" y2="18" />
      <line x1="3"  y1="6"  x2="3.01" y2="6"  />
      <line x1="3"  y1="12" x2="3.01" y2="12" />
      <line x1="3"  y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  Plus: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      aria-hidden="true">
      <line x1="12" y1="5"  x2="12" y2="19" />
      <line x1="5"  y1="12" x2="19" y2="12" />
    </svg>
  ),
  Edit: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Trash: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  ),
  Pause: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <rect x="6"  y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  ),
  Play: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  Search: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  X: ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      aria-hidden="true">
      <line x1="18" y1="6"  x2="6"  y2="18" />
      <line x1="6"  y1="6"  x2="18" y2="18" />
    </svg>
  ),
  Package: ({ size = 32 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <line x1="16.5" y1="9.4"  x2="7.5"  y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  Alert: ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9"  x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Tag: ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  Activity: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Warehouse: ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35z" />
      <path d="M6 18h12M6 14h12M6 10h12" />
    </svg>
  ),
};

/* ══════════════════════════════════════════════════════════════
   SPINNER
══════════════════════════════════════════════════════════════ */
function Spin({ size = 20, color = "#6366f1" }) {
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
}

/* ══════════════════════════════════════════════════════════════
   SKELETON LOADERS
══════════════════════════════════════════════════════════════ */
const shimmerStyle = {
  background: "linear-gradient(90deg,#f3f4f6 25%,#e9eaf0 50%,#f3f4f6 75%)",
  backgroundSize: "400px 100%",
  animation: "sp-shimmer 1.4s infinite",
};

function SkeletonCard() {
  return (
    <div style={{
      background: "white", borderRadius: "16px",
      border: "1px solid #f3f4f6", overflow: "hidden",
    }}>
      <div style={{ height: 155, ...shimmerStyle }} />
      <div style={{
        padding: "0.9rem", display: "flex",
        flexDirection: "column", gap: "0.5rem",
      }}>
        {[75, 50, 90].map((w, i) => (
          <div key={i} style={{
            height: 11, width: `${w}%`,
            borderRadius: "100px", ...shimmerStyle,
          }} />
        ))}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.875rem",
      padding: "0.875rem 1.25rem",
      borderBottom: "1px solid #f3f4f6",
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 10,
        flexShrink: 0, ...shimmerStyle,
      }} />
      <div style={{
        flex: 1, display: "flex",
        flexDirection: "column", gap: "0.4rem",
      }}>
        {[60, 40].map((w, i) => (
          <div key={i} style={{
            height: 11, width: `${w}%`,
            borderRadius: "100px", ...shimmerStyle,
          }} />
        ))}
      </div>
      <div style={{ width: 70, height: 22,
        borderRadius: 8, ...shimmerStyle }} />
    </div>
  );
}

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
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        background: cfg.dot, flexShrink: 0,
      }} />
      {cfg.label}
    </span>
  );
});

/* ══════════════════════════════════════════════════════════════
   STOCK BADGE
══════════════════════════════════════════════════════════════ */
const StockBadge = memo(function StockBadge({ stock }) {
  const n = Number(stock ?? 0);
  const cfg =
    n <= 0  ? { bg: "#fef2f2", color: "#991b1b", dot: "#ef4444", text: "Out of stock"    } :
    n <= 5  ? { bg: "#fffbeb", color: "#92400e", dot: "#f59e0b", text: `Low — ${n} left` } :
    n <= 20 ? { bg: "#fff7ed", color: "#c2410c", dot: "#f97316", text: `${n} in stock`   } :
              { bg: "#ecfdf5", color: "#065f46", dot: "#10b981", text: `${n} in stock`   };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "0.3rem",
      padding: "0.22rem 0.6rem", borderRadius: "100px",
      fontSize: "0.68rem", fontWeight: 700,
      background: cfg.bg, color: cfg.color,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%",
        background: cfg.dot, flexShrink: 0,
      }} />
      {cfg.text}
    </span>
  );
});

/* ══════════════════════════════════════════════════════════════
   PRODUCT IMAGE
   Shared between card and row — handles fallback gracefully.
══════════════════════════════════════════════════════════════ */
function ProductImage({ src, alt, width, height, borderRadius = 0 }) {
  const [err, setErr] = useState(false);

  /* Reset error state when src changes (e.g. after edit) */
  useEffect(() => { setErr(false); }, [src]);

  return (
    <div style={{
      width, height, borderRadius,
      background: "#f8fafc", flexShrink: 0, overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {src && !err ? (
        <img
          src={src}
          alt={alt}
          style={{
            width: "100%", height: "100%",
            objectFit: "cover", display: "block",
          }}
          onError={() => setErr(true)}
        />
      ) : (
        <span style={{ color: "#d1d5db" }}>
          <Icon.Package
            size={Math.floor(
              Math.min(
                typeof width  === "number" ? width  : 48,
                typeof height === "number" ? height : 48
              ) * 0.45
            )}
          />
        </span>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ACTION BUTTONS  (shared between card and row)
══════════════════════════════════════════════════════════════ */
function ActionButtons({ product, onEdit, onDelete, onPause, compact = false }) {
  return (
    <div style={{ display: "flex", gap: "0.4rem" }}>
      <button
        onClick={() => onEdit(product)}
        className="sp-btn sp-btn--blue"
        style={compact ? {} : { flex: 1 }}
        aria-label={`Edit ${product.name}`}>
        <Icon.Edit size={13} />
        <span>Edit</span>
      </button>

      {product.status === "approved" && (
        <button
          onClick={() => onPause(product)}
          className="sp-btn sp-btn--amber"
          aria-label={
            product.is_paused
              ? `Resume ${product.name}`
              : `Pause ${product.name}`
          }>
          {product.is_paused
            ? <Icon.Play  size={13} />
            : <Icon.Pause size={13} />}
        </button>
      )}

      <button
        onClick={() => onDelete(product)}
        className="sp-btn sp-btn--red"
        aria-label={`Delete ${product.name}`}>
        <Icon.Trash size={13} />
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PRODUCT CARD  (grid view)
══════════════════════════════════════════════════════════════ */
const ProductCard = memo(function ProductCard({
  product: p, mobile, onEdit, onDelete, onPause,
}) {
  const cover      = useMemo(() => getCoverImage(p),   [p]);
  const totalStock = useMemo(() => getTotalStock(p),   [p]);
  const imgH       = mobile ? 130 : 155;

  return (
    <article className="sp-card">
      {/* Image area */}
      <div style={{ height: imgH, position: "relative", overflow: "hidden" }}>
        <ProductImage
          src={cover}
          alt={p.name}
          width="100%"
          height={imgH}
        />

        {/* Status chip overlay */}
        <div style={{ position: "absolute", top: 8, left: 8 }}>
          <StatusChip product={p} />
        </div>

        {/* Paused dim overlay — aria-hidden: StatusChip already conveys state */}
        {p.is_paused && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute", inset: 0,
              background: "rgba(0,0,0,0.35)",
              display: "flex", alignItems: "center",
              justifyContent: "center",
            }}>
            <span style={{
              color: "white", fontSize: "0.72rem", fontWeight: 800,
              background: "rgba(0,0,0,0.5)",
              padding: "0.25rem 0.6rem", borderRadius: "6px",
            }}>
              PAUSED
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{
        padding: mobile ? "0.7rem" : "0.875rem",
        display: "flex", flexDirection: "column", gap: "0.35rem",
      }}>
        <p
          title={p.name}
          style={{
            fontWeight: 700, color: "#1f2937", margin: 0,
            fontSize: mobile ? "0.8rem" : "0.875rem",
            overflow: "hidden", textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
          {p.name}
        </p>

        {p.category && (
          <p style={{ color: "#9ca3af", fontSize: "0.68rem", margin: 0 }}>
            {p.category}
          </p>
        )}

        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", flexWrap: "wrap",
          gap: "0.25rem", marginTop: "0.15rem",
        }}>
          <span style={{
            fontWeight: 800, color: "#1f2937",
            fontSize: mobile ? "0.95rem" : "1rem",
          }}>
            {fmt(p.price)}
          </span>
          <StockBadge stock={totalStock} />
        </div>

        {Array.isArray(p.variants) && p.variants.length > 1 && (
          <p style={{ color: "#9ca3af", fontSize: "0.65rem", margin: 0 }}>
            {p.variants.length} variants
          </p>
        )}

        <div style={{ marginTop: "0.5rem" }}>
          <ActionButtons
            product={p}
            onEdit={onEdit}
            onDelete={onDelete}
            onPause={onPause}
          />
        </div>
      </div>
    </article>
  );
});

/* ══════════════════════════════════════════════════════════════
   PRODUCT ROW  (list view)
══════════════════════════════════════════════════════════════ */
const ProductRow = memo(function ProductRow({
  product: p, onEdit, onDelete, onPause,
}) {
  const cover      = useMemo(() => getCoverImage(p), [p]);
  const totalStock = useMemo(() => getTotalStock(p), [p]);

  return (
    <div
      className="sp-row"
      style={{
        display: "grid",
        gridTemplateColumns: "2.5fr 1fr 1fr 1fr auto",
        gap: "0.5rem", alignItems: "center",
        padding: "0.875rem 1.25rem",
      }}>

      {/* Product info */}
      <div style={{
        display: "flex", alignItems: "center",
        gap: "0.75rem", minWidth: 0,
      }}>
        <ProductImage
          src={cover}
          alt={p.name}
          width={48}
          height={48}
          borderRadius={10}
        />
        <div style={{ minWidth: 0 }}>
          <p style={{
            fontWeight: 600, color: "#1f2937", margin: 0,
            fontSize: "0.875rem", overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {p.name}
          </p>
          {p.category && (
            <p style={{
              color: "#9ca3af", fontSize: "0.7rem",
              margin: "0.1rem 0 0",
            }}>
              {p.category}
            </p>
          )}
          {Array.isArray(p.variants) && p.variants.length > 1 && (
            <p style={{
              color: "#c4b5fd", fontSize: "0.65rem",
              margin: "0.1rem 0 0",
            }}>
              {p.variants.length} variants
            </p>
          )}
        </div>
      </div>

      {/* Price */}
      <span style={{ fontWeight: 700, color: "#1f2937", fontSize: "0.9rem" }}>
        {fmt(p.price)}
      </span>

      {/* Stock */}
      <StockBadge stock={totalStock} />

      {/* Status */}
      <StatusChip product={p} />

      {/* Actions */}
      <ActionButtons
        product={p}
        onEdit={onEdit}
        onDelete={onDelete}
        onPause={onPause}
        compact
      />
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   MODAL SHELL
   Reusable wrapper: backdrop + centred card + focus + Escape.
══════════════════════════════════════════════════════════════ */
function Modal({ onClose, label, children }) {
  const ref = useRef();

  useEffect(() => {
    /* Trap focus on mount */
    ref.current?.focus();

    /* Close on Escape */
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      style={MS.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label}>
      <div
        ref={ref}
        tabIndex={-1}
        style={MS.modal}
        onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ERROR BANNER
══════════════════════════════════════════════════════════════ */
function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div style={{
      background: "#fef2f2", border: "1px solid #fecaca",
      borderRadius: "10px", padding: "0.75rem 1rem",
      color: "#991b1b", fontSize: "0.85rem",
      display: "flex", alignItems: "center", gap: "0.5rem",
    }}>
      <Icon.Alert size={15} />
      {message}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DELETE MODAL
══════════════════════════════════════════════════════════════ */
function DeleteModal({ product, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const { data } = await sellerApi.delete(
        `${PRODUCTS_BASE}/${product.id}`
      );
      if (data.success) {
        onDeleted();
      } else {
        setError(data.message ?? "Delete failed");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ?? "Delete failed. Please try again."
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal onClose={onClose} label="Delete product">
      <div style={MS.body}>
        <div style={{ ...MS.iconWrap, background: "#fef2f2" }}>
          <Icon.Trash size={24} />
        </div>

        <div style={{ textAlign: "center" }}>
          <h3 style={MS.title}>Delete Listing?</h3>
          <p style={MS.subtitle}>
            <strong>"{product.name}"</strong> will be permanently removed
            and cannot be recovered.
          </p>
        </div>

        <ErrorBanner message={error} />

        <div style={MS.actions}>
          <button
            onClick={onClose}
            style={MS.cancelBtn}
            disabled={deleting}>
            Keep It
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{ ...MS.dangerBtn, opacity: deleting ? 0.7 : 1 }}>
            {deleting ? (
              <span style={MS.btnInner}>
                <Spin size={15} color="white" /> Deleting…
              </span>
            ) : "Yes, Delete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAUSE MODAL
══════════════════════════════════════════════════════════════ */
function PauseModal({ product, onClose, onToggled }) {
  const isPaused          = product.is_paused;
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const handleToggle = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await sellerApi.patch(
        `${PRODUCTS_BASE}/${product.id}/pause`
      );
      if (data.success) {
        onToggled();
      } else {
        setError(data.message ?? "Failed. Please try again.");
      }
    } catch (err) {
      setError(
        err.response?.data?.message ?? "Failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      label={isPaused ? "Resume listing" : "Pause listing"}>
      <div style={MS.body}>
        <div style={{
          ...MS.iconWrap,
          background: isPaused ? "#ecfdf5" : "#fffbeb",
        }}>
          {isPaused
            ? <Icon.Play  size={22} />
            : <Icon.Pause size={22} />}
        </div>

        <div style={{ textAlign: "center" }}>
          <h3 style={MS.title}>
            {isPaused ? "Resume Listing?" : "Pause Listing?"}
          </h3>
          <p style={MS.subtitle}>
            {isPaused
              ? "Buyers will be able to see and purchase this listing again."
              : "This listing will be hidden from buyers until you resume it."}
          </p>
        </div>

        <ErrorBanner message={error} />

        <div style={MS.actions}>
          <button
            onClick={onClose}
            style={MS.cancelBtn}
            disabled={loading}>
            Cancel
          </button>
          <button
            onClick={handleToggle}
            disabled={loading}
            style={{
              ...MS.primaryBtn,
              opacity: loading ? 0.7 : 1,
              background: isPaused
                ? "linear-gradient(135deg,#10b981,#059669)"
                : "linear-gradient(135deg,#f59e0b,#d97706)",
            }}>
            {loading ? (
              <span style={MS.btnInner}>
                <Spin size={15} color="white" />
                {isPaused ? "Resuming…" : "Pausing…"}
              </span>
            ) : isPaused ? "Resume Listing" : "Pause Listing"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════
   SUMMARY STRIP
══════════════════════════════════════════════════════════════ */
function SummaryStrip({ products, mobile }) {
  const stats = useMemo(() => ({
    active: products.filter(
      (p) =>
        (p.status === "approved" || p.status === "active") && !p.is_paused
    ).length,
    stock: products.reduce((s, p) => s + getTotalStock(p), 0),
    low:   products.filter(
      (p) => getTotalStock(p) <= LOW_STOCK_THRESHOLD
    ).length,
  }), [products]);

  const items = [
    {
      label: "Active Listings", value: stats.active,
      I: Icon.Activity,  color: "#10b981", bg: "#ecfdf5",
    },
    {
      label: "Total Stock",     value: stats.stock,
      I: Icon.Warehouse, color: "#6366f1", bg: "#eff6ff",
    },
    {
      label: "Low Stock Items", value: stats.low,
      I: Icon.Alert,     color: "#f59e0b", bg: "#fffbeb",
    },
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3,1fr)",
      gap: "0.75rem",
    }}>
      {items.map(({ label, value, I, color, bg }) => (
        <div key={label} style={{
          background: "white", borderRadius: "14px",
          padding: "0.875rem 1rem", border: "1px solid #f3f4f6",
          display: "flex", alignItems: "center", gap: "0.75rem",
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: "10px",
            background: bg, color, flexShrink: 0,
            display: "flex", alignItems: "center",
            justifyContent: "center",
          }}>
            <I size={18} />
          </div>
          <div>
            <p style={{
              fontWeight: 800, color, margin: 0,
              fontSize: "1.15rem", lineHeight: 1,
            }}>
              {value.toLocaleString()}
            </p>
            <p style={{
              color: "#9ca3af", fontSize: "0.72rem",
              margin: "0.2rem 0 0", lineHeight: 1,
            }}>
              {label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGINATION BAR
══════════════════════════════════════════════════════════════ */
function PaginationBar({ pagination, page, onPage }) {
  const totalPages = pagination?.totalPages ?? 0;
  if (totalPages <= 1) return null;

  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      alignItems: "center", flexWrap: "wrap", gap: "0.75rem",
      background: "white", borderRadius: "14px",
      padding: "0.875rem 1.25rem",
      border: "1px solid #f3f4f6",
    }}>
      <p style={{ fontSize: "0.78rem", color: "#9ca3af", margin: 0 }}>
        Page {pagination.page} of {totalPages} · {pagination.total} products
      </p>

      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
        <button
          className="sp-page-btn"
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          style={pageBtnStyle(false, page === 1)}>
          ← Prev
        </button>

        {buildPageNumbers(page, totalPages).map((n) => (
          <button
            key={n}
            className="sp-page-btn"
            onClick={() => onPage(n)}
            style={pageBtnStyle(page === n, false)}>
            {n}
          </button>
        ))}

        <button
          className="sp-page-btn"
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          style={pageBtnStyle(false, page === totalPages)}>
          Next →
        </button>
      </div>
    </div>
  );
}

function pageBtnStyle(active, disabled) {
  return {
    padding: "0.4rem 0", minWidth: 36,
    border: `1px solid ${active ? "#6366f1" : "#e5e7eb"}`,
    borderRadius: "8px",
    cursor: disabled ? "default" : "pointer",
    fontSize: "0.78rem",
    fontWeight: active ? 700 : 500,
    background: active   ? "#6366f1" : "white",
    color:      active   ? "white"   : "#374151",
    opacity:    disabled ? 0.4       : 1,
    transition: "all 0.15s",
    fontFamily: "inherit",
  };
}

/* ══════════════════════════════════════════════════════════════
   EMPTY STATE
══════════════════════════════════════════════════════════════ */
function EmptyState({ hasFilters, onClear, onPost, mobile }) {
  return (
    <div style={{
      background: "white", borderRadius: "20px",
      border: "1px solid #f3f4f6",
      padding: mobile ? "3rem 1.5rem" : "5rem 2rem",
      textAlign: "center", display: "flex",
      flexDirection: "column", alignItems: "center", gap: "0.75rem",
    }}>
      <span style={{ color: "#d1d5db" }}>
        <Icon.Package size={56} />
      </span>
      <h3 style={{
        fontWeight: 700, color: "#374151",
        margin: 0, fontSize: "1.1rem",
      }}>
        {hasFilters ? "No products found" : "No listings yet"}
      </h3>
      <p style={{
        color: "#9ca3af", fontSize: "0.875rem",
        margin: 0, maxWidth: 280, lineHeight: 1.5,
      }}>
        {hasFilters
          ? "Try a different search term or clear the filter."
          : "Post your first product to start selling."}
      </p>
      {hasFilters ? (
        <button onClick={onClear} style={GHOST_BTN}>
          Clear filters
        </button>
      ) : (
        <button onClick={onPost} style={POST_BTN}>
          <Icon.Plus size={15} />
          Post Your First Product
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function Products() {
  const navigate = useNavigate();

  /* ── State ── */
  const [products,     setProducts]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [searchInput,  setSearchInput]  = useState("");
  const [search,       setSearch]       = useState("");
  const [filter,       setFilter]       = useState("");
  const [page,         setPage]         = useState(1);
  const [pagination,   setPagination]   = useState(null);
  const [viewMode,     setViewMode]     = useState("grid");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pauseTarget,  setPauseTarget]  = useState(null);
  const [screenW,      setScreenW]      = useState(window.innerWidth);

  const searchRef = useRef();
  const abortRef  = useRef(null);

  /* ── Responsive ── */
  useEffect(() => {
    const fn = () => setScreenW(window.innerWidth);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const mobile = screenW < 640;
  const tablet = screenW < 1024;

  /* ── Debounce search input → committed search ── */
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  /* ── Co-locate filter + page reset ── */
  const handleFilterChange = useCallback((key) => {
    setFilter(key);
    setPage(1);
  }, []);

  /* ── Fetch ── */
  const load = useCallback(async (silent = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!silent) setLoading(true);

    try {
      const { data } = await sellerApi.get(PRODUCTS_BASE, {
        params: {
          page,
          limit: PAGE_SIZE,
          ...(filter && { status: filter }),
          ...(search && { search }),
        },
        signal: controller.signal,
      });

      if (data.success) {
        setProducts(data.data?.products     ?? []);
        setPagination(data.data?.pagination ?? null);
      }
    } catch (err) {
      /* Ignore aborted requests */
      if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
      console.error("[Products] fetch error:", err.message);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [page, filter, search]);

  useEffect(() => { load(); }, [load]);

  /* ── Manual refresh ── */
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  /* ── Edit — redirect to update flow ── */
  const handleEdit = useCallback((p) => {
    navigate(`/minimart/edit-ad/${p.id}`);
  }, [navigate]);

  /*
   * ── After any mutation (delete / pause / resume) ──
   * Closes both modals and silently reloads the list.
   * Single callback avoids the double-fire bug from the
   * previous implementation.
   */
  const handleMutated = useCallback(() => {
    setDeleteTarget(null);
    setPauseTarget(null);
    load(true);
  }, [load]);

  const hasFilters = Boolean(search || filter);

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <>
      {/* ── Global keyframes + utility classes ── */}
      <style>{`
        @keyframes sp-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes sp-shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        @keyframes sp-fadeup {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }

        .sp-card {
          background: white; border-radius: 16px;
          border: 1px solid #f3f4f6; overflow: hidden;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
          transition: box-shadow 0.2s, transform 0.2s;
          animation: sp-fadeup 0.22s ease;
        }
        .sp-card:hover {
          box-shadow: 0 8px 24px rgba(99,102,241,0.1);
          transform: translateY(-2px);
        }

        .sp-row {
          border-bottom: 1px solid #f9fafb;
          background: white;
          transition: background 0.15s;
          animation: sp-fadeup 0.2s ease;
        }
        .sp-row:last-child { border-bottom: none; }
        .sp-row:hover      { background: #fafafa; }

        .sp-btn {
          display: inline-flex; align-items: center;
          justify-content: center; gap: 0.3rem;
          padding: 0.42rem 0.65rem; border-radius: 8px;
          font-size: 0.75rem; font-weight: 600;
          cursor: pointer; font-family: inherit;
          border: 1px solid transparent;
          transition: opacity 0.15s, transform 0.1s;
        }
        .sp-btn:hover         { opacity: 0.82; }
        .sp-btn:active        { transform: scale(0.96); }
        .sp-btn:disabled      { opacity: 0.5; cursor: default; }
        .sp-btn--blue         { background:#eff6ff; border-color:#bfdbfe; color:#1e40af; }
        .sp-btn--amber        { background:#fffbeb; border-color:#fde68a; color:#92400e; }
        .sp-btn--red          { background:#fef2f2; border-color:#fecaca; color:#ef4444; }

        .sp-pill {
          padding: 0.38rem 0.875rem; border-radius: 100px;
          font-size: 0.78rem; cursor: pointer;
          font-family: inherit; white-space: nowrap;
          transition: all 0.15s;
        }
        .sp-pill:hover {
          border-color: #6366f1 !important;
          color: #6366f1 !important;
        }

        .sp-page-btn:hover:not(:disabled) {
          border-color: #6366f1;
          color: #6366f1;
        }

        input:focus {
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.08);
          outline: none;
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

        {/* ══ HEADER ═══════════════════════════════════════════ */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem",
        }}>
          <div>
            <h2 style={{
              fontWeight: 800, fontSize: "1.35rem",
              color: "#1f2937", margin: 0,
              display: "flex", alignItems: "center", gap: "0.5rem",
            }}>
              <Icon.Tag size={22} />
              My Listings
            </h2>
            <p style={{
              color: "#9ca3af", fontSize: "0.85rem",
              margin: "0.2rem 0 0",
            }}>
              {pagination?.total ?? products.length} products in your store
            </p>
          </div>

          <div style={{
            display: "flex", gap: "0.5rem",
            alignItems: "center", flexWrap: "wrap",
          }}>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              aria-label="Refresh listings"
              style={{
                background: "white", border: "1px solid #e5e7eb",
                borderRadius: "10px", padding: "0.6rem 0.875rem",
                cursor: (refreshing || loading) ? "default" : "pointer",
                color: "#6b7280",
                display: "flex", alignItems: "center", gap: "0.4rem",
                fontSize: "0.8rem", fontWeight: 600,
                fontFamily: "inherit",
                opacity: (refreshing || loading) ? 0.6 : 1,
                transition: "opacity 0.15s",
              }}>
              <span style={{
                display: "inline-block",
                animation: refreshing
                  ? "sp-spin 0.7s linear infinite" : "none",
              }}>
                <Icon.Refresh size={15} />
              </span>
              {!mobile && <span>Refresh</span>}
            </button>

            {/* View toggle — desktop only */}
            {!mobile && (
              <div
                style={{
                  display: "flex", background: "white",
                  border: "1px solid #e5e7eb", borderRadius: "10px",
                  padding: "3px", gap: "2px",
                }}
                role="group"
                aria-label="View mode">
                {[
                  { mode: "grid", I: Icon.Grid },
                  { mode: "list", I: Icon.List },
                ].map(({ mode, I }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    aria-label={`${mode} view`}
                    aria-pressed={viewMode === mode}
                    style={{
                      padding: "0.35rem 0.65rem", borderRadius: "7px",
                      border: "none", cursor: "pointer",
                      background: viewMode === mode ? "#6366f1" : "transparent",
                      color:      viewMode === mode ? "white"   : "#9ca3af",
                      display: "flex", alignItems: "center",
                      transition: "all 0.15s",
                    }}>
                    <I size={15} />
                  </button>
                ))}
              </div>
            )}

            {/* Post new product */}
            <button
              onClick={() => navigate("/minimart/post-ad")}
              style={POST_BTN}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}>
              <Icon.Plus size={15} />
              {mobile ? "Post Ad" : "Post New Product"}
            </button>
          </div>
        </div>

        {/* ══ SUMMARY STRIP ════════════════════════════════════ */}
        {!loading && products.length > 0 && (
          <SummaryStrip products={products} mobile={mobile} />
        )}

        {/* ══ SEARCH + FILTERS ════════════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>

          {/* Search box */}
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute", left: "0.9rem", top: "50%",
              transform: "translateY(-50%)", color: "#9ca3af",
              pointerEvents: "none", display: "flex",
            }}>
              <Icon.Search size={16} />
            </span>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search by name or category…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search products"
              style={{
                width: "100%",
                padding: "0.75rem 2.5rem 0.75rem 2.4rem",
                border: "1.5px solid #e5e7eb", borderRadius: "12px",
                fontSize: "0.875rem", background: "white",
                color: "#374151", boxSizing: "border-box",
                fontFamily: "inherit", outline: "none",
                transition: "border-color 0.15s",
              }}
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput("");
                  searchRef.current?.focus();
                }}
                aria-label="Clear search"
                style={{
                  position: "absolute", right: "0.8rem", top: "50%",
                  transform: "translateY(-50%)",
                  background: "#f3f4f6", border: "none",
                  cursor: "pointer", color: "#6b7280",
                  width: 22, height: 22, borderRadius: "50%",
                  display: "flex", alignItems: "center",
                  justifyContent: "center",
                }}>
                <Icon.X size={11} />
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div
            style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}
            role="radiogroup"
            aria-label="Filter by status">
            {STATUS_FILTERS.map(({ key, label }) => {
              const active = filter === key;
              return (
                <button
                  key={key}
                  className="sp-pill"
                  role="radio"
                  aria-checked={active}
                  onClick={() => handleFilterChange(key)}
                  style={{
                    border:     `1.5px solid ${active ? "#6366f1" : "#e5e7eb"}`,
                    fontWeight: active ? 700 : 500,
                    background: active ? "#6366f1" : "white",
                    color:      active ? "white"   : "#6b7280",
                  }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ══ CONTENT AREA ════════════════════════════════════ */}

        {/* Loading skeletons */}
        {loading ? (
          viewMode === "grid" || mobile ? (
            <div style={{
              display: "grid", gap: "1rem",
              gridTemplateColumns: mobile
                ? "repeat(2,1fr)"
                : tablet ? "repeat(3,1fr)" : "repeat(4,1fr)",
            }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : (
            <div style={{
              background: "white", borderRadius: "16px",
              border: "1px solid #f3f4f6", overflow: "hidden",
            }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          )

        /* Empty state */
        ) : products.length === 0 ? (
          <EmptyState
            hasFilters={hasFilters}
            onClear={() => { setSearchInput(""); setFilter(""); }}
            onPost={() => navigate("/minimart/post-ad")}
            mobile={mobile}
          />

        /* Grid view */
        ) : viewMode === "grid" || mobile ? (
          <div style={{
            display: "grid", gap: "1rem",
            gridTemplateColumns: mobile
              ? "repeat(2,1fr)"
              : tablet ? "repeat(3,1fr)" : "repeat(4,1fr)",
          }}>
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

        /* List view */
        ) : (
          <div style={{
            background: "white", borderRadius: "16px",
            border: "1px solid #f3f4f6", overflow: "hidden",
          }}>
            {/* Column headers */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "2.5fr 1fr 1fr 1fr auto",
              gap: "0.5rem", padding: "0.75rem 1.25rem",
              background: "#f9fafb",
              borderBottom: "1px solid #f3f4f6",
            }}>
              {["Product", "Price", "Stock", "Status", "Actions"].map((h) => (
                <span key={h} style={{
                  fontSize: "0.72rem", fontWeight: 700,
                  color: "#9ca3af", textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}>
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

        {/* ══ PAGINATION ═══════════════════════════════════════ */}
        <PaginationBar
          pagination={pagination}
          page={page}
          onPage={setPage}
        />

      </div>

      {/* ══ MODALS ═══════════════════════════════════════════ */}
      {deleteTarget && (
        <DeleteModal
          product={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleMutated}
        />
      )}
      {pauseTarget && (
        <PauseModal
          product={pauseTarget}
          onClose={() => setPauseTarget(null)}
          onToggled={handleMutated}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   SHARED BUTTON STYLES
══════════════════════════════════════════════════════════════ */
const POST_BTN = {
  padding: "0.68rem 1.25rem",
  background: "linear-gradient(135deg,#ff5722,#ff8a00)",
  color: "white", border: "none", borderRadius: "11px",
  fontWeight: 700, cursor: "pointer", fontSize: "0.875rem",
  whiteSpace: "nowrap", fontFamily: "inherit",
  display: "flex", alignItems: "center", gap: "0.4rem",
  boxShadow: "0 2px 8px rgba(255,87,34,0.3)",
  transition: "opacity 0.15s",
};

const GHOST_BTN = {
  marginTop: "0.5rem", padding: "0.6rem 1.25rem",
  background: "white", color: "#6366f1",
  border: "1.5px solid #6366f1", borderRadius: "10px",
  fontWeight: 600, cursor: "pointer",
  fontSize: "0.875rem", fontFamily: "inherit",
};

/* ══════════════════════════════════════════════════════════════
   MODAL STYLES
══════════════════════════════════════════════════════════════ */
const MS = {
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: "1rem",
    backdropFilter: "blur(4px)",
  },
  modal: {
    background: "white", borderRadius: "20px",
    width: "100%", maxWidth: 380,
    maxHeight: "92vh", overflowY: "auto",
    boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
    outline: "none",
  },
  body: {
    padding: "2rem 1.75rem",
    display: "flex", flexDirection: "column", gap: "1.1rem",
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: "50%",
    display: "flex", alignItems: "center",
    justifyContent: "center", margin: "0 auto",
  },
  title: {
    fontWeight: 800, color: "#1f2937",
    margin: "0 0 0.4rem", fontSize: "1.1rem",
  },
  subtitle: {
    color: "#6b7280", fontSize: "0.875rem",
    margin: 0, lineHeight: 1.6,
  },
  actions: {
    display: "flex", gap: "0.75rem",
  },
  btnInner: {
    display: "flex", alignItems: "center",
    gap: "0.4rem", justifyContent: "center",
  },
  cancelBtn: {
    flex: 1, padding: "0.8rem",
    background: "white", border: "1px solid #e5e7eb",
    borderRadius: "12px", fontWeight: 600,
    cursor: "pointer", color: "#374151",
    fontSize: "0.9rem", fontFamily: "inherit",
  },
  primaryBtn: {
    flex: 2, padding: "0.8rem",
    background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    color: "white", border: "none", borderRadius: "12px",
    fontWeight: 700, cursor: "pointer",
    fontSize: "0.9rem", fontFamily: "inherit",
    transition: "opacity 0.15s",
  },
  dangerBtn: {
    flex: 1, padding: "0.8rem",
    background: "#ef4444", color: "white",
    border: "none", borderRadius: "12px",
    fontWeight: 700, cursor: "pointer",
    fontSize: "0.9rem", fontFamily: "inherit",
  },
};