import React, {
  useState, useEffect, useCallback, useMemo,
} from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";
import "../styles/ProductDetail.css";

const API = import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";
const PH  = "https://placehold.co/800x600/eae6e0/a8a39d?text=Minimart";

/* ─── HELPERS ─── */
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

const FAV_KEY  = "minimart_favs";
const loadFavs = () => { try { return JSON.parse(localStorage.getItem(FAV_KEY) || "{}"); } catch { return {}; } };
const saveFavs = (f) => { try { localStorage.setItem(FAV_KEY, JSON.stringify(f)); } catch {} };

/* ─── SKELETON ─── */
const Skel = ({ className = "", style }) => <div className={`pd-skeleton ${className}`} style={style} />;
function LoadingSkeleton() {
  return (
    <div className="pd-page">
      <Skel className="pd-skel-gallery" />
      <div className="pd-body" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <Skel className="pd-skel-line" style={{ width: "40%", height: 14 }} />
        <Skel className="pd-skel-line" style={{ width: "90%", height: 22 }} />
        <Skel className="pd-skel-line" style={{ width: "55%", height: 34 }} />
        <Skel className="pd-skel-line" style={{ width: "100%", height: 80, marginTop: 10 }} />
      </div>
    </div>
  );
}

/* ─── FAQ ITEM ─── */
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

/* ─── REVIEW FORM ─── */
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, rating, comment }),
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
        placeholder="Share your experience with this product... (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        maxLength={500}
      />
      <div className="pd-review-char">{comment.length}/500</div>
      {error && <div className="pd-review-error">{error}</div>}
      <button className="pd-review-submit" onClick={handleSubmit} disabled={submitting || !rating}>
        {submitting ? "Submitting…" : "Submit Review"}
      </button>
    </div>
  );
}

/* ─── PRODUCT CARD — reused for Similar + Seller's listings ─── */
function ProductCard({ p, onClick }) {
  const img         = getImages(p)[0];
  const avgRating   = Number(p.avg_rating || 0);
  const reviewCount = Number(p.review_count || 0);
  return (
    <div className="pd-sim-card" onClick={onClick}>
      <div className="pd-sim-img-wrap">
        <img className="pd-sim-img" src={img} alt={p.title} loading="lazy" />
        {p.is_promoted && <span className="pd-sim-promoted">Featured</span>}
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
        {p.location_city && <div className="pd-sim-loc">{p.location_city}</div>}
      </div>
    </div>
  );
}

/* ─── MAIN ─── */
export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addSingleProduct } = useProductCache();

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

  const userId = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("minimart_user") || "null")?.id || null; }
    catch { return null; }
  }, []);

  const images     = useMemo(() => getImages(product), [product]);
  const attrs      = useMemo(() => { const r = product?.attributes; if (!r || typeof r !== "object") return []; return Object.entries(r).filter(([, v]) => v != null && v !== ""); }, [product]);
  const highlights = useMemo(() => { const h = product?.highlights; return Array.isArray(h) ? h.filter(Boolean) : []; }, [product]);
  const faqs       = useMemo(() => { const f = product?.faq; return Array.isArray(f) ? f.filter((i) => i?.q && i?.a) : []; }, [product]);
  const specs      = useMemo(() => { const s = product?.specifications; if (!s || typeof s !== "object") return []; return Object.entries(s).filter(([, v]) => v != null && v !== ""); }, [product]);

  /* fetch product */
  const fetchProduct = useCallback(async () => {
    if (!slug || slug === "undefined") { setError("Invalid product link."); setLoading(false); return; }
    try {
      setLoading(true); setError(null);
      const res  = await fetch(`${API}/product/slug/${encodeURIComponent(slug)}`);
      if (res.status === 404) throw new Error("Product not found");
      if (!res.ok)            throw new Error("Could not load product");
      const data = await res.json();
      setProduct(data);
      addSingleProduct(data);
      setFav(!!loadFavs()[data.id]);
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); }
  }, [slug, addSingleProduct]);

  useEffect(() => { fetchProduct(); }, [fetchProduct]);

  /* track view once per session */
  useEffect(() => {
    if (!product?.id) return;
    const key = `viewed_${product.id}`;
    if (sessionStorage.getItem(key)) return;
    fetch(`${API}/products/${product.id}/view`, { method: "POST" }).catch(() => {});
    sessionStorage.setItem(key, "1");
  }, [product?.id]);

  /* fetch seller */
  useEffect(() => {
    if (!product?.seller_id) return;
    fetch(`${API}/users/${product.seller_id}/public`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setSeller(d); })
      .catch(() => {});
  }, [product?.seller_id]);

  /* fetch seller's other products */
  useEffect(() => {
    if (!product?.seller_id || !product?.id) return;
    const qs = new URLSearchParams({ seller_id: product.seller_id, exclude: product.id, limit: "10" });
    fetch(`${API}/products/by-seller?${qs}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setSellerProducts(Array.isArray(d) ? d : (d.products || [])))
      .catch(() => {});
  }, [product?.seller_id, product?.id]);

  /* fetch reviews */
  const fetchReviews = useCallback(async (page = 1) => {
    if (!slug) return;
    try {
      const res  = await fetch(`${API}/product/slug/${encodeURIComponent(slug)}/reviews?limit=5&page=${page}`);
      if (!res.ok) return;
      const data = await res.json();
      setReviews((prev) => page === 1 ? (data.reviews || []) : [...prev, ...(data.reviews || [])]);
      setReviewStats(data.stats || null);
      setReviewTotal(data.stats?.total || 0);
    } catch {}
  }, [slug]);

  useEffect(() => { fetchReviews(1); }, [fetchReviews]);

  /* fetch similar */
  useEffect(() => {
    if (!product?.id) return;
    const qs = new URLSearchParams({ category_id: product.category_id || "", exclude: product.id, limit: "10" });
    fetch(`${API}/products/similar?${qs}`)
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setSimilar(Array.isArray(d) ? d : (d.products || [])))
      .catch(() => {});
  }, [product?.id, product?.category_id]);

  /* lightbox keys */
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

  /* toggle favorite */
  const toggleFav = useCallback(async () => {
    if (!product?.id) return;
    const next = !fav;
    setFav(next);
    const favs = loadFavs();
    if (next) { favs[product.id] = true; } else { delete favs[product.id]; }
    saveFavs(favs);
    if (userId) {
      fetch(`${API}/products/${product.id}/favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      }).catch(() => {});
    }
  }, [fav, product, userId]);

  /* contact */
  const contactPhone = product?.phone || product?.contact?.phone;
  const waNumber     = product?.whatsapp || product?.contact?.whatsapp;
  const waLink       = product?.whatsapp_link || product?.contact?.whatsapp_link;
  const hasContact   = !!(waNumber || waLink || contactPhone || product?.seller_id);

  const openWhatsApp = () => {
    fetch(`${API}/products/${product.id}/click`, { method: "POST" }).catch(() => {});
    const msg = encodeURIComponent(`Hi, I'm interested in your listing: ${product.title} — ${window.location.href}`);
    const url = waLink || (waNumber ? `https://wa.me/${waNumber.replace(/\D/g, "")}?text=${msg}` : null);
    if (url) window.open(url, "_blank");
  };
  const openCall = () => { if (contactPhone) window.location.href = `tel:${contactPhone}`; };
  const openChat = () => { navigate(`/chat/${product.id}`); };

  /* delivery */
  const delivery = useMemo(() => {
    const d = product?.delivery;
    if (!d || typeof d !== "object" || !d.available) return null;
    return d;
  }, [product]);

  /* ── RENDER ── */
  if (loading) return <LoadingSkeleton />;
  if (error) return (
    <div className="pd-page">
      <div className="pd-error">
        <div className="pd-error-emoji">🔍</div>
        <div className="pd-error-title">{error}</div>
        <div className="pd-error-sub">The listing may have been removed or the link is incorrect.</div>
        <Link className="pd-error-link" to="/">Browse Marketplace</Link>
      </div>
    </div>
  );
  if (!product) return null;

  const descWords      = (product.description || "").split(" ");
  const descShort      = descWords.slice(0, 60).join(" ");
  const needsToggle    = descWords.length > 60;
  const hasMoreReviews = reviews.length < reviewTotal;

  return (
    <>
      {/* STICKY HEADER */}
      <div className="pd-header">
        <button className="pd-back" onClick={() => navigate(-1)} aria-label="Back">←</button>
        <div className="pd-header-actions">
          <button className={`pd-action-btn${fav ? " fav-on" : ""}`} onClick={toggleFav} aria-label="Save">
            {fav ? "♥" : "♡"}
          </button>
          <button className="pd-action-btn" onClick={() => navigator.share?.({ title: product.title, url: window.location.href })} aria-label="Share">↑</button>
        </div>
      </div>

      <div className="pd-page">

        {/* GALLERY */}
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
                <div key={i} className={`pd-thumb${activeImg === i ? " active" : ""}`} onClick={() => setActiveImg(i)}>
                  <img src={src} alt={`Image ${i + 1}`} loading="lazy" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pd-body">

          {/* TITLE */}
          <div className="pd-title-block">
            {product.category_name && (
              <div className="pd-category-crumb">
                {product.category_name}{product.subcategory_name && ` › ${product.subcategory_name}`}
              </div>
            )}
            <h1 className="pd-title">{product.title}</h1>
            <div className="pd-price-row">
              <span className="pd-price">{naira(product.price)}</span>
              {product.is_promoted && <span className="pd-price-note">Promoted listing</span>}
            </div>
            <div className="pd-stats-row">
              <span className="pd-stat">{Number(product.views || 0).toLocaleString()} views</span>
              {product.clicks_count > 0 && <span className="pd-stat">{Number(product.clicks_count).toLocaleString()} clicks</span>}
              {product.favorites_count > 0 && <span className="pd-stat">{product.favorites_count} saved</span>}
              <span className="pd-stat">{timeAgo(product.created_at)}</span>
            </div>
          </div>

          {/* ABOUT */}
          {product.description && (
            <div className="pd-section">
              <div className="pd-section-title">About this product</div>
              <p className="pd-desc">
                {needsToggle && !descExpanded ? descShort : product.description}
                {needsToggle && !descExpanded && (
                  <span className="pd-desc-ellipsis">
                    ...
                    <button className="pd-desc-toggle" onClick={() => setDescExpanded(true)}>read more</button>
                  </span>
                )}
              </p>
              {needsToggle && descExpanded && (
                <button className="pd-desc-toggle" onClick={() => setDescExpanded(false)}>Show less</button>
              )}
            </div>
          )}

          {/* FEATURES — vertical list, one per line with checkmark */}
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

          {/* DETAILS — stacked: label small gray on top, value bold below */}
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

          {/* SPECIFICATIONS — same stacked layout */}
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

          {/* LOCATION */}
          {(product.location_city || product.location_state) && (
            <div className="pd-section">
              <div className="pd-section-title">Location</div>
              <div className="pd-location-text">
                {product.location_city && <span className="pd-location-city">{product.location_city}</span>}
                {product.location_city && product.location_state && <span className="pd-location-sep">, </span>}
                {product.location_state && <span className="pd-location-state">{product.location_state}</span>}
              </div>
            </div>
          )}

          {/* DELIVERY */}
          {delivery && (
            <div className="pd-section">
              <div className="pd-section-title">Delivery</div>
              <div className="pd-attrs-stacked">
                <div className="pd-attr-stack-item">
                  <span className="pd-attr-stack-key">Status</span>
                  <span className="pd-attr-stack-val">
                    Available{delivery.duration?.from && delivery.duration?.to && <> — {delivery.duration.from}–{delivery.duration.to} days</>}
                  </span>
                </div>
                {delivery.fee != null && (
                  <div className="pd-attr-stack-item">
                    <span className="pd-attr-stack-key">Fee</span>
                    <span className="pd-attr-stack-val">{Number(delivery.fee) === 0 ? "Free" : naira(delivery.fee)}</span>
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

          {/* SELLER */}
          {(seller || product.seller_id) && (
            <div className="pd-section">
              <div className="pd-section-title">Seller</div>
              <div className="pd-seller" onClick={() => navigate(`/seller/${product.seller_id}`)} role="button" tabIndex={0}>
                {seller?.profile_image || seller?.store_logo ? (
                  <img className="pd-seller-avatar" src={seller.profile_image || seller.store_logo} alt={seller.name} loading="lazy" />
                ) : (
                  <div className="pd-seller-avatar-fallback">{(seller?.name || "S").charAt(0).toUpperCase()}</div>
                )}
                <div className="pd-seller-info">
                  <div className="pd-seller-name">
                    {seller?.store_name || seller?.name || "Seller"}
                    {seller?.verified && <span className="pd-seller-vfd">Verified</span>}
                  </div>
                  <div className="pd-seller-meta">
                    {seller?.products_count > 0 && <span>{seller.products_count} listings</span>}
                    {seller?.total_sales > 0 && <span>· {Number(seller.total_sales).toLocaleString()} sales</span>}
                    {seller?.rating > 0 && <span>· {Number(seller.rating).toFixed(1)} rating</span>}
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

          {/* CONTACT INFORMATION — replaces sticky CTA */}
          {hasContact && (
            <div className="pd-section">
              <div className="pd-section-title">Contact Information</div>
              <div className="pd-contact-list">

                {/* Chat with Seller */}
                <button className="pd-contact-btn pd-contact-chat" onClick={openChat}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  Chat with Seller
                </button>

                {/* WhatsApp */}
                {(waNumber || waLink) && (
                  <button className="pd-contact-btn pd-contact-whatsapp" onClick={openWhatsApp}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.857L.057 23.571l5.89-1.548A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.028-1.378l-.36-.215-3.734.98 1.001-3.654-.235-.374A9.818 9.818 0 012.182 12C2.182 6.562 6.562 2.182 12 2.182S21.818 6.562 21.818 12 17.438 21.818 12 21.818z"/>
                    </svg>
                    Chat on WhatsApp
                  </button>
                )}

                {/* Call */}
                {contactPhone && (
                  <button className="pd-contact-btn pd-contact-call" onClick={openCall}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.59 1.2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.73 16z"/>
                    </svg>
                    Call Seller
                    {contactPhone && <span className="pd-contact-phone-num">{contactPhone}</span>}
                  </button>
                )}

              </div>
            </div>
          )}

          {/* FAQ */}
          {faqs.length > 0 && (
            <div className="pd-section">
              <div className="pd-section-title">FAQs</div>
              <div className="pd-faq">
                {faqs.map((item, i) => <FaqItem key={i} q={item.q} a={item.a} />)}
              </div>
            </div>
          )}

          {/* REVIEWS */}
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
                  <div className="pd-review-score">{Number(reviewStats.average || 0).toFixed(1)}</div>
                  {stars(reviewStats.average)}
                  <div className="pd-review-total-txt">{reviewStats.total} review{reviewStats.total !== 1 ? "s" : ""}</div>
                </div>
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

            {reviews.length > 0 ? (
              <div className="pd-review-list">
                {reviews.map((r, i) => (
                  <div key={r.id || i} className="pd-review-item">
                    <div className="pd-review-header">
                      <div className="pd-review-author-wrap">
                        <div className="pd-review-avatar">
                          {r.author_image ? <img src={r.author_image} alt={r.author} /> : (r.author || "A").charAt(0).toUpperCase()}
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
                  <button className="pd-reviews-load-more" onClick={() => { const n = reviewPage + 1; setReviewPage(n); fetchReviews(n); }}>
                    Load more reviews
                  </button>
                )}
              </div>
            ) : (
              <div className="pd-no-reviews">No reviews yet. Be the first!</div>
            )}

            <ReviewForm slug={slug} userId={userId} onSubmitted={() => { setReviewPage(1); fetchReviews(1); }} />
          </div>

        </div>{/* /pd-body */}

        {/* SIMILAR PRODUCTS */}
        {similar.length > 0 && (
          <div className="pd-similar">
            <div className="pd-similar-title">You may also like</div>
            <div className="pd-similar-list">
              {similar.map((p) => (
                <ProductCard key={p.id} p={p} onClick={() => navigate(`/product/${p.slug || p.id}`)} />
              ))}
            </div>
          </div>
        )}

        {/* MORE FROM SELLER */}
        {sellerProducts.length > 0 && (
          <div className="pd-similar">
            <div className="pd-similar-title">
              More from {seller?.store_name || seller?.name || "this seller"}
            </div>
            <div className="pd-similar-list">
              {sellerProducts.map((p) => (
                <ProductCard key={p.id} p={p} onClick={() => navigate(`/product/${p.slug || p.id}`)} />
              ))}
            </div>
            <button className="pd-seller-see-all" onClick={() => navigate(`/seller/${product.seller_id}`)}>
              See all listings
            </button>
          </div>
        )}

      </div>{/* /pd-page */}

      {/* LIGHTBOX */}
      {lightbox && (
        <div className="pd-lightbox" onClick={() => setLightbox(false)}>
          <button className="pd-lightbox-close" onClick={() => setLightbox(false)} aria-label="Close">✕</button>
          {images.length > 1 && (
            <button className="pd-lightbox-prev" onClick={(e) => { e.stopPropagation(); setActiveImg((i) => (i - 1 + images.length) % images.length); }} aria-label="Previous">‹</button>
          )}
          <img className="pd-lightbox-img" src={images[activeImg]} alt={product.title} onClick={(e) => e.stopPropagation()} />
          {images.length > 1 && (
            <button className="pd-lightbox-next" onClick={(e) => { e.stopPropagation(); setActiveImg((i) => (i + 1) % images.length); }} aria-label="Next">›</button>
          )}
        </div>
      )}
    </>
  );
}
