/**
 * src/loemart/HomePage.jsx
 * Route: /loemart
 *
 * Premium marketplace homepage — Amazon/Jumia/Apple level polish
 * No changes to App.jsx
 */

import {
  useState, useMemo, useCallback,
  useEffect, useRef, memo,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  FiSearch, FiShield, FiPackage, FiHeart,
  FiChevronRight, FiCamera, FiTag, FiCheckCircle,
  FiBell, FiAlertCircle, FiRefreshCw, FiSliders,
  FiX, FiPlus, FiEye, FiFilter, FiShoppingCart,
  FiTrendingUp, FiZap, FiMapPin, FiStar,
  FiClock, FiArrowRight, FiHome, FiGrid,
  FiUser, FiPackage as FiBox, FiChevronLeft,
  FiTruck, FiLock, FiRotateCcw, FiAward,
} from "react-icons/fi";

import categories from "../config/categories";
import "../styles/Minimart.css";
import "../styles/LoemartHome.css";
import "../styles/LoemartPremium.css";

/* ═══════════════════════════════════════════════════════════════
   ENV
═══════════════════════════════════════════════════════════════ */
const API      = `${import.meta.env.VITE_API_BASE_URL}/api`;
const CART_KEY = "mm_cart";
const RECENT_KEY = "lm-recently-viewed";
const SEARCH_HISTORY_KEY = "lm-search-history";

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const DEFAULT_LIMIT  = 24;
const SLIDE_INTERVAL = 6000;

const SORT_OPTIONS = [
  { value: "newest",     label: "Newest First",    icon: FiZap       },
  { value: "price_asc",  label: "Price: Low–High", icon: FiArrowRight },
  { value: "price_desc", label: "Price: High–Low", icon: FiArrowRight },
  { value: "trending",   label: "Trending",        icon: FiTrendingUp },
  { value: "views",      label: "Most Viewed",     icon: FiEye       },
  { value: "saves",      label: "Most Saved",      icon: FiHeart     },
];

const HERO_SLIDES = [
  {
    id     : 1,
    eyebrow: "Limited Time",
    title  : "Flash Sale\nUp to 70% Off",
    sub    : "Shop exclusive deals from verified sellers across Nigeria",
    cta    : "Shop Flash Sale",
    ctaSub : "Start Selling Free",
    bg     : "linear-gradient(135deg,#0f0c29 0%,#1a1a4e 45%,#302b63 100%)",
    accent : "#ff5722",
    tag    : "🔥",
  },
  {
    id     : 2,
    eyebrow: "New Arrivals",
    title  : "Fresh Picks\nEvery Day",
    sub    : "Discover the latest products from top sellers near you",
    cta    : "Explore Now",
    ctaSub : "Sell Your Items",
    bg     : "linear-gradient(135deg,#134e5e 0%,#0d3b47 50%,#1a6b4a 100%)",
    accent : "#10b981",
    tag    : "✨",
  },
  {
    id     : 3,
    eyebrow: "Safe & Verified",
    title  : "Shop With\nConfidence",
    sub    : "Every listing auto-scanned. Buyer protection on all orders.",
    cta    : "Browse Listings",
    ctaSub : "Post Ad Free",
    bg     : "linear-gradient(135deg,#1a0533 0%,#2d1b69 50%,#11998e 100%)",
    accent : "#6366f1",
    tag    : "🛡️",
  },
];

const TRENDING_SEARCHES = [
  "iPhone 15", "Samsung S24", "HP Laptop", "Nike Sneakers",
  "Gaming Chair", "PlayStation 5", "MacBook Air", "Smart TV",
];

const TRUST_BADGES = [
  { icon: FiShield,   label: "Verified Sellers",    color: "#6366f1" },
  { icon: FiLock,     label: "Secure Payments",      color: "#10b981" },
  { icon: FiTruck,    label: "Nationwide Delivery",  color: "#f59e0b" },
  { icon: FiRotateCcw,label: "Buyer Protection",     color: "#ef4444" },
];

const BOTTOM_NAV = [
  { icon: FiHome,         label: "Home",     path: "/loemart"      },
  { icon: FiGrid,         label: "Browse",   path: "/loemart"      },
  { icon: FiShoppingCart, label: "Cart",     path: "/shop/cart"    },
  { icon: FiHeart,        label: "Saved",    path: "/saved"        },
  { icon: FiUser,         label: "Account",  path: "/profile"      },
];

/* ═══════════════════════════════════════════════════════════════
   CART HELPERS
═══════════════════════════════════════════════════════════════ */
const loadCart = () => {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
  catch { return []; }
};
const saveCart = (cart) => {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
  window.dispatchEvent(new Event("cart-updated"));
};
const addToCart = (product) => {
  const cart    = loadCart();
  const existing = cart.find((i) => i.productId === product.id && !i.variant);
  if (existing) { existing.qty += 1; }
  else {
    cart.push({
      productId : product.id,
      name      : product.name,
      price     : Number(product.price),
      image     : primaryImg(product.images),
      qty       : 1,
      variant   : null,
      slug      : product.slug ?? product.id,
    });
  }
  saveCart(cart);
};
const getCartCount = () => loadCart().reduce((s, i) => s + (i.qty ?? 1), 0);

/* ═══════════════════════════════════════════════════════════════
   RECENTLY VIEWED
═══════════════════════════════════════════════════════════════ */
const getRecentlyViewed = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
  catch { return []; }
};
const addToRecentlyViewed = (product) => {
  try {
    const list = getRecentlyViewed().filter((p) => p.id !== product.id);
    list.unshift({ id: product.id, name: product.name, price: product.price,
      image: primaryImg(product.images), slug: product.slug ?? product.id });
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10)));
  } catch {}
};

/* ═══════════════════════════════════════════════════════════════
   SEARCH HISTORY
═══════════════════════════════════════════════════════════════ */
const getSearchHistory = () => {
  try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]"); }
  catch { return []; }
};
const addToSearchHistory = (q) => {
  if (!q.trim()) return;
  try {
    const list = getSearchHistory().filter((s) => s !== q);
    list.unshift(q);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(list.slice(0, 8)));
  } catch {}
};

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const normalize     = (s = "") => String(s).replace(/\s+/g, " ").trim();
const fmtPrice      = (n)      => `₦${Number(n).toLocaleString("en-NG")}`;
const calcDiscount  = (p)      => {
  const base = Number(p.price);
  const orig = Number(p.original_price ?? 0);
  return !orig || orig <= base ? 0 : Math.round(((orig - base) / orig) * 100);
};
const primaryImg = (images = []) => {
  if (!Array.isArray(images) || !images.length) return null;
  return (images.find((i) => i.is_primary) ?? images[0])?.url ?? null;
};
const allImages = (images = []) =>
  Array.isArray(images) ? images.map((i) => i.url).filter(Boolean) : [];

/* Fake rating from product data */
const fakeRating = (product) => {
  const seed = (product.view_count ?? 0) + (product.save_count ?? 0);
  return Math.min(5, 3.5 + (seed % 15) / 10);
};
const fakeSold = (product) => {
  const seed = product.view_count ?? 0;
  if (seed > 1000) return `${Math.floor(seed / 100) * 10}+ sold`;
  if (seed > 100)  return `${Math.floor(seed / 10) * 10}+ sold`;
  return null;
};

/* ═══════════════════════════════════════════════════════════════
   COUNTDOWN TIMER  (Flash Sales)
═══════════════════════════════════════════════════════════════ */
function useCountdown(targetHours = 4) {
  const end = useRef(Date.now() + targetHours * 3600000 + 22 * 60000 + 13000);
  const [time, setTime] = useState({ h:"04", m:"22", s:"13" });

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, end.current - Date.now());
      const h    = String(Math.floor(diff / 3600000)).padStart(2, "0");
      const m    = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
      const s    = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
      setTime({ h, m, s });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}

/* ═══════════════════════════════════════════════════════════════
   INTERSECTION OBSERVER  (Fade-in sections)
═══════════════════════════════════════════════════════════════ */
function useFadeIn() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, visible };
}

/* ═══════════════════════════════════════════════════════════════
   RIPPLE EFFECT HOOK
═══════════════════════════════════════════════════════════════ */
function useRipple() {
  const [ripples, setRipples] = useState([]);

  const trigger = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x    = e.clientX - rect.left;
    const y    = e.clientY - rect.top;
    const id   = Date.now();
    setRipples((prev) => [...prev, { id, x, y }]);
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600);
  }, []);

  const RippleContainer = useMemo(() => (
    <>
      {ripples.map((r) => (
        <span
          key={r.id}
          className="lm-ripple"
          style={{ left: r.x, top: r.y }}
          aria-hidden="true"
        />
      ))}
    </>
  ), [ripples]);

  return { trigger, RippleContainer };
}

/* ═══════════════════════════════════════════════════════════════
   STAR RATING
═══════════════════════════════════════════════════════════════ */
const StarRating = memo(function StarRating({ rating, count }) {
  const stars = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const fill = Math.min(1, Math.max(0, rating - i));
      return fill;
    });
  }, [rating]);

  return (
    <div className="lm-stars" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {stars.map((fill, i) => (
        <span key={i} className="lm-star-wrap">
          <FiStar
            size={10}
            className="lm-star-bg"
            aria-hidden="true"
          />
          <FiStar
            size={10}
            className="lm-star-fg"
            style={{ clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)` }}
            aria-hidden="true"
          />
        </span>
      ))}
      {count != null && (
        <span className="lm-star-count">({count.toLocaleString()})</span>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   IMAGE CAROUSEL  (inside card, no navigation needed)
═══════════════════════════════════════════════════════════════ */
const ImageCarousel = memo(function ImageCarousel({ images, alt }) {
  const [idx, setIdx] = useState(0);
  const imgs = images.slice(0, 4);

  if (imgs.length <= 1) {
    return imgs[0]
      ? <img src={imgs[0]} alt={alt} className="mp-card-img lm-card-img" loading="lazy"
          onError={(e) => { e.currentTarget.style.display = "none"; }} />
      : <div className="mp-card-placeholder"><FiPackage size={32} className="mp-placeholder-icon" /></div>;
  }

  return (
    <div className="lm-carousel">
      <img
        src={imgs[idx]}
        alt={`${alt} ${idx + 1}`}
        className="mp-card-img lm-card-img"
        loading="lazy"
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />
      {/* Dot indicators */}
      <div className="lm-carousel-dots" aria-hidden="true">
        {imgs.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`lm-carousel-dot ${i === idx ? "lm-carousel-dot--active" : ""}`}
            onClick={(e) => { e.stopPropagation(); setIdx(i); }}
          />
        ))}
      </div>
      {/* Prev/Next on hover */}
      {idx > 0 && (
        <button
          type="button"
          className="lm-carousel-arrow lm-carousel-arrow--prev"
          onClick={(e) => { e.stopPropagation(); setIdx((i) => Math.max(0, i - 1)); }}
          aria-label="Previous image"
        >
          <FiChevronLeft size={14} />
        </button>
      )}
      {idx < imgs.length - 1 && (
        <button
          type="button"
          className="lm-carousel-arrow lm-carousel-arrow--next"
          onClick={(e) => { e.stopPropagation(); setIdx((i) => Math.min(imgs.length - 1, i + 1)); }}
          aria-label="Next image"
        >
          <FiChevronRight size={14} />
        </button>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   PREMIUM PRODUCT CARD
═══════════════════════════════════════════════════════════════ */
const ProductCard = memo(function ProductCard({
  product, wishlisted, onWishlist, onAddToCart, view = "grid", index = 0,
}) {
  const navigate    = useNavigate();
  const { trigger, RippleContainer } = useRipple();
  const { ref, visible } = useFadeIn();
  const [hearted, setHearted] = useState(wishlisted);
  const [carted,  setCarted]  = useState(false);

  const discount   = calcDiscount(product);
  const imgs       = allImages(product.images);
  const imgSrc     = primaryImg(product.images);
  const condition  = product.condition ?? "Used";
  const rating     = fakeRating(product);
  const soldLabel  = fakeSold(product);
  const dest       = `/shop/${product.slug ?? product.id}`;
  const hasDelivery = product.has_delivery ?? (product.view_count ?? 0) % 3 !== 0;
  const reviewCount = ((product.view_count ?? 0) % 800) + 12;

  const go = useCallback(() => {
    addToRecentlyViewed(product);
    navigate(dest);
  }, [navigate, dest, product]);

  const handleWish = useCallback((e) => {
    e.stopPropagation();
    setHearted((v) => !v);
    onWishlist(product.id);
  }, [onWishlist, product.id]);

  const handleCart = useCallback((e) => {
    e.stopPropagation();
    trigger(e);
    setCarted(true);
    onAddToCart(product);
    setTimeout(() => setCarted(false), 1200);
  }, [trigger, onAddToCart, product]);

  useEffect(() => { setHearted(wishlisted); }, [wishlisted]);

  return (
    <article
      ref={ref}
      className={`mp-card lm-pcard ${view === "list" ? "mp-card--list lm-pcard--list" : ""} ${visible ? "lm-pcard--visible" : ""}`}
      style={{ animationDelay: `${Math.min(index * 60, 400)}ms` }}
    >
      {/* ── Image ── */}
      <div
        className="mp-card-img-wrap lm-pcard-img-wrap"
        onClick={go}
        role="button"
        tabIndex={0}
        aria-label={`View ${product.name}`}
        onKeyDown={(e) => e.key === "Enter" && go()}
      >
        {imgs.length > 1 ? (
          <ImageCarousel images={imgs} alt={product.name} />
        ) : imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            className="mp-card-img lm-card-img"
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="mp-card-placeholder lm-pcard-placeholder">
            <FiPackage size={36} className="mp-placeholder-icon" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="lm-pcard-img-overlay" aria-hidden="true" />

        {/* Badges */}
        <div className="mp-card-badges lm-pcard-badges">
          {discount > 0 && (
            <span className="mp-badge lm-badge lm-badge--sale">-{discount}%</span>
          )}
          {product.is_featured && (
            <span className="mp-badge lm-badge lm-badge--featured">⚡ Featured</span>
          )}
          {product.is_trending && (
            <span className="mp-badge lm-badge lm-badge--hot">🔥 Hot</span>
          )}
          {condition === "New" && (
            <span className="mp-badge lm-badge lm-badge--new">New</span>
          )}
        </div>

        {/* Wishlist */}
        <button
          type="button"
          className={`mp-wishlist lm-wish-btn ${hearted ? "lm-wish-btn--active" : ""}`}
          aria-label={hearted ? "Remove from wishlist" : "Save to wishlist"}
          onClick={handleWish}
        >
          <FiHeart
            size={16}
            fill={hearted ? "currentColor" : "none"}
            className={hearted ? "lm-heart-beat" : ""}
          />
        </button>

        {/* Free delivery badge */}
        {hasDelivery && (
          <div className="lm-delivery-badge" aria-label="Free delivery available">
            <FiTruck size={10} /> Free
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="mp-card-body lm-pcard-body">

        {/* Seller row */}
        {product.seller_name && (
          <div className="mp-card-seller lm-seller-row">
            {product.seller_avatar ? (
              <img src={product.seller_avatar} alt={product.seller_name}
                className="mp-seller-avatar" />
            ) : (
              <div className="mp-seller-avatar mp-seller-avatar--fallback lm-seller-avatar">
                {product.seller_name[0]?.toUpperCase()}
              </div>
            )}
            <span className="mp-seller-name">{product.seller_name}</span>
            {product.seller_verified && (
              <span className="mp-verified lm-verified-badge" aria-label="Verified Seller">
                <FiShield size={10} /> Verified
              </span>
            )}
          </div>
        )}

        {/* Name */}
        <p className="mp-card-name lm-pcard-name" onClick={go} style={{ cursor:"pointer" }}>
          {product.name}
        </p>

        {/* Stars */}
        <StarRating rating={rating} count={reviewCount} />

        {/* Sold count */}
        {soldLabel && (
          <p className="lm-sold-label">{soldLabel}</p>
        )}

        {/* Price */}
        <div className="mp-price-row lm-price-row">
          <span className="mp-price lm-price">{fmtPrice(product.price)}</span>
          {discount > 0 && (
            <>
              <span className="mp-original lm-original">{fmtPrice(product.original_price)}</span>
              <span className="lm-discount-pill">Save {discount}%</span>
            </>
          )}
        </div>

        {/* Meta */}
        <div className="mp-card-meta lm-pcard-meta">
          <span className="mp-meta-pill lm-meta-pill">{condition}</span>
          {product.location && (
            <span className="mp-meta-pill lm-meta-pill">
              <FiMapPin size={9} /> {product.location}
            </span>
          )}
          {product.view_count > 0 && (
            <span className="mp-meta-views lm-meta-views">
              <FiEye size={9} /> {product.view_count.toLocaleString()}
            </span>
          )}
        </div>

        {/* Tags */}
        {Array.isArray(product.tags) && product.tags.length > 0 && (
          <div className="mp-card-tags">
            {product.tags.slice(0, 2).map((t) => (
              <span key={t} className="mp-tag lm-tag">#{t}</span>
            ))}
          </div>
        )}

        {/* Add to Cart */}
        <button
          type="button"
          className={`lm-cart-btn-card ${carted ? "lm-cart-btn-card--done" : ""}`}
          onClick={handleCart}
          aria-label={`Add ${product.name} to cart`}
        >
          {RippleContainer}
          {carted ? (
            <><FiCheckCircle size={14} /> Added!</>
          ) : (
            <><FiShoppingCart size={14} /> Add to Cart</>
          )}
        </button>
      </div>
    </article>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SKELETON CARD
═══════════════════════════════════════════════════════════════ */
function SkeletonCard() {
  return (
    <div className="mp-card lm-pcard lm-skeleton-card" aria-hidden="true">
      <div className="lm-skel lm-skel-img" />
      <div className="lm-pcard-body" style={{ display:"flex", flexDirection:"column", gap:8, padding:"12px 12px 14px" }}>
        <div className="lm-skel" style={{ width:"35%", height:9, borderRadius:4 }} />
        <div className="lm-skel" style={{ height:13, borderRadius:4 }} />
        <div className="lm-skel" style={{ width:"75%", height:13, borderRadius:4 }} />
        <div className="lm-skel" style={{ width:"55%", height:9, borderRadius:4 }} />
        <div className="lm-skel" style={{ width:"40%", height:18, borderRadius:4 }} />
        <div className="lm-skel" style={{ height:36, borderRadius:10, marginTop:2 }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION WRAPPER  (fade-in on scroll)
═══════════════════════════════════════════════════════════════ */
function FadeSection({ children, className = "", ...props }) {
  const { ref, visible } = useFadeIn();
  return (
    <section
      ref={ref}
      className={`lm-fade-section ${visible ? "lm-fade-section--visible" : ""} ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HORIZONTAL SCROLL SECTION
═══════════════════════════════════════════════════════════════ */
const HScroll = memo(function HScroll({ title, sub, icon: Icon, accent, onSeeAll, children, badge }) {
  const { ref, visible } = useFadeIn();
  return (
    <div
      ref={ref}
      className={`lm-hscroll-section ${visible ? "lm-hscroll-section--visible" : ""}`}
    >
      <div className="mp-section-header lm-hscroll-header">
        <div className="mp-section-title-wrap">
          <div className="lm-section-icon-wrap" style={{ background: `${accent}18`, color: accent }} aria-hidden="true">
            {Icon && <Icon size={18} />}
          </div>
          <div>
            <h2 className="mp-section-title lm-section-title">
              {title}
              {badge && <span className="lm-section-badge" style={{ background: accent }}>{badge}</span>}
            </h2>
            {sub && <p className="mp-section-sub lm-section-sub">{sub}</p>}
          </div>
        </div>
        {onSeeAll && (
          <button type="button" className="mp-section-see-all lm-see-all" onClick={onSeeAll}>
            See all <FiChevronRight size={14} />
          </button>
        )}
      </div>
      <div className="mp-featured-scroll lm-hscroll-track">
        {children}
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MINI PRODUCT CARD  (horizontal scroll)
═══════════════════════════════════════════════════════════════ */
const MiniCard = memo(function MiniCard({ product, onAddToCart, onWishlist, wishlisted }) {
  const navigate  = useNavigate();
  const imgSrc    = primaryImg(product.images);
  const discount  = calcDiscount(product);
  const rating    = fakeRating(product);
  const dest      = `/shop/${product.slug ?? product.id}`;
  const [hearted, setHearted] = useState(wishlisted);

  return (
    <div className="lm-mini-card">
      <div
        className="lm-mini-card__img-wrap"
        onClick={() => { addToRecentlyViewed(product); navigate(dest); }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && navigate(dest)}
      >
        {imgSrc ? (
          <img src={imgSrc} alt={product.name} loading="lazy"
            onError={(e) => { e.currentTarget.style.display = "none"; }} />
        ) : (
          <div className="lm-mini-card__placeholder"><FiPackage size={24} /></div>
        )}
        {discount > 0 && (
          <span className="lm-mini-card__discount">-{discount}%</span>
        )}
        <button
          type="button"
          className={`lm-mini-card__wish ${hearted ? "lm-mini-card__wish--active" : ""}`}
          onClick={(e) => { e.stopPropagation(); setHearted((v) => !v); onWishlist?.(product.id); }}
          aria-label="Save"
        >
          <FiHeart size={12} fill={hearted ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="lm-mini-card__body" onClick={() => navigate(dest)} style={{ cursor:"pointer" }}>
        <p className="lm-mini-card__name">{product.name}</p>
        <StarRating rating={rating} />
        <p className="lm-mini-card__price">{fmtPrice(product.price)}</p>
        <button
          type="button"
          className="lm-mini-card__cart"
          onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
        >
          <FiShoppingCart size={11} /> Add
        </button>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   FLASH DEAL CARD
═══════════════════════════════════════════════════════════════ */
const FlashCard = memo(function FlashCard({ product, onAddToCart }) {
  const navigate = useNavigate();
  const imgSrc   = primaryImg(product.images);
  const discount = calcDiscount(product);
  const pct      = Math.min(90, 40 + (product.view_count ?? 0) % 50);

  return (
    <div
      className="lm-flash-card"
      onClick={() => { addToRecentlyViewed(product); navigate(`/shop/${product.slug ?? product.id}`); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/shop/${product.slug ?? product.id}`)}
    >
      <div className="lm-flash-card__img-wrap">
        {imgSrc
          ? <img src={imgSrc} alt={product.name} loading="lazy" />
          : <div className="lm-flash-card__placeholder"><FiPackage size={28} /></div>
        }
        {discount > 0 && (
          <span className="lm-flash-card__discount">-{discount}%</span>
        )}
      </div>
      <div className="lm-flash-card__body">
        <p className="lm-flash-card__name">{product.name}</p>
        <p className="lm-flash-card__price">{fmtPrice(product.price)}</p>
        {product.original_price && (
          <p className="lm-flash-card__original">{fmtPrice(product.original_price)}</p>
        )}
        {/* Stock progress bar */}
        <div className="lm-flash-card__bar-wrap">
          <div className="lm-flash-card__bar">
            <div className="lm-flash-card__bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="lm-flash-card__bar-label">{pct}% claimed</span>
        </div>
        <button
          type="button"
          className="lm-flash-card__cart"
          onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
        >
          <FiShoppingCart size={12} /> Add to Cart
        </button>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SEARCH DROPDOWN
═══════════════════════════════════════════════════════════════ */
const SearchDropdown = memo(function SearchDropdown({
  query, history, trending, onSelect, onClearHistory,
}) {
  const showHistory  = history.length > 0 && !query;
  const showTrending = !query;
  const showResults  = !!query;

  return (
    <div className="lm-search-dropdown" role="listbox" aria-label="Search suggestions">
      {showHistory && (
        <>
          <div className="lm-search-dropdown__header">
            <span>Recent searches</span>
            <button type="button" onClick={onClearHistory} className="lm-search-dropdown__clear">
              Clear
            </button>
          </div>
          {history.map((s) => (
            <button
              key={s}
              type="button"
              className="lm-search-dropdown__item"
              role="option"
              onClick={() => onSelect(s)}
            >
              <FiClock size={13} className="lm-search-dropdown__icon" />
              {s}
            </button>
          ))}
          <div className="lm-search-dropdown__divider" />
        </>
      )}

      {showTrending && (
        <>
          <div className="lm-search-dropdown__header">
            <span><FiTrendingUp size={12} /> Trending searches</span>
          </div>
          <div className="lm-search-dropdown__trending">
            {trending.map((s) => (
              <button
                key={s}
                type="button"
                className="lm-search-dropdown__chip"
                onClick={() => onSelect(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </>
      )}

      {showResults && (
        <>
          <div className="lm-search-dropdown__header">
            <span>Search for</span>
          </div>
          <button
            type="button"
            className="lm-search-dropdown__item lm-search-dropdown__item--query"
            role="option"
            onClick={() => onSelect(query)}
          >
            <FiSearch size={13} className="lm-search-dropdown__icon" />
            <strong>{query}</strong>
          </button>
          {TRENDING_SEARCHES
            .filter((s) => s.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 4)
            .map((s) => (
              <button
                key={s}
                type="button"
                className="lm-search-dropdown__item"
                role="option"
                onClick={() => onSelect(s)}
              >
                <FiSearch size={13} className="lm-search-dropdown__icon" />
                {s}
              </button>
            ))
          }
        </>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   CART TOAST
═══════════════════════════════════════════════════════════════ */
function CartToast({ product, onView, onClose }) {
  return (
    <div className="lm-cart-toast">
      <div className="lm-cart-toast__img-wrap">
        {primaryImg(product.images)
          ? <img src={primaryImg(product.images)} alt={product.name} className="lm-cart-toast__img" />
          : <div className="lm-cart-toast__img-ph"><FiPackage size={18} /></div>
        }
      </div>
      <div className="lm-cart-toast__body">
        <p className="lm-cart-toast__label">✓ Added to cart</p>
        <p className="lm-cart-toast__name">{product.name}</p>
        <p className="lm-cart-toast__price">{fmtPrice(product.price)}</p>
      </div>
      <div className="lm-cart-toast__actions">
        <button type="button" className="lm-cart-toast__view" onClick={onView}>View Cart</button>
        <button type="button" className="lm-cart-toast__close" onClick={onClose} aria-label="Dismiss">
          <FiX size={13} />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BOTTOM NAV
═══════════════════════════════════════════════════════════════ */
function BottomNav({ cartCount, active = 0 }) {
  const navigate = useNavigate();
  return (
    <nav className="lm-bottom-nav" aria-label="Main navigation">
      {BOTTOM_NAV.map((item, i) => {
        const Icon     = item.icon;
        const isActive = i === active;
        const isCart   = item.label === "Cart";
        return (
          <button
            key={item.label}
            type="button"
            className={`lm-bottom-nav__item ${isActive ? "lm-bottom-nav__item--active" : ""}`}
            onClick={() => navigate(item.path)}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="lm-bottom-nav__icon-wrap">
              <Icon size={22} />
              {isCart && cartCount > 0 && (
                <span className="lm-bottom-nav__badge">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </span>
            <span className="lm-bottom-nav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function HomePage({ user }) {
  const navigate                        = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const flashTime                       = useCountdown(4);

  /* ── Hero ── */
  const [slideIndex, setSlideIndex] = useState(0);
  const timerRef                    = useRef(null);

  const resetTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(
      () => setSlideIndex((i) => (i + 1) % HERO_SLIDES.length),
      SLIDE_INTERVAL
    );
  }, []);

  useEffect(() => { resetTimer(); return () => clearInterval(timerRef.current); }, [resetTimer]);

  /* ── Search ── */
  const [searchQuery,     setSearchQuery]     = useState(searchParams.get("q") ?? "");
  const [searchFocused,   setSearchFocused]   = useState(false);
  const [searchHistory,   setSearchHistory]   = useState(getSearchHistory);
  const searchRef                             = useRef(null);

  /* ── Filters ── */
  const [activeCategory, setActiveCategory] = useState(searchParams.get("category") ?? "all");
  const [activeSort,     setActiveSort]     = useState(searchParams.get("sort")     ?? "newest");
  const [minPrice,       setMinPrice]       = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice,       setMaxPrice]       = useState(searchParams.get("maxPrice") ?? "");
  const [view,           setView]           = useState("grid");
  const [showSort,       setShowSort]       = useState(false);
  const [showFilters,    setShowFilters]    = useState(false);

  /* ── Products ── */
  const [products,    setProducts]    = useState([]);
  const [pagination,  setPagination]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError,  setFetchError]  = useState(null);
  const [offset,      setOffset]      = useState(0);

  /* ── Section data ── */
  const [featured,   setFeatured]   = useState([]);
  const [flashDeals, setFlashDeals] = useState([]);
  const [newArrivals,setNewArrivals]= useState([]);
  const [topRated,   setTopRated]   = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState(getRecentlyViewed);

  /* ── Cart ── */
  const [cartCount, setCartCount] = useState(getCartCount);
  useEffect(() => {
    const sync = () => setCartCount(getCartCount());
    window.addEventListener("cart-updated", sync);
    return () => window.removeEventListener("cart-updated", sync);
  }, []);

  /* ── Wishlist ── */
  const [wishlist, setWishlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem("loemart-wishlist") || "[]"); }
    catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem("loemart-wishlist", JSON.stringify(wishlist));
  }, [wishlist]);

  /* ── Notify ── */
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifySent,  setNotifySent]  = useState(false);

  /* ── Topbar scrolled ── */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Category tabs ── */
  const categoryTabs = useMemo(() => [
    { id: "all", name: "All", icon: <FiGrid size={14} /> },
    ...categories.map((c) => ({ ...c, icon: c.icon })),
  ], []);

  /* ════════════════════════════════════════════════════════
     FETCH
  ════════════════════════════════════════════════════════ */
  const fetchProducts = useCallback(async ({
    query = searchQuery, category = activeCategory, sort = activeSort,
    min = minPrice, max = maxPrice, newOffset = 0, append = false,
  } = {}) => {
    append ? setLoadingMore(true) : setLoading(true);
    setFetchError(null);
    try {
      const params = { limit: DEFAULT_LIMIT, offset: newOffset, sort };
      if (normalize(query))       params.search   = normalize(query);
      if (category !== "all")     params.category = category;
      if (min && Number(min) > 0) params.minPrice = min;
      if (max && Number(max) > 0) params.maxPrice = max;

      const { data } = await axios.get(`${API}/products`, { params });
      const rows     = data?.data?.products   ?? [];
      const meta     = data?.data?.pagination ?? null;
      setProducts((prev) => append ? [...prev, ...rows] : rows);
      setPagination(meta);
      setOffset(newOffset);
    } catch (err) {
      const msg = err.response?.data?.message
        ?? (err.code === "ERR_NETWORK" ? "Network error" : "Failed to load products");
      setFetchError(msg);
      if (!append) toast.error(msg);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchQuery, activeCategory, activeSort, minPrice, maxPrice]);

  /* Fetch specialised sections */
  const fetchSections = useCallback(async () => {
    try {
      const [featRes, trendRes, newRes] = await Promise.allSettled([
        axios.get(`${API}/products`, { params: { featured:"true",  limit:10, sort:"trending" } }),
        axios.get(`${API}/products`, { params: { trending:"true",  limit:10, sort:"views"    } }),
        axios.get(`${API}/products`, { params: { limit:10,         sort:"newest"             } }),
      ]);
      if (featRes.status  === "fulfilled") setFeatured  (featRes.value.data?.data?.products  ?? []);
      if (trendRes.status === "fulfilled") setFlashDeals(trendRes.value.data?.data?.products ?? []);
      if (newRes.status   === "fulfilled") {
        const rows = newRes.value.data?.data?.products ?? [];
        setNewArrivals(rows.slice(0, 10));
        setTopRated(rows.slice(5, 15));
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchProducts({ newOffset: 0 }); fetchSections(); }, []); // eslint-disable-line
  useEffect(() => { fetchProducts({ newOffset: 0, append: false }); }, [activeCategory, activeSort]); // eslint-disable-line
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) { setSearchQuery(q); fetchProducts({ query: q, newOffset: 0 }); }
  }, []); // eslint-disable-line

  /* ════════════════════════════════════════════════════════
     HANDLERS
  ════════════════════════════════════════════════════════ */
  const handleSearchSelect = useCallback((q) => {
    setSearchQuery(q);
    setSearchFocused(false);
    addToSearchHistory(q);
    setSearchHistory(getSearchHistory());
    setSearchParams(q ? { q } : {});
    fetchProducts({ query: q, newOffset: 0 });
  }, [fetchProducts, setSearchParams]);

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    handleSearchSelect(normalize(searchQuery));
  }, [searchQuery, handleSearchSelect]);

  const handleCategoryChange = useCallback((id) => {
    setActiveCategory(id); setOffset(0);
  }, []);

  const handleSortSelect = useCallback((val) => {
    setActiveSort(val); setShowSort(false); setOffset(0);
  }, []);

  const handleLoadMore = useCallback(() => {
    fetchProducts({ newOffset: offset + DEFAULT_LIMIT, append: true });
  }, [fetchProducts, offset]);

  const handleApplyFilters = useCallback((e) => {
    e?.preventDefault();
    fetchProducts({ min: minPrice, max: maxPrice, newOffset: 0 });
    setShowFilters(false);
  }, [fetchProducts, minPrice, maxPrice]);

  const clearFilters = useCallback(() => {
    setSearchQuery(""); setActiveCategory("all"); setActiveSort("newest");
    setMinPrice(""); setMaxPrice(""); setSearchParams({});
    fetchProducts({ query:"", category:"all", sort:"newest", min:"", max:"", newOffset:0 });
  }, [fetchProducts, setSearchParams]);

  const toggleWishlist = useCallback((id) => {
    setWishlist((prev) => {
      const saved = prev.includes(id);
      toast.success(saved ? "Removed from wishlist" : "Saved ❤️", { duration: 1500 });
      return saved ? prev.filter((x) => x !== id) : [...prev, id];
    });
    window.navigator?.vibrate?.(12);
  }, []);

  const handleAddToCart = useCallback((product) => {
    addToCart(product);
    setCartCount(getCartCount());
    window.navigator?.vibrate?.([20, 10, 20]);
    toast.custom(
      (t) => (
        <CartToast
          product={product}
          onView={() => { toast.dismiss(t.id); navigate("/shop/cart"); }}
          onClose={() => toast.dismiss(t.id)}
        />
      ),
      { duration: 4000, position: "bottom-right" }
    );
  }, [navigate]);

  const goPostAd = useCallback(() => {
    navigate(user ? "/minimart/post-ad" : "/auth");
  }, [navigate, user]);

  const handleNotify = useCallback((e) => {
    e.preventDefault();
    if (!notifyEmail.includes("@")) { toast.error("Enter a valid email"); return; }
    setNotifySent(true); toast.success("You're subscribed! 🎉");
  }, [notifyEmail]);

  const handleSlide = useCallback((i) => { setSlideIndex(i); resetTimer(); }, [resetTimer]);

  /* Click outside search */
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target))
        setSearchFocused(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Derived ── */
  const slide           = HERO_SLIDES[slideIndex];
  const hasMore         = pagination ? (offset + DEFAULT_LIMIT) < pagination.total : false;
  const activeSortLabel = SORT_OPTIONS.find((s) => s.value === activeSort)?.label ?? "Sort";
  const hasFilters      = !!(searchQuery || activeCategory !== "all" || activeSort !== "newest" || minPrice || maxPrice);
  const firstName       = user?.name?.split(" ")[0] ?? null;

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div className="mp-page lm-page lm-premium">

      {/* ════════════════════════════════════════════════
          GLASSMORPHISM TOPBAR
      ════════════════════════════════════════════════ */}
      <header className={`mp-topbar lm-topbar lm-glass-topbar ${scrolled ? "lm-topbar--scrolled" : ""}`}>
        <div className="mp-topbar-row">

          {/* Logo */}
          <button
            type="button"
            className="mp-logo lm-logo-btn"
            onClick={() => navigate("/loemart")}
            aria-label="Loemart home"
          >
            <span className="lm-logo-mark">🛍️</span>
            <span className="lm-logo-wordmark">Loemart</span>
          </button>

          {/* Premium Search */}
          <div className="mp-search-wrap lm-search-wrap" ref={searchRef}>
            <form onSubmit={handleSearch} role="search" aria-label="Search">
              <span className="mp-search-ico" aria-hidden="true">
                <FiSearch size={16} />
              </span>
              <input
                type="search"
                className="mp-search lm-search-input"
                placeholder="Search products, brands, categories…"
                value={searchQuery}
                aria-label="Search products"
                autoComplete="off"
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="mp-search-clear"
                  aria-label="Clear"
                  onClick={() => { setSearchQuery(""); fetchProducts({ query:"", newOffset:0 }); }}
                >
                  <FiX size={12} />
                </button>
              )}
            </form>

            {/* Search dropdown */}
            {searchFocused && (
              <SearchDropdown
                query={searchQuery}
                history={searchHistory}
                trending={TRENDING_SEARCHES}
                onSelect={handleSearchSelect}
                onClearHistory={() => {
                  localStorage.removeItem(SEARCH_HISTORY_KEY);
                  setSearchHistory([]);
                }}
              />
            )}
          </div>

          {/* Actions */}
          <div className="mp-topbar-actions lm-topbar-actions">
            {/* Personalised greeting — desktop only */}
            {user && firstName && (
              <span className="lm-greeting" aria-live="polite">
                Hi, <strong>{firstName}</strong> 👋
              </span>
            )}

            <button
              type="button"
              className={`mp-icon-btn lm-icon-btn ${wishlist.length ? "mp-icon-btn--active" : ""}`}
              aria-label={`Wishlist — ${wishlist.length} saved`}
            >
              <FiHeart size={19} />
              {wishlist.length > 0 && (
                <span className="mp-badge-dot lm-badge-dot">{wishlist.length > 9 ? "9+" : wishlist.length}</span>
              )}
            </button>

            <button
              type="button"
              className={`mp-icon-btn lm-icon-btn lm-cart-icon-btn ${cartCount ? "mp-icon-btn--active" : ""}`}
              aria-label={`Cart — ${cartCount} items`}
              onClick={() => navigate("/shop/cart")}
            >
              <FiShoppingCart size={19} />
              {cartCount > 0 && (
                <span className="mp-badge-dot lm-badge-dot lm-cart-badge-dot">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </button>

            <button
              type="button"
              className="mp-icon-btn lm-icon-btn"
              aria-label="Filters"
              aria-expanded={showFilters}
              onClick={() => setShowFilters((v) => !v)}
            >
              <FiFilter size={19} />
              {hasFilters && <span className="mp-badge-dot" style={{ fontSize:7, background:"#ff5722" }}>!</span>}
            </button>

            <button
              type="button"
              className="mp-post-btn lm-post-btn"
              onClick={goPostAd}
            >
              <FiPlus size={15} />
              <span className="mp-post-label">{user ? "Post Ad" : "Sell Free"}</span>
            </button>
          </div>
        </div>

        {/* Sticky category bar */}
        <nav className="mp-cats lm-cat-strip" aria-label="Categories">
          {categoryTabs.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`mp-cat-btn lm-cat-btn ${activeCategory === c.id ? "mp-cat-btn--active lm-cat-btn--active" : ""}`}
              aria-pressed={activeCategory === c.id}
              onClick={() => handleCategoryChange(c.id)}
            >
              <span className="mp-cat-icon" aria-hidden="true">{c.icon}</span>
              <span className="mp-cat-label">{c.name}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* ════════════════════════════════════════════════
          PERSONALIZED GREETING BANNER
      ════════════════════════════════════════════════ */}
      {user && firstName && (
        <div className="lm-welcome-bar" aria-live="polite">
          <span>👋 Welcome back, <strong>{firstName}</strong>!</span>
          <span className="lm-welcome-bar__sep">·</span>
          <button type="button" className="lm-welcome-bar__link"
            onClick={() => document.getElementById("loemart-listings")?.scrollIntoView({ behavior:"smooth" })}>
            Continue Shopping <FiArrowRight size={12} />
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          HERO — Premium animated
      ════════════════════════════════════════════════ */}
      <section className="mp-hero lm-hero lm-hero-premium" aria-label="Hero">
        <div className="lm-hero-bg" style={{ background: slide.bg }} aria-hidden="true" />
        <div className="lm-hero-particles" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`lm-particle lm-particle--${i + 1}`} />
          ))}
        </div>
        <div className="mp-hero-overlay lm-hero-overlay" aria-hidden="true" />

        <div className="mp-hero-content lm-hero-content-premium">
          <div className="lm-hero-eyebrow">
            <span className="lm-hero-tag" aria-hidden="true">{slide.tag}</span>
            <span>{slide.eyebrow}</span>
          </div>

          <h1 className="mp-hero-title lm-hero-h1">
            {slide.title.split("\n").map((line, i, arr) => (
              <span key={i} className="lm-hero-h1__line">
                {line}{i < arr.length - 1 && <br />}
              </span>
            ))}
          </h1>

          <p className="mp-hero-sub lm-hero-sub-premium">{slide.sub}</p>

          <div className="mp-hero-actions lm-hero-actions-premium">
            <button
              type="button"
              className="lm-hero-cta-primary"
              style={{ background: `linear-gradient(135deg,${slide.accent},${slide.accent}99)` }}
              onClick={() =>
                document.getElementById("loemart-listings")
                  ?.scrollIntoView({ behavior:"smooth" })
              }
            >
              {slide.cta}
              <FiArrowRight size={15} className="lm-hero-cta-arrow" />
            </button>
            <button type="button" className="lm-hero-cta-secondary" onClick={goPostAd}>
              {user ? slide.ctaSub : "Sign Up Free"}
            </button>
          </div>

          {/* Cart prompt */}
          {cartCount > 0 && (
            <button
              type="button"
              className="lm-hero-cart-pill"
              onClick={() => navigate("/shop/cart")}
              aria-label={`You have ${cartCount} items in cart`}
            >
              <FiShoppingCart size={13} />
              {cartCount} item{cartCount !== 1 ? "s" : ""} in your cart
              <FiChevronRight size={12} />
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="lm-hero-stats-bar" aria-label="Platform statistics">
          {[
            { v:"50K+", l:"Listings",  },
            { v:"12K+", l:"Sellers",   },
            { v:"100%", l:"Free",      },
            { v:"24/7", l:"Support",   },
          ].map((s) => (
            <div key={s.l} className="lm-hero-stat">
              <strong>{s.v}</strong>
              <span>{s.l}</span>
            </div>
          ))}
        </div>

        {/* Slide dots */}
        <div className="mp-hero-dots lm-hero-dots" role="tablist">
          {HERO_SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === slideIndex}
              aria-label={`Slide ${i + 1}`}
              className={`mp-hero-dot lm-hero-dot ${i === slideIndex ? "mp-hero-dot--active" : ""}`}
              onClick={() => handleSlide(i)}
            />
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          TRUST BADGES
      ════════════════════════════════════════════════ */}
      <div className="lm-trust-strip" aria-label="Why shop at Loemart">
        {TRUST_BADGES.map(({ icon: Icon, label, color }) => (
          <div key={label} className="lm-trust-badge">
            <div className="lm-trust-badge__icon" style={{ color, background:`${color}14` }}>
              <Icon size={18} />
            </div>
            <span className="lm-trust-badge__label">{label}</span>
          </div>
        ))}
      </div>

      {/* ════════════════════════════════════════════════
          FLASH DEALS  with countdown timer
      ════════════════════════════════════════════════ */}
      {flashDeals.length > 0 && (
        <FadeSection className="mp-section lm-flash-section" aria-label="Flash deals">
          <div className="lm-flash-header">
            <div className="lm-flash-title-wrap">
              <div className="lm-flash-icon" aria-hidden="true"><FiZap size={18} /></div>
              <div>
                <h2 className="mp-section-title lm-section-title">Flash Deals</h2>
                <p className="mp-section-sub">Limited stock · Grab them fast</p>
              </div>
            </div>
            <div className="lm-countdown" aria-label={`Ends in ${flashTime.h} hours ${flashTime.m} minutes`}>
              <FiClock size={13} aria-hidden="true" />
              <span>Ends in</span>
              <div className="lm-countdown-timer">
                <span className="lm-countdown-digit">{flashTime.h}</span>
                <span className="lm-countdown-sep">:</span>
                <span className="lm-countdown-digit">{flashTime.m}</span>
                <span className="lm-countdown-sep">:</span>
                <span className="lm-countdown-digit">{flashTime.s}</span>
              </div>
            </div>
          </div>
          <div className="mp-featured-scroll lm-hscroll-track">
            {flashDeals.map((p) => (
              <FlashCard key={p.id} product={p} onAddToCart={handleAddToCart} />
            ))}
          </div>
        </FadeSection>
      )}

      {/* ════════════════════════════════════════════════
          FEATURED PICKS
      ════════════════════════════════════════════════ */}
      {featured.length > 0 && (
        <HScroll
          title="Featured Picks"
          sub="Handpicked by our team"
          icon={FiAward}
          accent="#6366f1"
          onSeeAll={() => document.getElementById("loemart-listings")?.scrollIntoView({ behavior:"smooth" })}
        >
          {featured.map((p) => (
            <MiniCard key={p.id} product={p}
              onAddToCart={handleAddToCart}
              onWishlist={toggleWishlist}
              wishlisted={wishlist.includes(p.id)}
            />
          ))}
        </HScroll>
      )}

      {/* ════════════════════════════════════════════════
          NEW ARRIVALS
      ════════════════════════════════════════════════ */}
      {newArrivals.length > 0 && (
        <HScroll
          title="New Arrivals"
          sub="Fresh listings added today"
          icon={FiZap}
          accent="#10b981"
          badge="NEW"
          onSeeAll={() => setActiveSort("newest")}
        >
          {newArrivals.map((p) => (
            <MiniCard key={p.id} product={p}
              onAddToCart={handleAddToCart}
              onWishlist={toggleWishlist}
              wishlisted={wishlist.includes(p.id)}
            />
          ))}
        </HScroll>
      )}

      {/* ════════════════════════════════════════════════
          RECENTLY VIEWED
      ════════════════════════════════════════════════ */}
      {recentlyViewed.length > 0 && (
        <HScroll
          title="Recently Viewed"
          sub="Continue where you left off"
          icon={FiClock}
          accent="#f59e0b"
        >
          {recentlyViewed.map((p) => (
            <div
              key={p.id}
              className="lm-recent-card"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/shop/${p.slug}`)}
              onKeyDown={(e) => e.key === "Enter" && navigate(`/shop/${p.slug}`)}
              aria-label={`View ${p.name}`}
            >
              {p.image
                ? <img src={p.image} alt={p.name} className="lm-recent-card__img" loading="lazy" />
                : <div className="lm-recent-card__placeholder"><FiPackage size={20} /></div>
              }
              <p className="lm-recent-card__name">{p.name}</p>
              <p className="lm-recent-card__price">{fmtPrice(p.price)}</p>
            </div>
          ))}
        </HScroll>
      )}

      {/* ════════════════════════════════════════════════
          SUB-BAR (sticky)
      ════════════════════════════════════════════════ */}
      <div className="mp-subbar lm-subbar lm-sticky-subbar" aria-label="Controls">
        <div className="mp-subbar-left">
          {loading ? (
            <span className="mp-count-loading">Loading products…</span>
          ) : (
            <p className="mp-count">
              {pagination
                ? <><strong>{pagination.total.toLocaleString()}</strong> products</>
                : <strong>{products.length} products</strong>
              }
              {activeCategory !== "all" && (
                <em> · {categoryTabs.find((c) => c.id === activeCategory)?.name}</em>
              )}
              {searchQuery && <em> · "{searchQuery}"</em>}
            </p>
          )}
        </div>
        <div className="mp-subbar-right">
          {hasFilters && (
            <button type="button" className="mp-clear-all lm-clear-btn" onClick={clearFilters}>
              Clear all <FiX size={11} />
            </button>
          )}

          {/* Sort */}
          <div className="mp-sort-wrap">
            <button
              type="button"
              className="mp-sort-btn lm-sort-btn"
              aria-haspopup="listbox"
              aria-expanded={showSort}
              onClick={() => setShowSort((v) => !v)}
            >
              <FiSliders size={13} /> {activeSortLabel}
              <FiChevronRight size={13} style={{ transform: showSort ? "rotate(90deg)" : "none", transition:".2s" }} />
            </button>

            {showSort && (
              <>
                <div style={{ position:"fixed", inset:0, zIndex:199 }} onClick={() => setShowSort(false)} aria-hidden="true" />
                <div className="mp-sort-menu lm-sort-menu" role="listbox">
                  {SORT_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={activeSort === opt.value}
                        className={`mp-sort-item ${activeSort === opt.value ? "mp-sort-item--active" : ""}`}
                        onClick={() => handleSortSelect(opt.value)}
                      >
                        <span style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <Icon size={13} /> {opt.label}
                        </span>
                        {activeSort === opt.value && <span className="mp-sort-check">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* View toggle */}
          <div className="mp-view-toggle lm-view-toggle">
            <button
              type="button"
              className={`mp-view-btn ${view === "grid" ? "mp-view-btn--active" : ""}`}
              aria-pressed={view === "grid"} aria-label="Grid view"
              onClick={() => setView("grid")}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor">
                <rect x="0" y="0" width="6" height="6" rx="1.5"/>
                <rect x="8" y="0" width="6" height="6" rx="1.5"/>
                <rect x="0" y="8" width="6" height="6" rx="1.5"/>
                <rect x="8" y="8" width="6" height="6" rx="1.5"/>
              </svg>
            </button>
            <button
              type="button"
              className={`mp-view-btn ${view === "list" ? "mp-view-btn--active" : ""}`}
              aria-pressed={view === "list"} aria-label="List view"
              onClick={() => setView("list")}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor">
                <rect x="0" y="1"  width="14" height="3" rx="1.5"/>
                <rect x="0" y="6"  width="14" height="3" rx="1.5"/>
                <rect x="0" y="11" width="14" height="3" rx="1.5"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Active filter pills */}
      {hasFilters && (
        <div className="mp-active-filters lm-filter-pills">
          {searchQuery && (
            <span className="mp-filter-pill lm-pill">
              <FiSearch size={10} /> "{searchQuery}"
              <button type="button" onClick={() => { setSearchQuery(""); setSearchParams({}); fetchProducts({ query:"", newOffset:0 }); }}>
                <FiX size={10} />
              </button>
            </span>
          )}
          {activeCategory !== "all" && (
            <span className="mp-filter-pill lm-pill">
              {categoryTabs.find((c) => c.id === activeCategory)?.name}
              <button type="button" onClick={() => handleCategoryChange("all")}><FiX size={10} /></button>
            </span>
          )}
          {minPrice && (
            <span className="mp-filter-pill lm-pill">
              Min ₦{Number(minPrice).toLocaleString()}
              <button type="button" onClick={() => { setMinPrice(""); fetchProducts({ min:"", newOffset:0 }); }}><FiX size={10} /></button>
            </span>
          )}
          {maxPrice && (
            <span className="mp-filter-pill lm-pill">
              Max ₦{Number(maxPrice).toLocaleString()}
              <button type="button" onClick={() => { setMaxPrice(""); fetchProducts({ max:"", newOffset:0 }); }}><FiX size={10} /></button>
            </span>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════
          ALL PRODUCTS GRID
      ════════════════════════════════════════════════ */}
      <main
        id="loemart-listings"
        className={`mp-grid lm-grid ${view === "list" ? "mp-grid--list" : "mp-grid--grid2"}`}
        aria-label="Product listings"
        aria-live="polite"
        aria-busy={loading}
      >
        {loading && Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}

        {!loading && fetchError && (
          <div className="mp-error lm-error-state">
            <div className="lm-error-icon" aria-hidden="true"><FiAlertCircle size={40} /></div>
            <p className="lm-error-title">Oops, something went wrong</p>
            <p className="lm-error-sub">{fetchError}</p>
            <button type="button" className="lm-retry-btn" onClick={() => fetchProducts({ newOffset:0 })}>
              <FiRefreshCw size={14} /> Try Again
            </button>
          </div>
        )}

        {!loading && !fetchError && !products.length && (
          <div className="mp-empty lm-empty-state">
            <div className="lm-empty-illustration" aria-hidden="true">
              <div className="lm-empty-circle">
                <FiSearch size={36} />
              </div>
              <div className="lm-empty-dots">
                <div /><div /><div />
              </div>
            </div>
            <h3 className="lm-empty-title">No results found</h3>
            <p className="lm-empty-sub">
              Try different keywords, remove filters, or{" "}
              <button type="button" className="lm-empty-link" onClick={clearFilters}>browse all products</button>
            </p>
            <div className="lm-empty-suggestions">
              {TRENDING_SEARCHES.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="lm-empty-suggestion"
                  onClick={() => handleSearchSelect(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && !fetchError && products.map((product, i) => (
          <ProductCard
            key={product.id}
            product={product}
            wishlisted={wishlist.includes(product.id)}
            onWishlist={toggleWishlist}
            onAddToCart={handleAddToCart}
            view={view}
            index={i}
          />
        ))}

        {loadingMore && (
          <div className="mp-load-more-row">
            <div className="mp-spinner lm-spinner" aria-label="Loading more" />
          </div>
        )}

        {!loading && !loadingMore && hasMore && (
          <div className="mp-load-more-row">
            <button type="button" className="lm-load-more" onClick={handleLoadMore}>
              Load More Products <FiChevronRight size={14} />
            </button>
          </div>
        )}

        {!loading && !hasMore && products.length > 0 && (
          <p className="mp-end-msg lm-end-msg">
            ✓ You've seen all {products.length.toLocaleString()} listings
          </p>
        )}
      </main>

      {/* ════════════════════════════════════════════════
          TOP RATED
      ════════════════════════════════════════════════ */}
      {topRated.length > 0 && (
        <HScroll
          title="Top Rated"
          sub="Highest reviewed by buyers"
          icon={FiStar}
          accent="#f59e0b"
          onSeeAll={() => setActiveSort("saves")}
        >
          {topRated.map((p) => (
            <MiniCard key={p.id} product={p}
              onAddToCart={handleAddToCart}
              onWishlist={toggleWishlist}
              wishlisted={wishlist.includes(p.id)}
            />
          ))}
        </HScroll>
      )}

      {/* ════════════════════════════════════════════════
          HOW IT WORKS
      ════════════════════════════════════════════════ */}
      <FadeSection className="mp-section lm-how-section" aria-label="How to sell">
        <div className="mp-section-header">
          <div className="mp-section-title-wrap">
            <div className="lm-section-icon-wrap" style={{ background:"rgba(255,87,34,0.1)", color:"#ff5722" }}>
              <FiZap size={18} />
            </div>
            <div>
              <h2 className="mp-section-title lm-section-title">Sell in 4 Steps</h2>
              <p className="mp-section-sub">Get your listing live in under 60 seconds</p>
            </div>
          </div>
          <button type="button" className="mp-section-see-all lm-see-all" onClick={goPostAd}>
            {user ? "Post Now" : "Sign Up"} <FiArrowRight size={13} />
          </button>
        </div>

        <div className="lm-how-grid">
          {[
            { step:"01", icon:<FiCamera size={20}/>,      title:"Add Photos",         desc:"Upload up to 6 compressed images with auto duplicate detection." },
            { step:"02", icon:<FiTag size={20}/>,          title:"Fill Details",        desc:"AI auto-generates key features from your title and description."  },
            { step:"03", icon:<FiBox size={20}/>,          title:"Set Price & Variants",desc:"Add sizes, colours, SKUs and smart percentage discounts."         },
            { step:"04", icon:<FiCheckCircle size={20}/>,  title:"Go Live",             desc:"Review your listing and publish — buyers see it instantly."       },
          ].map((s, i) => (
            <div key={s.step} className="lm-how-card">
              <div className="lm-how-step-num" aria-hidden="true">{s.step}</div>
              <div className="lm-how-icon-box" aria-hidden="true">{s.icon}</div>
              <h3 className="lm-how-title">{s.title}</h3>
              <p  className="lm-how-desc">{s.desc}</p>
              {i < 3 && <div className="lm-how-connector" aria-hidden="true" />}
            </div>
          ))}
        </div>

        <div className="lm-how-cta">
          <button type="button" className="mp-post-btn lm-post-btn lm-cta-lg" onClick={goPostAd}>
            <FiPlus size={18} />
            {user ? "Post Your Ad — It's Free" : "Sign Up & Start Selling"}
          </button>
        </div>
      </FadeSection>

      {/* ════════════════════════════════════════════════
          NOTIFY BANNER
      ════════════════════════════════════════════════ */}
      <FadeSection className="mp-section lm-notify-wrap" aria-label="Newsletter">
        <div className="lm-notify-card">
          <div className="lm-notify-left">
            <div className="lm-notify-icon-box" aria-hidden="true">
              <FiBell size={24} />
            </div>
            <div>
              <h2 className="lm-notify-title">Never Miss a Deal</h2>
              <p className="lm-notify-sub">
                Get instant alerts for new listings that match what you're looking for
              </p>
            </div>
          </div>
          {notifySent ? (
            <div className="lm-notify-success" role="status" aria-live="polite">
              <FiCheckCircle size={18} /> You're subscribed!
            </div>
          ) : (
            <form className="lm-notify-form" onSubmit={handleNotify}>
              <input
                type="email"
                className="lm-notify-input"
                placeholder="your@email.com"
                value={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.value)}
                aria-label="Email address"
                required
              />
              <button type="submit" className="lm-notify-btn">
                <FiBell size={14} /> Notify Me
              </button>
            </form>
          )}
        </div>
      </FadeSection>

      {/* ════════════════════════════════════════════════
          FLOATING CART
      ════════════════════════════════════════════════ */}
      {cartCount > 0 && (
        <button
          type="button"
          className="lm-float-cart"
          onClick={() => navigate("/shop/cart")}
          aria-label={`Cart — ${cartCount} items`}
        >
          <FiShoppingCart size={19} />
          <span className="lm-float-cart__count">{cartCount > 9 ? "9+" : cartCount}</span>
          <span className="lm-float-cart__label">View Cart</span>
        </button>
      )}

      {cartCount === 0 && (
        <button type="button" className="mp-fab lm-fab" onClick={goPostAd}
          aria-label={user ? "Post ad" : "Sell free"}>
          <FiPlus size={20} />
          {user ? "Post Ad" : "Sell Free"}
        </button>
      )}

      {/* ════════════════════════════════════════════════
          FILTER DRAWER
      ════════════════════════════════════════════════ */}
      {showFilters && (
        <>
          <div className="mp-overlay" onClick={() => setShowFilters(false)} aria-hidden="true" />
          <div className="mp-drawer lm-drawer" role="dialog" aria-modal="true" aria-label="Filters">
            <div className="mp-drawer-handle" />
            <div className="mp-drawer-header">
              <span className="mp-drawer-title"><FiSliders size={16} /> Filter Products</span>
              <button type="button" className="mp-drawer-close" onClick={() => setShowFilters(false)} aria-label="Close">
                <FiX size={15} />
              </button>
            </div>

            <div className="mp-filter-section">
              <p className="mp-filter-label">Price Range (₦)</p>
              <div className="mp-price-range">
                <div className="mp-price-input-wrap">
                  <span className="mp-price-symbol">₦</span>
                  <input type="number" className="mp-price-input" placeholder="Min"
                    value={minPrice} min={0} aria-label="Min price" onChange={(e) => setMinPrice(e.target.value)} />
                </div>
                <span className="mp-price-sep">—</span>
                <div className="mp-price-input-wrap">
                  <span className="mp-price-symbol">₦</span>
                  <input type="number" className="mp-price-input" placeholder="Max"
                    value={maxPrice} min={0} aria-label="Max price" onChange={(e) => setMaxPrice(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="mp-filter-section">
              <p className="mp-filter-label">Sort By</p>
              <div className="mp-filter-chips">
                {SORT_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button"
                    className={`mp-chip ${activeSort === opt.value ? "mp-chip--active" : ""}`}
                    onClick={() => setActiveSort(opt.value)}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mp-filter-section">
              <p className="mp-filter-label">Category</p>
              <div className="mp-filter-chips">
                {categoryTabs.map((c) => (
                  <button key={c.id} type="button"
                    className={`mp-chip ${activeCategory === c.id ? "mp-chip--active" : ""}`}
                    onClick={() => setActiveCategory(c.id)}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mp-drawer-footer">
              <button type="button" className="mp-btn-clear"
                onClick={() => { setMinPrice(""); setMaxPrice(""); setActiveSort("newest"); setActiveCategory("all"); }}>
                Reset All
              </button>
              <button type="button" className="mp-btn-apply lm-apply-btn" onClick={handleApplyFilters}>
                Apply Filters
              </button>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════
          BOTTOM NAVIGATION
      ════════════════════════════════════════════════ */}
      <BottomNav cartCount={cartCount} active={0} />

    </div>
  );
}