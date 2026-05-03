// ProductDetail.jsx
// Fetches from  GET /api/product/:slug
// Fires         POST /api/product/:id/view  on mount
// Fires         POST /api/product/:id/click on WhatsApp / Phone tap
// Fires         POST /api/product/:id/share on share tap

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

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
  <div style={{ width: w, height: h, borderRadius: radius, background: "var(--sk)", animation: "pulse 1.6s ease-in-out infinite" }} />
);

/* ─── FAQ accordion item ───────────────────────────────────────────────────── */
const FaqItem = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="pd-faq-item" style={{ borderBottom: "1px solid var(--border)" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between",
          alignItems: "center", padding: "14px 0", background: "none",
          border: "none", cursor: "pointer", textAlign: "left",
          color: "var(--text)", fontFamily: "inherit",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "0.9rem", paddingRight: "16px" }}>{q}</span>
        <span style={{ flexShrink: 0, transition: "transform .25s", transform: open ? "rotate(180deg)" : "none", color: "var(--accent)" }}>
          <Icon.ChevronDown />
        </span>
      </button>
      <div style={{
        overflow: "hidden", maxHeight: open ? "400px" : "0",
        transition: "max-height .3s ease", color: "var(--muted)", fontSize: "0.875rem", lineHeight: 1.7,
      }}>
        <div style={{ paddingBottom: "14px" }}>{a}</div>
      </div>
    </div>
  );
};

/* ─── Related card ─────────────────────────────────────────────────────────── */
const RelatedCard = ({ item, onClick }) => (
  <div
    className="pd-related-card"
    onClick={() => onClick(item.slug)}
    style={{ cursor: "pointer", borderRadius: "14px", overflow: "hidden",
      background: "var(--card)", border: "1px solid var(--border)",
      transition: "transform .2s, box-shadow .2s" }}
  >
    <div style={{ aspectRatio: "4/3", overflow: "hidden", background: "var(--skeleton)" }}>
      {item.image
        ? <img src={item.image} alt={item.title} loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform .35s" }}
            className="pd-related-img" />
        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: "2rem" }}>🖼</div>
      }
    </div>
    <div style={{ padding: "12px" }}>
      <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--accent)", marginBottom: "4px" }}>
        {fmt(item.price)}
      </p>
      <p style={{ fontSize: "0.83rem", fontWeight: 500, color: "var(--text)", lineHeight: 1.4,
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {item.title}
      </p>
      {item.seller_name && (
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
          {item.seller_verified && <span style={{ color: "#3b82f6" }}>✓</span>}
          {item.seller_name}
        </p>
      )}
      {item.location?.label && (
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "3px", display: "flex", alignItems: "center", gap: "3px" }}>
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
  const { slug } = useParams();
  const navigate  = useNavigate();

  const [data,       setData]       = useState(null);   // { product, related }
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
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
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
    <div className="pd-root" style={{ minHeight: "100vh" }}>
      <PdStyles />
      <div className="pd-container pd-grid" style={{ paddingTop: "32px" }}>
        <div>
          <Skeleton w="100%" h="480px" radius="20px" />
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            {[...Array(4)].map((_, i) => <Skeleton key={i} w="72px" h="72px" radius="10px" />)}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingTop: "8px" }}>
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
    <div className="pd-root" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <PdStyles />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "16px" }}>😔</div>
        <h2 style={{ color: "var(--text)", marginBottom: "8px" }}>Product not found</h2>
        <p style={{ color: "var(--muted)", marginBottom: "24px" }}>This listing may have been removed or expired.</p>
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
      <PdStyles />

      {/* ── Page wrapper ───────────────────────────────────────────── */}
      <div className="pd-container" style={{ paddingTop: "20px", paddingBottom: "80px" }}>

        {/* Breadcrumb */}
        <nav style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "24px", fontSize: "0.8rem", color: "var(--muted)" }}>
          <button onClick={() => navigate("/")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontFamily: "inherit", padding: 0, fontSize: "inherit" }}>Home</button>
          <span>/</span>
          {product.category_name && <><span>{product.category_name}</span><span>/</span></>}
          <span style={{ color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "200px" }}>{product.title}</span>
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
            <div
              className="pd-main-img-wrap"
              onClick={() => setImgZoomed(true)}
              style={{ cursor: "zoom-in" }}
            >
              {product.is_promoted && (
                <div className="pd-badge-promoted">
                  ⚡ {product.promotion_type || "Featured"}
                </div>
              )}
              {mainImg
                ? <img key={mainImg} src={mainImg} alt={product.title} className="pd-main-img" />
                : <div className="pd-img-placeholder">🖼</div>
              }
              {/* nav arrows */}
              {images.length > 1 && (
                <>
                  <button className="pd-img-arrow pd-img-arrow--l" onClick={(e) => { e.stopPropagation(); prevImg(); }}><Icon.ChevronLeft /></button>
                  <button className="pd-img-arrow pd-img-arrow--r" onClick={(e) => { e.stopPropagation(); nextImg(); }}><Icon.ChevronRight /></button>
                  <div className="pd-img-dots">
                    {images.map((_, i) => (
                      <span key={i} onClick={(e) => { e.stopPropagation(); setImgIdx(i); }}
                        style={{ width: i === imgIdx ? "22px" : "7px", height: "7px", borderRadius: "4px",
                          background: i === imgIdx ? "var(--accent)" : "rgba(255,255,255,.5)",
                          transition: "width .25s, background .25s", cursor: "pointer" }} />
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
              <span style={{ marginLeft: "auto", color: "var(--muted)" }}>{timeAgo(product.created_at)}</span>
            </div>
          </div>

          {/* ════ RIGHT — Details ════ */}
          <div className="pd-detail-col">

            {/* Title + actions */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
              <h1 className="pd-title">{product.title}</h1>
              <div style={{ display: "flex", gap: "8px", flexShrink: 0, marginTop: "4px" }}>
                <button
                  onClick={() => setWishlisted(!wishlisted)}
                  className={`pd-action-btn ${wishlisted ? "pd-action-btn--active" : ""}`}
                  title="Save"
                >
                  <Icon.Heart filled={wishlisted} />
                </button>
                <button onClick={handleShare} className="pd-action-btn" title="Share">
                  {copied ? <span style={{ fontSize: "0.7rem", fontWeight: 700 }}>✓</span> : <Icon.Share />}
                </button>
              </div>
            </div>

            {/* Price row */}
            <div style={{ display: "flex", alignItems: "baseline", gap: "12px", margin: "12px 0 20px" }}>
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "20px" }}>
                {[
                  product.brand   && { l: "Brand",   v: product.brand },
                  product.model   && { l: "Model",   v: product.model },
                  product.color   && { l: "Color",   v: product.color },
                  product.ram     && { l: "RAM",     v: product.ram },
                  product.storage && { l: "Storage", v: product.storage },
                ].filter(Boolean).map(({ l, v }) => (
                  <div key={l} className="pd-spec-pill">
                    <span style={{ color: "var(--muted)", fontSize: "0.7rem" }}>{l}</span>
                    <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Location */}
            {product.location?.label && (
              <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--muted)", fontSize: "0.83rem", marginBottom: "16px" }}>
                <Icon.MapPin />{product.location.label}
              </div>
            )}

            {/* Highlights */}
            {product.highlights?.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: "10px" }}>Highlights</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                  {product.highlights.map((h, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.875rem", color: "var(--text)" }}>
                      <span style={{ color: "var(--accent)", flexShrink: 0 }}><Icon.Check /></span>{h}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div style={{ marginBottom: "24px" }}>
              <p style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: "10px" }}>Description</p>
              <p style={{ fontSize: "0.9rem", color: "var(--text)", lineHeight: 1.75, whiteSpace: "pre-line" }}>
                {product.description || "No description provided."}
              </p>
            </div>

            {/* ── Seller card ──────────────────────────────────────────── */}
            <div className="pd-seller-card">
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="pd-seller-avatar-wrap">
                  {seller.avatar
                    ? <img src={seller.avatar} alt={seller.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: "1.3rem" }}>👤</span>
                  }
                  {seller.is_online && <span className="pd-online-dot" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
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
                    <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "2px" }}>{seller.store_name}</p>
                  )}
                  <div style={{ display: "flex", gap: "12px", marginTop: "5px", flexWrap: "wrap" }}>
                    {seller.rating > 0 && (
                      <span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "0.78rem", color: "#f59e0b" }}>
                        <Icon.Star />{Number(seller.rating).toFixed(1)}
                      </span>
                    )}
                    {seller.trust_score != null && (
                      <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                        Trust {seller.trust_score}%
                      </span>
                    )}
                    {seller.listings_count > 0 && (
                      <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                        <Icon.Package /> {seller.listings_count} listings
                      </span>
                    )}
                    {seller.location?.label && (
                      <span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "0.78rem", color: "var(--muted)" }}>
                        <Icon.MapPin />{seller.location.label}
                      </span>
                    )}
                  </div>
                  {seller.member_since && (
                    <p style={{ fontSize: "0.73rem", color: "var(--muted)", marginTop: "3px" }}>
                      Member since {new Date(seller.member_since).getFullYear()}
                    </p>
                  )}
                </div>
              </div>

              {/* Contact buttons */}
              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
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
              <div className="pd-info-box" style={{ marginTop: "16px" }}>
                <p style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Icon.Package /> Delivery
                </p>
                {product.delivery.available !== undefined && (
                  <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                    {product.delivery.available ? "✓ Delivery available" : "✗ No delivery — pickup only"}
                  </p>
                )}
                {product.delivery.fee != null && (
                  <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Fee: {product.delivery.fee === 0 ? "Free" : fmt(product.delivery.fee)}</p>
                )}
                {product.delivery.duration && (
                  <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Duration: {product.delivery.duration}</p>
                )}
                {product.delivery.note && (
                  <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginTop: "4px", fontStyle: "italic" }}>{product.delivery.note}</p>
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
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
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
            <div style={{ borderTop: "1px solid var(--border)" }}>
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
              <button className="pd-lightbox-arrow pd-lightbox-arrow--l" onClick={(e) => { e.stopPropagation(); prevImg(); }}><Icon.ChevronLeft /></button>
              <button className="pd-lightbox-arrow pd-lightbox-arrow--r" onClick={(e) => { e.stopPropagation(); nextImg(); }}><Icon.ChevronRight /></button>
            </>
          )}
          <img
            src={mainImg} alt={product.title}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "92vw", maxHeight: "90vh", objectFit: "contain", borderRadius: "12px", boxShadow: "0 32px 80px rgba(0,0,0,.5)" }}
          />
          {images.length > 1 && (
            <p style={{ color: "rgba(255,255,255,.6)", marginTop: "12px", fontSize: "0.85rem" }}>{imgIdx + 1} / {images.length}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ALL STYLES — injected once as a <style> tag
══════════════════════════════════════════════════════════════════════════════ */
function PdStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap');

      :root {
        --accent:   #d4622a;
        --accent2:  #f0874a;
        --text:     #1a1a1a;
        --muted:    #6b7280;
        --border:   #e5e7eb;
        --card:     #ffffff;
        --bg:       #f8f7f5;
        --sk:       #ebebeb;
        --skeleton: #f0eeeb;
        --seller-bg:#fdfaf7;
        --info-bg:  #f9f9f9;
        --shadow:   0 2px 16px rgba(0,0,0,.07);
        --shadow-lg:0 8px 40px rgba(0,0,0,.12);
      }

      @keyframes pulse {
        0%,100%{ opacity:1 } 50%{ opacity:.45 }
      }
      @keyframes fadeUp {
        from{ opacity:0; transform:translateY(18px) }
        to  { opacity:1; transform:translateY(0) }
      }

      .pd-root {
        font-family: 'DM Sans', sans-serif;
        background: var(--bg);
        min-height: 100vh;
        color: var(--text);
      }

      .pd-container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 20px;
      }

      /* ── Back button ──────────────────────────────────────────────── */
      .pd-back-btn {
        display: inline-flex; align-items: center; gap: 6px;
        background: var(--card); border: 1px solid var(--border);
        border-radius: 10px; padding: 7px 14px;
        font-family: inherit; font-size: 0.83rem; font-weight: 500;
        color: var(--text); cursor: pointer;
        transition: background .15s, border-color .15s;
      }
      .pd-back-btn:hover { background: #f3f4f6; border-color: #d1d5db; }

      /* ── 2-col grid ───────────────────────────────────────────────── */
      .pd-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 40px;
        align-items: start;
      }
      @media(max-width:900px) {
        .pd-grid { grid-template-columns: 1fr; gap: 24px; }
      }

      /* ── Gallery ──────────────────────────────────────────────────── */
      .pd-gallery-col { position: sticky; top: 20px; }
      @media(max-width:900px){ .pd-gallery-col { position: static; } }

      .pd-main-img-wrap {
        position: relative; border-radius: 20px; overflow: hidden;
        aspect-ratio: 1/1; background: #f0eeeb;
        box-shadow: var(--shadow-lg);
        animation: fadeUp .4s ease both;
      }

      .pd-main-img {
        width: 100%; height: 100%; object-fit: cover;
        transition: transform .4s ease;
      }
      .pd-main-img-wrap:hover .pd-main-img { transform: scale(1.03); }

      .pd-img-placeholder {
        width: 100%; height: 100%; display: flex;
        align-items: center; justify-content: center;
        font-size: 4rem; color: #c9c9c9;
      }

      .pd-badge-promoted {
        position: absolute; top: 14px; left: 14px; z-index: 2;
        background: var(--accent); color: #fff;
        padding: 5px 12px; border-radius: 20px;
        font-size: 0.75rem; font-weight: 700; letter-spacing: .03em;
      }

      .pd-img-arrow {
        position: absolute; top: 50%; transform: translateY(-50%);
        background: rgba(255,255,255,.9); border: none; border-radius: 50%;
        width: 36px; height: 36px; display: flex; align-items: center;
        justify-content: center; cursor: pointer; z-index: 3;
        box-shadow: 0 2px 8px rgba(0,0,0,.15);
        transition: background .15s, transform .15s;
      }
      .pd-img-arrow:hover { background: #fff; transform: translateY(-50%) scale(1.1); }
      .pd-img-arrow--l { left: 12px; }
      .pd-img-arrow--r { right: 12px; }

      .pd-img-dots {
        position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%);
        display: flex; gap: 5px; align-items: center; z-index: 3;
      }

      .pd-thumbs {
        display: flex; gap: 8px; margin-top: 10px; overflow-x: auto;
        scrollbar-width: none; padding-bottom: 4px;
      }
      .pd-thumbs::-webkit-scrollbar { display: none; }

      .pd-thumb {
        flex-shrink: 0; width: 68px; height: 68px; border-radius: 10px;
        overflow: hidden; border: 2px solid transparent;
        cursor: pointer; padding: 0;
        transition: border-color .2s, transform .2s;
      }
      .pd-thumb:hover { transform: scale(1.05); }
      .pd-thumb--active { border-color: var(--accent); }

      .pd-stats-row {
        display: flex; align-items: center; gap: 14px;
        margin-top: 12px; font-size: 0.78rem; color: var(--muted);
        flex-wrap: wrap;
      }
      .pd-stats-row span { display: flex; align-items: center; gap: 4px; }

      /* ── Detail column ────────────────────────────────────────────── */
      .pd-detail-col { animation: fadeUp .4s ease .1s both; }

      .pd-title {
        font-family: 'Cormorant Garamond', serif;
        font-size: clamp(1.5rem, 3vw, 2.1rem);
        font-weight: 700; line-height: 1.2;
        color: var(--text); margin: 0;
        letter-spacing: -.01em;
      }

      .pd-price {
        font-size: clamp(1.6rem, 3.5vw, 2.2rem);
        font-weight: 700; color: var(--accent);
        font-variant-numeric: tabular-nums;
        letter-spacing: -.02em;
      }

      /* Badges */
      .pd-badge {
        display: inline-flex; align-items: center; gap: 3px;
        padding: 3px 9px; border-radius: 20px;
        font-size: 0.72rem; font-weight: 600; letter-spacing: .02em;
      }
      .pd-badge--green  { background: #dcfce7; color: #15803d; }
      .pd-badge--neutral{ background: #f1f5f9; color: #475569; }
      .pd-badge--blue   { background: #dbeafe; color: #1d4ed8; }
      .pd-badge--gold   { background: #fef3c7; color: #92400e; }

      /* Spec pills */
      .pd-spec-pill {
        display: flex; flex-direction: column; gap: 2px;
        padding: 8px 12px; background: var(--card);
        border: 1px solid var(--border); border-radius: 10px;
        min-width: 70px;
      }

      /* Action buttons */
      .pd-action-btn {
        width: 40px; height: 40px; border-radius: 12px;
        border: 1px solid var(--border); background: var(--card);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; color: var(--muted);
        transition: color .15s, border-color .15s, background .15s;
      }
      .pd-action-btn:hover { color: var(--accent); border-color: var(--accent); }
      .pd-action-btn--active { color: #ef4444; border-color: #fca5a5; background: #fff1f1; }

      /* Seller card */
      .pd-seller-card {
        background: var(--seller-bg);
        border: 1px solid var(--border);
        border-radius: 16px; padding: 18px;
        box-shadow: var(--shadow);
      }

      .pd-seller-avatar-wrap {
        width: 54px; height: 54px; border-radius: 50%; flex-shrink: 0;
        background: #e5e7eb; overflow: hidden; position: relative;
        display: flex; align-items: center; justify-content: center;
        border: 2px solid var(--border);
      }

      .pd-online-dot {
        position: absolute; bottom: 2px; right: 2px;
        width: 11px; height: 11px; background: #22c55e;
        border-radius: 50%; border: 2px solid #fff;
      }

      .pd-seller-name {
        font-weight: 700; font-size: 0.95rem; color: var(--text);
      }

      /* Contact buttons */
      .pd-btn-whatsapp {
        flex: 1; display: flex; align-items: center; justify-content: center;
        gap: 7px; padding: 11px 16px; border-radius: 12px;
        background: #25d366; color: #fff; border: none;
        font-family: inherit; font-size: 0.88rem; font-weight: 600;
        cursor: pointer; transition: background .15s, transform .12s;
      }
      .pd-btn-whatsapp:hover { background: #20b558; transform: translateY(-1px); }
      .pd-btn-whatsapp:active{ transform: translateY(0); }

      .pd-btn-phone {
        flex: 1; display: flex; align-items: center; justify-content: center;
        gap: 7px; padding: 11px 16px; border-radius: 12px;
        background: var(--card); color: var(--text);
        border: 1.5px solid var(--border);
        font-family: inherit; font-size: 0.88rem; font-weight: 600;
        cursor: pointer; transition: background .15s, border-color .15s, transform .12s;
      }
      .pd-btn-phone:hover { background: #f3f4f6; border-color: #9ca3af; transform: translateY(-1px); }

      .pd-btn-outline {
        padding: 10px 22px; border-radius: 10px;
        border: 1.5px solid var(--border); background: var(--card);
        font-family: inherit; font-size: 0.88rem; font-weight: 600;
        color: var(--text); cursor: pointer;
        transition: background .15s;
      }
      .pd-btn-outline:hover { background: #f3f4f6; }

      /* Info box */
      .pd-info-box {
        background: var(--info-bg);
        border: 1px solid var(--border); border-radius: 12px;
        padding: 14px 16px;
        font-size: 0.85rem; color: var(--text);
      }

      /* ── Sections ─────────────────────────────────────────────────── */
      .pd-section { margin-top: 48px; }

      .pd-section-title {
        font-family: 'Cormorant Garamond', serif;
        font-size: 1.5rem; font-weight: 700;
        color: var(--text); margin: 0 0 20px;
        padding-bottom: 12px;
        border-bottom: 2px solid var(--accent);
        display: inline-block;
      }

      /* Specs grid */
      .pd-specs-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 1px; background: var(--border);
        border: 1px solid var(--border); border-radius: 14px; overflow: hidden;
      }

      .pd-spec-row {
        display: flex; flex-direction: column; gap: 2px;
        padding: 12px 16px; background: var(--card);
      }

      .pd-spec-key {
        font-size: 0.72rem; font-weight: 600;
        text-transform: uppercase; letter-spacing: .06em;
        color: var(--muted);
      }

      .pd-spec-val {
        font-size: 0.9rem; font-weight: 500; color: var(--text);
      }

      /* Feature tags */
      .pd-feature-tag {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 7px 14px; border-radius: 20px;
        background: var(--card); border: 1px solid var(--border);
        font-size: 0.82rem; font-weight: 500; color: var(--text);
      }
      .pd-feature-tag svg { color: var(--accent); }

      /* FAQ */
      .pd-faq-item button:hover { color: var(--accent); }

      /* Related grid */
      .pd-related-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 16px;
      }

      .pd-related-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
      .pd-related-card:hover .pd-related-img { transform: scale(1.06); }

      /* ── Lightbox ─────────────────────────────────────────────────── */
      .pd-lightbox {
        position: fixed; inset: 0; z-index: 1000;
        background: rgba(0,0,0,.88); backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center;
        flex-direction: column;
        animation: fadeUp .2s ease;
      }

      .pd-lightbox-close {
        position: absolute; top: 18px; right: 22px;
        background: rgba(255,255,255,.15); color: #fff;
        border: none; border-radius: 50%; width: 40px; height: 40px;
        font-size: 1rem; cursor: pointer; display: flex;
        align-items: center; justify-content: center;
        transition: background .15s;
      }
      .pd-lightbox-close:hover { background: rgba(255,255,255,.25); }

      .pd-lightbox-arrow {
        position: absolute; top: 50%; transform: translateY(-50%);
        background: rgba(255,255,255,.15); color: #fff;
        border: none; border-radius: 50%;
        width: 44px; height: 44px; display: flex;
        align-items: center; justify-content: center;
        cursor: pointer; transition: background .15s;
      }
      .pd-lightbox-arrow:hover { background: rgba(255,255,255,.28); }
      .pd-lightbox-arrow--l { left: 20px; }
      .pd-lightbox-arrow--r { right: 20px; }

      @media(max-width:640px) {
        .pd-related-grid { grid-template-columns: repeat(2,1fr); gap: 12px; }
        .pd-specs-grid   { grid-template-columns: 1fr; }
      }
    `}</style>
  );
}
