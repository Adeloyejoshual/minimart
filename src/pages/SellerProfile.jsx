/**
 * src/pages/SellerProfile.jsx
 * Route: /seller/:id
 *
 * Pure public seller profile page.
 * No edit, no role checks, no dashboard links.
 * Uses GET /api/seller/:id and GET /api/seller/:id/products
 */

import { useCallback, useEffect, useRef, useState, memo, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav    from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import SellerHeader, { fmtNum } from "../components/SellerHeader";
import "../styles/SellerProfile.css";

/* ═══════════════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;
const PH       = "https://placehold.co/400x300/f0ede8/b0a89e?text=Loemart";
const PAGE_SZ  = 20;

const SORT_OPTIONS = [
  { value: "newest",     label: "Newest"           },
  { value: "price_asc",  label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "popular",    label: "Most Popular"      },
];

/* ═══════════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") || null;

const authH = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

const getImg = (p) => {
  if (p?.image)         return p.image;
  if (p?.main_image)    return p.main_image;
  if (p?.thumbnail_url) return p.thumbnail_url;
  if (Array.isArray(p?.images) && p.images.length) {
    const f = p.images[0];
    return typeof f === "string" ? f : f?.url || PH;
  }
  return PH;
};

const shareProfile = async (seller) => {
  const url   = window.location.href;
  const title = `Check out ${seller.store_name || seller.name} on Loemart`;
  if (navigator.share) {
    try { await navigator.share({ title, url }); return "shared"; } catch {}
  }
  try { await navigator.clipboard.writeText(url); return "copied"; }
  catch { return "failed"; }
};

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS used on this page
═══════════════════════════════════════════════════════════════ */
const SvgBack = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/>
    <polyline points="12 19 5 12 12 5"/>
  </svg>
);

const SvgShare = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/>
    <circle cx="6" cy="12" r="3"/>
    <circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);

const SvgFlag = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
    <line x1="4" y1="22" x2="4" y2="15"/>
  </svg>
);

const SvgSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const SvgX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const SvgMapPin = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

const SvgAlertCircle = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
    stroke="#bbb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const SvgShoppingBag = () => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
    stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
);

const SvgSearchEmpty = () => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
    stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    <line x1="8" y1="11" x2="14" y2="11"/>
  </svg>
);

const SvgCheckCircle = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
    stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const SvgStar = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════════════════════════════ */
const Toast = ({ message, type = "info", onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`sp-toast sp-toast--${type}`} role="alert" aria-live="polite">
      <span>{message}</span>
      <button className="sp-toast-close" onClick={onClose} aria-label="Dismiss">
        <SvgX />
      </button>
    </div>
  );
};

/* ── Product card ── */
const ProductCard = memo(function ProductCard({ product, onClick }) {
  const img       = getImg(product);
  const condition = product.condition;

  return (
    <article
      className="sp-card"
      onClick={() => onClick(product)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
      aria-label={`${product.title} — ${naira(product.price)}`}
    >
      <div className="sp-card-img">
        <img
          src={img} alt={product.title} loading="lazy"
          onError={(e) => { e.currentTarget.src = PH; }}
        />
        {product.is_promoted && (
          <span className="sp-card-badge sp-card-badge--promo">
            <SvgStar /> Featured
          </span>
        )}
        {condition && (
          <span className={`sp-card-badge sp-card-badge--cond sp-card-badge--${condition}`}>
            {condition.charAt(0).toUpperCase() + condition.slice(1)}
          </span>
        )}
      </div>
      <div className="sp-card-body">
        <p className="sp-card-title">{product.title}</p>
        <p className="sp-card-price">{naira(product.price)}</p>
        {(product.location_city || product.location_state) && (
          <p className="sp-card-loc">
            <SvgMapPin />
            {product.location_city || product.location_state}
          </p>
        )}
      </div>
    </article>
  );
});

/* ── Skeletons ── */
const SkeletonHeader = () => (
  <div className="sp-header sp-header--skeleton" aria-hidden="true">
    <div className="sp-sk sp-sk-banner" />
    <div className="sp-profile-row sp-profile-row--offset">
      <div className="sp-sk sp-sk-avatar" />
      <div className="sp-sk-lines">
        <div className="sp-sk sp-sk-name" />
        <div className="sp-sk sp-sk-sub" />
        <div className="sp-sk sp-sk-sub sp-sk-sub--short" />
      </div>
    </div>
    <div className="sp-sk sp-sk-stats" />
    <div className="sp-sk sp-sk-btn" />
  </div>
);

const SkeletonGrid = () => (
  <div className="sp-grid" aria-hidden="true">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="sp-sk-card">
        <div className="sp-sk sp-sk-card-img" />
        <div style={{ padding: "10px" }}>
          <div className="sp-sk sp-sk-card-title" />
          <div className="sp-sk sp-sk-card-price" />
        </div>
      </div>
    ))}
  </div>
);

/* ── Filter bar ── */
const FilterBar = ({ query, onQuery, sort, onSort, categories, activeCategory, onCategory }) => {
  const inputRef = useRef(null);
  return (
    <div className="sp-filterbar">
      <div className="sp-filter-row">
        <div className="sp-search-wrap">
          <span className="sp-search-icon"><SvgSearch /></span>
          <input
            ref={inputRef}
            className="sp-search" type="search"
            placeholder="Search listings…"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            aria-label="Search seller's listings"
          />
          {query && (
            <button
              className="sp-search-clear"
              onClick={() => { onQuery(""); inputRef.current?.focus(); }}
              aria-label="Clear search"
            >
              <SvgX />
            </button>
          )}
        </div>
        <select
          className="sp-sort" value={sort}
          onChange={(e) => onSort(e.target.value)}
          aria-label="Sort listings by"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {categories.length > 1 && (
        <div className="sp-cats" role="tablist" aria-label="Filter by category">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`sp-cat-tab${activeCategory === cat ? " sp-cat-tab--active" : ""}`}
              onClick={() => onCategory(cat)}
              role="tab"
              aria-selected={activeCategory === cat}
            >
              {cat === "__all__" ? "All" : cat}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Report modal ── */
const REPORT_REASONS = [
  "Fake or misleading products",
  "Doesn't respond to messages",
  "Suspected scam or fraud",
  "Inappropriate content",
  "Wrong category listings",
  "Other",
];

const ReportModal = ({ sellerId, onClose, showToast, navigate, user }) => {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [busy,   setBusy]   = useState(false);
  const [done,   setDone]   = useState(false);

  const submit = async () => {
    if (!reason) return;
    if (!user?.id) { navigate(`/auth?redirect=/seller/${sellerId}`); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API}/reports`, {
        method : "POST",
        headers: { "Content-Type": "application/json", ...authH() },
        body   : JSON.stringify({ type: "seller", target_id: sellerId, reason, detail }),
      });
      if (!res.ok) throw new Error("Failed");
      setDone(true);
      setTimeout(() => { onClose(); showToast("Report submitted. Thank you.", "success"); }, 1500);
    } catch {
      showToast("Could not submit report. Try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sp-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sp-modal-head">
          <h3>Report Seller</h3>
          <button className="sp-modal-close" onClick={onClose} aria-label="Close"><SvgX /></button>
        </div>
        {done ? (
          <div className="sp-modal-done">
            <SvgCheckCircle />
            <p>Report submitted</p>
          </div>
        ) : (
          <>
            <div className="sp-modal-body">
              <p className="sp-modal-label">What's the issue?</p>
              {REPORT_REASONS.map((r) => (
                <label key={r} className="sp-modal-radio">
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
                  {r}
                </label>
              ))}
              <textarea
                className="sp-modal-textarea" placeholder="Additional details (optional)"
                value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} maxLength={500}
              />
            </div>
            <div className="sp-modal-footer">
              <button className="sp-btn sp-btn--outline" onClick={onClose}>Cancel</button>
              <button className="sp-modal-btn-danger" onClick={submit} disabled={!reason || busy}>
                {busy ? <span className="sp-spinner" aria-hidden="true" /> : "Submit Report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ── Quick message modal ── */
const MSG_TEMPLATES = [
  "Is this still available?",
  "Can you deliver to my area?",
  "What's your best price?",
  "Do you accept returns?",
];

const QuickMessageModal = ({ onSelect, onClose }) => (
  <div className="sp-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
    <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
      <div className="sp-modal-head">
        <h3>Message Seller</h3>
        <button className="sp-modal-close" onClick={onClose} aria-label="Close"><SvgX /></button>
      </div>
      <div className="sp-modal-body">
        <p className="sp-modal-label">Choose a starter or open a blank chat:</p>
        {MSG_TEMPLATES.map((t) => (
          <button key={t} className="sp-qmsg-btn" onClick={() => onSelect(t)}>{t}</button>
        ))}
        <button className="sp-qmsg-btn sp-qmsg-btn--ghost" onClick={() => onSelect(null)}>
          Open blank chat →
        </button>
      </div>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function SellerProfile({ user }) {
  const { id }   = useParams();
  const navigate = useNavigate();

  /* ── State ── */
  const [seller,      setSeller]      = useState(null);
  const [stats,       setStats]       = useState(null);
  const [products,    setProducts]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [page,        setPage]        = useState(1);

  const [chatBusy,   setChatBusy]   = useState(false);
  const [following,  setFollowing]  = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [toast,      setToast]      = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [showQMsg,   setShowQMsg]   = useState(false);

  const [query,          setQuery]          = useState("");
  const [sort,           setSort]           = useState("newest");
  const [activeCategory, setActiveCategory] = useState("__all__");

  const sentinelRef = useRef(null);
  const allProducts = useRef([]);

  const showToast = useCallback((m, t = "info") => setToast({ message: m, type: t }), []);

  /* ── Categories ── */
  const categories = useMemo(() => {
    const cats = new Set(
      allProducts.current.map((p) => p.category || p.category_name).filter(Boolean)
    );
    return cats.size ? ["__all__", ...Array.from(cats)] : ["__all__"];
  }, [products]); // eslint-disable-line

  /* ── Filtered + sorted ── */
  const displayed = useMemo(() => {
    let list = [...allProducts.current];
    if (activeCategory !== "__all__")
      list = list.filter((p) => (p.category || p.category_name) === activeCategory);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) =>
        p.title?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
      );
    }
    switch (sort) {
      case "price_asc":  list.sort((a, b) => Number(a.price) - Number(b.price)); break;
      case "price_desc": list.sort((a, b) => Number(b.price) - Number(a.price)); break;
      case "popular":    list.sort((a, b) => Number(b.views ?? 0) - Number(a.views ?? 0)); break;
      default:           list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return list;
  }, [products, query, sort, activeCategory]); // eslint-disable-line

  /* ── Load seller ── */
  const loadSeller = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/seller/${id}`, { headers: authH() });
      if (res.status === 404) throw new Error("Seller not found");
      if (!res.ok) throw new Error("Could not load seller");

      const data = await res.json();
      setSeller(data.seller || data);
      setStats(data.stats || null);
      setFollowing(!!data.is_following);

      const prods = Array.isArray(data.products) ? data.products : [];
      allProducts.current = prods;
      setProducts(prods);
      setHasMore(data.hasMore ?? prods.length === PAGE_SZ);
      setPage(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadSeller(); }, [loadSeller]);

  /* ── Load more ── */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;
    try {
      const params = new URLSearchParams({ page: next, limit: PAGE_SZ, sort });
      const res = await fetch(`${API}/seller/${id}/products?${params}`);
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const incoming = Array.isArray(data.products) ? data.products : [];
      allProducts.current = [...allProducts.current, ...incoming];
      setProducts([...allProducts.current]);
      setHasMore(data.hasMore ?? incoming.length === PAGE_SZ);
      setPage(next);
    } catch {
      showToast("Failed to load more", "error");
    } finally {
      setLoadingMore(false);
    }
  }, [id, loadingMore, hasMore, page, sort, showToast]);

  /* ── Infinite scroll ── */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, hasMore]);

  /* ── Chat ── */
  const openChat = useCallback(async (template = null) => {
    if (!user?.id) { navigate(`/auth?redirect=/seller/${id}`); return; }
    if (String(user.id) === String(seller?.id)) return;
    setChatBusy(true);
    try {
      const res = await fetch(`${API}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authH() },
        body: JSON.stringify({
          buyerId: user.id, sellerId: seller.id,
          productId: null, starter_message: template || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      const tid = data.thread_id || data.id;
      if (!tid) throw new Error("No thread returned");
      navigate(`/chat/${tid}`);
    } catch (err) {
      showToast("Could not open chat: " + err.message, "error");
    } finally {
      setChatBusy(false);
    }
  }, [user, seller, id, navigate, showToast]);

  const messageSeller = useCallback(() => setShowQMsg(true), []);
  const handleQMsg    = useCallback((t) => { setShowQMsg(false); openChat(t); }, [openChat]);

  /* ── Follow ── */
  const toggleFollow = useCallback(async () => {
    if (!user?.id) { navigate(`/auth?redirect=/seller/${id}`); return; }
    const prev = following;
    setFollowing((f) => !f);
    setFollowBusy(true);
    try {
      const res = await fetch(`${API}/seller/${id}/follow`, {
        method: prev ? "DELETE" : "POST", headers: authH(),
      });
      if (!res.ok) throw new Error();
      showToast(prev ? "Unfollowed" : "Now following!", "success");
    } catch {
      setFollowing(prev);
      showToast("Could not update", "error");
    } finally {
      setFollowBusy(false);
    }
  }, [user, id, following, navigate, showToast]);

  /* ── Share ── */
  const handleShare = useCallback(async () => {
    if (!seller) return;
    const r = await shareProfile(seller);
    if (r === "copied") showToast("Link copied!", "success");
    if (r === "failed") showToast("Could not copy", "error");
  }, [seller, showToast]);

  /* ── Product click ── */
  const onProductClick = useCallback((p) => navigate(`/product/${p.slug || p.id}`), [navigate]);

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <>
      <TopNav user={user} />
      <div className="sp-page">

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        {showReport && <ReportModal sellerId={id} onClose={() => setShowReport(false)} showToast={showToast} navigate={navigate} user={user} />}
        {showQMsg && <QuickMessageModal onSelect={handleQMsg} onClose={() => setShowQMsg(false)} />}

        {/* ── Top bar ── */}
        <div className="sp-topbar">
          <button className="sp-icon-btn" onClick={() => navigate(-1)} aria-label="Go back">
            <SvgBack />
          </button>
          <div className="sp-topbar-right">
            {seller && (
              <button className="sp-icon-btn" onClick={handleShare} aria-label="Share profile">
                <SvgShare />
              </button>
            )}
            {seller && (
              <button className="sp-icon-btn sp-icon-btn--muted" onClick={() => setShowReport(true)} aria-label="Report seller">
                <SvgFlag />
              </button>
            )}
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="sp-error" role="alert">
            <SvgAlertCircle />
            <p>{error}</p>
            <button onClick={loadSeller}>Try again</button>
          </div>
        )}

        {/* ── Skeleton ── */}
        {loading && !error && <SkeletonHeader />}

        {/* ── Seller Header ── */}
        {!loading && !error && seller && (
          <SellerHeader
            seller={seller}
            stats={stats}
            following={following}
            followBusy={followBusy}
            toggleFollow={toggleFollow}
            chatBusy={chatBusy}
            messageSeller={messageSeller}
          />
        )}

        {/* ── Products ── */}
        {!error && (
          <div className="sp-products-section">

            {!loading && seller && (
              <div className="sp-products-head">
                <h2 className="sp-products-title">
                  Listings
                  <span className="sp-products-count">
                    {fmtNum(stats?.total_products ?? seller.products_count ?? products.length)}
                  </span>
                </h2>
              </div>
            )}

            {!loading && products.length > 0 && (
              <FilterBar
                query={query} onQuery={setQuery}
                sort={sort} onSort={setSort}
                categories={categories}
                activeCategory={activeCategory}
                onCategory={setActiveCategory}
              />
            )}

            {loading && <SkeletonGrid />}

            {!loading && products.length === 0 && seller && (
              <div className="sp-empty" role="status">
                <SvgShoppingBag />
                <p>No listings yet</p>
                <small>{seller.store_name || seller.name} hasn't posted anything yet.</small>
                <button className="sp-follow-empty-btn" onClick={toggleFollow} disabled={followBusy}>
                  {following ? "Following" : "+ Follow to get notified"}
                </button>
              </div>
            )}

            {!loading && products.length > 0 && displayed.length === 0 && (
              <div className="sp-empty" role="status">
                <SvgSearchEmpty />
                <p>No results found</p>
                <small>Try a different search or filter.</small>
                <button className="sp-clear-filters" onClick={() => { setQuery(""); setActiveCategory("__all__"); }}>
                  Clear filters
                </button>
              </div>
            )}

            {displayed.length > 0 && (
              <div className="sp-grid" role="list" aria-label="Seller's listings">
                {displayed.map((p) => <ProductCard key={p.id} product={p} onClick={onProductClick} />)}
              </div>
            )}

            <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />

            {loadingMore && (
              <div className="sp-loading-more" aria-live="polite">
                <span className="sp-spinner sp-spinner--dark" aria-hidden="true" />
                <span>Loading more…</span>
              </div>
            )}

            {!hasMore && products.length > 0 && !query && (
              <p className="sp-end-label">— All listings shown —</p>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </>
  );
}