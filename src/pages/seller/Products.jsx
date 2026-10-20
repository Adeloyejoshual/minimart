/**
 * pages/seller/Products.jsx — v3
 * Professional redesign + scroll performance fixes
 */

import {
  useState, useEffect, useCallback,
  useRef, useMemo, memo,
} from "react";
import { useNavigate } from "react-router-dom";
import { sellerApi }   from "./SellerDashboard";

/* ══════════════════════════════════════════════════════════════
   GLOBAL STYLES (injected once)
══════════════════════════════════════════════════════════════ */
const STYLE_ID = "sp-seller-products-styles";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
    @keyframes sp-spin { to { transform: rotate(360deg); } }
    @keyframes sp-shimmer {
      0%   { background-position: -400px 0; }
      100% { background-position:  400px 0; }
    }

    /* Cards — no transform on hover (prevents scroll jank) */
    .sp-card {
      background: #fff;
      border-radius: 10px;
      border: 1px solid #e5e7eb;
      overflow: hidden;
      transition: border-color 0.15s, box-shadow 0.15s;
      content-visibility: auto;
      contain-intrinsic-size: 280px;
    }
    .sp-card:hover {
      border-color: #d1d5db;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }

    .sp-row {
      border-bottom: 1px solid #f3f4f6;
      background: #fff;
      transition: background 0.1s;
    }
    .sp-row:last-child { border-bottom: none; }
    .sp-row:hover      { background: #fafafa; }

    /* Buttons */
    .sp-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      border: 1px solid #e5e7eb;
      background: #fff;
      color: #374151;
      transition: background 0.1s, border-color 0.1s;
    }
    .sp-btn:hover:not(:disabled) {
      background: #f9fafb;
      border-color: #d1d5db;
    }
    .sp-btn:disabled { opacity: 0.5; cursor: default; }
    .sp-btn--danger:hover:not(:disabled) {
      background: #fef2f2;
      border-color: #fecaca;
      color: #dc2626;
    }
    .sp-btn--warn:hover:not(:disabled) {
      background: #fffbeb;
      border-color: #fde68a;
      color: #b45309;
    }

    /* Pills */
    .sp-pill {
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      white-space: nowrap;
      border: 1px solid #e5e7eb;
      background: #fff;
      color: #6b7280;
      transition: background 0.1s, color 0.1s, border-color 0.1s;
    }
    .sp-pill:hover:not(.sp-pill--active) {
      background: #f9fafb;
      color: #111827;
    }
    .sp-pill--active {
      background: #111827;
      border-color: #111827;
      color: #fff;
    }

    .sp-page-btn {
      padding: 6px 10px;
      min-width: 32px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      background: #fff;
      color: #374151;
      font-size: 12px;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.1s;
    }
    .sp-page-btn:hover:not(:disabled) { background: #f9fafb; }
    .sp-page-btn:disabled { opacity: 0.4; cursor: default; }
    .sp-page-btn--active {
      background: #111827;
      border-color: #111827;
      color: #fff;
    }

    .sp-input:focus {
      border-color: #6b7280 !important;
      outline: none;
    }

    /* Body scroll lock when modal open */
    body.sp-modal-open {
      overflow: hidden;
      /* preserve scrollbar space to prevent layout shift */
      padding-right: var(--sp-scrollbar-w, 0px);
    }
  `;
  document.head.appendChild(el);
}

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const PAGE_SIZE           = 12;
const LOW_STOCK_THRESHOLD = 5;
const PRODUCTS_BASE       = "/api/seller/products";

const STATUS_FILTERS = [
  { key: "",         label: "All"      },
  { key: "pending",  label: "Pending"  },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "paused",   label: "Paused"   },
];

const STATUS_CONFIG = {
  pending  : { bg:"#fef3c7", color:"#92400e", label:"Pending"  },
  approved : { bg:"#d1fae5", color:"#065f46", label:"Approved" },
  active   : { bg:"#d1fae5", color:"#065f46", label:"Active"   },
  rejected : { bg:"#fee2e2", color:"#991b1b", label:"Rejected" },
  paused   : { bg:"#f3f4f6", color:"#4b5563", label:"Paused"   },
  archived : { bg:"#f3f4f6", color:"#6b7280", label:"Archived" },
};

/* ══════════════════════════════════════════════════════════════
   HOOKS
══════════════════════════════════════════════════════════════ */
function useWindowWidth() {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    setWidth(window.innerWidth);
    let rafId = null;
    const handler = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        setWidth(window.innerWidth);
        rafId = null;
      });
    };
    window.addEventListener("resize", handler, { passive: true });
    return () => {
      window.removeEventListener("resize", handler);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return width;
}

/* Lock body scroll when any modal is open — prevents iOS/mobile
   nested scroll chaos that causes scroll-up to hang. */
function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return;

    const scrollY = window.scrollY;
    const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.setProperty("--sp-scrollbar-w", `${scrollbarW}px`);
    document.body.classList.add("sp-modal-open");
    document.body.style.top = `-${scrollY}px`;
    document.body.style.position = "fixed";
    document.body.style.width = "100%";

    return () => {
      document.body.classList.remove("sp-modal-open");
      document.body.style.top = "";
      document.body.style.position = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}

/* ══════════════════════════════════════════════════════════════
   HELPERS
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
  return STATUS_CONFIG[p.status] ?? {
    bg: "#f3f4f6", color: "#6b7280", label: p.status ?? "—",
  };
}

function buildPageNumbers(current, total) {
  const count = Math.min(total, 5);
  let start;
  if      (total <= 5)           start = 1;
  else if (current <= 3)         start = 1;
  else if (current >= total - 2) start = total - 4;
  else                           start = current - 2;
  start = Math.max(1, start);
  return Array.from({ length: count }, (_, i) => start + i);
}

/* ══════════════════════════════════════════════════════════════
   ICONS (unchanged – minimal set)
══════════════════════════════════════════════════════════════ */
const Icon = {
  Refresh: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  Grid: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  List: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  Plus: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Edit: ({ size = 13 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Trash: ({ size = 13 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  ),
  Pause: ({ size = 13 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  ),
  Play: ({ size = 13 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  Search: ({ size = 15 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  X: ({ size = 12 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Package: ({ size = 32 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  Alert: ({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

function Spin({ size = 14, color = "#6b7280" }) {
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
   SKELETONS
══════════════════════════════════════════════════════════════ */
const shimmerStyle = {
  background: "linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%)",
  backgroundSize: "400px 100%",
  animation: "sp-shimmer 1.4s infinite",
};

function SkeletonCard() {
  return (
    <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb", overflow: "hidden" }}>
      <div style={{ height: 140, ...shimmerStyle }} />
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {[75, 50, 90].map((w, i) => (
          <div key={i} style={{ height: 10, width: `${w}%`, borderRadius: 4, ...shimmerStyle }} />
        ))}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid #f3f4f6" }}>
      <div style={{ width: 40, height: 40, borderRadius: 6, flexShrink: 0, ...shimmerStyle }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {[60, 40].map((w, i) => (
          <div key={i} style={{ height: 10, width: `${w}%`, borderRadius: 4, ...shimmerStyle }} />
        ))}
      </div>
      <div style={{ width: 70, height: 20, borderRadius: 4, ...shimmerStyle }} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STATUS / STOCK CHIPS
══════════════════════════════════════════════════════════════ */
const StatusChip = memo(function StatusChip({ product }) {
  const cfg = getStatusCfg(product);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 8px", borderRadius: 4,
      fontSize: 11, fontWeight: 500,
      background: cfg.bg, color: cfg.color,
    }}>
      {cfg.label}
    </span>
  );
});

const StockBadge = memo(function StockBadge({ stock }) {
  const n = Number(stock ?? 0);
  const cfg =
    n <= 0                   ? { color: "#dc2626", text: "Out of stock" } :
    n <= LOW_STOCK_THRESHOLD ? { color: "#d97706", text: `${n} left`    } :
                               { color: "#059669", text: `${n} in stock`};
  return (
    <span style={{ fontSize: 12, fontWeight: 500, color: cfg.color }}>
      {cfg.text}
    </span>
  );
});

/* ══════════════════════════════════════════════════════════════
   PRODUCT IMAGE
══════════════════════════════════════════════════════════════ */
function ProductImage({ src, alt, width, height, borderRadius = 0 }) {
  const [err, setErr] = useState(false);
  return (
    <div style={{
      width, height, borderRadius,
      background: "#f9fafb", flexShrink: 0, overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {src && !err ? (
        <img
          key={src}
          src={src}
          alt={alt}
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={() => setErr(true)}
        />
      ) : (
        <span style={{ color: "#d1d5db" }}>
          <Icon.Package size={Math.floor(Math.min(
            typeof width  === "number" ? width  : 48,
            typeof height === "number" ? height : 48
          ) * 0.4)} />
        </span>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ACTION BUTTONS
══════════════════════════════════════════════════════════════ */
function ActionButtons({ product, onEdit, onDelete, onPause, compact = false }) {
  const canPause = product.status === "approved" || product.status === "active";

  if (compact) {
    return (
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={() => onEdit(product)} className="sp-btn" title="Edit" aria-label={`Edit ${product.name}`}>
          <Icon.Edit />
        </button>
        {canPause && (
          <button onClick={() => onPause(product)} className="sp-btn sp-btn--warn"
            title={product.is_paused ? "Resume" : "Pause"}
            aria-label={product.is_paused ? `Resume ${product.name}` : `Pause ${product.name}`}>
            {product.is_paused ? <Icon.Play /> : <Icon.Pause />}
          </button>
        )}
        <button onClick={() => onDelete(product)} className="sp-btn sp-btn--danger" title="Delete" aria-label={`Delete ${product.name}`}>
          <Icon.Trash />
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <button onClick={() => onEdit(product)} className="sp-btn" style={{ flex: 1 }}>
        <Icon.Edit /> Edit
      </button>
      {canPause && (
        <button onClick={() => onPause(product)} className="sp-btn sp-btn--warn"
          aria-label={product.is_paused ? "Resume" : "Pause"}>
          {product.is_paused ? <Icon.Play /> : <Icon.Pause />}
        </button>
      )}
      <button onClick={() => onDelete(product)} className="sp-btn sp-btn--danger" aria-label="Delete">
        <Icon.Trash />
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PRODUCT CARD
══════════════════════════════════════════════════════════════ */
const ProductCard = memo(function ProductCard({ product: p, onEdit, onDelete, onPause }) {
  const cover      = useMemo(() => getCoverImage(p), [p]);
  const totalStock = useMemo(() => getTotalStock(p), [p]);

  return (
    <article className="sp-card">
      <div style={{ height: 140, position: "relative", background: "#f9fafb" }}>
        <ProductImage src={cover} alt={p.name} width="100%" height={140} />
        <div style={{ position: "absolute", top: 8, left: 8 }}>
          <StatusChip product={p} />
        </div>
        {p.is_paused && (
          <div aria-hidden="true" style={{
            position: "absolute", inset: 0,
            background: "rgba(17,24,39,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              color: "#fff", fontSize: 11, fontWeight: 600,
              letterSpacing: "0.05em", textTransform: "uppercase",
            }}>Paused</span>
          </div>
        )}
      </div>

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        <p title={p.name} style={{
          fontWeight: 500, color: "#111827", margin: 0, fontSize: 13,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {p.name}
        </p>

        {p.category && (
          <p style={{ color: "#9ca3af", fontSize: 11, margin: 0 }}>{p.category}</p>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
          <span style={{ fontWeight: 600, color: "#111827", fontSize: 14 }}>
            {fmt(p.price)}
          </span>
          <StockBadge stock={totalStock} />
        </div>

        <div style={{ marginTop: 8 }}>
          <ActionButtons product={p} onEdit={onEdit} onDelete={onDelete} onPause={onPause} />
        </div>
      </div>
    </article>
  );
});

/* ══════════════════════════════════════════════════════════════
   PRODUCT ROW
══════════════════════════════════════════════════════════════ */
const ProductRow = memo(function ProductRow({ product: p, onEdit, onDelete, onPause }) {
  const cover      = useMemo(() => getCoverImage(p), [p]);
  const totalStock = useMemo(() => getTotalStock(p), [p]);

  return (
    <div className="sp-row" style={{
      display: "grid",
      gridTemplateColumns: "2.5fr 1fr 1fr 1fr auto",
      gap: 12, alignItems: "center", padding: "12px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <ProductImage src={cover} alt={p.name} width={40} height={40} borderRadius={6} />
        <div style={{ minWidth: 0 }}>
          <p style={{
            fontWeight: 500, color: "#111827", margin: 0, fontSize: 13,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {p.name}
          </p>
          {p.category && (
            <p style={{ color: "#9ca3af", fontSize: 11, margin: "2px 0 0" }}>{p.category}</p>
          )}
        </div>
      </div>
      <span style={{ fontWeight: 600, color: "#111827", fontSize: 13 }}>{fmt(p.price)}</span>
      <StockBadge stock={totalStock} />
      <StatusChip product={p} />
      <ActionButtons product={p} onEdit={onEdit} onDelete={onDelete} onPause={onPause} compact />
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════
   MODAL
══════════════════════════════════════════════════════════════ */
function Modal({ onClose, label, children }) {
  const dialogRef = useRef();
  useBodyScrollLock(true);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div style={MS.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        style={MS.modal}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div style={{
      background: "#fef2f2", border: "1px solid #fecaca",
      borderRadius: 6, padding: "8px 12px",
      color: "#991b1b", fontSize: 13,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <Icon.Alert />
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
    setDeleting(true); setError(null);
    try {
      const { data } = await sellerApi.delete(`${PRODUCTS_BASE}/${product.id}`);
      if (data.success) onDeleted();
      else setError(data.message ?? "Delete failed");
    } catch (err) {
      setError(err.response?.data?.message ?? "Delete failed. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal onClose={onClose} label="Delete product">
      <div style={MS.body}>
        <div>
          <h3 style={MS.title}>Delete listing</h3>
          <p style={MS.subtitle}>
            "<strong>{product.name}</strong>" will be permanently removed. This action cannot be undone.
          </p>
        </div>
        <ErrorBanner message={error} />
        <div style={MS.actions}>
          <button onClick={onClose} style={MS.cancelBtn} disabled={deleting}>Cancel</button>
          <button onClick={handleDelete} disabled={deleting} style={MS.dangerBtn}>
            {deleting ? (
              <span style={MS.btnInner}><Spin size={13} color="#fff" /> Deleting…</span>
            ) : "Delete"}
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
  const isPaused = product.is_paused;
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const handleToggle = async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await sellerApi.patch(`${PRODUCTS_BASE}/${product.id}/pause`);
      if (data.success) onToggled();
      else setError(data.message ?? "Failed. Please try again.");
    } catch (err) {
      setError(err.response?.data?.message ?? "Failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose} label={isPaused ? "Resume listing" : "Pause listing"}>
      <div style={MS.body}>
        <div>
          <h3 style={MS.title}>{isPaused ? "Resume listing" : "Pause listing"}</h3>
          <p style={MS.subtitle}>
            {isPaused
              ? "Buyers will be able to see and purchase this listing again."
              : "This listing will be hidden from buyers until you resume it."}
          </p>
        </div>
        <ErrorBanner message={error} />
        <div style={MS.actions}>
          <button onClick={onClose} style={MS.cancelBtn} disabled={loading}>Cancel</button>
          <button onClick={handleToggle} disabled={loading} style={MS.primaryBtn}>
            {loading ? (
              <span style={MS.btnInner}>
                <Spin size={13} color="#fff" />
                {isPaused ? "Resuming…" : "Pausing…"}
              </span>
            ) : (isPaused ? "Resume" : "Pause")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGINATION
══════════════════════════════════════════════════════════════ */
function PaginationBar({ pagination, page, onPage }) {
  const totalPages = pagination?.totalPages ?? 0;
  if (totalPages <= 1) return null;

  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      flexWrap: "wrap", gap: 12,
      background: "#fff", borderRadius: 8,
      padding: "12px 16px", border: "1px solid #e5e7eb",
    }}>
      <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
        Page {pagination.page} of {totalPages} · {pagination.total} products
      </p>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        <button className="sp-page-btn" onClick={() => onPage(page - 1)} disabled={page === 1}>
          Prev
        </button>
        {buildPageNumbers(page, totalPages).map((n) => (
          <button key={n}
            className={`sp-page-btn ${page === n ? "sp-page-btn--active" : ""}`}
            onClick={() => onPage(n)}>
            {n}
          </button>
        ))}
        <button className="sp-page-btn" onClick={() => onPage(page + 1)} disabled={page === totalPages}>
          Next
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   EMPTY STATE
══════════════════════════════════════════════════════════════ */
function EmptyState({ hasFilters, onClear, onPost, mobile }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb",
      padding: mobile ? "48px 20px" : "72px 24px",
      textAlign: "center", display: "flex",
      flexDirection: "column", alignItems: "center", gap: 10,
    }}>
      <span style={{ color: "#d1d5db" }}><Icon.Package size={48} /></span>
      <h3 style={{ fontWeight: 600, color: "#111827", margin: 0, fontSize: 15 }}>
        {hasFilters ? "No products found" : "No listings yet"}
      </h3>
      <p style={{ color: "#6b7280", fontSize: 13, margin: 0, maxWidth: 280, lineHeight: 1.5 }}>
        {hasFilters
          ? "Try a different search term or clear the filter."
          : "Post your first product to start selling."}
      </p>
      {hasFilters ? (
        <button onClick={onClear} style={{ ...MS.cancelBtn, marginTop: 4 }}>Clear filters</button>
      ) : (
        <button onClick={onPost} style={{ ...MS.primaryBtn, marginTop: 4 }}>
          <Icon.Plus /> Post Product
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════ */
export default function Products() {
  useEffect(() => { ensureStyles(); }, []);

  const navigate = useNavigate();
  const screenW  = useWindowWidth();

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
  const [fetchError,   setFetchError]   = useState(null);

  const searchRef = useRef();
  const mobile = screenW > 0 && screenW < 640;
  const tablet = screenW > 0 && screenW < 1024;

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const abortRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!silent) setLoading(true); else setRefreshing(true);
    setFetchError(null);

    try {
      const { data } = await sellerApi.get(PRODUCTS_BASE, {
        params: {
          page, limit: PAGE_SIZE,
          ...(filter && { status: filter }),
          ...(search && { search }),
        },
        signal: controller.signal,
      });

      if (data.success) {
        setProducts(data.products ?? data.data?.products ?? []);
        setPagination(data.pagination ?? data.data?.pagination ?? null);
      } else {
        setFetchError(data.message ?? "Failed to load products");
      }
    } catch (err) {
      if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
      setFetchError(err.response?.data?.message ?? err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, filter, search]);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  const handleRefresh = useCallback(() => { load(true); }, [load]);
  const handleEdit    = useCallback((p) => navigate(`/minimart/edit-ad/${p.id}`), [navigate]);
  const handleDeleted = useCallback(() => { setDeleteTarget(null); load(true); }, [load]);
  const handleToggled = useCallback(() => { setPauseTarget(null);  load(true); }, [load]);

  const hasFilters = Boolean(search || filter);

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1280, margin: "0 auto" }}>

        {/* HEADER */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", flexWrap: "wrap", gap: 12,
        }}>
          <div>
            <h2 style={{ fontWeight: 600, fontSize: 20, color: "#111827", margin: 0 }}>
              Listings
            </h2>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "2px 0 0" }}>
              {pagination?.total ?? products.length} products
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={handleRefresh} disabled={refreshing || loading}
              className="sp-btn" aria-label="Refresh">
              <span style={{
                display: "inline-flex",
                animation: refreshing ? "sp-spin 0.7s linear infinite" : "none",
              }}>
                <Icon.Refresh />
              </span>
              {!mobile && "Refresh"}
            </button>

            {!mobile && (
              <div style={{
                display: "flex", background: "#f3f4f6", borderRadius: 6,
                padding: 2, gap: 2,
              }} role="group" aria-label="View mode">
                {[{ mode: "grid", I: Icon.Grid }, { mode: "list", I: Icon.List }].map(({ mode, I }) => (
                  <button key={mode} onClick={() => setViewMode(mode)}
                    aria-label={`${mode} view`} aria-pressed={viewMode === mode}
                    style={{
                      padding: "6px 10px", borderRadius: 4, border: "none",
                      cursor: "pointer",
                      background: viewMode === mode ? "#fff" : "transparent",
                      color: viewMode === mode ? "#111827" : "#6b7280",
                      display: "flex", alignItems: "center",
                      boxShadow: viewMode === mode ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                      transition: "background 0.1s",
                    }}>
                    <I />
                  </button>
                ))}
              </div>
            )}

            <button onClick={() => navigate("/minimart/post-ad")} style={MS.primaryBtn}>
              <Icon.Plus /> {mobile ? "New" : "New product"}
            </button>
          </div>
        </div>

        {/* FETCH ERROR */}
        {fetchError && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca",
            borderRadius: 8, padding: "10px 12px",
            color: "#991b1b", fontSize: 13,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Icon.Alert />
            <span style={{ flex: 1 }}>{fetchError}</span>
            <button onClick={() => load(true)} style={{
              background: "none", border: "none", color: "#991b1b",
              cursor: "pointer", fontWeight: 500, fontSize: 13,
              fontFamily: "inherit", textDecoration: "underline",
            }}>
              Retry
            </button>
          </div>
        )}

        {/* SEARCH + FILTERS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute", left: 12, top: "50%",
              transform: "translateY(-50%)", color: "#9ca3af",
              pointerEvents: "none", display: "flex",
            }}>
              <Icon.Search />
            </span>
            <input
              ref={searchRef}
              className="sp-input"
              type="text"
              placeholder="Search by name or category…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search products"
              style={{
                width: "100%",
                padding: "9px 36px 9px 36px",
                border: "1px solid #e5e7eb", borderRadius: 8,
                fontSize: 13, background: "#fff",
                color: "#111827", boxSizing: "border-box",
                fontFamily: "inherit", outline: "none",
                transition: "border-color 0.1s",
              }}
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(""); searchRef.current?.focus(); }}
                aria-label="Clear search"
                style={{
                  position: "absolute", right: 10, top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent", border: "none", cursor: "pointer",
                  color: "#9ca3af", padding: 4, borderRadius: 4,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                <Icon.X />
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
            role="radiogroup" aria-label="Filter by status">
            {STATUS_FILTERS.map(({ key, label }) => (
              <button key={key}
                className={`sp-pill ${filter === key ? "sp-pill--active" : ""}`}
                role="radio" aria-checked={filter === key}
                onClick={() => { setFilter(key); setPage(1); }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* CONTENT */}
        {loading ? (
          viewMode === "grid" || mobile ? (
            <div style={{
              display: "grid", gap: 12,
              gridTemplateColumns: mobile ? "repeat(2,1fr)" : tablet ? "repeat(3,1fr)" : "repeat(4,1fr)",
            }}>
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          )
        ) : products.length === 0 ? (
          <EmptyState hasFilters={hasFilters}
            onClear={() => { setSearchInput(""); setFilter(""); }}
            onPost={() => navigate("/minimart/post-ad")} mobile={mobile} />
        ) : viewMode === "grid" || mobile ? (
          <div style={{
            display: "grid", gap: 12,
            gridTemplateColumns: mobile ? "repeat(2,1fr)" : tablet ? "repeat(3,1fr)" : "repeat(4,1fr)",
          }}>
            {products.map((p) => (
              <ProductCard key={p.id} product={p}
                onEdit={handleEdit}
                onDelete={setDeleteTarget}
                onPause={setPauseTarget} />
            ))}
          </div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "2.5fr 1fr 1fr 1fr auto",
              gap: 12, padding: "10px 16px",
              background: "#f9fafb", borderBottom: "1px solid #e5e7eb",
            }}>
              {["Product", "Price", "Stock", "Status", ""].map((h, i) => (
                <span key={i} style={{
                  fontSize: 11, fontWeight: 600, color: "#6b7280",
                  textTransform: "uppercase", letterSpacing: "0.05em",
                }}>
                  {h}
                </span>
              ))}
            </div>
            {products.map((p) => (
              <ProductRow key={p.id} product={p}
                onEdit={handleEdit}
                onDelete={setDeleteTarget}
                onPause={setPauseTarget} />
            ))}
          </div>
        )}

        <PaginationBar pagination={pagination} page={page} onPage={setPage} />
      </div>

      {deleteTarget && (
        <DeleteModal product={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted} />
      )}
      {pauseTarget && (
        <PauseModal product={pauseTarget}
          onClose={() => setPauseTarget(null)}
          onToggled={handleToggled} />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   MODAL STYLES
══════════════════════════════════════════════════════════════ */
const MS = {
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 16,
    /* NO backdrop-filter — causes scroll hang on mobile */
  },
  modal: {
    background: "#fff", borderRadius: 10,
    width: "100%", maxWidth: 400,
    maxHeight: "92vh", overflowY: "auto",
    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
    outline: "none",
    border: "1px solid #e5e7eb",
  },
  body: {
    padding: 20,
    display: "flex", flexDirection: "column", gap: 14,
  },
  title: {
    fontWeight: 600, color: "#111827",
    margin: "0 0 6px", fontSize: 16,
  },
  subtitle: {
    color: "#6b7280", fontSize: 13,
    margin: 0, lineHeight: 1.5,
  },
  actions: {
    display: "flex", gap: 8, justifyContent: "flex-end",
  },
  btnInner: {
    display: "flex", alignItems: "center",
    gap: 6, justifyContent: "center",
  },
  cancelBtn: {
    padding: "8px 14px",
    background: "#fff", border: "1px solid #e5e7eb",
    borderRadius: 6, fontWeight: 500,
    cursor: "pointer", color: "#374151",
    fontSize: 13, fontFamily: "inherit",
    transition: "background 0.1s",
  },
  primaryBtn: {
    padding: "8px 14px",
    background: "#111827", color: "#fff",
    border: "1px solid #111827", borderRadius: 6,
    fontWeight: 500, cursor: "pointer",
    fontSize: 13, fontFamily: "inherit",
    display: "inline-flex", alignItems: "center", gap: 6,
    transition: "background 0.1s",
  },
  dangerBtn: {
    padding: "8px 14px",
    background: "#dc2626", color: "#fff",
    border: "1px solid #dc2626", borderRadius: 6,
    fontWeight: 500, cursor: "pointer",
    fontSize: 13, fontFamily: "inherit",
  },
};