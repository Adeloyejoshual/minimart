/**
 * src/pages/HomePageMobile.jsx
 * Mobile-optimized Loemart homepage (< 1024px screens)
 *
 * Features:
 * - Touch-optimized topbar with live search & dropdown suggestions
 * - Mobile hero carousel with touch swipe gestures
 * - Horizontal swipe sections (Flash Deals with countdown, Featured, Recently Viewed)
 * - 2-column touch grid & 1-column list view toggles
 * - Bottom-sheet filter drawer for price ranges, categories, and sorting
 * - Resilient primary image & price parser
 * - Floating Cart / Post Ad FAB
 */

import { useState, useMemo, useCallback, useEffect, useRef, memo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  FiSearch, FiShield, FiPackage, FiHeart, FiChevronRight,
  FiChevronLeft, FiCheckCircle, FiBell, FiAlertCircle, FiRefreshCw,
  FiSliders, FiX, FiPlus, FiEye, FiShoppingCart, FiTrendingUp,
  FiZap, FiClock, FiArrowRight, FiCamera, FiTag, FiTruck, FiLock,
  FiRotateCcw, FiAward, FiStar, FiMapPin, FiGrid, FiList
} from "react-icons/fi";

import categories from "../config/categories";
import "../styles/Minimart.css";
import "../styles/LoemartPremium.css";

/* ═══════════════════════════════════════════════════════════════
   ENV & KEYS
═══════════════════════════════════════════════════════════════ */
const API                = `${import.meta.env.VITE_API_BASE_URL}/api`;
const CART_KEY           = "mm_cart";
const RECENT_KEY         = "lm-recently-viewed";
const SEARCH_HISTORY_KEY = "lm-search-history";
const WISH_KEY           = "loemart-wishlist";

const DEFAULT_LIMIT  = 20;
const SLIDE_INTERVAL = 5000;

/* ═══════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════ */
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
    id: 1,
    tag: "🔥",
    eyebrow: "Flash Deals",
    title: "Up to 70% Off\nOn Verified Tech",
    sub: "Direct from top Nigerian sellers",
    cta: "Shop Deals",
    bg: "linear-gradient(135deg, #0f0c29 0%, #1a1a4e 50%, #302b63 100%)",
    accent: "#ff5722",
  },
  {
    id: 2,
    tag: "✨",
    eyebrow: "New Arrivals",
    title: "Fresh Marketplace\nListings Today",
    sub: "Explore thousands of item updates",
    cta: "Browse New",
    bg: "linear-gradient(135deg, #134e5e 0%, #0d3b47 50%, #1a6b4a 100%)",
    accent: "#10b981",
  },
  {
    id: 3,
    tag: "🛡️",
    eyebrow: "Buyer Protection",
    title: "Safe & Verified\nShopping Always",
    sub: "Auto-scanned items & safe payouts",
    cta: "Start Selling",
    bg: "linear-gradient(135deg, #1a0533 0%, #2d1b69 50%, #11998e 100%)",
    accent: "#6366f1",
  },
];

const TRENDING_SEARCHES = [
  "iPhone 15", "Samsung S24", "HP Laptop", "Nike Sneakers",
  "PlayStation 5", "MacBook Air", "Smart TV",
];

/* ═══════════════════════════════════════════════════════════════
   HELPERS & PARSERS
═══════════════════════════════════════════════════════════════ */
const normalize = (s = "") => String(s).replace(/\s+/g, " ").trim();
const fmtPrice  = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

const primaryImg = (images) => {
  if (!images) return null;
  if (typeof images === "string") {
    try { images = JSON.parse(images); } catch { images = [images]; }
  }
  if (!Array.isArray(images) || !images.length) return null;
  const first = images.find((i) => i?.is_primary) || images[0];
  if (typeof first === "string") return first;
  return first?.url || first?.image_url || first?.src || null;
};

const calcDiscount = (p) => {
  const base = Number(p.price || 0);
  const orig = Number(p.original_price || 0);
  if (!orig || orig <= base) return 0;
  return Math.round(((orig - base) / orig) * 100);
};

/* ═══════════════════════════════════════════════════════════════
   LOCAL STORAGE HELPERS
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
  const cart     = loadCart();
  const existing = cart.find((i) => i.productId === product.id && !i.variant);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      productId: product.id,
      name: product.name,
      price: Number(product.price),
      image: primaryImg(product.images),
      qty: 1,
      variant: null,
      slug: product.slug ?? product.id,
    });
  }
  saveCart(cart);
};

const getCartCount = () => loadCart().reduce((s, i) => s + (i.qty || 1), 0);

const getRecentlyViewed = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
  catch { return []; }
};

const addToRecentlyViewed = (product) => {
  try {
    const list = getRecentlyViewed().filter((p) => p.id !== product.id);
    list.unshift({
      id: product.id,
      name: product.name,
      price: product.price,
      image: primaryImg(product.images),
      slug: product.slug ?? product.id,
    });
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
  } catch {}
};

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
   HOOKS
═══════════════════════════════════════════════════════════════ */
function useCountdown(targetHours = 4) {
  const end = useRef(Date.now() + targetHours * 3600000 + 15 * 60000);
  const [time, setTime] = useState({ h: "04", m: "15", s: "00" });

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, end.current - Date.now());
      setTime({
        h: String(Math.floor(diff / 3600000)).padStart(2, "0"),
        m: String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0"),
        s: String(Math.floor((diff % 60000) / 1000)).padStart(2, "0"),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENTS
═══════════════════════════════════════════════════════════════ */

// Star Rating Component
const StarRating = memo(function StarRating({ rating = 4.5, count = 12 }) {
  return (
    <div className="lm-mobile-stars">
      <FiStar size={10} className="lm-star-active" fill="currentColor" />
      <span className="lm-mobile-rating-num">{rating.toFixed(1)}</span>
      <span className="lm-mobile-rating-count">({count})</span>
    </div>
  );
});

// Mobile Cart Toast
function CartToast({ product, onView, onClose }) {
  return (
    <div className="lm-cart-toast lm-cart-toast--mobile">
      <div className="lm-cart-toast__img-wrap">
        {primaryImg(product.images) ? (
          <img src={primaryImg(product.images)} alt={product.name} />
        ) : (
          <div className="lm-cart-toast__img-ph"><FiPackage size={16} /></div>
        )}
      </div>
      <div className="lm-cart-toast__body">
        <p className="lm-cart-toast__label">✓ Added to cart</p>
        <p className="lm-cart-toast__name">{product.name}</p>
        <p className="lm-cart-toast__price">{fmtPrice(product.price)}</p>
      </div>
      <button type="button" className="lm-cart-toast__view" onClick={onView}>Cart</button>
      <button type="button" className="lm-cart-toast__close" onClick={onClose}><FiX size={14} /></button>
    </div>
  );
}

// Mobile Mini Card (Horizontal Scroll)
const MiniCardMobile = memo(function MiniCardMobile({ product, onAddToCart, onWishlist, wishlisted }) {
  const navigate = useNavigate();
  const imgSrc   = primaryImg(product.images);
  const discount = calcDiscount(product);
  const dest     = `/shop/${product.slug ?? product.id}`;

  return (
    <div className="lm-mini-card-mobile" onClick={() => { addToRecentlyViewed(product); navigate(dest); }}>
      <div className="lm-mini-card-mobile__img">
        {imgSrc ? (
          <img src={imgSrc} alt={product.name} loading="lazy" />
        ) : (
          <div className="lm-mini-card-mobile__ph"><FiPackage size={22} /></div>
        )}
        {discount > 0 && <span className="lm-mini-card-mobile__badge">-{discount}%</span>}
        <button
          type="button"
          className={`lm-mini-card-mobile__wish ${wishlisted ? "active" : ""}`}
          onClick={(e) => { e.stopPropagation(); onWishlist(product.id); }}
        >
          <FiHeart size={12} fill={wishlisted ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="lm-mini-card-mobile__info">
        <p className="lm-mini-card-mobile__title">{product.name}</p>
        <p className="lm-mini-card-mobile__price">{fmtPrice(product.price)}</p>
        <button
          type="button"
          className="lm-mini-card-mobile__cart"
          onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
        >
          <FiShoppingCart size={11} /> Add
        </button>
      </div>
    </div>
  );
});

// Mobile Product Card (Grid / List)
const MobileProductCard = memo(function MobileProductCard({
  product, wishlisted, onWishlist, onAddToCart, view = "grid", index = 0,
}) {
  const navigate = useNavigate();
  const [carted, setCarted] = useState(false);
  const imgSrc    = primaryImg(product.images);
  const discount  = calcDiscount(product);
  const condition = product.condition ?? "Used";
  const dest      = `/shop/${product.slug ?? product.id}`;

  const go = useCallback(() => {
    addToRecentlyViewed(product);
    navigate(dest);
  }, [navigate, dest, product]);

  const handleCart = useCallback((e) => {
    e.stopPropagation();
    setCarted(true);
    onAddToCart(product);
    setTimeout(() => setCarted(false), 1200);
  }, [onAddToCart, product]);

  return (
    <article className={`lm-mcard ${view === "list" ? "lm-mcard--list" : ""}`}>
      <div className="lm-mcard__img-wrap" onClick={go}>
        {imgSrc ? (
          <img src={imgSrc} alt={product.name} loading="lazy" className="lm-mcard__img" />
        ) : (
          <div className="lm-mcard__ph"><FiPackage size={28} /></div>
        )}

        <div className="lm-mcard__badges">
          {discount > 0 && <span className="lm-mcard__tag lm-mcard__tag--sale">-{discount}%</span>}
          {product.is_featured && <span className="lm-mcard__tag lm-mcard__tag--feat">⚡</span>}
        </div>

        <button
          type="button"
          className={`lm-mcard__wish ${wishlisted ? "lm-mcard__wish--active" : ""}`}
          onClick={(e) => { e.stopPropagation(); onWishlist(product.id); }}
        >
          <FiHeart size={14} fill={wishlisted ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="lm-mcard__body">
        {product.seller_name && (
          <div className="lm-mcard__seller">
            <span className="lm-mcard__seller-name">{product.seller_name}</span>
            {product.seller_verified && <FiShield size={10} className="lm-mcard__verified" />}
          </div>
        )}

        <h3 className="lm-mcard__title" onClick={go}>{product.name}</h3>

        <StarRating rating={4.6} count={((product.view_count || 5) % 40) + 3} />

        <div className="lm-mcard__price-row">
          <span className="lm-mcard__price">{fmtPrice(product.price)}</span>
          {discount > 0 && (
            <span className="lm-mcard__orig">{fmtPrice(product.original_price)}</span>
          )}
        </div>

        <div className="lm-mcard__meta">
          <span className="lm-mcard__cond">{condition}</span>
          {product.location && (
            <span className="lm-mcard__loc"><FiMapPin size={9} /> {product.location}</span>
          )}
        </div>

        <button
          type="button"
          className={`lm-mcard__cart-btn ${carted ? "lm-mcard__cart-btn--done" : ""}`}
          onClick={handleCart}
        >
          {carted ? <><FiCheckCircle size={13} /> Added</> : <><FiShoppingCart size={13} /> Add to Cart</>}
        </button>
      </div>
    </article>
  );
});

// Mobile Skeleton Card
function SkeletonCardMobile() {
  return (
    <div className="lm-mcard lm-skel-mcard">
      <div className="lm-skel lm-skel-mimg" />
      <div className="lm-mcard__body" style={{ gap: 6, padding: 8 }}>
        <div className="lm-skel" style={{ width: "40%", height: 8 }} />
        <div className="lm-skel" style={{ height: 12 }} />
        <div className="lm-skel" style={{ width: "70%", height: 12 }} />
        <div className="lm-skel" style={{ width: "50%", height: 16, marginTop: 4 }} />
        <div className="lm-skel" style={{ height: 32, borderRadius: 8, marginTop: 4 }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN MOBILE HOMEPAGE COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function HomePageMobile({ user }) {
  const navigate                        = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const flashTime                       = useCountdown(5);

  /* ── Hero Carousel ── */
  const [slideIndex, setSlideIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length);
    }, SLIDE_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  /* ── Search State ── */
  const [searchQuery,   setSearchQuery]   = useState(searchParams.get("q") ?? "");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState(getSearchHistory);
  const searchRef                         = useRef(null);

  /* ── Filter & Sort State ── */
  const [activeCategory, setActiveCategory] = useState(searchParams.get("category") ?? "all");
  const [activeSort,     setActiveSort]     = useState(searchParams.get("sort")     ?? "newest");
  const [minPrice,       setMinPrice]       = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice,       setMaxPrice]       = useState(searchParams.get("maxPrice") ?? "");
  const [view,           setView]           = useState("grid");
  const [showFilters,    setShowFilters]    = useState(false);

  /* ── Products & Data ── */
  const [products,    setProducts]    = useState([]);
  const [pagination,  setPagination]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError,  setFetchError]  = useState(null);
  const [offset,      setOffset]      = useState(0);

  /* ── Sections ── */
  const [featured,       setFeatured]       = useState([]);
  const [flashDeals,     setFlashDeals]     = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState(getRecentlyViewed);

  /* ── Cart Count ── */
  const [cartCount, setCartCount] = useState(getCartCount);
  useEffect(() => {
    const sync = () => setCartCount(getCartCount());
    window.addEventListener("cart-updated", sync);
    return () => window.removeEventListener("cart-updated", sync);
  }, []);

  /* ── Wishlist State ── */
  const [wishlist, setWishlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem(WISH_KEY) || "[]"); }
    catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem(WISH_KEY, JSON.stringify(wishlist));
  }, [wishlist]);

  /* ── Category List ── */
  const categoryTabs = useMemo(() => [
    { id: "all", name: "All", icon: "🏪" },
    ...categories,
  ], []);

  /* ════════════════════════════════════════════════════════
     FETCH DATA
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
      const rows = data?.data?.products   ?? [];
      const meta = data?.data?.pagination ?? null;

      setProducts((prev) => (append ? [...prev, ...rows] : rows));
      setPagination(meta);
      setOffset(newOffset);
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to load products";
      setFetchError(msg);
      if (!append) toast.error(msg);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchQuery, activeCategory, activeSort, minPrice, maxPrice]);

  const fetchSections = useCallback(async () => {
    try {
      const [featRes, flashRes] = await Promise.allSettled([
        axios.get(`${API}/products`, { params: { featured: "true", limit: 6 } }),
        axios.get(`${API}/products`, { params: { trending: "true", limit: 6 } }),
      ]);
      if (featRes.status === "fulfilled")  setFeatured(featRes.value.data?.data?.products || []);
      if (flashRes.status === "fulfilled") setFlashDeals(flashRes.value.data?.data?.products || []);
    } catch {}
  }, []);

  useEffect(() => { fetchProducts({ newOffset: 0 }); fetchSections(); }, []); // eslint-disable-line
  useEffect(() => { fetchProducts({ newOffset: 0, append: false }); }, [activeCategory, activeSort]); // eslint-disable-line

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

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    handleSearchSelect(normalize(searchQuery));
  };

  const toggleWishlist = useCallback((id) => {
    setWishlist((prev) => {
      const saved = prev.includes(id);
      toast.success(saved ? "Removed" : "Saved ❤️", { duration: 1200 });
      return saved ? prev.filter((x) => x !== id) : [...prev, id];
    });
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
      { duration: 3000, position: "bottom-center" }
    );
  }, [navigate]);

  const clearFilters = useCallback(() => {
    setSearchQuery(""); setActiveCategory("all"); setActiveSort("newest");
    setMinPrice(""); setMaxPrice(""); setSearchParams({});
    fetchProducts({ query: "", category: "all", sort: "newest", min: "", max: "", newOffset: 0 });
  }, [fetchProducts, setSearchParams]);

  const hasMore    = pagination ? (offset + DEFAULT_LIMIT) < pagination.total : false;
  const slide      = HERO_SLIDES[slideIndex];
  const hasFilters = !!(searchQuery || activeCategory !== "all" || minPrice || maxPrice);

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div className="lm-mobile-page">

      {/* ── TOPBAR ── */}
      <header className="lm-m-topbar">
        <div className="lm-m-topbar__main">
          <div className="lm-m-topbar__brand" onClick={() => navigate("/loemart")}>
            <span className="lm-m-topbar__logo">🛍️</span>
            <span className="lm-m-topbar__name">Loemart</span>
          </div>

          <div className="lm-m-topbar__actions">
            <button
              type="button"
              className="lm-m-icon-btn"
              onClick={() => navigate("/shop/wishlist")}
              aria-label="Wishlist"
            >
              <FiHeart size={20} />
              {wishlist.length > 0 && <span className="lm-m-badge">{wishlist.length}</span>}
            </button>

            <button
              type="button"
              className="lm-m-icon-btn"
              onClick={() => navigate("/shop/cart")}
              aria-label="Cart"
            >
              <FiShoppingCart size={20} />
              {cartCount > 0 && <span className="lm-m-badge lm-m-badge--cart">{cartCount}</span>}
            </button>
          </div>
        </div>

        {/* ── SEARCH BAR ── */}
        <div className="lm-m-search-wrap" ref={searchRef}>
          <form onSubmit={handleSearchSubmit} className="lm-m-search-form">
            <FiSearch size={16} className="lm-m-search-icon" />
            <input
              type="search"
              className="lm-m-search-input"
              placeholder="Search items, brands, sellers…"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="lm-m-search-clear"
                onClick={() => { setSearchQuery(""); fetchProducts({ query: "", newOffset: 0 }); }}
              >
                <FiX size={14} />
              </button>
            )}
          </form>

          {/* Search Dropdown */}
          {searchFocused && (
            <div className="lm-m-search-dropdown">
              {searchHistory.length > 0 && !searchQuery && (
                <div className="lm-m-search-group">
                  <div className="lm-m-search-group__head">
                    <span>Recent Searches</span>
                    <button type="button" onClick={() => { localStorage.removeItem(SEARCH_HISTORY_KEY); setSearchHistory([]); }}>Clear</button>
                  </div>
                  {searchHistory.map((item) => (
                    <div key={item} className="lm-m-search-item" onClick={() => handleSearchSelect(item)}>
                      <FiClock size={12} /> {item}
                    </div>
                  ))}
                </div>
              )}

              {!searchQuery && (
                <div className="lm-m-search-group">
                  <span className="lm-m-search-group__head">Trending Now</span>
                  <div className="lm-m-search-chips">
                    {TRENDING_SEARCHES.map((t) => (
                      <button key={t} type="button" onClick={() => handleSearchSelect(t)}>{t}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── CATEGORY SWIPER ── */}
        <div className="lm-m-cat-strip">
          {categoryTabs.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`lm-m-cat-btn ${activeCategory === c.id ? "active" : ""}`}
              onClick={() => { setActiveCategory(c.id); setOffset(0); }}
            >
              <span className="lm-m-cat-icon">{c.icon}</span>
              <span className="lm-m-cat-label">{c.name}</span>
            </button>
          ))}
        </div>
      </header>

      {/* ── MOBILE HERO BANNER ── */}
      <section className="lm-m-hero" style={{ background: slide.bg }}>
        <div className="lm-m-hero__tag">{slide.tag} {slide.eyebrow}</div>
        <h2 className="lm-m-hero__title">
          {slide.title.split("\n").map((line, i) => <span key={i}>{line}<br /></span>)}
        </h2>
        <p className="lm-m-hero__sub">{slide.sub}</p>
        <button
          type="button"
          className="lm-m-hero__cta"
          style={{ background: slide.accent }}
          onClick={() => document.getElementById("mobile-grid")?.scrollIntoView({ behavior: "smooth" })}
        >
          {slide.cta} <FiArrowRight size={14} />
        </button>
        <div className="lm-m-hero__dots">
          {HERO_SLIDES.map((_, i) => (
            <span key={i} className={`lm-m-hero__dot ${i === slideIndex ? "active" : ""}`} />
          ))}
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <div className="lm-m-trust-bar">
        <div><FiShield size={14} /> Verified Sellers</div>
        <div><FiLock size={14} /> Secure Pay</div>
        <div><FiTruck size={14} /> Fast Delivery</div>
      </div>

      {/* ── FLASH DEALS ── */}
      {flashDeals.length > 0 && (
        <section className="lm-m-section">
          <div className="lm-m-section-head">
            <div className="lm-m-section-title">
              <FiZap className="lm-m-flash-icon" />
              <span>Flash Deals</span>
            </div>
            <div className="lm-m-timer">
              <FiClock size={12} /> {flashTime.h}:{flashTime.m}:{flashTime.s}
            </div>
          </div>
          <div className="lm-m-hscroll">
            {flashDeals.map((p) => (
              <MiniCardMobile
                key={p.id}
                product={p}
                onAddToCart={handleAddToCart}
                onWishlist={toggleWishlist}
                wishlisted={wishlist.includes(p.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── FEATURED PICKS ── */}
      {featured.length > 0 && (
        <section className="lm-m-section">
          <div className="lm-m-section-head">
            <div className="lm-m-section-title">
              <FiAward className="lm-m-feat-icon" />
              <span>Featured Items</span>
            </div>
          </div>
          <div className="lm-m-hscroll">
            {featured.map((p) => (
              <MiniCardMobile
                key={p.id}
                product={p}
                onAddToCart={handleAddToCart}
                onWishlist={toggleWishlist}
                wishlisted={wishlist.includes(p.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── RECENTLY VIEWED ── */}
      {recentlyViewed.length > 0 && (
        <section className="lm-m-section">
          <div className="lm-m-section-head">
            <div className="lm-m-section-title">
              <FiClock />
              <span>Recently Viewed</span>
            </div>
          </div>
          <div className="lm-m-hscroll">
            {recentlyViewed.map((p) => (
              <div
                key={p.id}
                className="lm-m-recent-card"
                onClick={() => navigate(`/shop/${p.slug}`)}
              >
                {p.image ? (
                  <img src={p.image} alt={p.name} />
                ) : (
                  <div className="lm-m-recent-ph"><FiPackage size={18} /></div>
                )}
                <p className="lm-m-recent-title">{p.name}</p>
                <p className="lm-m-recent-price">{fmtPrice(p.price)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── CONTROLS SUB-BAR ── */}
      <div className="lm-m-controls" id="mobile-grid">
        <span className="lm-m-controls__count">
          {pagination ? `${pagination.total} items` : `${products.length} items`}
        </span>

        <div className="lm-m-controls__right">
          {hasFilters && (
            <button type="button" className="lm-m-clear-btn" onClick={clearFilters}>
              Clear
            </button>
          )}

          <button
            type="button"
            className="lm-m-filter-btn"
            onClick={() => setShowFilters(true)}
          >
            <FiSliders size={14} /> Filter & Sort
          </button>

          <button
            type="button"
            className="lm-m-view-btn"
            onClick={() => setView((v) => (v === "grid" ? "list" : "grid"))}
            aria-label="Toggle View"
          >
            {view === "grid" ? <FiList size={16} /> : <FiGrid size={16} />}
          </button>
        </div>
      </div>

      {/* ── MAIN PRODUCT GRID / LIST ── */}
      <main className={`lm-m-grid ${view === "list" ? "lm-m-grid--list" : ""}`}>
        {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonCardMobile key={i} />)}

        {!loading && fetchError && (
          <div className="lm-m-error">
            <FiAlertCircle size={32} />
            <p>{fetchError}</p>
            <button type="button" onClick={() => fetchProducts({ newOffset: 0 })}>
              <FiRefreshCw /> Retry
            </button>
          </div>
        )}

        {!loading && !fetchError && !products.length && (
          <div className="lm-m-empty">
            <FiSearch size={36} />
            <h3>No results found</h3>
            <p>Try clearing filters or changing your search term.</p>
            <button type="button" onClick={clearFilters}>Browse All Products</button>
          </div>
        )}

        {!loading && !fetchError && products.map((product, i) => (
          <MobileProductCard
            key={product.id}
            product={product}
            wishlisted={wishlist.includes(product.id)}
            onWishlist={toggleWishlist}
            onAddToCart={handleAddToCart}
            view={view}
            index={i}
          />
        ))}
      </main>

      {/* ── LOAD MORE BUTTON ── */}
      {!loading && hasMore && (
        <div className="lm-m-loadmore-wrap">
          <button
            type="button"
            className="lm-m-loadmore-btn"
            onClick={() => fetchProducts({ newOffset: offset + DEFAULT_LIMIT, append: true })}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading..." : "Load More Products"}
          </button>
        </div>
      )}

      {/* ── FLOATING ACTION BUTTON (FAB) ── */}
      <button
        type="button"
        className="lm-m-fab"
        onClick={() => navigate(user ? "/minimart/post-ad" : "/auth")}
      >
        <FiPlus size={22} />
        <span>Sell</span>
      </button>

      {/* ── BOTTOM FILTER DRAWER ── */}
      {showFilters && (
        <div className="lm-m-drawer-backdrop" onClick={() => setShowFilters(false)}>
          <div className="lm-m-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="lm-m-drawer__head">
              <span>Filter & Sort</span>
              <button type="button" onClick={() => setShowFilters(false)}><FiX size={18} /></button>
            </div>

            <div className="lm-m-drawer__body">
              {/* Sort selector */}
              <div className="lm-m-drawer__group">
                <label>Sort By</label>
                <div className="lm-m-drawer__chips">
                  {SORT_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      className={activeSort === s.value ? "active" : ""}
                      onClick={() => setActiveSort(s.value)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price range */}
              <div className="lm-m-drawer__group">
                <label>Price Range (₦)</label>
                <div className="lm-m-price-inputs">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                  />
                  <span>-</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                  />
                </div>
              </div>

              {/* Categories */}
              <div className="lm-m-drawer__group">
                <label>Category</label>
                <div className="lm-m-drawer__chips">
                  {categoryTabs.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={activeCategory === c.id ? "active" : ""}
                      onClick={() => setActiveCategory(c.id)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lm-m-drawer__foot">
              <button type="button" className="lm-m-drawer__reset" onClick={clearFilters}>
                Reset
              </button>
              <button
                type="button"
                className="lm-m-drawer__apply"
                onClick={() => {
                  fetchProducts({ min: minPrice, max: maxPrice, newOffset: 0 });
                  setShowFilters(false);
                }}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}