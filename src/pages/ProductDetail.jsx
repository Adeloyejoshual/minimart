// src/pages/ProductDetail.jsx
import React, {
  useState, useEffect, useCallback, useMemo,
} from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";
import ProductHeader       from "../components/ProductHeader";
import MasonryGrid         from "../components/MasonryGrid";
import "../styles/ProductDetail.css";

const API = import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";
const PH  = "https://placehold.co/800x600/eae6e0/a8a39d?text=Minimart";

/* ─────────────────────────────────────
   HELPERS
───────────────────────────────────── */
const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

const fmtViews = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "m";
  if (v >= 1_000)     return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return v.toLocaleString();
};

const getImages = (product) => {
  if (!product) return [];
  const imgs = [];
  if (Array.isArray(product.images) && product.images.length) {
    product.images.forEach((img) => {
      const url = typeof img === "string" ? img : img?.url || img?.image_url;
      if (url) imgs.push(url);
    });
  }
  if (!imgs.length && product.main_image)    imgs.push(product.main_image);
  if (!imgs.length && product.thumbnail_url) imgs.push(product.thumbnail_url);
  return imgs.length ? imgs : [PH];
};

const stars = (rating = 0, size = "md") => {
  const r = Math.round(Number(rating));
  return (
    <span className={`pd-stars${size === "sm" ? " pd-star-sm" : ""}`}>
      {"★".repeat(r)}
      <span className="pd-star-empty">{"★".repeat(5 - r)}</span>
    </span>
  );
};

const formatAttrKey = (k) =>
  k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const timeAgo = (date) => {
  if (!date) return "";
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60)      return "just now";
  if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString("en-NG", { month: "short", year: "numeric" });
};

/* ── Auth ── */
function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("minimart_token") ||
    null
  );
}

function authH() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function readUserId() {
  try {
    for (const key of ["user", "minimart_user", "currentUser", "authUser"]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const p  = JSON.parse(raw);
        const id = p?.id || p?.user?.id || p?.data?.id;
        if (id) return String(id);
      } catch {}
    }
    const token = getToken();
    if (token) {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const id = payload?.id || payload?.sub || payload?.userId || payload?.user_id;
      if (id) return String(id);
    }
    return null;
  } catch { return null; }
}

/* ── Favourites ── */
const FAV_KEY  = "minimart_favs";
const loadFavs = () => { try { return JSON.parse(localStorage.getItem(FAV_KEY) || "{}"); } catch { return {}; } };
const saveFavs = (f)  => { try { localStorage.setItem(FAV_KEY, JSON.stringify(f)); } catch {} };

/* ── Start chat — creates thread then returns threadId ── */
async function startChatThread({ buyerId, sellerId, productId }) {
  if (!buyerId || !sellerId)        throw new Error("Missing buyer or seller ID");
  if (buyerId === sellerId)         throw new Error("Cannot chat with yourself");

  const res = await fetch(`${API}/conversations`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", ...authH() },
    body:    JSON.stringify({ buyerId, sellerId, productId: productId || null }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);

  const threadId = data.thread_id || data.id;
  if (!threadId) throw new Error("No thread ID returned");

  return threadId;
}

/* ─────────────────────────────────────
   SKELETON
───────────────────────────────────── */
const Skel = ({ style }) => <div className="pd-skeleton" style={style} />;
function LoadingSkeleton() {
  return (
    <div className="pd-page">
      <Skel style={{ width:"100%", height:300 }} />
      <div style={{ padding:16, display:"flex", flexDirection:"column", gap:12 }}>
        <Skel style={{ width:"40%", height:13 }} />
        <Skel style={{ width:"90%", height:22 }} />
        <Skel style={{ width:"55%", height:32 }} />
        <Skel style={{ width:"100%", height:80, marginTop:8 }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────
   FAQ ITEM
───────────────────────────────────── */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pd-faq-item">
      <button className="pd-faq-q" onClick={() => setOpen((v) => !v)}>
        {q}
        <span className={`pd-faq-chevron${open ? " open" : ""}`}>▼</span>
      </button>
      {open && <div className="pd-faq-a">{a}</div>}
    </div>
  );
}

/* ─────────────────────────────────────
   REVIEW FORM
───────────────────────────────────── */
function ReviewForm({ slug, userId, onSubmitted }) {
  const navigate      = useNavigate();
  const [rating,      setRating]      = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment,     setComment]     = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState(null);
  const [done,        setDone]        = useState(false);

  if (!userId) {
    return (
      <div className="pd-review-login-prompt">
        <p className="pd-review-login-text">Log in to leave a review</p>
        <button
          className="pd-review-login-btn"
          onClick={() => navigate(`/login?redirect=${encodeURIComponent(`/product/${slug}`)}`)}
        >
          Log in
        </button>
      </div>
    );
  }

  if (done) {
    return <div className="pd-review-done">Your review was submitted. Thank you!</div>;
  }

  const handleSubmit = async () => {
    if (!rating) { setError("Please select a rating"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res  = await fetch(`${API}/product/slug/${encodeURIComponent(slug)}/reviews`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...authH() },
        body:    JSON.stringify({ user_id: userId, rating, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit");
      setDone(true);
      onSubmitted?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pd-review-form">
      <div className="pd-review-form-title">Write a review</div>
      <div className="pd-star-picker">
        {[1,2,3,4,5].map((n) => (
          <button
            key={n}
            className={`pd-star-pick${(hoverRating || rating) >= n ? " active" : ""}`}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => setRating(n)}
            aria-label={`${n} star`}
          >★</button>
        ))}
        {rating > 0 && (
          <span className="pd-star-label">
            {["","Poor","Fair","Good","Very Good","Excellent"][rating]}
          </span>
        )}
      </div>
      <textarea
        className="pd-review-textarea"
        placeholder="Share your experience… (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={500}
      />
      <div className="pd-review-char">{comment.length}/500</div>
      {error && <div className="pd-review-error">{error}</div>}
      <button
        className="pd-review-submit"
        onClick={handleSubmit}
        disabled={submitting || !rating}
      >
        {submitting ? "Submitting…" : "Submit Review"}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────
   SAFETY TIPS
───────────────────────────────────── */
const SAFETY_TIPS = [
  "Do not pay in advance, including for delivery.",
  "Arrange to meet sellers in a safe, public location.",
  "Carefully inspect the item before purchase.",
  "Ensure the item you receive is the same one you inspected.",
  "Only make payment when you are fully satisfied.",
];
function SafetyTips() {
  return (
    <div className="pd-section pd-safety">
      <div className="pd-section-title pd-safety-title">Safety Tips</div>
      <div className="pd-safety-list">
        {SAFETY_TIPS.map((tip, i) => (
          <div key={i} className="pd-safety-item">
            <span className="pd-safety-dot">•</span>
            <span>{tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════ */
export default function ProductDetail({ user }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addSingleProduct } = useProductCache();

  /* ── state ── */
  const [product,        setProduct]        = useState(null);
  const [seller,         setSeller]         = useState(null);
  const [similar,        setSimilar]        = useState([]);
  const [sellerProducts, setSellerProducts] = useState([]);
  const [reviews,        setReviews]        = useState([]);
  const [reviewStats,    setReviewStats]    = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [activeImg,      setActiveImg]      = useState(0);
  const [lightbox,       setLightbox]       = useState(false);
  const [descExpanded,   setDescExpanded]   = useState(false);
  const [fav,            setFav]            = useState(false);
  const [reviewPage,     setReviewPage]     = useState(1);
  const [reviewTotal,    setReviewTotal]    = useState(0);
  const [chatLoading,    setChatLoading]    = useState(false); // ← NEW

  /* ── current user ── */
  const userId = useMemo(() => {
    // Prefer user prop (passed from App), fallback to localStorage decode
    return user?.id || readUserId();
  }, [user]);

  /* ── derived ── */
  const images = useMemo(() => getImages(product), [product]);

  const attrs = useMemo(() => {
    const raw = product?.attributes;
    if (!raw || typeof raw !== "object") return [];
    return Object.entries(raw).filter(([, v]) => v != null && v !== "");
  }, [product]);

  const highlights = useMemo(() => {
    const h = product?.highlights;
    return Array.isArray(h) ? h.filter(Boolean) : [];
  }, [product]);

  const faqs = useMemo(() => {
    const f = product?.faq;
    return Array.isArray(f) ? f.filter((i) => i?.q && i?.a) : [];
  }, [product]);

  const specs = useMemo(() => {
    const s = product?.specifications;
    if (!s || typeof s !== "object") return [];
    return Object.entries(s).filter(([, v]) => v != null && v !== "");
  }, [product]);

  /* ══════════════════════════════════
     FETCH PRODUCT
  ══════════════════════════════════ */
  const fetchProduct = useCallback(async () => {
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
      addSingleProduct(data);
      setFav(!!loadFavs()[data.id]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [slug, addSingleProduct]);

  useEffect(() => { fetchProduct(); }, [fetchProduct]);

  /* ── Track view ── */
  useEffect(() => {
    if (!product?.id) return;
    fetch(`${API}/product/products/${product.id}/view`, { method: "POST" }).catch(() => {});
  }, [product?.id]);

  /* ── Fetch seller ── */
  useEffect(() => {
    if (!product?.seller_id) return;
    fetch(`${API}/seller/${product.seller_id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setSeller(d.seller || d); })
      .catch(() => {});
  }, [product?.seller_id]);

  /* ── Fetch seller's other products ── */
  useEffect(() => {
    if (!product?.seller_id || !product?.id) return;
    const qs = new URLSearchParams({
      seller_id: product.seller_id,
      exclude:   product.id,
      limit:     "10",
    });
    fetch(`${API}/product/by-seller?${qs}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setSellerProducts(Array.isArray(d) ? d : (d.products || [])))
      .catch(() => {});
  }, [product?.seller_id, product?.id]);

  /* ── Fetch reviews ── */
  const fetchReviews = useCallback(async (page = 1) => {
    if (!slug) return;
    try {
      const res  = await fetch(
        `${API}/product/slug/${encodeURIComponent(slug)}/reviews?limit=5&page=${page}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setReviews((prev) =>
        page === 1 ? (data.reviews || []) : [...prev, ...(data.reviews || [])]
      );
      const s = data.stats || null;
      setReviewStats(s ? { ...s, avg_rating: s.average } : null);
      setReviewTotal(data.stats?.total || 0);
    } catch {}
  }, [slug]);

  useEffect(() => { fetchReviews(1); }, [fetchReviews]);

  /* ── Fetch similar ── */
  useEffect(() => {
    if (!product?.id || !product?.category_id) return;
    const qs = new URLSearchParams({
      category_id: product.category_id,
      exclude:     product.id,
      limit:       "10",
    });
    fetch(`${API}/product/similar?${qs}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setSimilar(Array.isArray(d) ? d : (d.products || [])))
      .catch(() => {});
  }, [product?.id, product?.category_id]);

  /* ── Lightbox keys ── */
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

  /* ── Favourite ── */
  const toggleFav = useCallback(async () => {
    if (!product?.id) return;
    const next = !fav;
    setFav(next);
    const favs = loadFavs();
    if (next) { favs[product.id] = true; } else { delete favs[product.id]; }
    saveFavs(favs);
    if (userId) {
      fetch(`${API}/products/${product.id}/favorite`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ user_id: userId }),
      }).catch(() => {});
    }
  }, [fav, product, userId]);

  /* ══════════════════════════════════
     CONTACT ACTIONS
  ══════════════════════════════════ */
  const contactPhone = product?.phone || product?.contact?.phone;
  const waNumber     = product?.whatsapp || product?.contact?.whatsapp;
  const waLink       = product?.whatsapp_link || product?.contact?.whatsapp_link;

  /* seller could be own listing */
  const isOwnProduct = userId && product?.seller_id && userId === product.seller_id;

  const hasContact = !!(waNumber || waLink || contactPhone || product?.seller_id);

  const openWhatsApp = useCallback(() => {
    if (!product) return;
    fetch(`${API}/products/${product.id}/click`, { method: "POST" }).catch(() => {});
    const msg = encodeURIComponent(
      `Hi, I'm interested in: ${product.title} — ${window.location.href}`
    );
    const url = waLink ||
      (waNumber ? `https://wa.me/${waNumber.replace(/\D/g, "")}?text=${msg}` : null);
    if (url) window.open(url, "_blank");
  }, [product, waLink, waNumber]);

  const openCall = useCallback(() => {
    if (contactPhone) window.location.href = `tel:${contactPhone}`;
  }, [contactPhone]);

  /* ── Open chat — creates real thread first ── */
  const openChat = useCallback(async () => {
    if (!userId) {
      navigate(`/login?redirect=${encodeURIComponent(`/product/${slug}`)}`);
      return;
    }
    if (isOwnProduct) return;
    if (!product?.seller_id) return;

    setChatLoading(true);
    try {
      const threadId = await startChatThread({
        buyerId:   userId,
        sellerId:  product.seller_id,
        productId: product.id,
      });
      navigate(`/chat/${threadId}`);
    } catch (err) {
      console.error("openChat failed:", err.message);
      alert("Could not open chat: " + err.message);
    } finally {
      setChatLoading(false);
    }
  }, [userId, isOwnProduct, product, slug, navigate]);

  /* ── Delivery ── */
  const delivery = useMemo(() => {
    const d = product?.delivery;
    if (!d || typeof d !== "object" || !d.available) return null;
    return d;
  }, [product]);

  /* ══ RENDER ══ */
  if (loading) return <LoadingSkeleton />;

  if (error) return (
    <div className="pd-page">
      <div className="pd-error">
        <div className="pd-error-emoji">🔍</div>
        <div className="pd-error-title">{error}</div>
        <div className="pd-error-sub">
          The listing may have been removed or the link is incorrect.
        </div>
        <Link className="pd-error-link" to="/">Browse Marketplace</Link>
      </div>
    </div>
  );

  if (!product) return null;

  const descWords      = (product.description || "").split(" ");
  const needsToggle    = descWords.length > 60;
  const hasMoreReviews = reviews.length < reviewTotal;

  return (
    <>
      <ProductHeader
        product={product}
        seller={seller}
        reviewStats={reviewStats ? {
          avg_rating: reviewStats.average,
          total:      reviewStats.total,
        } : null}
        onFavorite={toggleFav}
        isFavorited={fav}
      />

      <div className="pd-page">

        {/* ── GALLERY ── */}
        <div className="pd-gallery">
          <div className="pd-main-img-wrap" onClick={() => setLightbox(true)}>
            {product.is_promoted && <span className="pd-promoted-badge">Featured</span>}
            <img
              key={images[activeImg]}
              className="pd-main-img"
              src={images[activeImg]}
              alt={product.title}
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
            {images.length > 1 && (
              <span className="pd-img-counter">{activeImg + 1} / {images.length}</span>
            )}
          </div>

          {images.length > 1 && (
            <div className="pd-thumbs">
              {images.map((src, i) => (
                <div
                  key={i}
                  className={`pd-thumb${activeImg === i ? " active" : ""}`}
                  onClick={() => setActiveImg(i)}
                >
                  <img src={src} alt={`Image ${i + 1}`} loading="lazy" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pd-body">

          {/* ── TITLE BLOCK ── */}
          <div className="pd-title-block">
            {product.category_name && (
              <div className="pd-category-crumb">
                {product.category_name}
                {product.subcategory_name && ` › ${product.subcategory_name}`}
              </div>
            )}
            <h1 className="pd-title">{product.title}</h1>
            <div className="pd-price-row">
              <span className="pd-price">{naira(product.price)}</span>
              {product.is_promoted && <span className="pd-price-note">Promoted listing</span>}
            </div>
            <div className="pd-stats-row">
              <span className="pd-stat">{fmtViews(product.views)} views</span>
              {product.favorites_count > 0 && (
                <span className="pd-stat">{product.favorites_count} saved</span>
              )}
              <span className="pd-stat">{timeAgo(product.created_at)}</span>
            </div>
          </div>

          {/* ── DESCRIPTION ── */}
          {product.description && (
            <div className="pd-section">
              <div className="pd-section-title">About this product</div>
              <p className="pd-desc">
                {needsToggle && !descExpanded
                  ? descWords.slice(0, 60).join(" ")
                  : product.description}
                {needsToggle && !descExpanded && (
                  <span className="pd-desc-ellipsis">
                    …
                    <button className="pd-desc-toggle" onClick={() => setDescExpanded(true)}>
                      read more
                    </button>
                  </span>
                )}
              </p>
              {needsToggle && descExpanded && (
                <button className="pd-desc-toggle" onClick={() => setDescExpanded(false)}>
                  Show less
                </button>
              )}
            </div>
          )}

          {/* ── FEATURES ── */}
          {highlights.length > 0 && (
            <div className="pd-section">
              <div className="pd-section-title">Features</div>
              <div className="pd-features-list">
                {highlights.map((h, i) => (
                  <div key={i} className="pd-feature-item">
                    <span className="pd-feature-check">✓</span>
                    <span className="pd-feature-text">
                      {typeof h === "string" ? h : h.text || JSON.stringify(h)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── DETAILS ── */}
          {attrs.length > 0 && (
            <div className="pd-section">
              <div className="pd-section-title">Details</div>
              <div className="pd-attrs-stacked">
                {attrs.map(([k, v]) => (
                  <div key={k} className="pd-attr-stack-item">
                    <span className="pd-attr-stack-key">{formatAttrKey(k)}</span>
                    <span className="pd-attr-stack-val">
                      {Array.isArray(v) ? v.join(", ") : String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SPECIFICATIONS ── */}
          {specs.length > 0 && (
            <div className="pd-section">
              <div className="pd-section-title">Specifications</div>
              <div className="pd-attrs-stacked">
                {specs.map(([k, v]) => (
                  <div key={k} className="pd-attr-stack-item">
                    <span className="pd-attr-stack-key">{formatAttrKey(k)}</span>
                    <span className="pd-attr-stack-val">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── LOCATION ── */}
          {(product.location_city || product.location_state) && (
            <div className="pd-section">
              <div className="pd-section-title">Location</div>
              <div className="pd-location-text">
                {product.location_city && (
                  <span className="pd-location-city">{product.location_city}</span>
                )}
                {product.location_city && product.location_state && (
                  <span className="pd-location-sep">, </span>
                )}
                {product.location_state && (
                  <span className="pd-location-state">{product.location_state}</span>
                )}
              </div>
            </div>
          )}

          {/* ── DELIVERY ── */}
          {delivery && (
            <div className="pd-section">
              <div className="pd-section-title">Delivery</div>
              <div className="pd-attrs-stacked">
                <div className="pd-attr-stack-item">
                  <span className="pd-attr-stack-key">Status</span>
                  <span className="pd-attr-stack-val">
                    Available
                    {delivery.duration?.from && delivery.duration?.to && (
                      <> — {delivery.duration.from}–{delivery.duration.to} days</>
                    )}
                  </span>
                </div>
                {delivery.fee != null && (
                  <div className="pd-attr-stack-item">
                    <span className="pd-attr-stack-key">Fee</span>
                    <span className="pd-attr-stack-val">
                      {Number(delivery.fee) === 0 ? "Free" : naira(delivery.fee)}
                    </span>
                  </div>
                )}
                {delivery.note && (
                  <div className="pd-attr-stack-item">
                    <span className="pd-attr-stack-key">Note</span>
                    <span className="pd-attr-stack-val">{delivery.note}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── SELLER ── */}
          {(seller || product.seller_id) && (
            <div className="pd-section">
              <div className="pd-section-title">Seller</div>
              <div
                className="pd-seller"
                onClick={() => navigate(`/seller/${product.seller_id}`)}
                role="button"
                tabIndex={0}
              >
                {seller?.profile_image || seller?.store_logo ? (
                  <img
                    className="pd-seller-avatar"
                    src={seller.profile_image || seller.store_logo}
                    alt={seller.name}
                    loading="lazy"
                  />
                ) : (
                  <div className="pd-seller-avatar-fallback">
                    {(seller?.name || "S").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="pd-seller-info">
                  <div className="pd-seller-name">
                    {seller?.store_name || seller?.name || "Seller"}
                    {seller?.verified && <span className="pd-seller-vfd">Verified</span>}
                  </div>
                  <div className="pd-seller-meta">
                    {seller?.products_count > 0 && (
                      <span>{seller.products_count} listings</span>
                    )}
                    {seller?.total_sales > 0 && (
                      <span>· {Number(seller.total_sales).toLocaleString()} sales</span>
                    )}
                    {seller?.rating > 0 && (
                      <span>· {Number(seller.rating).toFixed(1)} ★</span>
                    )}
                  </div>
                  {seller?.trust_score != null && (
                    <div className="pd-seller-trust">
                      <div className="pd-trust-track">
                        <div
                          className="pd-trust-fill"
                          style={{ width: `${seller.trust_score}%` }}
                        />
                      </div>
                      <span className="pd-trust-val">{seller.trust_score}% trust</span>
                    </div>
                  )}
                </div>
                <span className="pd-seller-arrow">›</span>
              </div>
            </div>
          )}

          {/* ── CONTACT ── */}
          {hasContact && !isOwnProduct && (
            <div className="pd-section">
              <div className="pd-section-title">Contact Seller</div>
              <div className="pd-contact-list">

                {/* Chat button — creates real thread */}
                {product.seller_id && (
                  <button
                    className="pd-contact-btn pd-contact-chat"
                    onClick={openChat}
                    disabled={chatLoading}
                  >
                    {chatLoading ? (
                      <>
                        <span style={{
                          display:"inline-block", width:14, height:14,
                          border:"2px solid rgba(255,255,255,.3)",
                          borderTop:"2px solid #fff",
                          borderRadius:"50%",
                          animation:"spin .7s linear infinite",
                          marginRight:6,
                          verticalAlign:"middle",
                        }}/>
                        Opening chat…
                      </>
                    ) : (
                      <>
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2"
                          strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        Chat with Seller
                      </>
                    )}
                  </button>
                )}

                {(waNumber || waLink) && (
                  <button
                    className="pd-contact-btn pd-contact-whatsapp"
                    onClick={openWhatsApp}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.857L.057 23.571l5.89-1.548A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.028-1.378l-.36-.215-3.734.98 1.001-3.654-.235-.374A9.818 9.818 0 012.182 12C2.182 6.562 6.562 2.182 12 2.182S21.818 6.562 21.818 12 17.438 21.818 12 21.818z"/>
                    </svg>
                    Chat on WhatsApp
                  </button>
                )}

                {contactPhone && (
                  <button
                    className="pd-contact-btn pd-contact-call"
                    onClick={openCall}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 1.2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.73 16z"/>
                    </svg>
                    Call Seller
                  </button>
                )}

              </div>
            </div>
          )}

          {/* ── FAQ ── */}
          {faqs.length > 0 && (
            <div className="pd-section">
              <div className="pd-section-title">FAQs</div>
              <div className="pd-faq">
                {faqs.map((item, i) => (
                  <FaqItem key={i} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
          )}

          {/* ── REVIEWS ── */}
          <div className="pd-section">
            <div className="pd-section-title">
              Reviews
              {reviewStats?.total > 0 && (
                <span className="pd-reviews-count-badge">{reviewStats.total}</span>
              )}
            </div>

            {reviewStats?.total > 0 && (
              <div className="pd-review-summary">
                <div className="pd-review-avg-block">
                  <div className="pd-review-score">
                    {Number(reviewStats.average || 0).toFixed(1)}
                  </div>
                  {stars(reviewStats.average)}
                  <div className="pd-review-total-txt">
                    {reviewStats.total} review{reviewStats.total !== 1 ? "s" : ""}
                  </div>
                </div>
                <div className="pd-review-bars">
                  {[5,4,3,2,1].map((n) => {
                    const key   = ["","one","two","three","four","five"][n] + "_star";
                    const count = reviewStats[key] || 0;
                    const pct   = reviewStats.total > 0
                      ? (count / reviewStats.total) * 100 : 0;
                    return (
                      <div key={n} className="pd-review-bar-row">
                        <span className="pd-review-bar-label">{n}</span>
                        <div className="pd-review-bar-track">
                          <div className="pd-review-bar-fill" style={{ width:`${pct}%` }}/>
                        </div>
                        <span className="pd-review-bar-count">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {reviews.length > 0 ? (
              <div className="pd-review-list">
                {reviews.map((r, i) => (
                  <div key={r.id || i} className="pd-review-item">
                    <div className="pd-review-header">
                      <div className="pd-review-author-wrap">
                        <div className="pd-review-avatar">
                          {r.author_image
                            ? <img src={r.author_image} alt={r.author} />
                            : (r.author || "A").charAt(0).toUpperCase()
                          }
                        </div>
                        <div>
                          <div className="pd-review-author">{r.author || "Anonymous"}</div>
                          <div className="pd-review-date">{timeAgo(r.created_at)}</div>
                        </div>
                      </div>
                      {stars(r.rating, "sm")}
                    </div>
                    {r.comment && <p className="pd-review-text">{r.comment}</p>}
                  </div>
                ))}
                {hasMoreReviews && (
                  <button
                    className="pd-reviews-load-more"
                    onClick={() => {
                      const n = reviewPage + 1;
                      setReviewPage(n);
                      fetchReviews(n);
                    }}
                  >
                    Load more reviews
                  </button>
                )}
              </div>
            ) : (
              <div className="pd-no-reviews">No reviews yet. Be the first!</div>
            )}

            <ReviewForm
              slug={slug}
              userId={userId}
              onSubmitted={() => { setReviewPage(1); fetchReviews(1); }}
            />
          </div>

          <SafetyTips />

        </div>

        {/* ── SIMILAR ── */}
        {similar.length > 0 && (
          <div className="pd-similar">
            <div className="pd-similar-title">You may also like</div>
            <MasonryGrid
              products={similar}
              onView={() => {}}
              onClick={(p) => navigate(`/product/${p.slug || p.id}`)}
            />
          </div>
        )}

        {/* ── MORE FROM SELLER ── */}
        {sellerProducts.length > 0 && (
          <div className="pd-similar">
            <div className="pd-similar-title">
              More from {seller?.store_name || seller?.name || "this seller"}
            </div>
            <MasonryGrid
              products={sellerProducts}
              onView={() => {}}
              onClick={(p) => navigate(`/product/${p.slug || p.id}`)}
            />
            <button
              className="pd-seller-see-all"
              onClick={() => navigate(`/seller/${product.seller_id}`)}
            >
              See all listings
            </button>
          </div>
        )}

      </div>

      {/* ── LIGHTBOX ── */}
      {lightbox && (
        <div className="pd-lightbox" onClick={() => setLightbox(false)}>
          <button
            className="pd-lightbox-close"
            onClick={() => setLightbox(false)}
            aria-label="Close"
          >✕</button>

          {images.length > 1 && (
            <button
              className="pd-lightbox-prev"
              onClick={(e) => {
                e.stopPropagation();
                setActiveImg((i) => (i - 1 + images.length) % images.length);
              }}
              aria-label="Previous"
            >‹</button>
          )}

          <img
            className="pd-lightbox-img"
            src={images[activeImg]}
            alt={product.title}
            onClick={(e) => e.stopPropagation()}
          />

          {images.length > 1 && (
            <button
              className="pd-lightbox-next"
              onClick={(e) => {
                e.stopPropagation();
                setActiveImg((i) => (i + 1) % images.length);
              }}
              aria-label="Next"
            >›</button>
          )}
        </div>
      )}

      {/* spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}