/**
 * src/pages/ProductDetail.jsx
 *
 * Route: /product/:slug
 *
 * Main product detail page — all sub-sections are separate components.
 * This file handles:
 *   ─ Data fetching (product, reviews, similar, more-from-seller)
 *   ─ Auth / user ID resolution
 *   ─ Favourites (optimistic + server sync)
 *   ─ Chat, WhatsApp, Call actions
 *   ─ Wiring all sub-components together
 */

import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";

/* ── Sub-components ────────────────────────────────────────── */
import ProductDetailTopBar   from "./ProductDetail/ProductDetailTopBar";
import ProductDetailExpiry   from "./ProductDetail/ProductDetailExpiry";
import ProductImageGallery   from "./ProductDetail/ProductImageGallery";
import ProductDetailInfo     from "./ProductDetail/ProductDetailInfo";
import ContactStrip          from "./ProductDetail/ContactStrip";
import ReviewSection         from "./ProductDetail/Review";
import SafetyTips            from "./ProductDetail/SafetyTips";
import SimilarProducts       from "./ProductDetail/SimilarProducts";
import MoreFromSeller        from "./ProductDetail/MoreFromSeller";

/* ── Styles ────────────────────────────────────────────────── */
import "../styles/ProductDetail.css";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const BASE_URL      = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API           = `${BASE_URL}/api`;
const FAV_KEY       = "loemart_favs";
const REVIEWS_LIMIT = 5;
const FAV_DEBOUNCE  = 400;

/* ═══════════════════════════════════════════════════════════════
   AUTH HELPERS
═══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token") ||
  null;

const authHeaders = () => {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

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
   FAVOURITES HELPERS
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
const onEnter = (fn) => (e) => {
  if (e.key === "Enter" || e.key === " ") fn();
};

const formatDeliveryValue = (v) => {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
};

/* ═══════════════════════════════════════════════════════════════
   SKELETON
═══════════════════════════════════════════════════════════════ */
const Skeleton = memo(function Skeleton() {
  return (
    <div className="pd-page" aria-busy="true" aria-live="polite"
      aria-label="Loading product">
      <div className="pd-sk-hero" />
      <div className="pd-sk-body">
        <div className="pd-sk-line" style={{ width: "35%",  height: 11 }} />
        <div className="pd-sk-line" style={{ width: "90%",  height: 24, marginTop: 8 }} />
        <div className="pd-sk-line" style={{ width: "45%",  height: 32, marginTop: 10 }} />
        <div className="pd-sk-line" style={{ width: "100%", height: 90, marginTop: 20, borderRadius: 12 }} />
        <div className="pd-sk-line" style={{ width: "100%", height: 120, marginTop: 12, borderRadius: 12 }} />
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   DESCRIPTION
═══════════════════════════════════════════════════════════════ */
const Description = memo(function Description({ text }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;

  const LIMIT = 300;
  const isLong = text.length > LIMIT;
  const shown = !isLong || expanded ? text : `${text.slice(0, LIMIT)}…`;

  return (
    <section className="pd-section" aria-label="Description">
      <h3 className="pd-section-h">Description</h3>
      <p className="pd-description">{shown}</p>
      {isLong && (
        <button
          className="pd-expand-btn"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? "Show less ▲" : "Read more ▼"}
        </button>
      )}
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   FEATURES
═══════════════════════════════════════════════════════════════ */
const Features = memo(function Features({ features }) {
  if (!Array.isArray(features) || !features.length) return null;

  return (
    <section className="pd-section" aria-label="Features">
      <h3 className="pd-section-h">Features</h3>
      <ul className="pd-features-list">
        {features.map((f, i) => (
          <li key={i} className="pd-features-item">
            <span className="pd-features-dot" aria-hidden="true">✓</span>
            {f}
          </li>
        ))}
      </ul>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SPECIFICATIONS
═══════════════════════════════════════════════════════════════ */
const Specifications = memo(function Specifications({ specifications }) {
  if (!Array.isArray(specifications) || !specifications.length) return null;

  return (
    <section className="pd-section" aria-label="Specifications">
      <h3 className="pd-section-h">Specifications</h3>
      <table className="pd-specs-table" aria-label="Product specifications">
        <tbody>
          {specifications.map(({ label, value }, i) => (
            <tr key={i} className={i % 2 === 0 ? "pd-specs-row--even" : ""}>
              <th className="pd-specs-label" scope="row">{label}</th>
              <td className="pd-specs-value">{String(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   HIGHLIGHTS
═══════════════════════════════════════════════════════════════ */
const Highlights = memo(function Highlights({ highlights }) {
  if (!Array.isArray(highlights) || !highlights.length) return null;

  return (
    <section className="pd-section" aria-label="Highlights">
      <h3 className="pd-section-h">Highlights</h3>
      <ul className="pd-highlights-list">
        {highlights.map((h, i) => (
          <li key={i} className="pd-highlights-item">
            <span aria-hidden="true">⚡</span>
            {h}
          </li>
        ))}
      </ul>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   FAQ
═══════════════════════════════════════════════════════════════ */
const FAQ = memo(function FAQ({ faq }) {
  const [openIdx, setOpenIdx] = useState(null);
  if (!Array.isArray(faq) || !faq.length) return null;

  return (
    <section className="pd-section" aria-label="FAQ">
      <h3 className="pd-section-h">FAQ</h3>
      <div className="pd-faq">
        {faq.map((item, i) => {
          const isOpen = openIdx === i;
          return (
            <div key={i} className="pd-faq-item">
              <button
                className="pd-faq-q"
                onClick={() => setOpenIdx(isOpen ? null : i)}
                aria-expanded={isOpen}
              >
                <span>{item.question || item.q}</span>
                <span aria-hidden="true">{isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen && (
                <div className="pd-faq-a" role="region">
                  {item.answer || item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   DELIVERY
═══════════════════════════════════════════════════════════════ */
const DeliveryInfo = memo(function DeliveryInfo({ delivery }) {
  if (!delivery || typeof delivery !== "object") return null;

  const rows = Object.entries(delivery).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== ""
  );
  if (!rows.length) return null;

  const prettify = (k) =>
    k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <section className="pd-section" aria-label="Delivery information">
      <h3 className="pd-section-h">Delivery &amp; Shipping</h3>
      <div className="pd-delivery-grid">
        {rows.map(([k, v]) => (
          <div key={k} className="pd-delivery-row">
            <span className="pd-delivery-label">{prettify(k)}</span>
            <span className="pd-delivery-value">{formatDeliveryValue(v)}</span>
          </div>
        ))}
      </div>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   ATTRIBUTES
═══════════════════════════════════════════════════════════════ */
const Attributes = memo(function Attributes({ attributes }) {
  if (!attributes || typeof attributes !== "object") return null;

  const rows = Object.entries(attributes).filter(
    ([, v]) => v !== null && v !== undefined && String(v).trim() !== ""
  );
  if (!rows.length) return null;

  const prettify = (k) =>
    k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <section className="pd-section" aria-label="Additional details">
      <h3 className="pd-section-h">Additional Details</h3>
      <div className="pd-attrs-grid">
        {rows.map(([k, v]) => (
          <div key={k} className="pd-attrs-row">
            <span className="pd-attrs-label">{prettify(k)}</span>
            <span className="pd-attrs-value">{String(v)}</span>
          </div>
        ))}
      </div>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SELLER CARD
═══════════════════════════════════════════════════════════════ */
const SellerCard = memo(function SellerCard({ product, onNavigate }) {
  const name     = product.seller_store || product.seller_name || "Seller";
  const avatar   = product.seller_image ?? null;
  const verified = product.seller_verified;
  const trust    = product.seller_trust;
  const rating   = product.seller_rating;
  const online   = product.seller_online;

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
        <div className="pd-seller-avatar">
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <span aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
          )}
          {online && <span className="pd-seller-online" aria-label="Online" />}
        </div>

        <div className="pd-seller-info">
          <div className="pd-seller-name-row">
            <span className="pd-seller-name">{name}</span>
            {verified && (
              <span className="pd-seller-badge" aria-label="Verified">
                ✔ Verified
              </span>
            )}
          </div>

          <div className="pd-seller-stats">
            {rating > 0 && <span>{Number(rating).toFixed(1)}★</span>}
          </div>

          {trust != null && (
            <div className="pd-trust" aria-label={`Trust: ${trust}%`}>
              <div className="pd-trust-bar" role="presentation">
                <div
                  className="pd-trust-fill"
                  style={{ width: `${Math.min(100, trust)}%` }}
                />
              </div>
              <span className="pd-trust-label">{trust}%</span>
            </div>
          )}
        </div>

        <span className="pd-seller-chevron" aria-hidden="true">›</span>
      </div>
    </section>
  );
});

/* ═══════════════════════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════════════════════ */
const Toast = memo(function Toast({ message, onDismiss, type = "error" }) {
  if (!message) return null;

  return (
    <div
      className={`pd-toast pd-toast--${type}`}
      role="alert"
      aria-live="assertive"
    >
      <span>{message}</span>
      <button
        className="pd-toast-close"
        onClick={onDismiss}
        aria-label="Dismiss"
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
  const { slug }             = useParams();
  const navigate             = useNavigate();
  const { addSingleProduct } = useProductCache();

  /* ── State ──────────────────────────────────────────── */
  const [product,     setProduct]     = useState(null);
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
  const [toast,       setToast]       = useState(null);

  /* ── Refs ───────────────────────────────────────────── */
  const favTimerRef = useRef(null);
  const abortRef    = useRef(null);

  /* ── Derived ────────────────────────────────────────── */
  const userId = useMemo(() => user?.id || readUserId(), [user]);

  const isOwn = useMemo(
    () => !!(userId && product?.seller_id && userId === String(product.seller_id)),
    [userId, product?.seller_id]
  );

  const showToast    = useCallback((message, type = "error") => setToast({ message, type }), []);
  const dismissToast = useCallback(() => setToast(null), []);

  /* ═════════════════════════════════════════════════════
     FETCH — PRODUCT
  ═════════════════════════════════════════════════════ */
  const loadProduct = useCallback(async () => {
    if (!slug || slug === "undefined") {
      setError("Invalid product link.");
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `${API}/product/slug/${encodeURIComponent(slug)}`,
        { signal: controller.signal }
      );

      if (res.status === 404) throw new Error("Product not found");
      if (!res.ok) throw new Error("Could not load product");

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
    return () => {
      abortRef.current?.abort();
      clearTimeout(favTimerRef.current);
    };
  }, [loadProduct]);

  /* ═════════════════════════════════════════════════════
     FETCH — SECONDARY DATA
  ═════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!product?.id) return;

    const { id, seller_id, category_id } = product;

    const fetches = [
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
    ].filter(Boolean);

    Promise.allSettled(fetches);
  }, [product]);

  /* ═════════════════════════════════════════════════════
     FETCH — REVIEWS
  ═════════════════════════════════════════════════════ */
  useEffect(() => {
    setReviews([]);
    setReviewPage(1);
    setReviewStats(null);
    setReviewTotal(0);
  }, [slug]);

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
          page === 1 ? data.reviews || [] : [...prev, ...(data.reviews || [])]
        );
        if (data.stats) {
          setReviewStats(data.stats);
          setReviewTotal(data.stats.total || 0);
        }
      } catch {}
    },
    [slug]
  );

  useEffect(() => {
    loadReviews(1);
  }, [loadReviews]);

  /* ═════════════════════════════════════════════════════
     ACTIONS
  ═════════════════════════════════════════════════════ */

  /* ── Favourite ──────────────────────────────────────── */
  const toggleFav = useCallback(() => {
    if (!product?.id) return;
    const next = !fav;
    setFav(next);

    const favs = loadFavs();
    if (next) favs[product.id] = true;
    else delete favs[product.id];
    saveFavs(favs);

    if (!userId) return;

    clearTimeout(favTimerRef.current);
    favTimerRef.current = setTimeout(() => {
      fetch(`${API}/product/products/${product.id}/favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ user_id: userId }),
      }).catch(() => {
        setFav(!next);
        const rollback = loadFavs();
        if (next) delete rollback[product.id];
        else rollback[product.id] = true;
        saveFavs(rollback);
      });
    }, FAV_DEBOUNCE);
  }, [fav, product, userId]);

  /* ── WhatsApp ───────────────────────────────────────── */
  const openWhatsApp = useCallback(() => {
    if (!product || isOwn) return;

    fetch(`${API}/product/products/${product.id}/click`, {
      method: "POST",
    }).catch(() => {});

    const waNumber = product.whatsapp || product.contact?.whatsapp;
    const waLink   = product.whatsapp_link || product.contact?.whatsapp_link;
    const msg      = encodeURIComponent(
      `Hi, I'm interested in: ${product.title} — ${window.location.href}`
    );

    const url =
      waLink ||
      (waNumber
        ? `https://wa.me/${waNumber.replace(/\D/g, "")}?text=${msg}`
        : null);

    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      showToast("No WhatsApp contact available.", "info");
    }
  }, [product, isOwn, showToast]);

  /* ── Call ────────────────────────────────────────────── */
  const openCall = useCallback(() => {
    if (isOwn) return;
    const phone = product?.phone || product?.contact?.phone;
    if (phone) {
      window.location.href = `tel:${phone}`;
    } else {
      showToast("No phone number available.", "info");
    }
  }, [product, isOwn, showToast]);

  /* ── Chat ────────────────────────────────────────────── */
  const openChat = useCallback(async () => {
    if (!userId) {
      navigate(`/auth?redirect=/product/${encodeURIComponent(slug)}`);
      return;
    }
    if (isOwn || !product?.seller_id) return;

    setChatBusy(true);
    setToast(null);

    try {
      const res = await fetch(`${API}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          buyerId: userId,
          sellerId: product.seller_id,
          productId: product.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Server error");

      const threadId = data.thread_id || data.id;
      if (!threadId) throw new Error("No thread ID returned");

      navigate(`/chat/${threadId}`);
    } catch (err) {
      showToast(err.message || "Could not open chat.");
    } finally {
      setChatBusy(false);
    }
  }, [userId, isOwn, product, slug, navigate, showToast]);

  /* ── Navigate to product ────────────────────────────── */
  const goProduct = useCallback(
    (p) => navigate(`/product/${p.slug || p.id}`),
    [navigate]
  );

  /* ═════════════════════════════════════════════════════
     RENDER
  ═════════════════════════════════════════════════════ */

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <div className="pd-page" role="main">
        <div className="pd-error-wrap" role="alert">
          <span className="pd-error-emoji" aria-hidden="true">🔍</span>
          <h2 className="pd-error-title">{error}</h2>
          <p className="pd-error-sub">
            This listing may have been removed or the link is incorrect.
          </p>
          <Link to="/" className="pd-error-btn">
            Browse Marketplace
          </Link>
        </div>
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="pd-page" role="main">

      {/* ── Toast ────────────────────────────────────── */}
      <Toast
        message={toast?.message}
        type={toast?.type}
        onDismiss={dismissToast}
      />

      {/* ── Top bar: Back · Fav · Share ──────────────── */}
      <ProductDetailTopBar
        product={product}
        fav={fav}
        onBack={() => navigate(-1)}
        onToggleFav={toggleFav}
      />

      {/* ── Trial expiry banner ──────────────────────── */}
      <ProductDetailExpiry product={product} isOwn={isOwn} />

      {/* ── Image gallery (progressive + tap to view) ── */}
      <ProductImageGallery
        images={product.images}
        title={product.title}
        productSlug={slug}
      />

      {/* ── Info: breadcrumb · title · engagement · price · meta ── */}
      <ProductDetailInfo product={product} />

      {/* ── Edit (own listing) ───────────────────────── */}
      {isOwn && (
        <div className="pd-edit-wrap">
          <button
            className="pd-edit-btn"
            onClick={() => navigate(`/listings/edit/${product.id}`)}
            aria-label="Edit this listing"
          >
            Edit Listing
          </button>
        </div>
      )}

      {/* ── Contact strip ────────────────────────────── */}
      <ContactStrip
        product={product}
        userId={userId}
        isOwn={isOwn}
        chatBusy={chatBusy}
        onChat={openChat}
        onWhatsApp={openWhatsApp}
        onCall={openCall}
      />

      {/* ── Description ──────────────────────────────── */}
      <Description text={product.description} />

      {/* ── Features ─────────────────────────────────── */}
      <Features features={product.features} />

      {/* ── Highlights ───────────────────────────────── */}
      <Highlights highlights={product.highlights} />

      {/* ── Specifications ───────────────────────────── */}
      <Specifications specifications={product.specifications} />

      {/* ── Attributes ───────────────────────────────── */}
      <Attributes attributes={product.attributes} />

      {/* ── Delivery ─────────────────────────────────── */}
      <DeliveryInfo delivery={product.delivery} />

      {/* ── FAQ ──────────────────────────────────────── */}
      <FAQ faq={product.faq} />

      {/* ── Seller card ──────────────────────────────── */}
      <SellerCard
        product={product}
        onNavigate={() => navigate(`/seller/${product.seller_id}`)}
      />

      {/* ── Reviews ──────────────────────────────────── */}
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

      {/* ── Safety tips ──────────────────────────────── */}
      <SafetyTips />

      {/* ── More from seller ─────────────────────────── */}
      <MoreFromSeller
        products={moreSeller}
        seller={{
          name: product.seller_store || product.seller_name,
          image: product.seller_image,
        }}
        sellerId={product.seller_id}
        onProductClick={goProduct}
      />

      {/* ── Similar products ─────────────────────────── */}
      <SimilarProducts
        products={similar}
        onProductClick={goProduct}
      />

    </div>
  );
}