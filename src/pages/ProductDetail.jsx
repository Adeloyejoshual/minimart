// ProductDetail.jsx
// Fetches from  GET /api/product/:slug
// Fires         POST /api/product/:id/view  on mount
// Fires         POST /api/product/:id/click on WhatsApp / Phone tap
// Fires         POST /api/product/:id/share on share tap

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/ProductDetail.css";

/* ─── tiny helpers ─────────────────────────────────────────────────────────── */
const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 30)  return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
};

const track = (id, action) =>
  fetch(`/api/product/${id}/${action}`, { method: "POST" }).catch(() => {});

/* ─── icon set (inline SVG) ───────────────────────────────────────────────── */
const Icon = {
  Heart: ({ filled }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
  Share: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  ),
  Phone: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18C1.6 2.1 2.38 1.18 3.46 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.4a16 16 0 0 0 5.55 5.55l.76-.76a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  ),
  Whatsapp: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  MapPin: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  Eye: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  Star: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  Shield: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  Tag: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
  Package: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  ArrowLeft: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/>
      <polyline points="12 19 5 12 12 5"/>
    </svg>
  ),
};

/* ─── Skeleton ─────────────────────────────────────────────────────────────── */
const Skeleton = ({ w = "100%", h = "16px", radius = "6px" }) => (
  <div className="pd-skeleton" style={{ width: w, height: h, borderRadius: radius }} />
);

/* ─── FAQ accordion item ───────────────────────────────────────────────────── */
const FaqItem = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="pd-faq-item">
      <button className="pd-faq-trigger" onClick={() => setOpen(!open)}>
        <span className="pd-faq-question">{q}</span>
        <span className={`pd-faq-icon ${open ? "pd-faq-icon--open" : ""}`}>
          <Icon.ChevronDown />
        </span>
      </button>
      <div className={`pd-faq-body ${open ? "pd-faq-body--open" : ""}`}>
        <div className="pd-faq-answer">{a}</div>
      </div>
    </div>
  );
};

/* ─── Related card ─────────────────────────────────────────────────────────── */
const RelatedCard = ({ item, onClick }) => (
  <div className="pd-related-card" onClick={() => onClick(item.slug)}>
    <div className="pd-related-img-wrap">
      {item.image
        ? <img src={item.image} alt={item.title} loading="lazy" className="pd-related-img" />
        : <div className="pd-related-img-placeholder">🖼</div>
      }
    </div>
    <div className="pd-related-body">
      <p className="pd-related-price">{fmt(item.price)}</p>
      <p className="pd-related-title">{item.title}</p>
      {item.seller_name && (
        <p className="pd-related-seller">
          {item.seller_verified && <span className="pd-verified-check">✓</span>}
          {item.seller_name}
        </p>
      )}
      {item.location?.label && (
        <p className="pd-related-location">
          <Icon.MapPin />{item.location.label}
        </p>
      )}
    </div>
  </div>
);

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════════ */
export default function ProductDetail() {
  const { slug }   = useParams();
  const navigate   = useNavigate();

  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [imgIdx,     setImgIdx]     = useState(0);
  const [wishlisted, setWishlisted] = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [imgZoomed,  setImgZoomed]  = useState(false);
  const viewFired = useRef(false);

  /* fetch -------------------------------------------------------------------- */
  useEffect(() => {
    setLoading(true);
    setError(null);
    setImgIdx(0);
    viewFired.current = false;

    fetch(`/api/product/${slug}`)
      .then(async (r) => {
        if (!r.ok) {
          let body = {};
          try { body = await r.json(); } catch {}
          throw new Error(body.detail || body.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
        if (!viewFired.current) {
          track(d.product.id, "view");
          viewFired.current = true;
        }
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [slug]);

  /* handlers ----------------------------------------------------------------- */
  const handleShare = useCallback(async () => {
    if (!data) return;
    const url = window.location.href;
    try { await navigator.share({ title: data.product.title, url }); }
    catch { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    track(data.product.id, "share");
  }, [data]);

  const handleContact = useCallback((type) => {
    if (!data) return;
    track(data.product.id, "click");
    const { seller } = data.product;
    if (type === "whatsapp") {
      const link = seller.whatsapp_link || (seller.whatsapp ? `https://wa.me/${seller.whatsapp.replace(/\D/g, "")}` : null);
      if (link) window.open(link, "_blank");
    } else {
      if (seller.phone) window.location.href = `tel:${seller.phone}`;
    }
  }, [data]);

  const prevImg = () => setImgIdx((i) => (i - 1 + data.product.images.length) % data.product.images.length);
  const nextImg = () => setImgIdx((i) => (i + 1) % data.product.images.length);

  /* ─── LOADING ─────────────────────────────────────────────────────────────── */
  if (loading) return (
    <div className="pd-root pd-root--loading">
      <div className="pd-container pd-grid">
        <div>
          <Skeleton w="100%" h="480px" radius="20px" />
          <div className="pd-skeleton-thumbs">
            {[...Array(4)].map((_, i) => <Skeleton key={i} w="72px" h="72px" radius="10px" />)}
          </div>
        </div>
        <div className="pd-skeleton-detail">
          <Skeleton w="60%" h="14px" />
          <Skeleton w="100%" h="36px" />
          <Skeleton w="40%" h="40px" />
          <Skeleton w="100%" h="120px" />
          <Skeleton w="100%" h="100px" radius="14px" />
          <Skeleton w="100%" h="56px" radius="12px" />
          <Skeleton w="100%" h="56px" radius="12px" />
        </div>
      </div>
    </div>
  );

  /* ─── ERROR ───────────────────────────────────────────────────────────────── */
  if (error || !data) return (
    <div className="pd-root pd-root--error">
      <div className="pd-error-inner">
        <div className="pd-error-emoji">😔</div>
        <h2 className="pd-error-heading">
          {error === "Product not found" ? "Product not found" : "Something went wrong"}
        </h2>
        <p className="pd-error-sub">
          {error === "Product not found"
            ? "This listing may have been removed or expired."
            : "We couldn't load this product."}
        </p>
        {error && error !== "Product not found" && (
          <pre className="pd-error-debug">{error}</pre>
        )}
        <button onClick={() => navigate(-1)} className="pd-btn-outline">← Go back</button>
      </div>
    </div>
  );

  const { product, related } = data;
  const images  = product.images?.length ? product.images : [product.image].filter(Boolean);
  const mainImg = images[imgIdx] || null;
  const seller  = product.seller || {};
  const specs   = Object.entries(product.specifications || {});
  const faqs    = product.faq || [];
  const hasDel  = product.delivery && Object.keys(product.delivery).length > 0;

  /* ─── RENDER ──────────────────────────────────────────────────────────────── */
  return (
    <div className="pd-root">

      <div className="pd-container" style={{ paddingTop: "20px", paddingBottom: "80px" }}>

        {/* Breadcrumb */}
        <nav className="pd-breadcrumb">
          <button onClick={() => navigate("/")} className="pd-breadcrumb-link">Home</button>
          <span>/</span>
          {product.category_name && <><span>{product.category_name}</span><span>/</span></>}
          <span className="pd-breadcrumb-current">{product.title}</span>
        </nav>

        {/* Back */}
        <button onClick={() => navigate(-1)} className="pd-back-btn">
          <Icon.ArrowLeft /> Back
        </button>

        {/* ── Main 2-col grid ────────────────────────────────────────── */}
        <div className="pd-grid" style={{ marginTop: "20px" }}>

          {/* ════ LEFT — Gallery ════ */}
          <div className="pd-gallery-col">

            {/* Main image */}
            <div className="pd-main-img-wrap" onClick={() => setImgZoomed(true)}>
              {product.is_promoted && (
                <div className="pd-badge-promoted">
                  ⚡ {product.promotion_type || "Featured"}
                </div>
              )}
              {mainImg
                ? <img key={mainImg} src={mainImg} alt={product.title} className="pd-main-img" />
                : <div className="pd-img-placeholder">🖼</div>
              }
              {images.length > 1 && (
                <>
                  <button className="pd-img-arrow pd-img-arrow--l" onClick={(e) => { e.stopPropagation(); prevImg(); }}>
                    <Icon.ChevronLeft />
                  </button>
                  <button className="pd-img-arrow pd-img-arrow--r" onClick={(e) => { e.stopPropagation(); nextImg(); }}>
                    <Icon.ChevronRight />
                  </button>
                  <div className="pd-img-dots">
                    {images.map((_, i) => (
                      <span
                        key={i}
                        className={`pd-img-dot ${i === imgIdx ? "pd-img-dot--active" : ""}`}
                        onClick={(e) => { e.stopPropagation(); setImgIdx(i); }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="pd-thumbs">
                {images.map((img, i) => (
                  <button key={i} onClick={() => setImgIdx(i)} className={`pd-thumb ${i === imgIdx ? "pd-thumb--active" : ""}`}>
                    <img src={img} alt={`View ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </button>
                ))}
              </div>
            )}

            {/* Stats row */}
            <div className="pd-stats-row">
              {product.views > 0 && (
                <span><Icon.Eye /> {product.views.toLocaleString()} views</span>
              )}
              {product.favorites_count > 0 && (
                <span>♡ {product.favorites_count} saves</span>
              )}
              {product.share_count > 0 && (
                <span>↗ {product.share_count} shares</span>
              )}
              <span className="pd-stats-time">{timeAgo(product.created_at)}</span>
            </div>
          </div>

          {/* ════ RIGHT — Details ════ */}
          <div className="pd-detail-col">

            {/* Title + actions */}
            <div className="pd-title-row">
              <h1 className="pd-title">{product.title}</h1>
              <div className="pd-action-btns">
                <button
                  onClick={() => setWishlisted(!wishlisted)}
                  className={`pd-action-btn ${wishlisted ? "pd-action-btn--active" : ""}`}
                  title="Save"
                >
                  <Icon.Heart filled={wishlisted} />
                </button>
                <button onClick={handleShare} className="pd-action-btn" title="Share">
                  {copied ? <span className="pd-copied-check">✓</span> : <Icon.Share />}
                </button>
              </div>
            </div>

            {/* Price row */}
            <div className="pd-price-row">
              <span className="pd-price">{fmt(product.price)}</span>
              {product.negotiable && (
                <span className="pd-badge pd-badge--green">Negotiable</span>
              )}
              {product.condition && (
                <span className="pd-badge pd-badge--neutral">{product.condition}</span>
              )}
            </div>

            {/* Quick specs pills */}
            {(product.brand || product.model || product.color || product.ram || product.storage) && (
              <div className="pd-spec-pills">
                {[
                  product.brand   && { l: "Brand",   v: product.brand },
                  product.model   && { l: "Model",   v: product.model },
                  product.color   && { l: "Color",   v: product.color },
                  product.ram     && { l: "RAM",     v: product.ram },
                  product.storage && { l: "Storage", v: product.storage },
                ].filter(Boolean).map(({ l, v }) => (
                  <div key={l} className="pd-spec-pill">
                    <span className="pd-spec-pill-label">{l}</span>
                    <span className="pd-spec-pill-value">{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Location */}
            {product.location?.label && (
              <div className="pd-location">
                <Icon.MapPin />{product.location.label}
              </div>
            )}

            {/* Highlights */}
            {product.highlights?.length > 0 && (
              <div className="pd-highlights">
                <p className="pd-label">Highlights</p>
                <div className="pd-highlights-list">
                  {product.highlights.map((h, i) => (
                    <div key={i} className="pd-highlight-item">
                      <span className="pd-highlight-icon"><Icon.Check /></span>{h}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="pd-description">
              <p className="pd-label">Description</p>
              <p className="pd-description-text">
                {product.description || "No description provided."}
              </p>
            </div>

            {/* ── Seller card ──────────────────────────────────────────── */}
            <div className="pd-seller-card">
              <div className="pd-seller-top">
                <div className="pd-seller-avatar-wrap">
                  {seller.avatar
                    ? <img src={seller.avatar} alt={seller.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: "1.3rem" }}>👤</span>
                  }
                  {seller.is_online && <span className="pd-online-dot" />}
                </div>
                <div className="pd-seller-info">
                  <div className="pd-seller-name-row">
                    <span className="pd-seller-name">{seller.name}</span>
                    {seller.verified && (
                      <span className="pd-badge pd-badge--blue" title="Verified seller">
                        <Icon.Shield /> Verified
                      </span>
                    )}
                    {seller.store_verified && (
                      <span className="pd-badge pd-badge--gold">🏪 Store</span>
                    )}
                  </div>
                  {seller.store_name && (
                    <p className="pd-seller-store">{seller.store_name}</p>
                  )}
                  <div className="pd-seller-meta">
                    {seller.rating > 0 && (
                      <span className="pd-seller-rating">
                        <Icon.Star />{Number(seller.rating).toFixed(1)}
                      </span>
                    )}
                    {seller.trust_score != null && (
                      <span className="pd-seller-trust">Trust {seller.trust_score}%</span>
                    )}
                    {seller.listings_count > 0 && (
                      <span className="pd-seller-listings">
                        <Icon.Package /> {seller.listings_count} listings
                      </span>
                    )}
                    {seller.location?.label && (
                      <span className="pd-seller-location">
                        <Icon.MapPin />{seller.location.label}
                      </span>
                    )}
                  </div>
                  {seller.member_since && (
                    <p className="pd-seller-since">
                      Member since {new Date(seller.member_since).getFullYear()}
                    </p>
                  )}
                </div>
              </div>

              {/* Contact buttons */}
              <div className="pd-contact-btns">
                {seller.whatsapp && (
                  <button onClick={() => handleContact("whatsapp")} className="pd-btn-whatsapp">
                    <Icon.Whatsapp /> WhatsApp
                  </button>
                )}
                {seller.phone && (
                  <button onClick={() => handleContact("phone")} className="pd-btn-phone">
                    <Icon.Phone /> Call
                  </button>
                )}
              </div>
            </div>

            {/* Delivery */}
            {hasDel && (
              <div className="pd-info-box pd-delivery">
                <p className="pd-delivery-title">
                  <Icon.Package /> Delivery
                </p>
                {product.delivery.available !== undefined && (
                  <p className="pd-delivery-row">
                    {product.delivery.available ? "✓ Delivery available" : "✗ No delivery — pickup only"}
                  </p>
                )}
                {product.delivery.fee != null && (
                  <p className="pd-delivery-row">
                    Fee: {product.delivery.fee === 0 ? "Free" : fmt(product.delivery.fee)}
                  </p>
                )}
                {product.delivery.duration && (
                  <p className="pd-delivery-row">Duration: {product.delivery.duration}</p>
                )}
                {product.delivery.note && (
                  <p className="pd-delivery-note">{product.delivery.note}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Specifications ─────────────────────────────────────────── */}
        {specs.length > 0 && (
          <section className="pd-section">
            <h2 className="pd-section-title">Specifications</h2>
            <div className="pd-specs-grid">
              {specs.map(([k, v]) => (
                <div key={k} className="pd-spec-row">
                  <span className="pd-spec-key">{k}</span>
                  <span className="pd-spec-val">{String(v)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Features ───────────────────────────────────────────────── */}
        {product.features?.length > 0 && (
          <section className="pd-section">
            <h2 className="pd-section-title">Features</h2>
            <div className="pd-features">
              {product.features.map((f, i) => (
                <span key={i} className="pd-feature-tag">
                  <Icon.Check />{f}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── FAQ ────────────────────────────────────────────────────── */}
        {faqs.length > 0 && (
          <section className="pd-section">
            <h2 className="pd-section-title">FAQ</h2>
            <div className="pd-faq-list">
              {faqs.map((item, i) => (
                <FaqItem key={i} q={item.q} a={item.a} />
              ))}
            </div>
          </section>
        )}

        {/* ── Related products ───────────────────────────────────────── */}
        {related?.length > 0 && (
          <section className="pd-section">
            <h2 className="pd-section-title">Similar Listings</h2>
            <div className="pd-related-grid">
              {related.map((item) => (
                <RelatedCard key={item.id} item={item} onClick={(s) => navigate(`/product/${s}`)} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Lightbox ───────────────────────────────────────────────────── */}
      {imgZoomed && mainImg && (
        <div className="pd-lightbox" onClick={() => setImgZoomed(false)}>
          <button className="pd-lightbox-close" onClick={() => setImgZoomed(false)}>✕</button>
          {images.length > 1 && (
            <>
              <button className="pd-lightbox-arrow pd-lightbox-arrow--l" onClick={(e) => { e.stopPropagation(); prevImg(); }}>
                <Icon.ChevronLeft />
              </button>
              <button className="pd-lightbox-arrow pd-lightbox-arrow--r" onClick={(e) => { e.stopPropagation(); nextImg(); }}>
                <Icon.ChevronRight />
              </button>
            </>
          )}
          <img
            src={mainImg}
            alt={product.title}
            onClick={(e) => e.stopPropagation()}
            className="pd-lightbox-img"
          />
          {images.length > 1 && (
            <p className="pd-lightbox-counter">{imgIdx + 1} / {images.length}</p>
          )}
        </div>
      )}
    </div>
  );
}
