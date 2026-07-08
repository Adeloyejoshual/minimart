/**
 * src/pages/ProductDetail.jsx
 * Route: /product/:slug
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
} from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";

import ProductHeader  from "./ProductDetail/ProductHeader";
import ContactStrip   from "./ProductDetail/ContactStrip";
import ReviewSection  from "./ProductDetail/Review";
import SafetyTips     from "./ProductDetail/SafetyTips";
import SimilarProducts from "./ProductDetail/SimilarProducts";
import MoreFromSeller from "./ProductDetail/MoreFromSeller";

import "../styles/ProductDetail.css";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const BASE_URL      = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API           = `${BASE_URL}/api`;
const FAV_KEY       = "loemart_favs";
const REVIEWS_LIMIT = 5;
const FAV_DEBOUNCE  = 400; // ms

/* ═══════════════════════════════════════════════════════════════
   AUTH UTILS
═══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const authH = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

/**
 * Safely decode a JWT payload.
 * atob() requires standard Base64; JWTs use Base64url (- and _).
 */
const decodeJWT = (token) => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
};

const readUserId = () => {
  try {
    const token = getToken();
    if (token) {
      const p  = decodeJWT(token);
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
  } catch {
    return null;
  }
};

/* ═══════════════════════════════════════════════════════════════
   FAVOURITES UTILS
═══════════════════════════════════════════════════════════════ */
const loadFavs = () => {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) || "{}");
  } catch {
    return {};
  }
};

const saveFavs = (f) => {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(f));
  } catch {}
};

/* ═══════════════════════════════════════════════════════════════
   SHARED HELPERS
═══════════════════════════════════════════════════════════════ */

/** Keyboard handler — fires callback on Enter or Space */
const onEnter = (fn) => (e) => {
  if (e.key === "Enter" || e.key === " ") fn();
};

/* ═══════════════════════════════════════════════════════════════
   SKELETON
═══════════════════════════════════════════════════════════════ */
const Skeleton = memo(function Skeleton() {
  return (
    <div className="pd-page" aria-busy="true" aria-label="Loading product">
      <div className="pd-sk-hero" />
      <div className="pd-sk-body">
        <div className="pd-sk-line" style={{ width: "35%",  height: 11 }} />
        <div className="pd-sk-line" style={{ width: "90%",  height: 24, marginTop: 8  }} />
        <div className="pd-sk-line" style={{ width: "45%",  height: 32, marginTop: 10 }} />
        <div className="pd-sk-line" style={{ width: "100%", height: 90, marginTop: 20, borderRadius: 12 }} />
        <div className="pd-sk-line" style={{ width: "100%", height: 120, marginTop: 12, borderRadius: 12 }} />
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SELLER CARD  (extracted from render)
═══════════════════════════════════════════════════════════════ */
const SellerCard = memo(function SellerCard({ seller, sellerId, onNavigate }) {
  if (!seller && !sellerId) return null;

  const avatar = seller?.profile_image || seller?.store_logo;
  const name   = seller?.store_name || seller?.name || "Seller";

  return (
    <section className="pd-section" aria-label="Seller information">
      <h3 className="pd-section-h">Seller</h3>
      <div
        className="pd-seller-card"
        onClick={onNavigate}
        role="button"
        tabIndex={0}
        aria-label={`View seller profile for ${name}`}
        onKeyDown={onEnter(onNavigate)}
      >
        {/* Avatar */}
        <div className="pd-seller-avatar">
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <span aria-hidden="true">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
          {seller?.is_online && (
            <span className="pd-seller-online" aria-label="Seller is online" />
          )}
        </div>

        {/* Info */}
        <div className="pd-seller-info">
          <div className="pd-seller-name-row">
            <span className="pd-seller-name">{name}</span>
            {seller?.verified && (
              <span className="pd-seller-badge" aria-label="Verified seller">
                ✔ Verified
              </span>
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
              <span aria-label={`Rating: ${Number(seller.rating).toFixed(1)} stars`}>
                · {Number(seller.rating).toFixed(1)}★
              </span>
            )}
          </div>

          {seller?.trust_score != null && (
            <div className="pd-trust" aria-label={`Trust score: ${seller.trust_score}%`}>
              <div className="pd-trust-bar" role="presentation">
                <div
                  className="pd-trust-fill"
                  style={{ width: `${Math.min(100, seller.trust_score)}%` }}
                />
              </div>
              <span className="pd-trust-label">{seller.trust_score}% trust</span>
            </div>
          )}
        </div>

        {/* Chevron */}
        <svg
          className="pd-seller-chevron"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          aria-hidden="true"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   CHAT ERROR TOAST
═══════════════════════════════════════════════════════════════ */
const ChatErrorToast = memo(function ChatErrorToast({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="pd-toast pd-toast--error" role="alert" aria-live="assertive">
      <span>{message}</span>
      <button
        className="pd-toast-close"
        onClick={onDismiss}
        aria-label="Dismiss error"
      >
        ✕
      </button>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function ProductDetail({ user }) {
  const { slug }   = useParams();
  const navigate   = useNavigate();
  const { addSingleProduct } = useProductCache();

  /* ── state ───────────────────────────────────────────────── */
  const [product,     setProduct]     = useState(null);
  const [seller,      setSeller]      = useState(null);
  const [similar,     setSimilar]     = useState([]);
  const [moreSeller,  setMoreSeller]  = useState([]);
  const [reviews,     setReviews]     = useState([]);
  const [reviewStats, setReviewStats] = useState(null);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewPage,  setReviewPage]  = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [fav,         setFav]         = useState(false);
  const [chatBusy,    setChatBusy]    = useState(false);
  const [chatError,   setChatError]   = useState(null);

  /* ── refs ────────────────────────────────────────────────── */
  const favTimerRef    = useRef(null);   // debounce fav API call
  const abortRef       = useRef(null);   // AbortController for product fetch

  /* ── derived ─────────────────────────────────────────────── */
  const userId = useMemo(() => user?.id || readUserId(), [user]);

  const isOwn = useMemo(
    () => !!(userId && product?.seller_id && userId === String(product.seller_id)),
    [userId, product?.seller_id]
  );

  /* ═══════════════════════════════════════════════════════════
     FETCH — PRIMARY PRODUCT
  ═══════════════════════════════════════════════════════════ */
  const loadProduct = useCallback(async () => {
    if (!slug || slug === "undefined") {
      setError("Invalid product link.");
      setLoading(false);
      return;
    }

    // Cancel any in-flight request for a previous slug
    abortRef.current?.abort();
    const controller  = new AbortController();
    abortRef.current  = controller;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `${API}/product/slug/${encodeURIComponent(slug)}`,
        { signal: controller.signal }
      );

      if (res.status === 404) throw new Error("Product not found");
      if (!res.ok)            throw new Error("Could not load product");

      const data = await res.json();
      setProduct(data);
      addSingleProduct?.(data);
      setFav(!!loadFavs()[data.id]);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [slug, addSingleProduct]);

  useEffect(() => {
    loadProduct();
    // Abort on unmount or slug change
    return () => abortRef.current?.abort();
  }, [loadProduct]);

  /* ═══════════════════════════════════════════════════════════
     FETCH — SECONDARY DATA  (parallel, fires once product loads)
  ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!product?.id) return;

    const { id, seller_id, category_id } = product;

    // Fire all secondary requests in parallel — none blocks the others
    Promise.allSettled([

      // 1. Record view
      fetch(`${API}/product/products/${id}/view`, { method: "POST" }),

      // 2. Seller profile
      seller_id &&
        fetch(`${API}/seller/${seller_id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => { if (d) setSeller(d.seller || d); }),

      // 3. More from this seller
      seller_id &&
        fetch(
          `${API}/product/by-seller?${new URLSearchParams({
            seller_id,
            exclude: id,
            limit: "8",
          })}`
        )
          .then((r) => (r.ok ? r.json() : []))
          .then((d) => setMoreSeller(Array.isArray(d) ? d : [])),

      // 4. Similar products
      category_id &&
        fetch(
          `${API}/product/similar?${new URLSearchParams({
            category_id,
            exclude: id,
            limit: "8",
          })}`
        )
          .then((r) => (r.ok ? r.json() : []))
          .then((d) => setSimilar(Array.isArray(d) ? d : [])),

    ]).catch(() => {}); // allSettled never rejects, but belt-and-braces
  }, [product?.id, product?.seller_id, product?.category_id]);

  /* ═══════════════════════════════════════════════════════════
     FETCH — REVIEWS
  ═══════════════════════════════════════════════════════════ */
  const loadReviews = useCallback(
    async (page = 1) => {
      if (!slug) return;
      try {
        const res = await fetch(
          `${API}/product/slug/${encodeURIComponent(slug)}/reviews` +
            `?limit=${REVIEWS_LIMIT}&page=${page}`
        );
        if (!res.ok) return;
        const data = await res.json();

        setReviews((prev) =>
          page === 1
            ? data.reviews || []
            : [...prev, ...(data.reviews || [])]
        );

        if (data.stats) {
          setReviewStats(data.stats);
          setReviewTotal(data.stats.total || 0);
        }
      } catch {}
    },
    [slug]
  );

  useEffect(() => { loadReviews(1); }, [loadReviews]);

  /* ═══════════════════════════════════════════════════════════
     ACTIONS
  ═══════════════════════════════════════════════════════════ */

  /**
   * Optimistic favourite toggle with:
   *  - immediate local state + localStorage update
   *  - debounced API sync
   *  - rollback on API failure
   */
  const toggleFav = useCallback(() => {
    if (!product?.id) return;

    const next = !fav;
    setFav(next);

    const favs = loadFavs();
    if (next) favs[product.id] = true;
    else      delete favs[product.id];
    saveFavs(favs);

    if (!userId) return;

    clearTimeout(favTimerRef.current);
    favTimerRef.current = setTimeout(() => {
      fetch(`${API}/product/products/${product.id}/favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      }).catch(() => {
        // Rollback optimistic update on network failure
        setFav(!next);
        const rollback = loadFavs();
        if (!next) rollback[product.id] = true;
        else       delete rollback[product.id];
        saveFavs(rollback);
      });
    }, FAV_DEBOUNCE);
  }, [fav, product, userId]);

  const openWhatsApp = useCallback(() => {
    if (!product) return;
    fetch(`${API}/product/products/${product.id}/click`, { method: "POST" })
      .catch(() => {});

    const waNumber = product?.whatsapp || product?.contact?.whatsapp;
    const waLink   = product?.whatsapp_link || product?.contact?.whatsapp_link;
    const msg      = encodeURIComponent(
      `Hi, I'm interested in: ${product.title} — ${window.location.href}`
    );
    const url =
      waLink ||
      (waNumber
        ? `https://wa.me/${waNumber.replace(/\D/g, "")}?text=${msg}`
        : null);

    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }, [product]);

  const openCall = useCallback(() => {
    const phone = product?.phone || product?.contact?.phone;
    if (phone) window.location.href = `tel:${phone}`;
  }, [product]);

  const openChat = useCallback(async () => {
    if (!userId) {
      navigate(`/auth?redirect=/product/${encodeURIComponent(slug)}`);
      return;
    }
    if (isOwn || !product?.seller_id) return;

    setChatBusy(true);
    setChatError(null);

    try {
      const res = await fetch(`${API}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authH() },
        body: JSON.stringify({
          buyerId:   userId,
          sellerId:  product.seller_id,
          productId: product.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Server error");

      const threadId = data.thread_id || data.id;
      if (!threadId) throw new Error("No thread ID returned");

      navigate(`/chat/${threadId}`);
    } catch (err) {
      // ✅ State-driven error — no alert()
      setChatError(err.message || "Could not open chat. Please try again.");
    } finally {
      setChatBusy(false);
    }
  }, [userId, isOwn, product, slug, navigate]);

  const goProduct = useCallback(
    (p) => { navigate(`/product/${p.slug || p.id}`); },
    [navigate]
  );

  /* ═══════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════ */
  if (loading) return <Skeleton />;

  if (error)
    return (
      <div className="pd-page" role="main">
        <div className="pd-error-wrap" role="alert">
          <span className="pd-error-emoji" aria-hidden="true">🔍</span>
          <h2 className="pd-error-title">{error}</h2>
          <p className="pd-error-sub">
            This listing may have been removed or the link is incorrect.
          </p>
          <Link to="/" className="pd-error-btn">Browse Marketplace</Link>
        </div>
      </div>
    );

  if (!product) return null;

  return (
    <div className="pd-page" role="main">

      {/* ── Chat error toast ───────────────────────────────── */}
      <ChatErrorToast
        message={chatError}
        onDismiss={() => setChatError(null)}
      />

      {/* ── Header (images, title, price, fav) ────────────── */}
      <ProductHeader
        product={product}
        seller={seller}
        fav={fav}
        onToggleFav={toggleFav}
        onNavigateBack={() => navigate(-1)}
        isOwn={isOwn}
        onEditListing={() => navigate(`/listings/edit/${product.id}`)}
      />

      {/* ── Contact buttons ────────────────────────────────── */}
      <ContactStrip
        product={product}
        userId={userId}
        isOwn={isOwn}
        chatBusy={chatBusy}
        onChat={openChat}
        onWhatsApp={openWhatsApp}
        onCall={openCall}
      />

      {/* ── Seller card ────────────────────────────────────── */}
      <SellerCard
        seller={seller}
        sellerId={product.seller_id}
        onNavigate={() => navigate(`/seller/${product.seller_id}`)}
      />

      {/* ── Reviews ────────────────────────────────────────── */}
      <ReviewSection
        slug={slug}
        userId={userId}
        reviews={reviews}
        reviewStats={reviewStats}
        reviewTotal={reviewTotal}
        reviewPage={reviewPage}
        onLoadMore={() => {
          const next = reviewPage + 1;
          setReviewPage(next);
          loadReviews(next);
        }}
        onReviewDone={() => {
          setReviewPage(1);
          loadReviews(1);
        }}
      />

      {/* ── Safety tips ────────────────────────────────────── */}
      <SafetyTips />

      {/* ── More from this seller (horizontal scroll) ─────── */}
      <MoreFromSeller
        products={moreSeller}
        seller={seller}
        sellerId={product.seller_id}
        onProductClick={goProduct}
      />

      {/* ── Similar products (masonry grid) ───────────────── */}
      <SimilarProducts
        products={similar}
        onProductClick={goProduct}
      />

      {/* ── Spinner keyframe (scoped) ──────────────────────── */}
      <style>{`
        @keyframes pd-spin { to { transform: rotate(360deg); } }
        .pd-spinner {
          display: inline-block;
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: pd-spin .7s linear infinite;
        }
        .pd-toast {
          position: fixed; bottom: 20px; left: 50%;
          transform: translateX(-50%);
          display: flex; align-items: center; gap: 10px;
          padding: 10px 16px;
          border-radius: 8px; font-size: 14px;
          box-shadow: 0 4px 16px rgba(0,0,0,.15);
          z-index: 9999; max-width: 90vw;
        }
        .pd-toast--error { background: #ff4d4f; color: #fff; }
        .pd-toast-close {
          background: none; border: none;
          color: inherit; cursor: pointer;
          font-size: 16px; line-height: 1;
          padding: 0 2px;
        }
      `}</style>
    </div>
  );
}