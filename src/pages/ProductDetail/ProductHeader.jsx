/**
 * src/pages/ProductDetail/ProductHeader.jsx
 */

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
} from "react";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const PH           = "https://placehold.co/800x600/f0ede8/b0a89e?text=Loemart";
const DESC_WORD_MAX = 80;

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
  return new Date(d).toLocaleDateString("en-NG", {
    month: "short",
    year:  "numeric",
  });
};

const fmtKey = (k) =>
  k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const getImages = (p) => {
  if (!p) return [PH];
  const seen = new Set();
  const imgs = [];

  const push = (url) => {
    if (url && !seen.has(url)) {
      seen.add(url);
      imgs.push(url);
    }
  };

  if (Array.isArray(p.images)) {
    p.images.forEach((img) => {
      if (!img) return;
      push(typeof img === "string" ? img : img?.url || img?.image_url);
    });
  }

  if (!imgs.length) push(p.main_image);
  if (!imgs.length) push(p.thumbnail_url);
  if (!imgs.length) push(p.image);

  return imgs.length ? imgs : [PH];
};

/* ═══════════════════════════════════════════════════════════════
   LIGHTBOX
═══════════════════════════════════════════════════════════════ */
const Lightbox = memo(function Lightbox({
  images,
  activeImg,
  onClose,
  onSetActive,
}) {
  const hasMany = images.length > 1;

  const prev = useCallback(
    () => onSetActive((i) => (i - 1 + images.length) % images.length),
    [images.length, onSetActive]
  );

  const next = useCallback(
    () => onSetActive((i) => (i + 1) % images.length),
    [images.length, onSetActive]
  );

  /* keyboard navigation */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape")     onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft")  prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  /* focus trap — move focus into dialog on mount */
  const dialogRef = useRef(null);
  useEffect(() => { dialogRef.current?.focus(); }, []);

  return (
    <div
      className="pd-lightbox"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image lightbox"
      ref={dialogRef}
      tabIndex={-1}
    >
      {/* Close */}
      <button
        className="pd-lb-close"
        onClick={onClose}
        aria-label="Close lightbox"
      >
        ✕
      </button>

      {/* Prev / Next */}
      {hasMany && (
        <>
          <button
            className="pd-lb-prev"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            aria-label="Previous image"
          >
            ‹
          </button>
          <button
            className="pd-lb-next"
            onClick={(e) => { e.stopPropagation(); next(); }}
            aria-label="Next image"
          >
            ›
          </button>
        </>
      )}

      {/* Image */}
      <img
        className="pd-lb-img"
        src={images[activeImg]}
        alt={`Product image ${activeImg + 1} of ${images.length}`}
        onClick={(e) => e.stopPropagation()}
        onError={(e) => { e.currentTarget.src = PH; }}
      />

      {/* Counter */}
      {hasMany && (
        <p
          className="pd-lb-counter"
          aria-live="polite"
          aria-atomic="true"
        >
          {activeImg + 1} / {images.length}
        </p>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   FAQ ITEM
═══════════════════════════════════════════════════════════════ */
const FaqItem = memo(function FaqItem({ q, a, id }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <div className="pd-faq-item">
      <button
        className="pd-faq-q"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={`faq-answer-${id}`}
        id={`faq-question-${id}`}
      >
        <span>{q}</span>
        <span
          className={`pd-faq-arrow${open ? " pd-faq-arrow--open" : ""}`}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>
      {open && (
        <p
          id={`faq-answer-${id}`}
          role="region"
          aria-labelledby={`faq-question-${id}`}
          className="pd-faq-a"
        >
          {a}
        </p>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SHARE TOAST  — replaces alert()
═══════════════════════════════════════════════════════════════ */
const ShareToast = memo(function ShareToast({ show }) {
  if (!show) return null;
  return (
    <div
      className="pd-share-toast"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      ✓ Link copied
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   PRODUCT HEADER
═══════════════════════════════════════════════════════════════ */
export default function ProductHeader({
  product,
  fav,
  onToggleFav,
  onNavigateBack,
  isOwn,
  onEditListing,
}) {
  const [activeImg,  setActiveImg]  = useState(0);
  const [lightbox,   setLightbox]   = useState(false);
  const [expanded,   setExpanded]   = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // ✅ Ref instead of state — no re-render on every touch
  const touchStartX = useRef(null);

  /* ── derived data ──────────────────────────────────────── */
  const images = useMemo(() => getImages(product), [product]);
  const hasMany = images.length > 1;

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

  const words    = useMemo(() => (product?.description || "").split(" "), [product?.description]);
  const longDesc = words.length > DESC_WORD_MAX;

  /* ── touch / swipe ─────────────────────────────────────── */
  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      setActiveImg((i) =>
        diff > 0
          ? (i + 1) % images.length
          : (i - 1 + images.length) % images.length
      );
    }
    touchStartX.current = null;
  }, [images.length]);

  /* ── share ─────────────────────────────────────────────── */
  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.title,
          url:   window.location.href,
        });
      } catch {
        /* user cancelled — do nothing */
      }
      return;
    }
    // Fallback: clipboard
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      /* clipboard unavailable */
    }
  }, [product?.title]);

  /* ── actions ───────────────────────────────────────────── */
  const openLightbox  = useCallback(() => setLightbox(true),  []);
  const closeLightbox = useCallback(() => setLightbox(false), []);
  const toggleExpand  = useCallback(() => setExpanded((v) => !v), []);

  /* ── guard ─────────────────────────────────────────────── */
  if (!product) return null;

  return (
    <>
      {/* ── Share toast ─────────────────────────── */}
      <ShareToast show={shareCopied} />

      {/* ── Top bar ─────────────────────────────── */}
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
            aria-hidden="true"
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
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}

          <button
            className="pd-topbar-btn"
            onClick={handleShare}
            aria-label="Share this listing"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="18" cy="5"  r="3" />
              <circle cx="6"  cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
            </svg>
          </button>

          <button
            className={`pd-topbar-btn${fav ? " pd-topbar-btn--fav" : ""}`}
            onClick={onToggleFav}
            aria-label={fav ? "Remove from favourites" : "Save to favourites"}
            aria-pressed={fav}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill={fav ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Gallery ─────────────────────────────── */}
      <div className="pd-gallery">
        <div
          className="pd-main-wrap"
          onClick={openLightbox}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          role="button"
          tabIndex={0}
          aria-label={`View full image — ${activeImg + 1} of ${images.length}`}
          onKeyDown={(e) => e.key === "Enter" && openLightbox()}
        >
          {product.is_promoted && (
            <span className="pd-badge-promo" aria-label="Featured listing">
              ⭐ Featured
            </span>
          )}

          <img
            className="pd-main-img"
            src={images[activeImg]}
            alt={`${product.title} — image ${activeImg + 1}`}
            loading="eager"
            decoding="async"
            fetchpriority="high"   /* ✅ lowercase — valid HTML attr */
            onError={(e) => { e.currentTarget.src = PH; }}
          />

          {hasMany && (
            <span
              className="pd-img-counter"
              aria-live="polite"
              aria-atomic="true"
            >
              {activeImg + 1} / {images.length}
            </span>
          )}

          <span className="pd-zoom-hint" aria-hidden="true">
            🔍 Tap to zoom
          </span>
        </div>

        {/* Thumbnails */}
        {hasMany && (
          <div
            className="pd-thumbs"
            role="listbox"
            aria-label="Product images"
          >
            {images.map((src, i) => (
              <button
                key={src}               /* ✅ stable key — url not index */
                role="option"
                aria-selected={activeImg === i}
                aria-label={`Image ${i + 1}`}
                className={`pd-thumb${activeImg === i ? " pd-thumb--active" : ""}`}
                onClick={() => setActiveImg(i)}
              >
                <img
                  src={src}
                  alt={`Thumbnail ${i + 1}`}
                  loading="lazy"
                  onError={(e) => { e.currentTarget.src = PH; }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Title + Price ────────────────────────── */}
      <div className="pd-title-block">
        {/* Breadcrumb */}
        {product.category_name && (
          <p className="pd-crumb" aria-label="Category">
            {product.category_name}
            {product.subcategory_name && (
              <> <span aria-hidden="true">›</span> {product.subcategory_name}</>
            )}
          </p>
        )}

        <h1 className="pd-title">{product.title}</h1>

        {/* Price row */}
        <div className="pd-price-row">
          <span className="pd-price" aria-label={`Price: ${naira(product.price)}`}>
            {naira(product.price)}
          </span>
          {product.is_promoted && (
            <span className="pd-price-tag">Promoted</span>
          )}
        </div>

        {/* Meta stats */}
        <div className="pd-meta-row" aria-label="Listing statistics">
          {(product.views ?? 0) > 0 && (
            <span className="pd-meta" aria-label={`${fmtNum(product.views)} views`}>
              {fmtNum(product.views)} views
            </span>
          )}
          {(product.favorites_count ?? 0) > 0 && (
            <span className="pd-meta" aria-label={`${product.favorites_count} saves`}>
              ♥ {product.favorites_count}
            </span>
          )}
          {product.created_at && (
            <span className="pd-meta">
              <time dateTime={product.created_at}>
                {timeAgo(product.created_at)}
              </time>
            </span>
          )}
        </div>

        {/* Location */}
        {(product.location_city || product.location_state) && (
          <div className="pd-location-pill" aria-label="Location">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
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

      {/* ── Description ─────────────────────────── */}
      {product.description && (
        <section className="pd-section" aria-label="Product description">
          <h3 className="pd-section-h">About this product</h3>
          <p className="pd-description">
            {longDesc && !expanded
              ? words.slice(0, DESC_WORD_MAX).join(" ") + "…"
              : product.description}
          </p>
          {longDesc && (
            <button
              className="pd-toggle"
              onClick={toggleExpand}
              aria-expanded={expanded}
            >
              {expanded ? "Show less ↑" : "Read more ↓"}
            </button>
          )}
        </section>
      )}

      {/* ── Features ────────────────────────────── */}
      {features.length > 0 && (
        <section className="pd-section" aria-label="Product features">
          <h3 className="pd-section-h">Features</h3>
          <ul className="pd-features">
            {features.map((f, i) => {
              const text = typeof f === "string" ? f : f?.text || String(f);
              return (
                <li key={text || i} className="pd-feature">
                  <span className="pd-feature-check" aria-hidden="true">✓</span>
                  <span>{text}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ── Details (attributes) ────────────────── */}
      {attrs.length > 0 && (
        <section className="pd-section" aria-label="Product details">
          <h3 className="pd-section-h">Details</h3>
          <div className="pd-table" role="table" aria-label="Product attributes">
            {attrs.map(([k, v]) => (
              <div key={k} className="pd-table-row" role="row">
                <span className="pd-table-key" role="rowheader">{fmtKey(k)}</span>
                <span className="pd-table-val" role="cell">
                  {Array.isArray(v) ? v.join(", ") : String(v)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Specifications ──────────────────────── */}
      {specs.length > 0 && (
        <section className="pd-section" aria-label="Product specifications">
          <h3 className="pd-section-h">Specifications</h3>
          <div className="pd-table" role="table" aria-label="Specifications">
            {specs.map(([k, v]) => (
              <div key={k} className="pd-table-row" role="row">
                <span className="pd-table-key" role="rowheader">{fmtKey(k)}</span>
                <span className="pd-table-val" role="cell">{String(v)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Delivery ────────────────────────────── */}
      {delivery && (
        <section className="pd-section" aria-label="Delivery information">
          <h3 className="pd-section-h">Delivery</h3>
          <div className="pd-delivery-card">
            <div className="pd-delivery-icon" aria-hidden="true">🚚</div>
            <div className="pd-delivery-info">
              <p className="pd-delivery-label">
                {delivery.duration?.from && delivery.duration?.to
                  ? `${delivery.duration.from}–${delivery.duration.to} days`
                  : "Available"}
              </p>
              {delivery.fee != null && (
                <p className="pd-delivery-fee">
                  Fee:{" "}
                  {Number(delivery.fee) === 0 ? "Free" : naira(delivery.fee)}
                </p>
              )}
              {delivery.note && (
                <p className="pd-delivery-note">{delivery.note}</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── FAQs ────────────────────────────────── */}
      {faqs.length > 0 && (
        <section className="pd-section" aria-label="Frequently asked questions">
          <h3 className="pd-section-h">FAQs</h3>
          <div className="pd-faqs">
            {faqs.map((item, i) => (
              <FaqItem
                key={item.q}          /* ✅ stable key — question text */
                id={`${i}`}
                q={item.q}
                a={item.a}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Lightbox ────────────────────────────── */}
      {lightbox && (
        <Lightbox
          images={images}
          activeImg={activeImg}
          onClose={closeLightbox}
          onSetActive={setActiveImg}
        />
      )}
    </>
  );
}