/**
 * src/loemart/HomePageMobile.jsx
 * Mobile-optimized Loemart homepage
 *
 * Design principles:
 * - Compact spacing
 * - Bottom sheet interactions
 * - Thumb-friendly tap targets (min 44px)
 * - Native app-like feel
 * - Bottom nav for navigation
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
  FiChevronRight, FiCheckCircle, FiBell,
  FiAlertCircle, FiRefreshCw, FiSliders,
  FiX, FiPlus, FiEye, FiShoppingCart,
  FiTrendingUp, FiZap, FiClock, FiArrowRight,
  FiHome, FiGrid, FiUser, FiChevronLeft,
  FiTruck, FiStar, FiMapPin,
} from "react-icons/fi";

import categories from "../config/categories";
import "../styles/Minimart.css";
import "../styles/LoemartHome.css";
import "../styles/LoemartMobile.css";

/* ═══════════════════════════════════════════════════════════════
   ENV + KEYS
═══════════════════════════════════════════════════════════════ */
const API                = `${import.meta.env.VITE_API_BASE_URL}/api`;
const CART_KEY           = "mm_cart";
const RECENT_KEY         = "lm-recently-viewed";
const SEARCH_HISTORY_KEY = "lm-search-history";
const WISH_KEY           = "loemart-wishlist";

const DEFAULT_LIMIT  = 12; /* smaller for mobile */
const SLIDE_INTERVAL = 6000;

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
const SORT_OPTIONS = [
  { value: "newest",     label: "Newest"    },
  { value: "price_asc",  label: "Price ↑"   },
  { value: "price_desc", label: "Price ↓"   },
  { value: "trending",   label: "Trending"  },
];

const HERO_SLIDES = [
  {
    id     : 1,
    eyebrow: "Flash Sale",
    title  : "Up to 70% Off",
    sub    : "Exclusive deals from verified sellers",
    cta    : "Shop Now",
    bg     : "linear-gradient(135deg,#0f0c29 0%,#302b63 100%)",
    accent : "#ff5722",
    icon   : "🔥",
  },
  {
    id     : 2,
    eyebrow: "New Arrivals",
    title  : "Fresh Picks",
    sub    : "Latest products from top sellers near you",
    cta    : "Explore",
    bg     : "linear-gradient(135deg,#134e5e 0%,#71b280 100%)",
    accent : "#10b981",
    icon   : "✨",
  },
  {
    id     : 3,
    eyebrow: "Verified Safe",
    title  : "Shop Trusted",
    sub    : "Buyer protection on every order",
    cta    : "Browse",
    bg     : "linear-gradient(135deg,#1a0533 0%,#11998e 100%)",
    accent : "#6366f1",
    icon   : "🛡️",
  },
];

const TRENDING_SEARCHES = [
  "iPhone", "Laptop", "Sneakers", "PlayStation", "Fashion", "TV",
];

const BOTTOM_NAV = [
  { icon: FiHome,         label: "Home",    path: "/loemart"   },
  { icon: FiGrid,         label: "Browse",  path: "/loemart"   },
  { icon: FiShoppingCart, label: "Cart",    path: "/shop/cart" },
  { icon: FiHeart,        label: "Saved",   path: "/saved"     },
  { icon: FiUser,         label: "Account", path: "/profile"   },
];

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const normalize    = (s = "") => String(s).replace(/\s+/g, " ").trim();
const fmtPrice     = (n)      => `₦${Number(n).toLocaleString("en-NG")}`;
const calcDiscount = (p)      => {
  const base = Number(p.price);
  const orig = Number(p.original_price ?? 0);
  return !orig || orig <= base ? 0 : Math.round(((orig - base) / orig) * 100);
};
const primaryImg = (images = []) => {
  if (!Array.isArray(images) || !images.length) return null;
  return (images.find((i) => i.is_primary) ?? images[0])?.url ?? null;
};

const fakeRating = (product) => {
  const seed = (product.view_count ?? 0) + (product.save_count ?? 0);
  return Math.min(5, 3.6 + (seed % 12) / 10);
};

/* ═══════════════════════════════════════════════════════════════
   CART
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
  const cart = loadCart();
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

/* Recently viewed */
const getRecentlyViewed = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
  catch { return []; }
};
const addToRecentlyViewed = (product) => {
  try {
    const list = getRecentlyViewed().filter((p) => p.id !== product.id);
    list.unshift({
      id    : product.id,
      name  : product.name,
      price : product.price,
      image : primaryImg(product.images),
      slug  : product.slug ?? product.id,
    });
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10)));
  } catch {}
};

/* Search history */
const getSearchHistory = () => {
  try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || "[]"); }
  catch { return []; }
};
const addToSearchHistory = (q) => {
  if (!q.trim()) return;
  try {
    const list = getSearchHistory().filter((s) => s !== q);
    list.unshift(q);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(list.slice(0, 6)));
  } catch {}
};

/* ═══════════════════════════════════════════════════════════════
   COUNTDOWN
═══════════════════════════════════════════════════════════════ */
function useCountdown(hours = 4) {
  const end = useRef(Date.now() + hours * 3600000 + 22 * 60000);
  const [t, setT] = useState({ h:"04", m:"22", s:"00" });
  useEffect(() => {
    const tick = () => {
      const d = Math.max(0, end.current - Date.now());
      setT({
        h: String(Math.floor(d / 3600000)).padStart(2, "0"),
        m: String(Math.floor((d % 3600000) / 60000)).padStart(2, "0"),
        s: String(Math.floor((d % 60000) / 1000)).padStart(2, "0"),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

/* ═══════════════════════════════════════════════════════════════
   STAR RATING
═══════════════════════════════════════════════════════════════ */
const Stars = memo(function Stars({ rating }) {
  return (
    <div className="lmm-stars" aria-label={`${rating.toFixed(1)} of 5`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.min(1, Math.max(0, rating - i));
        return (
          <span key={i} className="lmm-star-wrap">
            <FiStar size={9} className="lmm-star-bg" />
            <FiStar size={9} className="lmm-star-fg"
              style={{ clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)` }} />
          </span>
        );
      })}
      <span className="lmm-star-num">{rating.toFixed(1)}</span>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   MOBILE PRODUCT CARD  (2-column grid — compact & thumb-friendly)
═══════════════════════════════════════════════════════════════ */
const MobileCard = memo(function MobileCard({
  product, wishlisted, onWishlist, onAddToCart,
}) {
  const navigate = useNavigate();
  const [hearted, setHearted] = useState(wishlisted);
  const [carted,  setCarted]  = useState(false);

  const discount   = calcDiscount(product);
  const imgSrc     = primaryImg(product.images);
  const condition  = product.condition ?? "Used";
  const rating     = fakeRating(product);
  const reviewCount = ((product.view_count ?? 0) % 500) + 10;
  const dest       = `/shop/${product.slug ?? product.id}`;

  const go = useCallback(() => {
    addToRecentlyViewed(product);
    navigate(dest);
  }, [navigate, dest, product]);

  const handleWish = useCallback((e) => {
    e.stopPropagation();
    setHearted((v) => !v);
    onWishlist(product.id);
    window.navigator?.vibrate?.(10);
  }, [onWishlist, product.id]);

  const handleCart = useCallback((e) => {
    e.stopPropagation();
    setCarted(true);
    onAddToCart(product);
    window.navigator?.vibrate?.([15, 10, 15]);
    setTimeout(() => setCarted(false), 1400);
  }, [onAddToCart, product]);

  useEffect(() => { setHearted(wishlisted); }, [wishlisted]);

  return (
    <article className="lmm-card" onClick={go} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && go()}
      aria-label={`View ${product.name}`}>

      {/* Image */}
      <div className="lmm-card__img-wrap">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            className="lmm-card__img"
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="lmm-card__placeholder">
            <FiPackage size={26} />
          </div>
        )}

        {/* Discount badge */}
        {discount > 0 && (
          <span className="lmm-card__discount">-{discount}%</span>
        )}

        {/* Wishlist */}
        <button type="button"
          className={`lmm-card__wish ${hearted ? "lmm-card__wish--on" : ""}`}
          onClick={handleWish}
          aria-label={hearted ? "Remove from wishlist" : "Save"}>
          <FiHeart size={13} fill={hearted ? "currentColor" : "none"} />
        </button>

        {/* Featured / trending badge */}
        {product.is_featured && (
          <span className="lmm-card__feat">⚡</span>
        )}
      </div>

      {/* Body */}
      <div className="lmm-card__body">
        <p className="lmm-card__name">{product.name}</p>

        {/* Stars */}
        <div className="lmm-card__rating-row">
          <Stars rating={rating} />
          <span className="lmm-card__reviews">({reviewCount})</span>
        </div>

        {/* Price */}
        <div className="lmm-card__price-row">
          <span className="lmm-card__price">{fmtPrice(product.price)}</span>
          {discount > 0 && (
            <span className="lmm-card__original">
              {fmtPrice(product.original_price)}
            </span>
          )}
        </div>

        {/* Meta line */}
        <div className="lmm-card__meta">
          <span className={`lmm-card__cond lmm-card__cond--${condition.toLowerCase()}`}>
            {condition}
          </span>
          {product.location && (
            <span className="lmm-card__loc">
              <FiMapPin size={8} />{product.location}
            </span>
          )}
        </div>

        {/* Verified seller pill */}
        {product.seller_verified && (
          <div className="lmm-card__verified">
            <FiShield size={9} /> Verified Seller
          </div>
        )}

        {/* Add to cart */}
        <button type="button"
          className={`lmm-card__cart ${carted ? "lmm-card__cart--done" : ""}`}
          onClick={handleCart}
          aria-label={`Add ${product.name} to cart`}>
          {carted
            ? <><FiCheckCircle size={12} /> Added</>
            : <><FiShoppingCart size={12} /> Add to Cart</>
          }
        </button>
      </div>
    </article>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SKELETON
═══════════════════════════════════════════════════════════════ */
function MobileSkeleton() {
  return (
    <div className="lmm-card lmm-card--skel" aria-hidden="true">
      <div className="lmm-skel lmm-skel-img" />
      <div className="lmm-card__body" style={{ gap: 7 }}>
        <div className="lmm-skel" style={{ height: 11, borderRadius: 4 }} />
        <div className="lmm-skel" style={{ height: 11, width: "70%", borderRadius: 4 }} />
        <div className="lmm-skel" style={{ height: 9,  width: "45%", borderRadius: 4 }} />
        <div className="lmm-skel" style={{ height: 14, width: "55%", borderRadius: 4 }} />
        <div className="lmm-skel" style={{ height: 30, borderRadius: 8, marginTop: 4 }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MINI CARD  (horizontal scroll sections)
═══════════════════════════════════════════════════════════════ */
const MiniCard = memo(function MiniCard({ product, onAddToCart }) {
  const navigate = useNavigate();
  const imgSrc   = primaryImg(product.images);
  const discount = calcDiscount(product);

  return (
    <div className="lmm-mini"
      onClick={() => { addToRecentlyViewed(product); navigate(`/shop/${product.slug ?? product.id}`); }}
      role="button" tabIndex={0}>
      <div className="lmm-mini__img-wrap">
        {imgSrc
          ? <img src={imgSrc} alt={product.name} loading="lazy"
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
          : <div className="lmm-mini__ph"><FiPackage size={20} /></div>
        }
        {discount > 0 && <span className="lmm-mini__discount">-{discount}%</span>}
      </div>
      <div className="lmm-mini__body">
        <p className="lmm-mini__name">{product.name}</p>
        <p className="lmm-mini__price">{fmtPrice(product.price)}</p>
        <button
          type="button"
          className="lmm-mini__cart"
          onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
        >
          <FiPlus size={11} /> Add
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
  const pct      = Math.min(90, 30 + (product.view_count ?? 0) % 55);

  return (
    <div className="lmm-flash"
      onClick={() => { addToRecentlyViewed(product); navigate(`/shop/${product.slug ?? product.id}`); }}
      role="button" tabIndex={0}>
      <div className="lmm-flash__img-wrap">
        {imgSrc
          ? <img src={imgSrc} alt={product.name} loading="lazy" />
          : <div className="lmm-flash__ph"><FiPackage size={22} /></div>
        }
        {discount > 0 && <span className="lmm-flash__discount">-{discount}%</span>}
      </div>
      <div className="lmm-flash__body">
        <p className="lmm-flash__name">{product.name}</p>
        <p className="lmm-flash__price">{fmtPrice(product.price)}</p>
        <div className="lmm-flash__bar">
          <div className="lmm-flash__bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="lmm-flash__bar-label">{pct}% claimed</p>
        <button
          type="button"
          className="lmm-flash__cart"
          onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
        >
          <FiShoppingCart size={11} /> Grab
        </button>
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SEARCH BOTTOM SHEET  (mobile-first pattern)
═══════════════════════════════════════════════════════════════ */
function SearchSheet({ open, onClose, query, setQuery, onSelect, history, onClearHistory }) {
  if (!open) return null;
  return (
    <div className="lmm-search-sheet" role="dialog" aria-modal="true" aria-label="Search">
      {/* Header */}
      <div className="lmm-search-sheet__header">
        <button type="button" className="lmm-search-sheet__back" onClick={onClose} aria-label="Close search">
          <FiChevronLeft size={22} />
        </button>
        <form
          className="lmm-search-sheet__form"
          onSubmit={(e) => { e.preventDefault(); onSelect(query); }}
        >
          <FiSearch size={16} className="lmm-search-sheet__icon" aria-hidden="true" />
          <input
            type="search"
            autoFocus
            className="lmm-search-sheet__input"
            placeholder="Search products…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search"
          />
          {query && (
            <button type="button" className="lmm-search-sheet__clear"
              onClick={() => setQuery("")} aria-label="Clear">
              <FiX size={14} />
            </button>
          )}
        </form>
      </div>

      {/* Body */}
      <div className="lmm-search-sheet__body">
        {history.length > 0 && !query && (
          <>
            <div className="lmm-search-sheet__section">
              <div className="lmm-search-sheet__title">
                <FiClock size={12} /> Recent
                <button type="button" onClick={onClearHistory} className="lmm-search-sheet__title-clear">
                  Clear
                </button>
              </div>
              {history.map((s) => (
                <button key={s} type="button" className="lmm-search-sheet__row"
                  onClick={() => onSelect(s)}>
                  <FiClock size={13} className="lmm-search-sheet__row-icon" />
                  <span>{s}</span>
                  <FiArrowRight size={13} className="lmm-search-sheet__row-arrow" />
                </button>
              ))}
            </div>
            <div className="lmm-search-sheet__divider" />
          </>
        )}

        <div className="lmm-search-sheet__section">
          <div className="lmm-search-sheet__title">
            <FiTrendingUp size={12} /> Trending
          </div>
          <div className="lmm-search-sheet__chips">
            {TRENDING_SEARCHES.map((s) => (
              <button key={s} type="button" className="lmm-search-sheet__chip"
                onClick={() => onSelect(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {query && (
          <div className="lmm-search-sheet__section">
            <div className="lmm-search-sheet__title">Search for</div>
            <button type="button" className="lmm-search-sheet__row lmm-search-sheet__row--query"
              onClick={() => onSelect(query)}>
              <FiSearch size={14} className="lmm-search-sheet__row-icon" />
              <strong>{query}</strong>
              <FiArrowRight size={14} className="lmm-search-sheet__row-arrow" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FILTER BOTTOM SHEET
═══════════════════════════════════════════════════════════════ */
function FilterSheet({
  open, onClose,
  minPrice, setMinPrice, maxPrice, setMaxPrice,
  activeSort, setActiveSort, onApply, onReset,
}) {
  if (!open) return null;
  return (
    <>
      <div className="lmm-sheet-overlay" onClick={onClose} aria-hidden="true" />
      <div className="lmm-sheet" role="dialog" aria-modal="true" aria-label="Filters">
        <div className="lmm-sheet__handle" aria-hidden="true" />
        <div className="lmm-sheet__header">
          <h3 className="lmm-sheet__title">
            <FiSliders size={16} /> Filters
          </h3>
          <button type="button" className="lmm-sheet__close" onClick={onClose} aria-label="Close">
            <FiX size={16} />
          </button>
        </div>

        <div className="lmm-sheet__body">
          {/* Price */}
          <div className="lmm-sheet__section">
            <p className="lmm-sheet__label">Price Range (₦)</p>
            <div className="lmm-price-inputs">
              <input type="number" placeholder="Min" value={minPrice}
                min={0} className="lmm-price-input"
                onChange={(e) => setMinPrice(e.target.value)} aria-label="Min price" />
              <span className="lmm-price-sep">—</span>
              <input type="number" placeholder="Max" value={maxPrice}
                min={0} className="lmm-price-input"
                onChange={(e) => setMaxPrice(e.target.value)} aria-label="Max price" />
            </div>
          </div>

          {/* Sort */}
          <div className="lmm-sheet__section">
            <p className="lmm-sheet__label">Sort By</p>
            <div className="lmm-sheet__chips">
              {SORT_OPTIONS.map((opt) => (
                <button key={opt.value} type="button"
                  className={`lmm-sheet__chip ${activeSort === opt.value ? "lmm-sheet__chip--on" : ""}`}
                  onClick={() => setActiveSort(opt.value)}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lmm-sheet__footer">
          <button type="button" className="lmm-btn-reset" onClick={onReset}>Reset</button>
          <button type="button" className="lmm-btn-apply" onClick={onApply}>Apply Filters</button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CART TOAST
═══════════════════════════════════════════════════════════════ */
function CartToast({ product, onView, onClose }) {
  return (
    <div className="lmm-toast">
      <div className="lmm-toast__img-wrap">
        {primaryImg(product.images)
          ? <img src={primaryImg(product.images)} alt={product.name} className="lmm-toast__img" />
          : <div className="lmm-toast__ph"><FiPackage size={16} /></div>
        }
      </div>
      <div className="lmm-toast__body">
        <p className="lmm-toast__label">✓ Added</p>
        <p className="lmm-toast__name">{product.name}</p>
      </div>
      <button type="button" className="lmm-toast__view" onClick={onView}>View</button>
      <button type="button" className="lmm-toast__close" onClick={onClose} aria-label="Dismiss">
        <FiX size={12} />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BOTTOM NAV
═══════════════════════════════════════════════════════════════ */
function BottomNav({ cartCount, wishCount, active = 0 }) {
  const navigate = useNavigate();
  return (
    <nav className="lmm-bottomnav" aria-label="Main navigation">
      {BOTTOM_NAV.map((item, i) => {
        const Icon     = item.icon;
        const isActive = i === active;
        const badge    = item.label === "Cart"  ? cartCount
                       : item.label === "Saved" ? wishCount
                       : 0;
        return (
          <button
            key={item.label}
            type="button"
            className={`lmm-bottomnav__item ${isActive ? "lmm-bottomnav__item--active" : ""}`}
            onClick={() => navigate(item.path)}
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="lmm-bottomnav__icon">
              <Icon size={20} />
              {badge > 0 && (
                <span className="lmm-bottomnav__badge">{badge > 9 ? "9+" : badge}</span>
              )}
            </span>
            <span className="lmm-bottomnav__label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */
export default function HomePageMobile({ user }) {
  const navigate                        = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const flashTime                       = useCountdown(4);

  /* Hero */
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

  /* Search */
  const [searchQuery,   setSearchQuery]   = useState(searchParams.get("q") ?? "");
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [searchHistory, setSearchHistory] = useState(getSearchHistory);

  /* Filters */
  const [activeCategory, setActiveCategory] = useState(searchParams.get("category") ?? "all");
  const [activeSort,     setActiveSort]     = useState(searchParams.get("sort")     ?? "newest");
  const [minPrice,       setMinPrice]       = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice,       setMaxPrice]       = useState(searchParams.get("maxPrice") ?? "");
  const [showFilters,    setShowFilters]    = useState(false);

  /* Products */
  const [products,    setProducts]    = useState([]);
  const [pagination,  setPagination]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError,  setFetchError]  = useState(null);
  const [offset,      setOffset]      = useState(0);

  /* Section data */
  const [featured,       setFeatured]       = useState([]);
  const [flashDeals,     setFlashDeals]     = useState([]);
  const [newArrivals,    setNewArrivals]    = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState(getRecentlyViewed);

  /* Cart / wishlist */
  const [cartCount, setCartCount] = useState(getCartCount);
  useEffect(() => {
    const sync = () => setCartCount(getCartCount());
    window.addEventListener("cart-updated", sync);
    return () => window.removeEventListener("cart-updated", sync);
  }, []);

  const [wishlist, setWishlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem(WISH_KEY) || "[]"); }
    catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem(WISH_KEY, JSON.stringify(wishlist));
  }, [wishlist]);

  /* Notify */
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifySent,  setNotifySent]  = useState(false);

  /* Category tabs */
  const categoryTabs = useMemo(() => [
    { id: "all", name: "All", icon: "🏪" },
    ...categories,
  ], []);

  /* ── Fetch ── */
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
      const rows = data?.data?.products   ?? [];
      const meta = data?.data?.pagination ?? null;
      setProducts((prev) => append ? [...prev, ...rows] : rows);
      setPagination(meta);
      setOffset(newOffset);
    } catch (err) {
      const msg = err.response?.data?.message
        ?? (err.code === "ERR_NETWORK" ? "Network error" : "Failed to load");
      setFetchError(msg);
      if (!append) toast.error(msg);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchQuery, activeCategory, activeSort, minPrice, maxPrice]);

  const fetchSections = useCallback(async () => {
    try {
      const [feat, trend, latest] = await Promise.allSettled([
        axios.get(`${API}/products`, { params: { featured:"true", limit:8, sort:"trending" } }),
        axios.get(`${API}/products`, { params: { trending:"true", limit:8, sort:"views"    } }),
        axios.get(`${API}/products`, { params: { limit:8,          sort:"newest"           } }),
      ]);
      if (feat.status   === "fulfilled") setFeatured  (feat.value.data?.data?.products   ?? []);
      if (trend.status  === "fulfilled") setFlashDeals(trend.value.data?.data?.products  ?? []);
      if (latest.status === "fulfilled") setNewArrivals(latest.value.data?.data?.products ?? []);
    } catch {}
  }, []);

  useEffect(() => { fetchProducts({ newOffset: 0 }); fetchSections(); }, []); // eslint-disable-line
  useEffect(() => { fetchProducts({ newOffset: 0, append: false }); }, [activeCategory, activeSort]); // eslint-disable-line

  /* ── Handlers ── */
  const handleSearchSelect = useCallback((q) => {
    setSearchQuery(q);
    setSearchOpen(false);
    addToSearchHistory(q);
    setSearchHistory(getSearchHistory());
    setSearchParams(q ? { q } : {});
    fetchProducts({ query: q, newOffset: 0 });
  }, [fetchProducts, setSearchParams]);

  const handleCategoryChange = useCallback((id) => {
    setActiveCategory(id); setOffset(0);
    window.navigator?.vibrate?.(8);
  }, []);

  const handleLoadMore = useCallback(() => {
    fetchProducts({ newOffset: offset + DEFAULT_LIMIT, append: true });
  }, [fetchProducts, offset]);

  const handleApplyFilters = useCallback(() => {
    fetchProducts({ min: minPrice, max: maxPrice, newOffset: 0 });
    setShowFilters(false);
  }, [fetchProducts, minPrice, maxPrice]);

  const handleResetFilters = useCallback(() => {
    setMinPrice(""); setMaxPrice(""); setActiveSort("newest");
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchQuery(""); setActiveCategory("all"); setActiveSort("newest");
    setMinPrice(""); setMaxPrice(""); setSearchParams({});
    fetchProducts({ query:"", category:"all", sort:"newest", min:"", max:"", newOffset:0 });
  }, [fetchProducts, setSearchParams]);

  const toggleWishlist = useCallback((id) => {
    setWishlist((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }, []);

  const handleAddToCart = useCallback((product) => {
    addToCart(product);
    setCartCount(getCartCount());
    toast.custom(
      (t) => (
        <CartToast
          product={product}
          onView={() => { toast.dismiss(t.id); navigate("/shop/cart"); }}
          onClose={() => toast.dismiss(t.id)}
        />
      ),
      { duration: 3200, position: "bottom-center" }
    );
  }, [navigate]);

  const goPostAd = useCallback(() => {
    navigate(user ? "/minimart/post-ad" : "/auth");
  }, [navigate, user]);

  const handleNotify = useCallback((e) => {
    e.preventDefault();
    if (!notifyEmail.includes("@")) { toast.error("Enter valid email"); return; }
    setNotifySent(true); toast.success("Subscribed! 🎉");
  }, [notifyEmail]);

  const handleSlide = useCallback((i) => { setSlideIndex(i); resetTimer(); }, [resetTimer]);

  const hasMore    = pagination ? (offset + DEFAULT_LIMIT) < pagination.total : false;
  const hasFilters = !!(searchQuery || activeCategory !== "all" || activeSort !== "newest" || minPrice || maxPrice);
  const slide      = HERO_SLIDES[slideIndex];
  const firstName  = user?.name?.split(" ")[0] ?? null;

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="lmm-page">

      {/* ═══════════════════════════════════════════════
          COMPACT TOPBAR
      ═══════════════════════════════════════════════ */}
      <header className="lmm-topbar">
        <div className="lmm-topbar__row">

          <button type="button" className="lmm-topbar__logo"
            onClick={() => navigate("/loemart")}
            aria-label="Loemart home">
            <span className="lmm-topbar__logo-icon">🛍️</span>
            <span className="lmm-topbar__logo-text">Loemart</span>
          </button>

          <button type="button" className="lmm-topbar__search-btn"
            onClick={() => setSearchOpen(true)}
            aria-label="Open search">
            <FiSearch size={16} />
            <span className="lmm-topbar__search-placeholder">
              {searchQuery || "Search products…"}
            </span>
          </button>

          <button type="button" className="lmm-topbar__filter-btn"
            onClick={() => setShowFilters(true)}
            aria-label="Filters">
            <FiSliders size={17} />
            {hasFilters && <span className="lmm-topbar__filter-dot" />}
          </button>
        </div>

        {/* Category strip */}
        <nav className="lmm-topbar__cats" aria-label="Categories">
          {categoryTabs.map((c) => (
            <button key={c.id} type="button"
              className={`lmm-cat ${activeCategory === c.id ? "lmm-cat--on" : ""}`}
              onClick={() => handleCategoryChange(c.id)}
              aria-pressed={activeCategory === c.id}>
              <span className="lmm-cat__icon">{c.icon}</span>
              <span className="lmm-cat__label">{c.name}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* ═══════════════════════════════════════════════
          WELCOME BAR
      ═══════════════════════════════════════════════ */}
      {user && firstName && (
        <div className="lmm-welcome">
          <span>👋 Hi, <strong>{firstName}</strong></span>
          <button type="button" className="lmm-welcome__link"
            onClick={() => document.getElementById("lmm-listings")?.scrollIntoView({ behavior:"smooth" })}>
            Continue <FiArrowRight size={11} />
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          COMPACT HERO
      ═══════════════════════════════════════════════ */}
      <section className="lmm-hero" aria-label="Featured banner">
        <div className="lmm-hero__bg" style={{ background: slide.bg }} aria-hidden="true" />
        <div className="lmm-hero__overlay" aria-hidden="true" />

        <div className="lmm-hero__content">
          <span className="lmm-hero__eyebrow">
            <span className="lmm-hero__icon" aria-hidden="true">{slide.icon}</span>
            {slide.eyebrow}
          </span>
          <h1 className="lmm-hero__title">{slide.title}</h1>
          <p  className="lmm-hero__sub">{slide.sub}</p>

          <div className="lmm-hero__actions">
            <button type="button" className="lmm-hero__cta"
              style={{ background: `linear-gradient(135deg, ${slide.accent}, ${slide.accent}bb)` }}
              onClick={() => document.getElementById("lmm-listings")?.scrollIntoView({ behavior:"smooth" })}>
              {slide.cta} <FiArrowRight size={13} />
            </button>
            <button type="button" className="lmm-hero__cta-2" onClick={goPostAd}>
              Sell
            </button>
          </div>

          {cartCount > 0 && (
            <button type="button" className="lmm-hero__cart-pill"
              onClick={() => navigate("/shop/cart")}>
              <FiShoppingCart size={11} />
              {cartCount} in cart
              <FiChevronRight size={11} />
            </button>
          )}
        </div>

        {/* Dots */}
        <div className="lmm-hero__dots" role="tablist">
          {HERO_SLIDES.map((s, i) => (
            <button key={s.id} type="button" role="tab"
              aria-selected={i === slideIndex} aria-label={`Slide ${i + 1}`}
              className={`lmm-hero__dot ${i === slideIndex ? "lmm-hero__dot--on" : ""}`}
              onClick={() => handleSlide(i)} />
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          QUICK ACTION TILES  (mobile-only shortcut row)
      ═══════════════════════════════════════════════ */}
      <div className="lmm-quick-tiles">
        {[
          { icon: "⚡", label: "Flash Deals", color: "#ff5722",
            onClick: () => document.getElementById("lmm-flash")?.scrollIntoView({ behavior:"smooth" }) },
          { icon: "✨", label: "New Arrivals", color: "#10b981",
            onClick: () => document.getElementById("lmm-new")?.scrollIntoView({ behavior:"smooth" }) },
          { icon: "🔥", label: "Trending", color: "#6366f1",
            onClick: () => document.getElementById("lmm-listings")?.scrollIntoView({ behavior:"smooth" }) },
          { icon: "💰", label: "Sell", color: "#f59e0b", onClick: goPostAd },
        ].map((t) => (
          <button key={t.label} type="button" className="lmm-tile" onClick={t.onClick}>
            <div className="lmm-tile__icon" style={{ background: `${t.color}18`, color: t.color }}>
              <span>{t.icon}</span>
            </div>
            <span className="lmm-tile__label">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════
          FLASH DEALS with countdown
      ═══════════════════════════════════════════════ */}
      {flashDeals.length > 0 && (
        <section id="lmm-flash" className="lmm-flash-section" aria-label="Flash deals">
          <div className="lmm-flash-section__header">
            <div className="lmm-flash-section__title-wrap">
              <div className="lmm-flash-section__icon" aria-hidden="true">⚡</div>
              <div>
                <h2 className="lmm-flash-section__title">Flash Deals</h2>
                <p className="lmm-flash-section__sub">Limited stock</p>
              </div>
            </div>
            <div className="lmm-countdown" aria-label={`Ends in ${flashTime.h}h ${flashTime.m}m`}>
              <FiClock size={10} />
              <span className="lmm-countdown__digit">{flashTime.h}</span>:
              <span className="lmm-countdown__digit">{flashTime.m}</span>:
              <span className="lmm-countdown__digit">{flashTime.s}</span>
            </div>
          </div>
          <div className="lmm-hscroll">
            {flashDeals.map((p) => (
              <FlashCard key={p.id} product={p} onAddToCart={handleAddToCart} />
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════
          FEATURED
      ═══════════════════════════════════════════════ */}
      {featured.length > 0 && (
        <section className="lmm-section" aria-label="Featured picks">
          <div className="lmm-section__header">
            <div>
              <h2 className="lmm-section__title">⚡ Featured Picks</h2>
              <p className="lmm-section__sub">Handpicked for you</p>
            </div>
            <button type="button" className="lmm-see-all"
              onClick={() => document.getElementById("lmm-listings")?.scrollIntoView({ behavior:"smooth" })}>
              All <FiChevronRight size={12} />
            </button>
          </div>
          <div className="lmm-hscroll">
            {featured.map((p) => (
              <MiniCard key={p.id} product={p} onAddToCart={handleAddToCart} />
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════
          NEW ARRIVALS
      ═══════════════════════════════════════════════ */}
      {newArrivals.length > 0 && (
        <section id="lmm-new" className="lmm-section" aria-label="New arrivals">
          <div className="lmm-section__header">
            <div>
              <h2 className="lmm-section__title">
                ✨ New Arrivals
                <span className="lmm-section__badge" style={{ background:"#10b981" }}>NEW</span>
              </h2>
              <p className="lmm-section__sub">Fresh today</p>
            </div>
            <button type="button" className="lmm-see-all"
              onClick={() => setActiveSort("newest")}>
              All <FiChevronRight size={12} />
            </button>
          </div>
          <div className="lmm-hscroll">
            {newArrivals.map((p) => (
              <MiniCard key={p.id} product={p} onAddToCart={handleAddToCart} />
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════
          RECENTLY VIEWED
      ═══════════════════════════════════════════════ */}
      {recentlyViewed.length > 0 && (
        <section className="lmm-section" aria-label="Recently viewed">
          <div className="lmm-section__header">
            <div>
              <h2 className="lmm-section__title">🕒 Recently Viewed</h2>
            </div>
          </div>
          <div className="lmm-hscroll">
            {recentlyViewed.map((p) => (
              <div key={p.id} className="lmm-recent"
                onClick={() => navigate(`/shop/${p.slug}`)}
                role="button" tabIndex={0}>
                {p.image
                  ? <img src={p.image} alt={p.name} className="lmm-recent__img" loading="lazy" />
                  : <div className="lmm-recent__ph"><FiPackage size={16} /></div>
                }
                <p className="lmm-recent__name">{p.name}</p>
                <p className="lmm-recent__price">{fmtPrice(p.price)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════
          LISTINGS GRID  (2 cols mobile-first)
      ═══════════════════════════════════════════════ */}
      <div className="lmm-listings-header">
        <div>
          <h2 className="lmm-listings-title">Browse All</h2>
          {!loading && (
            <p className="lmm-listings-count">
              {pagination ? `${pagination.total.toLocaleString()} products` : `${products.length} shown`}
            </p>
          )}
        </div>
        {hasFilters && (
          <button type="button" className="lmm-clear-btn" onClick={clearAllFilters}>
            Clear <FiX size={11} />
          </button>
        )}
      </div>

      <main id="lmm-listings" className="lmm-grid" aria-label="Products" aria-busy={loading}>
        {loading && Array.from({ length: 6 }).map((_, i) => <MobileSkeleton key={i} />)}

        {!loading && fetchError && (
          <div className="lmm-error">
            <FiAlertCircle size={28} />
            <p>{fetchError}</p>
            <button type="button" className="lmm-retry" onClick={() => fetchProducts({ newOffset:0 })}>
              <FiRefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {!loading && !fetchError && !products.length && (
          <div className="lmm-empty">
            <div className="lmm-empty__icon"><FiSearch size={30} /></div>
            <p className="lmm-empty__title">No results found</p>
            <p className="lmm-empty__sub">Try different keywords or browse categories</p>
            <button type="button" className="lmm-empty__clear" onClick={clearAllFilters}>
              Clear Filters
            </button>
          </div>
        )}

        {!loading && !fetchError && products.map((p) => (
          <MobileCard key={p.id} product={p}
            wishlisted={wishlist.includes(p.id)}
            onWishlist={toggleWishlist}
            onAddToCart={handleAddToCart}
          />
        ))}

        {loadingMore && (
          <div className="lmm-loadmore-row">
            <div className="lmm-spinner" aria-label="Loading more" />
          </div>
        )}

        {!loading && !loadingMore && hasMore && (
          <div className="lmm-loadmore-row">
            <button type="button" className="lmm-loadmore-btn" onClick={handleLoadMore}>
              Load More <FiChevronRight size={13} />
            </button>
          </div>
        )}

        {!loading && !hasMore && products.length > 0 && (
          <p className="lmm-end">✓ End of results</p>
        )}
      </main>

      {/* ═══════════════════════════════════════════════
          NOTIFY BANNER
      ═══════════════════════════════════════════════ */}
      <section className="lmm-notify" aria-label="Deal notifications">
        <div className="lmm-notify__icon-wrap">
          <FiBell size={20} />
        </div>
        <div className="lmm-notify__body">
          <p className="lmm-notify__title">Never miss a deal</p>
          <p className="lmm-notify__sub">Get alerts for new products</p>
        </div>
        {notifySent ? (
          <div className="lmm-notify__done">
            <FiCheckCircle size={16} />
          </div>
        ) : (
          <form onSubmit={handleNotify} className="lmm-notify__form">
            <input type="email" placeholder="Your email"
              value={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.value)}
              aria-label="Email" required
              className="lmm-notify__input" />
            <button type="submit" className="lmm-notify__btn" aria-label="Subscribe">
              <FiArrowRight size={14} />
            </button>
          </form>
        )}
      </section>

      {/* ═══════════════════════════════════════════════
          FLOATING CART / POST FAB
      ═══════════════════════════════════════════════ */}
      {cartCount > 0 ? (
        <button type="button" className="lmm-fab lmm-fab--cart"
          onClick={() => navigate("/shop/cart")}
          aria-label={`View cart with ${cartCount} items`}>
          <FiShoppingCart size={18} />
          <span className="lmm-fab__count">{cartCount > 9 ? "9+" : cartCount}</span>
        </button>
      ) : (
        <button type="button" className="lmm-fab lmm-fab--post"
          onClick={goPostAd}
          aria-label={user ? "Post an ad" : "Sign up to sell"}>
          <FiPlus size={20} />
        </button>
      )}

      {/* ═══════════════════════════════════════════════
          SHEETS
      ═══════════════════════════════════════════════ */}
      <SearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        query={searchQuery}
        setQuery={setSearchQuery}
        onSelect={handleSearchSelect}
        history={searchHistory}
        onClearHistory={() => {
          localStorage.removeItem(SEARCH_HISTORY_KEY);
          setSearchHistory([]);
        }}
      />

      <FilterSheet
        open={showFilters}
        onClose={() => setShowFilters(false)}
        minPrice={minPrice} setMinPrice={setMinPrice}
        maxPrice={maxPrice} setMaxPrice={setMaxPrice}
        activeSort={activeSort} setActiveSort={setActiveSort}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />

      {/* ═══════════════════════════════════════════════
          BOTTOM NAV  (fixed)
      ═══════════════════════════════════════════════ */}
      <BottomNav cartCount={cartCount} wishCount={wishlist.length} active={0} />

    </div>
  );
}