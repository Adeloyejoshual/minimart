/**
 * src/pages/ProductDetail/ProductHeader.jsx
 *
 * Gallery (full uncropped images), title, price, location,
 * breadcrumb, meta stats, lightbox, favourites, share.
 */

import { useState, useEffect, useCallback, useMemo, memo } from "react";

const PH = "https://placehold.co/800x600/f0ede8/b0a89e?text=Loemart";
const DESC_WORD_MAX = 80;

/* ── helpers ────────────────────────────────────────── */
const naira = (n) =>
  "₦" + Number(n || 0).toLocaleString("en-NG");

const fmtNum = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "m";
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return v.toLocaleString();
};

const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d)) / 1_000);
  if (s < 60) return "just now";
  if (s < 3_600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3_600)}h ago`;
  if (s < 2_592_000) return `${Math.floor(s / 86_400)}d ago`;
  return new Date(d).toLocaleDateString("en-NG", {
    month: "short",
    year: "numeric",
  });
};

const fmtKey = (k) =>
  k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const getImages = (p) => {
  if (!p) return [PH];
  const imgs = [];
  if (Array.isArray(p.images)) {
    p.images.forEach((img) => {
      if (!img) return;
      const url = typeof img === "string" ? img : img?.url || img?.image_url;
      if (url && !imgs.includes(url)) imgs.push(url);
    });
  }
  if (!imgs.length && p.main_image) imgs.push(p.main_image);
  if (!imgs.length && p.thumbnail_url) imgs.push(p.thumbnail_url);
  if (!imgs.length && p.image) imgs.push(p.image);
  return imgs.length ? imgs : [PH];
};

/* ── Lightbox ───────────────────────────────────────── */
function Lightbox({ images, activeImg, onClose, onSetActive }) {
  useEffect(() => {
    const h = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight")
        onSetActive((activeImg + 1) % images.length);
      if (e.key === "ArrowLeft")
        onSetActive((activeImg - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [activeImg, images.length, onClose, onSetActive]);

  return (
    <div className="pd-lightbox" onClick={onClose}>
      <button
        className="pd-lb-close"
        onClick={onClose}
        aria-label="Close"
      >
        ✕
      </button>

      {images.length > 1 && (
        <>
          <button
            className="pd-lb-prev"
            onClick={(e) => {
              e.stopPropagation();
              onSetActive(
                (activeImg - 1 + images.length) % images.length
              );
            }}
            aria-label="Previous"
          >
            ‹
          </button>
          <button
            className="pd-lb-next"
            onClick={(e) => {
              e.stopPropagation();
              onSetActive((activeImg + 1) % images.length);
            }}
            aria-label="Next"
          >
            ›
          </button>
        </>
      )}

      <img
        className="pd-lb-img"
        src={images[activeImg]}
        alt="Full view"
        onClick={(e) => e.stopPropagation()}
        onError={(e) => {
          e.currentTarget.src = PH;
        }}
      />

      {images.length > 1 && (
        <p className="pd-lb-counter">
          {activeImg + 1} / {images.length}
        </p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   PRODUCT HEADER
══════════════════════════════════════════════════════ */
export default function ProductHeader({
  product,
  fav,
  onToggleFav,
  onNavigateBack,
  isOwn,
  onEditListing,
}) {
  const [activeImg, setActiveImg] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Touch / swipe state
  const [touchStartX, setTouchStartX] = useState(null);

  const images = useMemo(() => getImages(product), [product]);

  const attrs = useMemo(() => {
    const a = product?.attributes;
    if (!a || typeof a !== "object") return [];
    return Object.entries(a).filter(
      ([, v]) => v != null && v !== "" && !Array.isArray(v)
    );
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

  /* swipe handlers */
  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (touchStartX === null) return;
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        setActiveImg((i) => (i + 1) % images.length);
      } else {
        setActiveImg((i) => (i - 1 + images.length) % images.length);
      }
    }
    setTouchStartX(null);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product.title,
        url: window.location.href,
      });
    } else {
      navigator.clipboard?.writeText(window.location.href);
      alert("Link copied!");
    }
  };

  if (!product) return null;

  const words = (product.description || "").split(" ");
  const longDesc = words.length > DESC_WORD_MAX;

  return (
    <>
      {/* ── Top bar ──────────────────────────────── */}
      <div className="pd-topbar">
        <button
          className="pd-topbar-back"
          onClick={onNavigateBack}
          aria-label="Go back"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>

        <div className="pd-topbar-actions">
          {isOwn && (
            <button
              className="pd-topbar-btn pd-topbar-btn--edit"
              onClick={onEditListing}
              aria-label="Edit listing"
            >
              ✏️
            </button>
          )}

          <button
            className="pd-topbar-btn"
            onClick={handleShare}
            aria-label="Share"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
            </svg>
          </button>

          <button
            className={`pd-topbar-btn${fav ? " pd-topbar-btn--fav" : ""}`}
            onClick={onToggleFav}
            aria-label={
              fav ? "Remove from favourites" : "Add to favourites"
            }
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill={fav ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Gallery ──────────────────────────────── */}
      <div className="pd-gallery">
        <div
          className="pd-main-wrap"
          onClick={() => setLightbox(true)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
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
            onError={(e) => {
              e.currentTarget.src = PH;
            }}
          />
          {images.length > 1 && (
            <span className="pd-img-counter">
              {activeImg + 1} / {images.length}
            </span>
          )}
          <span className="pd-zoom-hint">🔍 Tap to zoom</span>
        </div>

        {images.length > 1 && (
          <div className="pd-thumbs">
            {images.map((src, i) => (
              <button
                key={i}
                className={`pd-thumb${
                  activeImg === i ? " pd-thumb--active" : ""
                }`}
                onClick={() => setActiveImg(i)}
                aria-label={`View image ${i + 1}`}
              >
                <img
                  src={src}
                  alt={`${i + 1}`}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.src = PH;
                  }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Title + Price ────────────────────────── */}
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
            <span className="pd-meta">
              {fmtNum(product.views)} views
            </span>
          )}
          {product.favorites_count > 0 && (
            <span className="pd-meta">
              ♥ {product.favorites_count}
            </span>
          )}
          <span className="pd-meta">
            {timeAgo(product.created_at)}
          </span>
        </div>

        {(product.location_city || product.location_state) && (
          <div className="pd-location-pill">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            <span>
              {[product.location_city, product.location_state]
                .filter(Boolean)
                .join(", ")}
            </span>
          </div>
        )}
      </div>

      {/* ── Description ──────────────────────────── */}
      {product.description && (
        <div className="pd-section">
          <h3 className="pd-section-h">About this product</h3>
          <p className="pd-description">
            {longDesc && !expanded
              ? words.slice(0, DESC_WORD_MAX).join(" ") + "…"
              : product.description}
          </p>
          {longDesc && (
            <button
              className="pd-toggle"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Show less ↑" : "Read more ↓"}
            </button>
          )}
        </div>
      )}

      {/* ── Features ─────────────────────────────── */}
      {features.length > 0 && (
        <div className="pd-section">
          <h3 className="pd-section-h">Features</h3>
          <ul className="pd-features">
            {features.map((f, i) => (
              <li key={i} className="pd-feature">
                <span className="pd-feature-check">✓</span>
                <span>
                  {typeof f === "string" ? f : f?.text || String(f)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Details (attributes) ─────────────────── */}
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

      {/* ── Specifications ───────────────────────── */}
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

      {/* ── Delivery ─────────────────────────────── */}
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
                  Fee:{" "}
                  {Number(delivery.fee) === 0
                    ? "Free"
                    : naira(delivery.fee)}
                </p>
              )}
              {delivery.note && (
                <p className="pd-delivery-note">{delivery.note}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── FAQ ──────────────────────────────────── */}
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

      {/* ── Seller card ──────────────────────────── */}
      <SellerSection
        seller={product._seller}
        sellerId={product.seller_id}
      />

      {/* ── Lightbox ─────────────────────────────── */}
      {lightbox && (
        <Lightbox
          images={images}
          activeImg={activeImg}
          onClose={() => setLightbox(false)}
          onSetActive={setActiveImg}
        />
      )}
    </>
  );
}

/* ── Seller section (inside header file) ─────────── */
function SellerSection({ seller, sellerId }) {
  // seller is passed from parent or fetched there
  // This just renders the card
  return null; // handled in index.jsx
}

/* ── FAQ Item ────────────────────────────────────── */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pd-faq-item">
      <button
        className="pd-faq-q"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{q}</span>
        <span
          className={`pd-faq-arrow${
            open ? " pd-faq-arrow--open" : ""
          }`}
        >
          ▼
        </span>
      </button>
      {open && <p className="pd-faq-a">{a}</p>}
    </div>
  );
}