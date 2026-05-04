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
   PURE HELPERS
───────────────────────────────────────────── */
const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");

const getImages = (product) => {
  if (!product) return [];
  const imgs = [];

  // Prefer product_images join (array of URLs from backend)
  if (Array.isArray(product.images) && product.images.length) {
    product.images.forEach((img) => {
      const url = typeof img === "string" ? img : img?.url || img?.image_url;
      if (url) imgs.push(url);
    });
  }

  // Fallbacks from schema columns
  if (!imgs.length && product.main_image) imgs.push(product.main_image);
  if (!imgs.length && product.thumbnail_url) imgs.push(product.thumbnail_url);

  return imgs.length ? imgs : [PH];
};

const stars = (rating = 0) => {
  const r = Math.round(Number(rating));
  return "★".repeat(r) + "☆".repeat(5 - r);
};

const formatAttrKey = (k) =>
  k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const timeAgo = (date) => {
  if (!date) return "";
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60)     return "just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000)return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString("en-NG", { month: "short", year: "numeric" });
};

/* Skeleton component */
const Skel = ({ className = "" }) => (
  <div className={`pd-skeleton ${className}`} />
);

/* ─────────────────────────────────────────────
   LOADING SKELETON
───────────────────────────────────────────── */
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
   FAQ ITEM (controlled accordion)
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
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function ProductDetail() {
  const { slug }   = useParams();
  const navigate   = useNavigate();
  const { addSingleProduct } = useProductCache();

  /* ── state ── */
  const [product,        setProduct]        = useState(null);
  const [seller,         setSeller]         = useState(null);
  const [similar,        setSimilar]        = useState([]);
  const [reviews,        setReviews]        = useState([]);
  const [reviewStats,    setReviewStats]    = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [activeImg,      setActiveImg]      = useState(0);
  const [lightbox,       setLightbox]       = useState(false);
  const [descExpanded,   setDescExpanded]   = useState(false);
  const [fav,            setFav]            = useState(false);
  const [viewTracked,    setViewTracked]    = useState(false);

  /* ── derived ── */
  const images    = useMemo(() => getImages(product), [product]);
  const attrs     = useMemo(() => {
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
      addSingleProduct(data); // warm the homepage cache
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [slug, addSingleProduct]);

  useEffect(() => { fetchProduct(); }, [fetchProduct]);

  /* ── TRACK VIEW (once per session) ── */
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
  useEffect(() => {
    if (!product?.id) return;
    fetch(`${API}/product/slug/${encodeURIComponent(slug)}/reviews?limit=5`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setReviews(data.reviews || []);
          setReviewStats(data.stats || null);
        }
      })
      .catch(() => {});
  }, [product?.id, slug]);

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

  /* ── LIGHTBOX KEY HANDLER ── */
  useEffect(() => {
    if (!lightbox) return;
    const h = (e) => {
      if (e.key === "Escape") setLightbox(false);
      if (e.key === "ArrowRight") setActiveImg((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft")  setActiveImg((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [lightbox, images.length]);

  /* ── CONTACT ACTIONS ── */
  const contactPhone = product?.phone || product?.contact?.phone;
  const waNumber     = product?.whatsapp || product?.contact?.whatsapp;
  const waLink       = product?.whatsapp_link || product?.contact?.whatsapp_link;

  const openWhatsApp = () => {
    fetch(`${API}/products/${product.id}/click`, { method: "POST" }).catch(() => {});
    const msg  = encodeURIComponent(`Hi, I'm interested in your listing: ${product.title} — ${window.location.href}`);
    const url  = waLink || (waNumber ? `https://wa.me/${waNumber.replace(/\D/g, "")}?text=${msg}` : null);
    if (url) window.open(url, "_blank");
  };

  const openCall = () => {
    if (contactPhone) window.location.href = `tel:${contactPhone}`;
  };

  /* ── DELIVERY ── */
  const delivery = useMemo(() => {
    const d = product?.delivery;
    if (!d || typeof d !== "object") return null;
    if (!d.available) return null;
    return d;
  }, [product]);

  /* ─────────────── RENDER ─────────────────── */

  if (loading) return <LoadingSkeleton />;

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

  const descWords    = (product.description || "").split(" ");
  const descShort    = descWords.slice(0, 60).join(" ");
  const descLong     = product.description || "";
  const needsToggle  = descWords.length > 60;

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
            onClick={() => setFav((v) => !v)}
            aria-label="Save listing"
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
                🏷 {product.category_name}
                {product.subcategory_name && ` › ${product.subcategory_name}`}
              </div>
            )}

            <h1 className="pd-title">{product.title}</h1>

            <div className="pd-price-row">
              <span className="pd-price">{naira(product.price)}</span>
              {product.is_promoted && (
                <span className="pd-price-note">✦ Promoted listing</span>
              )}
            </div>

            <div className="pd-stats-row">
              <span className="pd-stat">
                <span className="pd-stat-icon">👁</span>
                {Number(product.views || 0).toLocaleString()} views
              </span>
              {product.clicks_count > 0 && (
                <span className="pd-stat">
                  <span className="pd-stat-icon">👆</span>
                  {Number(product.clicks_count).toLocaleString()} clicks
                </span>
              )}
              {product.favorites_count > 0 && (
                <span className="pd-stat">
                  <span className="pd-stat-icon">♥</span>
                  {product.favorites_count}
                </span>
              )}
              <span className="pd-stat">
                <span className="pd-stat-icon">🕐</span>
                {timeAgo(product.created_at)}
              </span>
            </div>
          </div>

          {/* ── DESCRIPTION ── */}
          {product.description && (
            <div className="pd-section">
              <div className="pd-section-title">About this listing</div>
              <p className="pd-desc">
                {needsToggle && !descExpanded ? `${descShort}…` : descLong}
              </p>
              {needsToggle && (
                <button
                  className="pd-desc-toggle"
                  onClick={() => setDescExpanded((v) => !v)}
                >
                  {descExpanded ? "Show less ▲" : "Read more ▼"}
                </button>
              )}
            </div>
          )}

          {/* ── HIGHLIGHTS ── */}
          {highlights.length > 0 && (
            <div className="pd-section">
              <div className="pd-section-title">Highlights</div>
              <div className="pd-highlights">
                {highlights.map((h, i) => (
                  <div key={i} className="pd-highlight">
                    <span className="pd-highlight-dot" />
                    {typeof h === "string" ? h : h.text || JSON.stringify(h)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ATTRIBUTES ── */}
          {attrs.length > 0 && (
            <div className="pd-section">
              <div className="pd-section-title">Details</div>
              <div className="pd-attrs">
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
              <div className="pd-attrs">
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
              <div className="pd-location">
                <span className="pd-location-icon">📍</span>
                <div className="pd-location-detail">
                  <span className="pd-location-city">
                    {product.location_city || product.location_state}
                  </span>
                  {product.location_city && product.location_state && (
                    <span className="pd-location-state">{product.location_state}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── DELIVERY ── */}
          {delivery && (
            <div className="pd-section">
              <div className="pd-section-title">Delivery</div>
              <div className="pd-delivery">
                <div className="pd-delivery-row">
                  <span className="pd-delivery-icon">🚚</span>
                  <span>
                    <span className="pd-delivery-label">Delivery available</span>
                    {delivery.duration?.from && delivery.duration?.to && (
                      <> — {delivery.duration.from}–{delivery.duration.to} days</>
                    )}
                  </span>
                </div>
                {delivery.fee != null && (
                  <div className="pd-delivery-row">
                    <span className="pd-delivery-icon">💳</span>
                    <span>
                      <span className="pd-delivery-label">Fee:</span>
                      {" "}{Number(delivery.fee) === 0 ? "Free" : naira(delivery.fee)}
                    </span>
                  </div>
                )}
                {delivery.note && (
                  <div className="pd-delivery-row">
                    <span className="pd-delivery-icon">📝</span>
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
                      <span className="pd-seller-vfd">✓ Verified</span>
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
                      <span>· ⭐ {Number(seller.rating).toFixed(1)}</span>
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
          {(reviews.length > 0 || reviewStats) && (
            <div className="pd-section">
              <div className="pd-section-title">Reviews</div>
              <div className="pd-reviews">
                {reviewStats && (
                  <div className="pd-review-summary">
                    <div>
                      <div className="pd-review-score">
                        {Number(reviewStats.average || 0).toFixed(1)}
                      </div>
                      <div className="pd-review-stars">
                        {stars(reviewStats.average)}
                      </div>
                      <div className="pd-review-count">
                        {reviewStats.total} review{reviewStats.total !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                )}

                {reviews.map((r, i) => (
                  <div key={i} className="pd-review-item">
                    <div className="pd-review-header">
                      <span className="pd-review-author">{r.author || "Anonymous"}</span>
                      <span className="pd-review-date">{timeAgo(r.created_at)}</span>
                    </div>
                    <div className="pd-review-stars-sm">{stars(r.rating)}</div>
                    {r.comment && <p className="pd-review-text">{r.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>{/* /pd-body */}

        {/* ── SIMILAR PRODUCTS ── */}
        {similar.length > 0 && (
          <div className="pd-similar">
            <div className="pd-similar-title">You may also like</div>
            <div className="pd-similar-row">
              {similar.map((p) => {
                const simImg = getImages(p)[0];
                return (
                  <div
                    key={p.id}
                    className="pd-sim-card"
                    onClick={() => navigate(`/product/${p.slug || p.id}`)}
                  >
                    <img
                      className="pd-sim-img"
                      src={simImg}
                      alt={p.title}
                      loading="lazy"
                    />
                    <div className="pd-sim-body">
                      <div className="pd-sim-name">{p.title}</div>
                      <div className="pd-sim-price">{naira(p.price)}</div>
                      {p.location_city && (
                        <div className="pd-sim-loc">📍 {p.location_city}</div>
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
              📞
            </button>
          )}
        </div>
      )}

      {/* ── LIGHTBOX ── */}
      {lightbox && (
        <div className="pd-lightbox" onClick={() => setLightbox(false)}>
          <button
            className="pd-lightbox-close"
            onClick={() => setLightbox(false)}
            aria-label="Close"
          >
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
