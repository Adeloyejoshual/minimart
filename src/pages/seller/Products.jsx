import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import { sellerApi } from "./SellerDashboard";
import "./Products.css";

const PAGE_SIZE = 12;
const LOW_STOCK = 5;
const API = "/api/seller/products";

const FILTERS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "paused", label: "Paused" },
];

const fmt = (v) =>
  `₦${Number(v ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function getCover(p) {
  if (Array.isArray(p.images) && p.images.length) {
    const m = p.images.find((i) => i.is_primary) ?? p.images[0];
    return m?.url ?? m?.image_url ?? null;
  }
  return p.image_url ?? null;
}

function getStock(p) {
  if (Array.isArray(p.variants) && p.variants.length)
    return p.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0);
  return Number(p.stock ?? p.quantity ?? 0);
}

function statusClass(p) {
  if (p.is_paused) return "sp-chip--paused";
  return `sp-chip--${p.status ?? "paused"}`;
}

function statusLabel(p) {
  if (p.is_paused) return "Paused";
  return (p.status ?? "—").charAt(0).toUpperCase() + (p.status ?? "").slice(1);
}

function stockClass(n) {
  if (n <= 0) return "sp-stock--out";
  if (n <= LOW_STOCK) return "sp-stock--low";
  return "sp-stock--ok";
}

function stockText(n) {
  if (n <= 0) return "Out of stock";
  if (n <= LOW_STOCK) return `${n} left`;
  return `${n} in stock`;
}

function pageNumbers(cur, total) {
  const count = Math.min(total, 5);
  let s = total <= 5 ? 1 : cur <= 3 ? 1 : cur >= total - 2 ? total - 4 : cur - 2;
  s = Math.max(1, s);
  return Array.from({ length: count }, (_, i) => s + i);
}

/* ── Icons (tiny, inline SVG) ── */
const I = {
  search: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  x: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  plus: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  edit: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>,
  pause: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  play: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  refresh: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  grid: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  list: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  box: <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  alert: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
};

/* ── Image ── */
function Img({ src, alt, className }) {
  const [err, setErr] = useState(false);
  if (!src || err) return <div className={className}><span style={{ color: "#ccc" }}>{I.box}</span></div>;
  return (
    <div className={className}>
      <img key={src} src={src} alt={alt} loading="lazy" onError={() => setErr(true)} />
    </div>
  );
}

/* ── Card ── */
const Card = memo(function Card({ p, onEdit, onDelete, onPause }) {
  const cover = useMemo(() => getCover(p), [p]);
  const stock = useMemo(() => getStock(p), [p]);
  const canPause = p.status === "approved" || p.status === "active";

  return (
    <div className="sp-card">
      <div className="sp-card-img">
        <Img src={cover} alt={p.name} className="sp-card-img" />
        <span className={`sp-chip sp-card-status ${statusClass(p)}`}>{statusLabel(p)}</span>
        {p.is_paused && <div className="sp-card-paused">Paused</div>}
      </div>
      <div className="sp-card-body">
        <p className="sp-card-name" title={p.name}>{p.name}</p>
        {p.category && <p className="sp-card-cat">{p.category}</p>}
        <div className="sp-card-footer">
          <span className="sp-card-price">{fmt(p.price)}</span>
          <span className={`sp-stock ${stockClass(stock)}`}>{stockText(stock)}</span>
        </div>
        <div className="sp-card-actions">
          <button className="sp-btn" onClick={() => onEdit(p)}>{I.edit} Edit</button>
          {canPause && (
            <button className="sp-btn sp-btn-warn" onClick={() => onPause(p)}>
              {p.is_paused ? I.play : I.pause}
            </button>
          )}
          <button className="sp-btn sp-btn-danger" onClick={() => onDelete(p)}>{I.trash}</button>
        </div>
      </div>
    </div>
  );
});

/* ── Row ── */
const Row = memo(function Row({ p, onEdit, onDelete, onPause }) {
  const cover = useMemo(() => getCover(p), [p]);
  const stock = useMemo(() => getStock(p), [p]);
  const canPause = p.status === "approved" || p.status === "active";

  return (
    <div className="sp-row">
      <div className="sp-row-info">
        <Img src={cover} alt={p.name} className="sp-row-thumb" />
        <div style={{ minWidth: 0 }}>
          <p className="sp-row-name">{p.name}</p>
          {p.category && <p className="sp-row-cat">{p.category}</p>}
        </div>
      </div>
      <span className="sp-row-price">{fmt(p.price)}</span>
      <span className={`sp-stock ${stockClass(stock)}`}>{stockText(stock)}</span>
      <span className={`sp-chip ${statusClass(p)}`}>{statusLabel(p)}</span>
      <div className="sp-row-actions">
        <button className="sp-btn" onClick={() => onEdit(p)} title="Edit">{I.edit}</button>
        {canPause && (
          <button className="sp-btn sp-btn-warn" onClick={() => onPause(p)} title="Pause">
            {p.is_paused ? I.play : I.pause}
          </button>
        )}
        <button className="sp-btn sp-btn-danger" onClick={() => onDelete(p)} title="Delete">{I.trash}</button>
      </div>
    </div>
  );
});

/* ── Modal ── */
function Modal({ onClose, title, children }) {
  useEffect(() => {
    document.body.classList.add("sp-no-scroll");
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("sp-no-scroll");
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="sp-overlay" onClick={onClose}>
      <div className="sp-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

/* ── Skeletons ── */
function SkelGrid({ n }) {
  return (
    <div className="sp-grid">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="sp-skel-card">
          <div className="sp-skel-card-img sp-skeleton" />
          <div className="sp-skel-card-body">
            <div className="sp-skeleton" style={{ height: 10, width: "75%" }} />
            <div className="sp-skeleton" style={{ height: 10, width: "50%" }} />
            <div className="sp-skeleton" style={{ height: 10, width: "90%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkelList({ n }) {
  return (
    <div className="sp-table">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="sp-skel-row">
          <div className="sp-skeleton" style={{ width: 40, height: 40, borderRadius: 6 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="sp-skeleton" style={{ height: 10, width: "60%" }} />
            <div className="sp-skeleton" style={{ height: 10, width: "40%" }} />
          </div>
          <div className="sp-skeleton" style={{ width: 70, height: 20 }} />
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN
═════════════════════════════════════════════════════════ */
export default function Products() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchIn, setSearchIn] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pag, setPag] = useState(null);
  const [view, setView] = useState("grid");
  const [delTarget, setDelTarget] = useState(null);
  const [pauseTarget, setPauseTarget] = useState(null);
  const [error, setError] = useState(null);

  const searchRef = useRef();
  const abortRef = useRef(null);

  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchIn.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchIn]);

  // fetch
  const load = useCallback(async (silent = false) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    if (!silent) setLoading(true); else setRefreshing(true);
    setError(null);
    try {
      const { data } = await sellerApi.get(API, {
        params: { page, limit: PAGE_SIZE, ...(filter && { status: filter }), ...(search && { search }) },
        signal: ctrl.signal,
      });
      if (data.success) {
        setItems(data.products ?? data.data?.products ?? []);
        setPag(data.pagination ?? data.data?.pagination ?? null);
      } else {
        setError(data.message ?? "Failed to load");
      }
    } catch (err) {
      if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
      setError(err.response?.data?.message ?? err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, filter, search]);

  useEffect(() => { load(); return () => abortRef.current?.abort(); }, [load]);

  const onEdit = useCallback((p) => navigate(`/minimart/edit-ad/${p.id}`), [navigate]);
  const onDeleted = useCallback(() => { setDelTarget(null); load(true); }, [load]);
  const onToggled = useCallback(() => { setPauseTarget(null); load(true); }, [load]);

  const totalPages = pag?.totalPages ?? 0;

  return (
    <div className="sp-page">

      {/* Header */}
      <div className="sp-header">
        <div>
          <h2>Listings</h2>
          <p>{pag?.total ?? items.length} products</p>
        </div>
        <div className="sp-header-actions">
          <button className="sp-btn" onClick={() => load(true)} disabled={refreshing || loading}>
            <span style={{ display: "inline-flex", animation: refreshing ? "sp-spin 0.6s linear infinite" : "none" }}>
              {I.refresh}
            </span>
            {!mobile && "Refresh"}
          </button>
          {!mobile && (
            <div className="sp-view-toggle">
              <button className={`sp-view-btn ${view === "grid" ? "sp-view-btn--active" : ""}`} onClick={() => setView("grid")}>{I.grid}</button>
              <button className={`sp-view-btn ${view === "list" ? "sp-view-btn--active" : ""}`} onClick={() => setView("list")}>{I.list}</button>
            </div>
          )}
          <button className="sp-btn sp-btn-primary" onClick={() => navigate("/minimart/post-ad")}>
            {I.plus} {mobile ? "New" : "New product"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="sp-error">
          {I.alert} <span>{error}</span>
          <button onClick={() => load(true)}>Retry</button>
        </div>
      )}

      {/* Search + Filters */}
      <div className="sp-search-wrap">
        <span className="sp-search-icon">{I.search}</span>
        <input
          ref={searchRef}
          className="sp-search"
          placeholder="Search products…"
          value={searchIn}
          onChange={(e) => setSearchIn(e.target.value)}
        />
        {searchIn && (
          <button className="sp-search-clear" onClick={() => { setSearchIn(""); searchRef.current?.focus(); }}>
            {I.x}
          </button>
        )}
      </div>

      <div className="sp-filters">
        {FILTERS.map(({ key, label }) => (
          <button key={key}
            className={`sp-pill ${filter === key ? "sp-pill--active" : ""}`}
            onClick={() => { setFilter(key); setPage(1); }}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        mobile || view === "grid" ? <SkelGrid n={8} /> : <SkelList n={6} />
      ) : items.length === 0 ? (
        <div className="sp-empty">
          <span style={{ color: "#ccc" }}>{I.box}</span>
          <h3>{search || filter ? "No products found" : "No listings yet"}</h3>
          <p>{search || filter ? "Try different search or clear filters." : "Post your first product to start selling."}</p>
          {search || filter ? (
            <button className="sp-btn" onClick={() => { setSearchIn(""); setFilter(""); }}>Clear filters</button>
          ) : (
            <button className="sp-btn sp-btn-primary" onClick={() => navigate("/minimart/post-ad")}>
              {I.plus} Post product
            </button>
          )}
        </div>
      ) : mobile || view === "grid" ? (
        <div className="sp-grid">
          {items.map((p) => (
            <Card key={p.id} p={p} onEdit={onEdit} onDelete={setDelTarget} onPause={setPauseTarget} />
          ))}
        </div>
      ) : (
        <div className="sp-table">
          <div className="sp-table-head">
            <span>Product</span><span>Price</span><span>Stock</span><span>Status</span><span></span>
          </div>
          {items.map((p) => (
            <Row key={p.id} p={p} onEdit={onEdit} onDelete={setDelTarget} onPause={setPauseTarget} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="sp-pagination">
          <p className="sp-pagination-info">Page {pag.page} of {totalPages} · {pag.total} products</p>
          <div className="sp-pagination-btns">
            <button className="sp-page-btn" onClick={() => setPage(page - 1)} disabled={page === 1}>Prev</button>
            {pageNumbers(page, totalPages).map((n) => (
              <button key={n} className={`sp-page-btn ${page === n ? "sp-page-btn--active" : ""}`} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button className="sp-page-btn" onClick={() => setPage(page + 1)} disabled={page === totalPages}>Next</button>
          </div>
        </div>
      )}

      {/* Modals */}
      {delTarget && (
        <Modal onClose={() => setDelTarget(null)} title="Delete listing">
          <p>"<strong>{delTarget.name}</strong>" will be permanently removed. This cannot be undone.</p>
          <div className="sp-modal-actions">
            <button className="sp-btn" onClick={() => setDelTarget(null)}>Cancel</button>
            <button className="sp-btn sp-btn-danger" onClick={async () => {
              try {
                const { data } = await sellerApi.delete(`${API}/${delTarget.id}`);
                if (data.success) onDeleted();
              } catch { /* ignore */ }
            }}>Delete</button>
          </div>
        </Modal>
      )}

      {pauseTarget && (
        <Modal onClose={() => setPauseTarget(null)} title={pauseTarget.is_paused ? "Resume listing" : "Pause listing"}>
          <p>
            {pauseTarget.is_paused
              ? "Buyers will be able to see and purchase this listing again."
              : "This listing will be hidden from buyers until you resume it."}
          </p>
          <div className="sp-modal-actions">
            <button className="sp-btn" onClick={() => setPauseTarget(null)}>Cancel</button>
            <button className="sp-btn sp-btn-primary" onClick={async () => {
              try {
                const { data } = await sellerApi.patch(`${API}/${pauseTarget.id}/pause`);
                if (data.success) onToggled();
              } catch { /* ignore */ }
            }}>{pauseTarget.is_paused ? "Resume" : "Pause"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}