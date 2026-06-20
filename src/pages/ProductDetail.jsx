/**
 * src/pages/ProductDetail.jsx
 * Route: /product/:slug
 *
 * Clean, modern product detail page for Loemart.
 * Features:
 * - Image gallery + lightbox
 * - Description expand/collapse
 * - Seller card + trust score
 * - Contact: chat, WhatsApp, call
 * - Reviews + star rating form
 * - Similar + more from seller
 * - Favourites (local + API)
 * - Safety tips
 */

import {
  useState, useEffect, useCallback, useMemo, memo,
} from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";
import "../styles/ProductDetail.css";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API      = `${BASE_URL}/api`;

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const PH            = "https://placehold.co/800x600/f0ede8/b0a89e?text=Loemart";
const FAV_KEY       = "loemart_favs";
const DESC_WORD_MAX = 80;
const REVIEWS_LIMIT = 5;

const SAFETY_TIPS = [
  "Never pay in advance — pay only on delivery.",
  "Meet sellers in safe, public locations.",
  "Inspect items carefully before buying.",
  "Confirm you received the exact item shown.",
  "Report suspicious listings immediately.",
];

const RATING_LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];

/* ═══════════════════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token")             ||
  null;

const authH = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const readUserId = () => {
  try {
    const token = getToken();
    if (token) {
      const p  = JSON.parse(atob(token.split(".")[1]));
      const id = p?.id || p?.sub || p?.userId || p?.user_id;
      if (id) return String(id);
    }
    for (const key of ["user", "loemart_user", "authUser"]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const p  = JSON.parse(raw);
      const id = p?.id || p?.user?.id;
      if (id) return String(id);
    }
    return null;
  } catch { return null; }
};

/* ═══════════════════════════════════════════════════════════════
   FAVOURITES
═══════════════════════════════════════════════════════════════ */
const loadFavs = () => {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || "{}"); }
  catch { return {}; }
};
const saveFavs = (f) => {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(f)); } catch {}
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const naira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG");

const fmtNum = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "m";
  if (v >= 1_000)     return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return v.toLocaleString();
};

const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 60)        return "just now";
  if (s < 3_600)     return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400)    return `${Math.floor(s / 3_600)}h ago`;
  if (s < 2_592_000) return `${Math.floor(s / 86_400)}d ago`;
  return new Date(d).toLocaleDateString("en-NG", { month: "short", year: "numeric" });
};

const getImages = (p) => {
  if (!p) return [PH];
  const imgs = [];
  if (Array.isArray(p.images)) {
    p.images.forEach((img) => {
      if (!img) return;
      const url = typeof img === "string" ? img : img?.url || img?.image_url;
      if (url && !imgs.includes(url)) imgs.push(url);
    });
  }
  if (!imgs.length && p.main_image)    imgs.push(p.main_image);
  if (!imgs.length && p.thumbnail_url) imgs.push(p.thumbnail_url);
  if (!imgs.length && p.image)         imgs.push(p.image);
  return imgs.length ? imgs : [PH];
};

const fmtKey = (k) =>
  k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* ═══════════════════════════════════════════════════════════════
   STAR DISPLAY
═══════════════════════════════════════════════════════════════ */
const Stars = memo(({ rating = 0, size = "md" }) => {
  const r = Math.min(5, Math.max(0, Math.round(Number(rating))));
  return (
    <span className={`pd-stars${size === "sm" ? " pd-stars--sm" : ""}`}>
      {"★".repeat(r)}
      <span className="pd-stars-empty">{"★".repeat(5 - r)}</span>
    </span>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SKELETON
═══════════════════════════════════════════════════════════════ */
function Skeleton() {
  return (
    <div className="pd-page">
      <div className="pd-sk-hero" />
      <div className="pd-sk-body">
        <div className="pd-sk-line" style={{ width: "35%", height: 11 }} />
        <div className="pd-sk-line" style={{ width: "90%", height: 24, marginTop: 8 }} />
        <div className="pd-sk-line" style={{ width: "45%", height: 32, marginTop: 10 }} />
        <div className="pd-sk-line" style={{ width: "100%", height: 90, marginTop: 20, borderRadius: 12 }} />
        <div className="pd-sk-line" style={{ width: "100%", height: 120, marginTop: 12, borderRadius: 12 }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MINI PRODUCT CARD (for similar / more from seller)
═══════════════════════════════════════════════════════════════ */
const MiniCard = memo(function MiniCard({ product, onClick }) {
  const img = getImages(product)[0];
  return (
    <div className="pd-mini-card" onClick={() => onClick(product)} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}>
      <div className="pd-mini-img-wrap">
        <img src={img} alt={product.title} loading="lazy"
          onError={(e) => { e.currentTarget.src = PH; }} />
        {product.is_promoted && <span className="pd-mini-promo">Featured</span>}
      </div>
      <div className="pd-mini-body">
        <p className="pd-mini-title">{product.title}</p>
        <p className="pd-mini-price">{naira(product.price)}</p>
        {(product.location_city || product.location?.city) && (
          <p className="pd-mini-loc">
            📍 {product.location_city || product.location?.city}
          </p>
        )}
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   REVIEW FORM
═══════════════════════════════════════════════════════════════ */
function ReviewForm({ slug, userId, onDone }) {
  const navigate = useNavigate();
  const [rating,  setRating]  = useState(0);
  const [hover,   setHover]   = useState(0);
  const [comment, setComment] = useState("");
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState(null);
  const [done,    setDone]    = useState(false);

  if (!userId) return (
    <div className="pd-review-gate">
      <p>Log in to leave a review</p>
      <button onClick={() => navigate(`/auth?redirect=/product/${slug}`)}>
        Log in
      </button>
    </div>
  );

  if (done) return (
    <div className="pd-review-done">✅ Review submitted — thank you!</div>
  );

  const submit = async () => {
    if (!rating) { setErr("Please pick a rating"); return; }
    setBusy(true); setErr(null);
    try {
      const res = await fetch(
        `${API}/product/slug/${encodeURIComponent(slug)}/reviews`,
        {
          method  : "POST",
          headers : { "Content-Type": "application/json", ...authH() },
          body    : JSON.stringify({ user_id: userId, rating, comment }),
        }
      );
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      setDone(true);
      onDone?.();
    } catch (e) {
      setErr(e.message || "Failed to submit");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pd-review-form">
      <p className="pd-review-form-title">Write a review</p>

      {/* Star picker */}
      <div className="pd-star-picker">
        {[1,2,3,4,5].map((n) => (
          <button
            key={n}
            className={`pd-star-btn${(hover || rating) >= n ? " on" : ""}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            aria-label={`${n} star`}
          >★</button>
        ))}
        {rating > 0 && (
          <span className="pd-star-label">{RATING_LABELS[rating]}</span>
        )}
      </div>

      <textarea
        className="pd-review-ta"
        placeholder="Share your experience… (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={500}
      />
      <div className="pd-review-chars">{comment.length}/500</div>

      {err && <p className="pd-review-err">{err}</p>}

      <button
        className="pd-review-submit"
        onClick={submit}
        disabled={busy || !rating}
      >
        {busy ? "Submitting…" : "Submit Review"}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function ProductDetail({ user }) {
  const { slug }             = useParams();
  const navigate             = useNavigate();
  const { addSingleProduct } = useProductCache();

  /* ── State ─────────────────────────────────────────────── */
  const [product,        setProduct]        = useState(null);
  const [seller,         setSeller]         = useState(null);
  const [similar,        setSimilar]        = useState([]);
  const [moreSeller,     setMoreSeller]     = useState([]);
  const [reviews,        setReviews]        = useState([]);
  const [reviewStats,    setReviewStats]    = useState(null);
  const [reviewTotal,    setReviewTotal]    = useState(0);
  const [reviewPage,     setReviewPage]     = useState(1);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [activeImg,      setActiveImg]      = useState(0);
  const [lightbox,       setLightbox]       = useState(false);
  const [expanded,       setExpanded]       = useState(false);
  const [fav,            setFav]            = useState(false);
  const [chatBusy,       setChatBusy]       = useState(false);

  /* ── User ─────────────────────────────────────────────── */
  const userId = useMemo(() => user?.id || readUserId(), [user]);

  /* ── Derived ──────────────────────────────────────────── */
  const images = useMemo(() => getImages(product), [product]);

  const attrs = useMemo(() => {
    const a = product?.attributes;
    if (!a || typeof a !== "object") return [];
    return Object.entries(a).filter(([, v]) => v != null && v !== "" && !Array.isArray(v));
  }, [product]);

  const features = useMemo(() => {
    const h = product?.highlights;
    return Array.isArray(h) ? h.filter(Boolean) : [];
  }, [product]);

  const specs = useMemo(() => {
    const s = product?.specifications;
    if (!s || typeof s !== "object") return [];
    return Object.entries(s).filter(([, v]) => v != null && v !== "");
  }, [product]);

  const faqs = useMemo(() => {
    const f = product?.faq;
    return Array.isArray(f) ? f.filter((i) => i?.q && i?.a) : [];
  }, [product]);

  const delivery = useMemo(() => {
    const d = product?.delivery;
    return d?.available ? d : null;
  }, [product]);

  const isOwn     = !!(userId && product?.seller_id && userId === product.seller_id);
  const waNumber  = product?.whatsapp      || product?.contact?.whatsapp;
  const waLink    = product?.whatsapp_link || product?.contact?.whatsapp_link;
  const phone     = product?.phone         || product?.contact?.phone;
  const hasContact = !!(waNumber || waLink || phone || product?.seller_id);

  /* ════════════════════════════════════════════════════════
     DATA FETCHING
  ════════════════════════════════════════════════════════ */

  // ── Product ───────────────────────────────────────────
  const loadProduct = useCallback(async () => {
    if (!slug || slug === "undefined") {
      setError("Invalid product link.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res  = await fetch(`${API}/product/slug/${encodeURIComponent(slug)}`);
      if (res.status === 404) throw new Error("Product not found");
      if (!res.ok)            throw new Error("Could not load product");
      const data = await res.json();
      setProduct(data);
      addSingleProduct?.(data);
      setFav(!!loadFavs()[data.id]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [slug, addSingleProduct]);

  useEffect(() => { loadProduct(); }, [loadProduct]);

  // ── Track view ────────────────────────────────────────
  useEffect(() => {
    if (!product?.id) return;
    fetch(`${API}/product/products/${product.id}/view`, {
      method: "POST",
    }).catch(() => {});
  }, [product?.id]);

  // ── Seller ────────────────────────────────────────────
  useEffect(() => {
    if (!product?.seller_id) return;
    fetch(`${API}/seller/${product.seller_id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setSeller(d.seller || d); })
      .catch(() => {});
  }, [product?.seller_id]);

  // ── More from seller ──────────────────────────────────
  useEffect(() => {
    if (!product?.seller_id || !product?.id) return;
    const qs = new URLSearchParams({
      seller_id : product.seller_id,
      exclude   : product.id,
      limit     : "8",
    });
    fetch(`${API}/product/by-seller?${qs}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setMoreSeller(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [product?.seller_id, product?.id]);

  // ── Similar ───────────────────────────────────────────
  useEffect(() => {
    if (!product?.id || !product?.category_id) return;
    const qs = new URLSearchParams({
      category_id : product.category_id,
      exclude     : product.id,
      limit       : "8",
    });
    fetch(`${API}/product/similar?${qs}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setSimilar(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [product?.id, product?.category_id]);

  // ── Reviews ───────────────────────────────────────────
  const loadReviews = useCallback(async (page = 1) => {
    if (!slug) return;
    try {
      const res  = await fetch(
        `${API}/product/slug/${encodeURIComponent(slug)}/reviews?limit=${REVIEWS_LIMIT}&page=${page}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setReviews((prev) =>
        page === 1 ? (data.reviews || []) : [...prev, ...(data.reviews || [])]
      );
      if (data.stats) {
        setReviewStats(data.stats);
        setReviewTotal(data.stats.total || 0);
      }
    } catch {}
  }, [slug]);

  useEffect(() => { loadReviews(1); }, [loadReviews]);

  // ── Lightbox keyboard ─────────────────────────────────
  useEffect(() => {
    if (!lightbox) return;
    const h = (e) => {
      if (e.key === "Escape")     setLightbox(false);
      if (e.key === "ArrowRight") setActiveImg((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft")  setActiveImg((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [lightbox, images.length]);

  /* ════════════════════════════════════════════════════════
     ACTIONS
  ════════════════════════════════════════════════════════ */

  // ── Favourite ─────────────────────────────────────────
  const toggleFav = useCallback(() => {
    if (!product?.id) return;
    const next = !fav;
    setFav(next);
    const favs = loadFavs();
    if (next) favs[product.id] = true;
    else delete favs[product.id];
    saveFavs(favs);
    if (userId) {
      fetch(`${API}/product/products/${product.id}/favorite`, {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify({ user_id: userId }),
      }).catch(() => {});
    }
  }, [fav, product, userId]);

  // ── WhatsApp ──────────────────────────────────────────
  const openWhatsApp = useCallback(() => {
    if (!product) return;
    fetch(`${API}/product/products/${product.id}/click`, { method: "POST" }).catch(() => {});
    const msg = encodeURIComponent(
      `Hi, I'm interested in: ${product.title} — ${window.location.href}`
    );
    const url = waLink || (waNumber
      ? `https://wa.me/${waNumber.replace(/\D/g, "")}?text=${msg}`
      : null);
    if (url) window.open(url, "_blank");
  }, [product, waLink, waNumber]);

  // ── Call ─────────────────────────────────────────────
  const openCall = useCallback(() => {
    if (phone) window.location.href = `tel:${phone}`;
  }, [phone]);

  // ── Chat ─────────────────────────────────────────────
  const openChat = useCallback(async () => {
    if (!userId) {
      navigate(`/auth?redirect=/product/${slug}`);
      return;
    }
    if (isOwn || !product?.seller_id) return;
    setChatBusy(true);
    try {
      const res  = await fetch(`${API}/conversations`, {
        method  : "POST",
        headers : { "Content-Type": "application/json", ...authH() },
        body    : JSON.stringify({
          buyerId  : userId,
          sellerId : product.seller_id,
          productId: product.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      const threadId = data.thread_id || data.id;
      if (!threadId) throw new Error("No thread ID");
      navigate(`/chat/${threadId}`);
    } catch (err) {
      alert("Could not open chat: " + err.message);
    } finally {
      setChatBusy(false);
    }
  }, [userId, isOwn, product, slug, navigate]);

  // ── Navigate to product ───────────────────────────────
  const goProduct = useCallback((p) => {
    navigate(`/product/${p.slug || p.id}`);
  }, [navigate]);

  /* ════════════════════════════════════════════════════════
     LOADING / ERROR
  ════════════════════════════════════════════════════════ */
  if (loading) return <Skeleton />;

  if (error) return (
    <div className="pd-page">
      <div className="pd-error-wrap">
        <span className="pd-error-emoji">🔍</span>
        <h2 className="pd-error-title">{error}</h2>
        <p className="pd-error-sub">
          This listing may have been removed or the link is incorrect.
        </p>
        <Link to="/" className="pd-error-btn">Browse Marketplace</Link>
      </div>
    </div>
  );

  if (!product) return null;

  const words      = (product.description || "").split(" ");
  const longDesc   = words.length > DESC_WORD_MAX;
  const hasMore    = reviews.length < reviewTotal;

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div className="pd-page">

      {/* ══════════════════════════════════════════════
          HEADER BAR
      ══════════════════════════════════════════════ */}
      <div className="pd-topbar">
        <button className="pd-topbar-back" onClick={() => navigate(-1)} aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>

        <div className="pd-topbar-actions">
          {/* Share */}
          <button
            className="pd-topbar-btn"
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: product.title, url: window.location.href });
              } else {
                navigator.clipboard?.writeText(window.location.href);
                alert("Link copied!");
              }
            }}
            aria-label="Share"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/>
            </svg>
          </button>

          {/* Favourite */}
          <button
            className={`pd-topbar-btn${fav ? " pd-topbar-btn--fav" : ""}`}
            onClick={toggleFav}
            aria-label={fav ? "Remove from favourites" : "Add to favourites"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24"
              fill={fav ? "currentColor" : "none"}
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
          GALLERY
      ══════════════════════════════════════════════ */}
      <div className="pd-gallery">

        {/* Main image */}
        <div
          className="pd-main-wrap"
          onClick={() => setLightbox(true)}
          role="button"
          aria-label="View full image"
        >
          {product.is_promoted && (
            <span className="pd-badge-promo">⭐ Featured</span>
          )}
          <img
            className="pd-main-img"
            src={images[activeImg]}
            alt={product.title}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            onError={(e) => { e.currentTarget.src = PH; }}
          />
          {images.length > 1 && (
            <span className="pd-img-counter">{activeImg + 1} / {images.length}</span>
          )}
          <span className="pd-zoom-hint">🔍 Tap to zoom</span>
        </div>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="pd-thumbs">
            {images.map((src, i) => (
              <button
                key={i}
                className={`pd-thumb${activeImg === i ? " pd-thumb--active" : ""}`}
                onClick={() => setActiveImg(i)}
                aria-label={`View image ${i + 1}`}
              >
                <img src={src} alt={`${i + 1}`} loading="lazy"
                  onError={(e) => { e.currentTarget.src = PH; }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          TITLE + PRICE
      ══════════════════════════════════════════════ */}
      <div className="pd-title-block">
        {product.category_name && (
          <div className="pd-crumb">
            {product.category_name}
            {product.subcategory_name && ` › ${product.subcategory_name}`}
          </div>
        )}

        <h1 className="pd-title">{product.title}</h1>

        <div className="pd-price-row">
          <span className="pd-price">{naira(product.price)}</span>
          {product.is_promoted && (
            <span className="pd-price-tag">Promoted</span>
          )}
        </div>

        <div className="pd-meta-row">
          {product.views > 0 && (
            <span className="pd-meta">{fmtNum(product.views)} views</span>
          )}
          {product.favorites_count > 0 && (
            <span className="pd-meta">♥ {product.favorites_count}</span>
          )}
          <span className="pd-meta">{timeAgo(product.created_at)}</span>
        </div>

        {/* Location pill */}
        {(product.location_city || product.location_state) && (
          <div className="pd-location-pill">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span>
              {[product.location_city, product.location_state]
                .filter(Boolean)
                .join(", ")}
            </span>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════
          CONTACT BUTTONS
      ══════════════════════════════════════════════ */}
      {hasContact && !isOwn && (
        <div className="pd-contact-strip">
          {/* Chat */}
          {product.seller_id && (
            <button
              className="pd-btn pd-btn--chat"
              onClick={openChat}
              disabled={chatBusy}
            >
              {chatBusy ? (
                <span className="pd-spinner" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              )}
              {chatBusy ? "Opening…" : "Chat"}
            </button>
          )}

          {/* WhatsApp */}
          {(waNumber || waLink) && (
            <button className="pd-btn pd-btn--whatsapp" onClick={openWhatsApp}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.857L.057 23.571l5.89-1.548A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.028-1.378l-.36-.215-3.734.98 1.001-3.654-.235-.374A9.818 9.818 0 012.182 12C2.182 6.562 6.562 2.182 12 2.182S21.818 6.562 21.818 12 17.438 21.818 12 21.818z"/>
              </svg>
              WhatsApp
            </button>
          )}

          {/* Call */}
          {phone && (
            <button className="pd-btn pd-btn--call" onClick={openCall}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 1.2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.73 16z"/>
              </svg>
              Call
            </button>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          DESCRIPTION
      ══════════════════════════════════════════════ */}
      {product.description && (
        <div className="pd-section">
          <h3 className="pd-section-h">About this product</h3>
          <p className="pd-description">
            {longDesc && !expanded
              ? words.slice(0, DESC_WORD_MAX).join(" ") + "…"
              : product.description}
          </p>
          {longDesc && (
            <button className="pd-toggle" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Show less ↑" : "Read more ↓"}
            </button>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════
          FEATURES
      ══════════════════════════════════════════════ */}
      {features.length > 0 && (
        <div className="pd-section">
          <h3 className="pd-section-h">Features</h3>
          <ul className="pd-features">
            {features.map((f, i) => (
              <li key={i} className="pd-feature">
                <span className="pd-feature-check">✓</span>
                <span>{typeof f === "string" ? f : f?.text || String(f)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          DETAILS
      ══════════════════════════════════════════════ */}
      {attrs.length > 0 && (
        <div className="pd-section">
          <h3 className="pd-section-h">Details</h3>
          <div className="pd-table">
            {attrs.map(([k, v]) => (
              <div key={k} className="pd-table-row">
                <span className="pd-table-key">{fmtKey(k)}</span>
                <span className="pd-table-val">
                  {Array.isArray(v) ? v.join(", ") : String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          SPECIFICATIONS
      ══════════════════════════════════════════════ */}
      {specs.length > 0 && (
        <div className="pd-section">
          <h3 className="pd-section-h">Specifications</h3>
          <div className="pd-table">
            {specs.map(([k, v]) => (
              <div key={k} className="pd-table-row">
                <span className="pd-table-key">{fmtKey(k)}</span>
                <span className="pd-table-val">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          DELIVERY
      ══════════════════════════════════════════════ */}
      {delivery && (
        <div className="pd-section">
          <h3 className="pd-section-h">Delivery</h3>
          <div className="pd-delivery-card">
            <div className="pd-delivery-icon">🚚</div>
            <div className="pd-delivery-info">
              <p className="pd-delivery-label">
                {delivery.duration?.from && delivery.duration?.to
                  ? `${delivery.duration.from}–${delivery.duration.to} days`
                  : "Available"}
              </p>
              {delivery.fee != null && (
                <p className="pd-delivery-fee">
                  Fee: {Number(delivery.fee) === 0 ? "Free" : naira(delivery.fee)}
                </p>
              )}
              {delivery.note && (
                <p className="pd-delivery-note">{delivery.note}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          SELLER CARD
      ══════════════════════════════════════════════ */}
      {(seller || product.seller_id) && (
        <div className="pd-section">
          <h3 className="pd-section-h">Seller</h3>
          <div
            className="pd-seller-card"
            onClick={() => navigate(`/seller/${product.seller_id}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && navigate(`/seller/${product.seller_id}`)}
          >
            {/* Avatar */}
            <div className="pd-seller-avatar">
              {seller?.profile_image || seller?.store_logo ? (
                <img
                  src={seller.profile_image || seller.store_logo}
                  alt={seller.name}
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ) : (
                <span>{(seller?.name || "S").charAt(0).toUpperCase()}</span>
              )}
              {seller?.is_online && <span className="pd-seller-online" />}
            </div>

            {/* Info */}
            <div className="pd-seller-info">
              <div className="pd-seller-name-row">
                <span className="pd-seller-name">
                  {seller?.store_name || seller?.name || "Seller"}
                </span>
                {seller?.verified && (
                  <span className="pd-seller-badge">✔ Verified</span>
                )}
              </div>
              <div className="pd-seller-stats">
                {seller?.products_count > 0 && (
                  <span>{seller.products_count} listings</span>
                )}
                {seller?.total_sales > 0 && (
                  <span>· {Number(seller.total_sales).toLocaleString()} sales</span>
                )}
                {seller?.rating > 0 && (
                  <span>· {Number(seller.rating).toFixed(1)}★</span>
                )}
              </div>
              {seller?.trust_score != null && (
                <div className="pd-trust">
                  <div className="pd-trust-bar">
                    <div
                      className="pd-trust-fill"
                      style={{ width: `${Math.min(100, seller.trust_score)}%` }}
                    />
                  </div>
                  <span className="pd-trust-label">{seller.trust_score}% trust</span>
                </div>
              )}
            </div>

            <svg className="pd-seller-chevron" width="16" height="16"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          FAQ
      ══════════════════════════════════════════════ */}
      {faqs.length > 0 && (
        <div className="pd-section">
          <h3 className="pd-section-h">FAQs</h3>
          <div className="pd-faqs">
            {faqs.map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          REVIEWS
      ══════════════════════════════════════════════ */}
      <div className="pd-section">
        <h3 className="pd-section-h">
          Reviews
          {reviewStats?.total > 0 && (
            <span className="pd-review-badge">{reviewStats.total}</span>
          )}
        </h3>

        {/* Summary */}
        {reviewStats?.total > 0 && (
          <div className="pd-review-summary">
            <div className="pd-review-avg">
              <span className="pd-review-score">
                {Number(reviewStats.average || 0).toFixed(1)}
              </span>
              <Stars rating={reviewStats.average} />
              <span className="pd-review-count">
                {reviewStats.total} review{reviewStats.total !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="pd-review-bars">
              {[5, 4, 3, 2, 1].map((n) => {
                const key   = ["", "one", "two", "three", "four", "five"][n] + "_star";
                const count = reviewStats[key] || 0;
                const pct   = reviewStats.total > 0
                  ? (count / reviewStats.total) * 100 : 0;
                return (
                  <div key={n} className="pd-bar-row">
                    <span className="pd-bar-n">{n}</span>
                    <div className="pd-bar-track">
                      <div className="pd-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="pd-bar-count">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Review list */}
        {reviews.length > 0 ? (
          <div className="pd-review-list">
            {reviews.map((r, i) => (
              <div key={r.id || i} className="pd-review-item">
                <div className="pd-review-top">
                  <div className="pd-reviewer">
                    <div className="pd-reviewer-avatar">
                      {r.author_image
                        ? <img src={r.author_image} alt={r.author} />
                        : (r.author || "A").charAt(0).toUpperCase()
                      }
                    </div>
                    <div>
                      <p className="pd-reviewer-name">{r.author || "Anonymous"}</p>
                      <p className="pd-reviewer-date">{timeAgo(r.created_at)}</p>
                    </div>
                  </div>
                  <Stars rating={r.rating} size="sm" />
                </div>
                {r.comment && (
                  <p className="pd-review-text">{r.comment}</p>
                )}
              </div>
            ))}

            {hasMore && (
              <button
                className="pd-load-more"
                onClick={() => {
                  const next = reviewPage + 1;
                  setReviewPage(next);
                  loadReviews(next);
                }}
              >
                Load more reviews
              </button>
            )}
          </div>
        ) : (
          <p className="pd-no-reviews">No reviews yet — be the first!</p>
        )}

        {/* Review form */}
        <ReviewForm
          slug={slug}
          userId={userId}
          onDone={() => { setReviewPage(1); loadReviews(1); }}
        />
      </div>

      {/* ══════════════════════════════════════════════
          SAFETY TIPS
      ══════════════════════════════════════════════ */}
      <div className="pd-section pd-safety-section">
        <h3 className="pd-section-h pd-safety-h">🛡️ Safety Tips</h3>
        <ul className="pd-safety-list">
          {SAFETY_TIPS.map((tip, i) => (
            <li key={i} className="pd-safety-item">
              <span className="pd-safety-dot">•</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ══════════════════════════════════════════════
          SIMILAR PRODUCTS
      ══════════════════════════════════════════════ */}
      {similar.length > 0 && (
        <div className="pd-section">
          <h3 className="pd-section-h">You may also like</h3>
          <div className="pd-mini-grid">
            {similar.map((p) => (
              <MiniCard key={p.id} product={p} onClick={goProduct} />
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          MORE FROM SELLER
      ══════════════════════════════════════════════ */}
      {moreSeller.length > 0 && (
        <div className="pd-section">
          <h3 className="pd-section-h">
            More from {seller?.store_name || seller?.name || "this seller"}
          </h3>
          <div className="pd-mini-grid">
            {moreSeller.map((p) => (
              <MiniCard key={p.id} product={p} onClick={goProduct} />
            ))}
          </div>
          <button
            className="pd-see-all-btn"
            onClick={() => navigate(`/seller/${product.seller_id}`)}
          >
            See all listings →
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          LIGHTBOX
      ══════════════════════════════════════════════ */}
      {lightbox && (
        <div className="pd-lightbox" onClick={() => setLightbox(false)}>
          <button className="pd-lb-close" onClick={() => setLightbox(false)} aria-label="Close">
            ✕
          </button>

          {images.length > 1 && (
            <>
              <button
                className="pd-lb-prev"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImg((i) => (i - 1 + images.length) % images.length);
                }}
                aria-label="Previous"
              >‹</button>
              <button
                className="pd-lb-next"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImg((i) => (i + 1) % images.length);
                }}
                aria-label="Next"
              >›</button>
            </>
          )}

          <img
            className="pd-lb-img"
            src={images[activeImg]}
            alt={product.title}
            onClick={(e) => e.stopPropagation()}
            onError={(e) => { e.currentTarget.src = PH; }}
          />

          {images.length > 1 && (
            <p className="pd-lb-counter">
              {activeImg + 1} / {images.length}
            </p>
          )}
        </div>
      )}

      <style>{`
        @keyframes pd-spin {
          to { transform: rotate(360deg); }
        }
        .pd-spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: pd-spin .7s linear infinite;
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FAQ ITEM
═══════════════════════════════════════════════════════════════ */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pd-faq-item">
      <button className="pd-faq-q" onClick={() => setOpen((v) => !v)}>
        <span>{q}</span>
        <span className={`pd-faq-arrow${open ? " pd-faq-arrow--open" : ""}`}>▼</span>
      </button>
      {open && <p className="pd-faq-a">{a}</p>}
    </div>
  );
}