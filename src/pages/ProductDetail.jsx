import React, {
  useState, useEffect, useCallback,
  useRef, useMemo,
} from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";
import "../styles/ProductDetail.css";

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const API = import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";
const PH  = "https://placehold.co/800x600/eae6e0/a8a39d?text=Minimart";

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

const getImages = (product) => {
  if (!product) return [];
  const imgs = [];
  if (Array.isArray(product.images) && product.images.length) {
    product.images.forEach((img) => {
      const url = typeof img === "string" ? img : img?.url || img?.image_url;
      if (url) imgs.push(url);
    });
  }
  if (!imgs.length && product.main_image)   imgs.push(product.main_image);
  if (!imgs.length && product.thumbnail_url) imgs.push(product.thumbnail_url);
  return imgs.length ? imgs : [PH];
};

const stars = (rating = 0, size = "md") => {
  const r   = Math.round(Number(rating));
  const cls = size === "sm" ? "pd-star-sm" : "pd-star";
  return (
    <span className={`pd-stars ${cls}`}>
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

/** Persist favorites in localStorage keyed by product id */
const FAV_KEY = "minimart_favs";
const loadFavs = () => {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || "{}"); }
  catch { return {}; }
};
const saveFavs = (favs) => {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); } catch {}
};

/* ─────────────────────────────────────────────
   SKELETON
───────────────────────────────────────────── */
const Skel = ({ className = "" }) => <div className={`pd-skeleton ${className}`} />;

function LoadingSkeleton() {
  return (
    <div className="pd-page">
      <Skel className="pd-skel-gallery" />
      <div className="pd-body">
        <div className="pd-title-block" style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <Skel className="pd-skel-line sm" />
          <Skel className="pd-skel-line lg" />
          <Skel className="pd-skel-line lg" style={{ height:36, width:"55%" }} />
        </div>
        <div className="pd-section" style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <Skel className="pd-skel-line md" />
          <Skel className="pd-skel-line" style={{ height:80, width:"100%" }} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   FAQ ITEM
───────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────
   REVIEW FORM
───────────────────────────────────────────── */
function ReviewForm({ slug, userId, onSubmitted }) {
  const [rating,      setRating]      = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment,     setComment]     = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState(null);

  const handleSubmit = async () => {
    if (!rating) { setError("Please select a rating"); return; }
    if (!userId) { setError("Please log in to leave a review"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/product/slug/${encodeURIComponent(slug)}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, rating, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to submit");
      setRating(0);
      setComment("");
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

      {/* Star picker */}
      <div className="pd-star-picker">
        {[1,2,3,4,5].map((n) => (
          <button
            key={n}
            className={`pd-star-pick${(hoverRating || rating) >= n ? " active" : ""}`}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => setRating(n)}
            aria-label={`${n} star`}
          >
            ★
          </button>
        ))}
        {rating > 0 && (
          <span className="pd-star-label">
            {["","Poor","Fair","Good","Very Good","Excellent"][rating]}
          </span>
        )}
      </div>

      <textarea
        className="pd-review-textarea"
        placeholder="Share your experience with this product... (optional)"
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

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function ProductDetail() {
  const { slug }   = useParams();
  const navigate   = useNavigate();
  const { addSingleProduct } = useProductCache();

  /* ── state ── */
  const [product,      setProduct]      = useState(null);
  const [seller,       setSeller]       = useState(null);
  const [similar,      setSimilar]      = useState([]);
  const [reviews,      setReviews]      = useState([]);
  const [reviewStats,  setReviewStats]  = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [activeImg,    setActiveImg]    = useState(0);
  const [lightbox,     setLightbox]     = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [fav,          setFav]          = useState(false);
  const [viewTracked,  setViewTracked]  = useState(false);
  const [reviewPage,   setReviewPage]   = useState(1);
  const [reviewTotal,  setReviewTotal]  = useState(0);

  // Pull userId from your auth store — adjust as needed
  const userId = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("minimart_user") || "null")?.id || null; }
    catch { return null; }
  }, []);

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

  /* ── FETCH PRODUCT ── */
  const fetchProduct = useCallback(async () => {
    if (!slug || slug === "undefined") {
      setError("Invalid product link.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API}/product/slug/${encodeURIComponent(slug)}`);
      if (res.status === 404) throw new Error("Product not found");
      if (!res.ok)            throw new Error("Could not load product");
      const data = await res.json();
      setProduct(data);
      addSingleProduct(data);

      // Restore favorite state from localStorage
      const favs = loadFavs();
      setFav(!!favs[data.id]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [slug, addSingleProduct]);

  useEffect(() => { fetchProduct(); }, [fetchProduct]);

  /* ── TRACK VIEW ── */
  useEffect(() => {
    if (!product?.id || viewTracked) return;
    fetch(`${API}/products/${product.id}/view`, { method: "POST" }).catch(() => {});
    setViewTracked(true);
  }, [product, viewTracked]);

  /* ── FETCH SELLER ── */
  useEffect(() => {
    if (!product?.seller_id) return;
    fetch(`${API}/users/${product.seller_id}/public`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setSeller(data); })
      .catch(() => {});
  }, [product?.seller_id]);

  /* ── FETCH REVIEWS ── */
  const fetchReviews = useCallback(async (page = 1) => {
    if (!slug) return;
    try {
      const res  = await fetch(`${API}/product/slug/${encodeURIComponent(slug)}/reviews?limit=5&page=${page}`);
      if (!res.ok) return;
      const data = await res.json();
      if (page === 1) {
        setReviews(data.reviews || []);
      } else {
        setReviews((prev) => [...prev, ...(data.reviews || [])]);
      }
      setReviewStats(data.stats || null);
      setReviewTotal(data.stats?.total || 0);
    } catch {}
  }, [slug]);

  useEffect(() => { fetchReviews(1); }, [fetchReviews]);

  /* ── FETCH SIMILAR ── */
  useEffect(() => {
    if (!product?.id) return;
    const qs = new URLSearchParams({
      category_id: product.category_id || "",
      exclude:     product.id,
      limit:       "10",
    });
    fetch(`${API}/products/similar?${qs}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setSimilar(Array.isArray(data) ? data : (data.products || [])))
      .catch(() => {});
  }, [product?.id, product?.category_id]);

  /* ── LIGHTBOX KEYS ── */
  useEffect(() => {
    if (!lightbox) return;
    const h = (e) => {
      if (e.key === "Escape")      setLightbox(false);
      if (e.key === "ArrowRight")  setActiveImg((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft")   setActiveImg((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [lightbox, images.length]);

  /* ── TOGGLE FAVORITE ── */
  const toggleFav = useCallback(async () => {
    if (!product?.id) return;
    const next = !fav;
    setFav(next);

    // Persist locally immediately
    const favs = loadFavs();
    if (next) { favs[product.id] = true; }
    else      { delete favs[product.id]; }
    saveFavs(favs);

    // Sync with server if logged in
    if (userId) {
      fetch(`${API}/products/${product.id}/favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      }).catch(() => {});
    }
  }, [fav, product, userId]);

  /* ── CONTACT ── */
  const contactPhone = product?.phone || product?.contact?.phone;
  const waNumber     = product?.whatsapp || product?.contact?.whatsapp;
  const waLink       = product?.whatsapp_link || product?.contact?.whatsapp_link;

  const openWhatsApp = () => {
    fetch(`${API}/products/${product.id}/click`, { method: "POST" }).catch(() => {});
    const msg = encodeURIComponent(`Hi, I'm interested in your listing: ${product.title} — ${window.location.href}`);
    const url = waLink || (waNumber ? `https://wa.me/${waNumber.replace(/\D/g, "")}?text=${msg}` : null);
    if (url) window.open(url, "_blank");
  };

  const openCall = () => {
    if (contactPhone) window.location.href = `tel:${contactPhone}`;
  };

  /* ── DELIVERY ── */
  const delivery = useMemo(() => {
    const d = product?.delivery;
    if (!d || typeof d !== "object" || !d.available) return null;
    return d;
  }, [product]);

  /* ─────────────── RENDER ─────────────────── */
  if (loading)  return <LoadingSkeleton />;

  if (error) {
    return (
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
  }

  if (!product) return null;

  const descWords   = (product.description || "").split(" ");
  const descShort   = descWords.slice(0, 60).join(" ");
  const descLong    = product.description || "";
  const needsToggle = descWords.length > 60;

  const REVIEW_PAGE_SIZE = 5;
  const hasMoreReviews   = reviews.length < reviewTotal;

  return (
    <>
      {/* ── STICKY HEADER ── */}
      <div className="pd-header">
        <button className="pd-back" onClick={() => navigate(-1)} aria-label="Back">
          ←
        </button>
        <div className="pd-header-actions">
          <button
            className={`pd-action-btn${fav ? " fav-on" : ""}`}
            onClick={toggleFav}
            aria-label={fav ? "Remove from saved" : "Save listing"}
          >
            {fav ? "♥" : "♡"}
          </button>
          <button
            className="pd-action-btn"
            onClick={() => navigator.share?.({ title: product.title, url: window.location.href })}
            aria-label="Share"
          >
            ↑
          </button>
        </div>
      </div>

      <div className="pd-page">

        {/* ── GALLERY ── */}
        <div className="pd-gallery">
          <div className="pd-main-img-wrap" onClick={() => setLightbox(true)}>
            {product.is_promoted && (
              <span className="pd-promoted-badge">Featured</span>
            )}
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
              <span className="pd-img-counter">
                {activeImg + 1} / {images.length}
              </span>
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
              {product.is_promoted && (
                <span className="pd-price-note">Promoted listing</span>
              )}
            </div>

            {/* Stats — vertical list, no icons */}
            <div className="pd-stats-list">
              <div className="pd-stat-item">
                <span className="pd-stat-label">Views</span>
                <span className="pd-stat-value">{Number(product.views || 0).toLocaleString()}</span>
              </div>
              {product.clicks_count > 0 && (
                <div className="pd-stat-item">
                  <span className="pd-stat-label">Clicks</span>
                  <span className="pd-stat-value">{Number(product.clicks_count).toLocaleString()}</span>
                </div>
              )}
              {product.favorites_count > 0 && (
                <div className="pd-stat-item">
                  <span className="pd-stat-label">Saved</span>
                  <span className="pd-stat-value">{product.favorites_count}</span>
                </div>
              )}
              <div className="pd-stat-item">
                <span className="pd-stat-label">Posted</span>
                <span className="pd-stat-value">{timeAgo(product.created_at)}</span>
              </div>
            </div>
          </div>

          {/* ── DESCRIPTION ── */}
          {product.description && (
            <div className="pd-section">
              <div className="pd-section-title">About this product</div>
              <p className="pd-desc">
                {needsToggle && !descExpanded ? `${descShort}` : descLong}
                {needsToggle && !descExpanded && (
                  <span className="pd-desc-ellipsis">
                    {"..."}
                    <button
                      className="pd-desc-toggle"
                      onClick={() => setDescExpanded(true)}
                    >
                      read more
                    </button>
                  </span>
                )}
              </p>
              {needsToggle && descExpanded && (
                <button
                  className="pd-desc-toggle"
                  onClick={() => setDescExpanded(false)}
                >
                  Show less
                </button>
              )}
            </div>
          )}

          {/* ── HIGHLIGHTS ── */}
          {highlights.length > 0 && (
            <div className="pd-section">
              <div className="pd-section-title">Highlights</div>
              <div className="pd-highlights-list">
                {highlights.map((h, i) => (
                  <div key={i} className="pd-highlight-item">
                    <span className="pd-highlight-dot" />
                    <span>{typeof h === "string" ? h : h.text || JSON.stringify(h)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ATTRIBUTES ── */}
          {attrs.length > 0 && (
            <div className="pd-section">
              <div className="pd-section-title">Details</div>
              <div className="pd-attrs-list">
                {attrs.map(([k, v]) => (
                  <div key={k} className="pd-attr-row">
                    <span className="pd-attr-key">{formatAttrKey(k)}</span>
                    <span className="pd-attr-val">
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
              <div className="pd-attrs-list">
                {specs.map(([k, v]) => (
                  <div key={k} className="pd-attr-row">
                    <span className="pd-attr-key">{formatAttrKey(k)}</span>
                    <span className="pd-attr-val">{String(v)}</span>
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
              <div className="pd-delivery-list">
                <div className="pd-delivery-row">
                  <span className="pd-delivery-label">Status</span>
                  <span>Available
                    {delivery.duration?.from && delivery.duration?.to && (
                      <> — {delivery.duration.from}–{delivery.duration.to} days</>
                    )}
                  </span>
                </div>
                {delivery.fee != null && (
                  <div className="pd-delivery-row">
                    <span className="pd-delivery-label">Fee</span>
                    <span>{Number(delivery.fee) === 0 ? "Free" : naira(delivery.fee)}</span>
                  </div>
                )}
                {delivery.note && (
                  <div className="pd-delivery-row">
                    <span className="pd-delivery-label">Note</span>
                    <span>{delivery.note}</span>
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
                style={{ cursor: "pointer" }}
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
                    {seller?.verified && (
                      <span className="pd-seller-vfd">Verified</span>
                    )}
                  </div>

                  <div className="pd-seller-meta">
                    {seller?.products_count > 0 && (
                      <span>{seller.products_count} listings</span>
                    )}
                    {seller?.total_sales > 0 && (
                      <span>· {Number(seller.total_sales).toLocaleString()} sales</span>
                    )}
                    {seller?.rating > 0 && (
                      <span>· {Number(seller.rating).toFixed(1)} rating</span>
                    )}
                  </div>

                  {seller?.trust_score != null && (
                    <div className="pd-seller-trust">
                      <div className="pd-trust-track">
                        <div className="pd-trust-fill" style={{ width: `${seller.trust_score}%` }} />
                      </div>
                      <span className="pd-trust-val">{seller.trust_score}% trust</span>
                    </div>
                  )}
                </div>

                <span className="pd-seller-arrow">›</span>
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
                <span className="pd-reviews-count-badge">
                  {reviewStats.total}
                </span>
              )}
            </div>

            {/* Summary */}
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

                {/* Rating breakdown bars */}
                <div className="pd-review-bars">
                  {[5,4,3,2,1].map((n) => {
                    const count = reviewStats[`${["","one","two","three","four","five"][n]}_star`] || 0;
                    const pct   = reviewStats.total > 0 ? (count / reviewStats.total) * 100 : 0;
                    return (
                      <div key={n} className="pd-review-bar-row">
                        <span className="pd-review-bar-label">{n}</span>
                        <div className="pd-review-bar-track">
                          <div className="pd-review-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="pd-review-bar-count">{count}</span>
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
                    <div className="pd-review-header">
                      <div className="pd-review-author-wrap">
                        <div className="pd-review-avatar">
                          {r.author_image ? (
                            <img src={r.author_image} alt={r.author} />
                          ) : (
                            (r.author || "A").charAt(0).toUpperCase()
                          )}
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
                      const next = reviewPage + 1;
                      setReviewPage(next);
                      fetchReviews(next);
                    }}
                  >
                    Load more reviews
                  </button>
                )}
              </div>
            ) : (
              <div className="pd-no-reviews">No reviews yet. Be the first!</div>
            )}

            {/* Review form */}
            <ReviewForm
              slug={slug}
              userId={userId}
              onSubmitted={() => {
                setReviewPage(1);
                fetchReviews(1);
              }}
            />
          </div>

        </div>{/* /pd-body */}

        {/* ── SIMILAR PRODUCTS ── */}
        {similar.length > 0 && (
          <div className="pd-similar">
            <div className="pd-similar-title">You may also like</div>
            <div className="pd-similar-list">
              {similar.map((p) => {
                const simImg      = getImages(p)[0];
                const avgRating   = Number(p.avg_rating || 0);
                const reviewCount = Number(p.review_count || 0);

                return (
                  <div
                    key={p.id}
                    className="pd-sim-card"
                    onClick={() => navigate(`/product/${p.slug || p.id}`)}
                  >
                    <div className="pd-sim-img-wrap">
                      <img
                        className="pd-sim-img"
                        src={simImg}
                        alt={p.title}
                        loading="lazy"
                      />
                      {p.is_promoted && (
                        <span className="pd-sim-promoted">Featured</span>
                      )}
                    </div>
                    <div className="pd-sim-body">
                      <div className="pd-sim-name">{p.title}</div>
                      <div className="pd-sim-price">{naira(p.price)}</div>
                      {reviewCount > 0 && (
                        <div className="pd-sim-rating">
                          {stars(avgRating, "sm")}
                          <span className="pd-sim-rating-count">({reviewCount})</span>
                        </div>
                      )}
                      {p.location_city && (
                        <div className="pd-sim-loc">{p.location_city}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>{/* /pd-page */}

      {/* ── STICKY CTA ── */}
      {(waNumber || waLink || contactPhone) && (
        <div className="pd-cta">
          {(waNumber || waLink) && (
            <button className="pd-cta-whatsapp" onClick={openWhatsApp}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.857L.057 23.571l5.89-1.548A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.028-1.378l-.36-.215-3.734.98 1.001-3.654-.235-.374A9.818 9.818 0 012.182 12C2.182 6.562 6.562 2.182 12 2.182S21.818 6.562 21.818 12 17.438 21.818 12 21.818z"/>
              </svg>
              Chat on WhatsApp
            </button>
          )}
          {contactPhone && (
            <button className="pd-cta-call" onClick={openCall} aria-label="Call seller">
              Call
            </button>
          )}
        </div>
      )}

      {/* ── LIGHTBOX ── */}
      {lightbox && (
        <div className="pd-lightbox" onClick={() => setLightbox(false)}>
          <button className="pd-lightbox-close" onClick={() => setLightbox(false)} aria-label="Close">
            ✕
          </button>
          {images.length > 1 && (
            <button
              className="pd-lightbox-prev"
              onClick={(e) => { e.stopPropagation(); setActiveImg((i) => (i - 1 + images.length) % images.length); }}
              aria-label="Previous"
            >
              ‹
            </button>
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
              onClick={(e) => { e.stopPropagation(); setActiveImg((i) => (i + 1) % images.length); }}
              aria-label="Next"
            >
              ›
            </button>
          )}
        </div>
      )}
    </>
  );
}
