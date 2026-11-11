import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useNavigate } from "react-router-dom";

/* ── Components (never inlined) ─────────────────────────────── */
import Footer from "../components/Footer";
import BottomNav from "../components/BottomNav";
import FloatingCartButton from "../components/FloatingCartButton";

/* ── Mobile helpers (Code 1 data layer) ─────────────────────── */
import {
  fetchProductsPage,
  fetchCampaigns,
  formatPrice,
  calcDiscountPct,
  primaryImg,
  getProductPath,
} from "../loemart/mobile/mobileHelpers";

/* ── Styles ──────────────────────────────────────────────────── */
import "../styles/Testpage.css";

/* ================================================================
   CONSTANTS
   ================================================================ */

// TODO: Verify BASE_URL matches your actual backend origin.
const BASE_URL = import.meta.env.VITE_API_URL || "https://api.loemart.com";
const API = `${BASE_URL}/api`;

const ROUTES = {
  home: "/loemart",
  cart: "/cart",
  login: "/login",
  signup: "/signup",
  account: "/account",
  local: "/nearby",
  market: "/trending",
  deals: "/deals",
  latest: "/latest",
  sell: "/minimart/add",
  search: "/search",
  product: "/product",
  campaign: "/campaign",
  category: "/search",
  // TODO: Verify the actual Local listing detail route
  localListing: "/nearby/listing",
};

// TODO: Verify these keys match your real authentication system.
const AUTH_TOKEN_KEYS = [
  "token",
  "buyer_token",
  "auth_token",
  "access_token",
  "lm_token",
  "jwt",
];

// Only enable the countdown when flash deals genuinely expire at
// midnight WAT.  Set to true once the promotion schedule is real.
const DEALS_HAVE_MIDNIGHT_EXPIRY = false;

const CATEGORIES = [
  { icon: "📱", label: "Phones & Tablets", slug: "phones" },
  { icon: "💻", label: "Computers", slug: "computers" },
  { icon: "🎧", label: "Electronics", slug: "electronics" },
  { icon: "👗", label: "Fashion", slug: "fashion" },
  { icon: "🏠", label: "Home & Living", slug: "home" },
  { icon: "🛒", label: "Groceries", slug: "groceries" },
  { icon: "💄", label: "Beauty", slug: "beauty" },
  { icon: "🚗", label: "Automotive", slug: "automotive" },
];

const BENEFITS = [
  {
    icon: "🔄",
    title: "More Ways to Shop",
    text: "Browse local listings or shop online with checkout — one platform, two experiences.",
  },
  {
    icon: "🤝",
    title: "Connect with Sellers",
    text: "Chat directly with nearby sellers or buy from verified Market stores.",
  },
  {
    icon: "🚚",
    title: "Managed Delivery",
    text: "Loemart handles logistics for Market orders so you don't have to.",
  },
  {
    icon: "🌍",
    title: "Built for Local Commerce",
    text: "Designed for African businesses, from small vendors to growing brands.",
  },
];

/* ================================================================
   HELPERS
   ================================================================ */

function getAuthToken() {
  try {
    for (const key of AUTH_TOKEN_KEYS) {
      const v = localStorage.getItem(key);
      if (v) return v;
    }
  } catch {
    /* storage blocked */
  }
  return null;
}

function isLoggedIn() {
  return !!getAuthToken();
}

function readGuestCount() {
  try {
    const raw = localStorage.getItem("guest_cart");
    if (!raw) return 0;
    const items = JSON.parse(raw);
    return Array.isArray(items)
      ? items.reduce((s, i) => s + (i.qty || 1), 0)
      : 0;
  } catch {
    return 0;
  }
}

function normalizeProduct(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = raw.id ?? raw.product_id ?? raw._id ?? raw.uuid;
  if (!id) return null;

  const title =
    raw.title ?? raw.name ?? raw.product_name ?? "Untitled Product";
  const price = Number(raw.price ?? raw.current_price ?? raw.amount ?? 0);
  const oldPrice = Number(
    raw.old_price ?? raw.original_price ?? raw.compare_at_price ?? 0
  );
  const images = Array.isArray(raw.images)
    ? raw.images
    : raw.image
      ? [raw.image]
      : raw.thumbnail
        ? [raw.thumbnail]
        : [];
  const image =
    primaryImg?.(raw) ?? images[0] ?? raw.image ?? raw.thumbnail ?? "";

  return {
    id,
    title,
    price,
    oldPrice: oldPrice > price ? oldPrice : 0,
    image,
    images,
    slug: raw.slug ?? raw.product_slug ?? String(id),
    is_promoted: Boolean(raw.is_promoted ?? raw.featured ?? raw.promoted),
    location_city: raw.location_city ?? raw.city ?? "",
    seller_name: raw.seller_name ?? raw.shop_name ?? raw.vendor ?? "",
    banner_image: raw.banner_image ?? raw.campaign_image ?? "",
  };
}

function extractProducts(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data?.products)) return data.data.products;
  if (Array.isArray(data?.data?.data)) return data.data.data;
  return [];
}

function getMidnightWATTimeLeft() {
  const now = new Date();
  const wat = new Date(
    now.toLocaleString("en-US", { timeZone: "Africa/Lagos" })
  );
  const midnight = new Date(wat);
  midnight.setHours(24, 0, 0, 0);
  const diff = midnight - wat;
  if (diff <= 0) return "00:00:00";
  const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
  const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
  const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/* ================================================================
   SMALL PRESENTATIONAL COMPONENTS
   ================================================================ */

const MarketplaceCard = memo(function MarketplaceCard({ type, onClick }) {
  const isLocal = type === "local";
  const handleKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`lm-market-card ${isLocal ? "lm-local" : "lm-market"}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKey}
      aria-label={
        isLocal
          ? "Loemart Local — Discover nearby listings and connect directly with sellers."
          : "Loemart Market — Shop products online with checkout and Managed Delivery."
      }
    >
      <div>
        <span className="lm-card-tag">{isLocal ? "Nearby" : "Online"}</span>
        <div className="lm-card-icon">{isLocal ? "📍" : "🛍️"}</div>
        <h2>{isLocal ? "Loemart Local" : "Loemart Market"}</h2>
        <p>
          {isLocal
            ? "Discover nearby listings and connect directly with sellers in your area."
            : "Shop products online with checkout and Managed Delivery by Loemart."}
        </p>
      </div>
      <div className="lm-card-bottom">
        <span className="lm-card-btn">
          {isLocal ? "Explore Local" : "Shop Market"}
        </span>
        <span className="lm-arrow">→</span>
      </div>
    </div>
  );
});

function ProductCard({ product, onClick, source }) {
  const discount =
    calcDiscountPct?.(product.oldPrice, product.price) ?? 0;
  const imgSrc = product.image || "/placeholder-product.svg";
  const priceLabel = `${formatPrice?.(product.price) ?? `₦${product.price}`}${
    discount > 0 ? ` (${discount}% off)` : ""
  }`;

  return (
    <article
      className={`lm-pcard${source === "local" ? " lm-pcard--local" : ""}`}
      onClick={() => onClick(product)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(product);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${product.title}, ${priceLabel}`}
    >
      <div className="lm-pcard-img-wrap">
        <img
          className="lm-pcard-img"
          src={imgSrc}
          alt={product.title}
          loading="lazy"
        />
        {discount > 0 && (
          <span className="lm-pcard-disc">-{discount}%</span>
        )}
        {product.is_promoted && source === "market" && (
          <span className="lm-pcard-promo">⭐ Featured</span>
        )}
        {source === "local" && product.location_city && (
          <span className="lm-pcard-loc">📍 {product.location_city}</span>
        )}
      </div>
      <div className="lm-pcard-body">
        <h3 className="lm-pcard-title">{product.title}</h3>
        <div className="lm-pcard-pricing">
          <span className="lm-pcard-price">
            {formatPrice?.(product.price) ?? `₦${product.price}`}
          </span>
          {product.oldPrice > 0 && (
            <span className="lm-pcard-old">
              {formatPrice?.(product.oldPrice) ?? `₦${product.oldPrice}`}
            </span>
          )}
        </div>
        {product.seller_name && (
          <p className="lm-pcard-seller">by {product.seller_name}</p>
        )}
      </div>
    </article>
  );
}

function SkeletonGrid({ count = 8, scroll = false }) {
  return (
    <div className={`lm-pgrid${scroll ? " lm-pgrid--scroll" : ""}`}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="lm-pcard lm-pcard--skeleton">
          <div className="lm-pcard-img-wrap lm-shimmer" />
          <div className="lm-pcard-body">
            <div className="lm-shimmer" style={{ height: 14, marginBottom: 8 }} />
            <div className="lm-shimmer" style={{ height: 14, width: "60%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ================================================================
   MAIN PAGE
   ================================================================ */

export default function Testpage() {
  const navigate = useNavigate();

  /* ── state ──────────────────────────────────────────────── */
  const [marketProducts, setMarketProducts] = useState([]);
  const [localProducts, setLocalProducts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [countdown, setCountdown] = useState("00:00:00");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const menuBtnRef = useRef(null);

  /* ── data fetching ──────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const mktRaw = await fetchProductsPage?.(1, 24);
        const mktArr = extractProducts(mktRaw)
          .map(normalizeProduct)
          .filter(Boolean);

        let locArr = [];
        try {
          const locRes = await fetch(`${API}/listings?limit=12`);
          if (locRes.ok) {
            const locData = await locRes.json();
            locArr = extractProducts(locData)
              .map(normalizeProduct)
              .filter(Boolean);
          }
        } catch {
          /* Local endpoint may not exist yet */
        }

        let campArr = [];
        try {
          const campRaw = await fetchCampaigns?.();
          if (Array.isArray(campRaw)) {
            campArr = campRaw;
          } else if (campRaw?.data) {
            campArr = Array.isArray(campRaw.data)
              ? campRaw.data
              : [campRaw.data];
          }
        } catch {
          /* campaigns optional */
        }

        if (!cancelled) {
          setMarketProducts(mktArr);
          setLocalProducts(locArr);
          setCampaigns(campArr);
        }
      } catch (err) {
        console.error("[Testpage] data load error", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── cart count (FIX 5: uses API base, not bare /api) ──── */
  useEffect(() => {
    let cancelled = false;

    async function loadCart() {
      const token = getAuthToken();
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      try {
        const res = await fetch(`${API}/cart`, {
          headers,
          credentials: "include",
        });

        if (!res.ok) {
          if (!cancelled) setCartCount(readGuestCount());
          return;
        }

        const data = await res.json();
        const items =
          data?.items ?? data?.data?.items ?? data?.cart ?? [];
        const count = Array.isArray(items)
          ? items.reduce(
              (s, i) => s + (i.qty || i.quantity || 1),
              0
            )
          : 0;
        if (!cancelled) setCartCount(count);
      } catch {
        if (!cancelled) setCartCount(readGuestCount());
      }
    }

    loadCart();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── countdown (FIX 3: only when real schedule exists) ─── */
  useEffect(() => {
    if (!DEALS_HAVE_MIDNIGHT_EXPIRY) return;
    setCountdown(getMidnightWATTimeLeft());
    const id = setInterval(
      () => setCountdown(getMidnightWATTimeLeft()),
      1000
    );
    return () => clearInterval(id);
  }, []);

  /* ── scroll-to-top visibility ───────────────────────────── */
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── mobile drawer (FIX 7: Escape, scroll lock, focus) ─── */
  useEffect(() => {
    if (!menuOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    requestAnimationFrame(() => {
      const drawer = document.querySelector(".lm-mobile-drawer");
      if (drawer) {
        const focusable = drawer.querySelectorAll(
          'button, a, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length) focusable[0].focus();
      }
    });

    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      menuBtnRef.current?.focus();
    };
  }, [menuOpen]);

  /* ── derived data ───────────────────────────────────────── */

  // FIX 1: Flash deals — ONLY real discounts, no fallback
  const flashDeals = marketProducts.filter(
    (p) => p.oldPrice > 0 && p.price < p.oldPrice
  );
  const hasFlash = flashDeals.length > 0;

  // FIX 2: "Featured" not "Trending" (no real popularity data yet)
  const featured = marketProducts
    .filter((p) => p.is_promoted)
    .slice(0, 8);
  const featuredDisplay =
    featured.length > 0 ? featured : marketProducts.slice(0, 8);

  const activeCampaign =
    campaigns.find((c) => c.is_active || c.active) ??
    campaigns[0] ??
    null;

  // FIX 1: Only products actually attached to the campaign
  const campaignProducts = activeCampaign
    ? extractProducts(activeCampaign)
        .map(normalizeProduct)
        .filter(Boolean)
    : [];

  /* ── navigation handlers ────────────────────────────────── */

  // FIX 6: Separate routes for Market vs Local
  const handleMarketProductClick = useCallback(
    (product) => {
      const path =
        getProductPath?.(product) ||
        `${ROUTES.product}/${product.slug || product.id}`;
      navigate(path);
    },
    [navigate]
  );

  const handleLocalProductClick = useCallback(
    (product) => {
      const path = `${ROUTES.localListing}/${product.slug || product.id}`;
      navigate(path);
    },
    [navigate]
  );

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(
        `${ROUTES.search}?q=${encodeURIComponent(searchQuery.trim())}`
      );
    }
  };

  const closeMenu = () => setMenuOpen(false);

  const navTo = (path) => () => {
    navigate(path);
    closeMenu();
  };

  /* ── focus trap for drawer ──────────────────────────────── */
  const handleDrawerKeyDown = (e) => {
    if (e.key !== "Tab") return;
    const drawer = e.currentTarget;
    const focusable = drawer.querySelectorAll(
      'button, a, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  /* ================================================================
     RENDER
     ================================================================ */

  return (
    <div className="lm-test">
      {/* ──────── 1. HEADER + SEARCH ──────── */}
      <header className="lm-header">
        <div className="lm-container lm-header-inner">
          <button
            className="lm-mobile-menu-btn"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            ref={menuBtnRef}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <a
            className="lm-logo"
            href={ROUTES.home}
            onClick={(e) => {
              e.preventDefault();
              navigate(ROUTES.home);
            }}
            aria-label="Loemart home"
          >
            Loe<span>mart</span>
          </a>

          <form
            className="lm-search"
            role="search"
            onSubmit={handleSearch}
          >
            <span className="lm-search-ic" aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="search"
              placeholder="Search products, sellers, categories…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search Loemart"
            />
            <button type="submit">Search</button>
          </form>

          <div className="lm-header-actions">
            <button
              className="lm-hdr-btn"
              onClick={() =>
                navigate(isLoggedIn() ? ROUTES.account : ROUTES.login)
              }
              aria-label={isLoggedIn() ? "My account" : "Log in"}
            >
              👤 <span>{isLoggedIn() ? "Account" : "Log In"}</span>
            </button>
            <button
              className="lm-hdr-btn lm-cart-btn-wrap"
              onClick={() => navigate(ROUTES.cart)}
              aria-label={`Cart, ${cartCount} items`}
            >
              🛒 <span>Cart</span>
              {cartCount > 0 && (
                <span className="lm-cart-count">{cartCount}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ──────── MOBILE DRAWER ──────── */}
      <div
        className={`lm-mobile-overlay${menuOpen ? " open" : ""}`}
        onClick={closeMenu}
        aria-hidden={!menuOpen}
      >
        <nav
          className="lm-mobile-drawer"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleDrawerKeyDown}
          aria-label="Main navigation"
        >
          <button
            className="lm-mobile-drawer-close"
            onClick={closeMenu}
            aria-label="Close navigation menu"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <button className="lm-mobile-link" onClick={navTo(ROUTES.home)}>
            Home
          </button>
          <button className="lm-mobile-link" onClick={navTo(ROUTES.local)}>
            Loemart Local
          </button>
          <button className="lm-mobile-link" onClick={navTo(ROUTES.market)}>
            Loemart Market
          </button>
          <button className="lm-mobile-link" onClick={navTo(ROUTES.deals)}>
            Deals
          </button>
          <button className="lm-mobile-link" onClick={navTo(ROUTES.sell)}>
            Start Selling
          </button>
          <button
            className="lm-mobile-link"
            onClick={navTo(
              isLoggedIn() ? ROUTES.account : ROUTES.login
            )}
          >
            {isLoggedIn() ? "My Account" : "Log In"}
          </button>
        </nav>
      </div>

      {/* ──────── 2. HERO + MARKETPLACE CARDS ──────── */}
      <section className="lm-hero">
        <div className="lm-container">
          <div className="lm-hero-content">
            <span className="lm-eyebrow">
              🏪 Two Marketplaces, One Platform
            </span>
            <h1>
              Shop Local. <em>Shop Online.</em>
            </h1>
            <p>
              Discover nearby listings on{" "}
              <strong>Loemart Local</strong> or shop online with
              checkout and Managed Delivery on{" "}
              <strong>Loemart Market</strong>.
            </p>

            <div className="lm-marketplaces">
              <MarketplaceCard
                type="local"
                onClick={() => navigate(ROUTES.local)}
              />
              <MarketplaceCard
                type="market"
                onClick={() => navigate(ROUTES.market)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ──────── 3. CATEGORIES ──────── */}
      <section className="lm-section">
        <div className="lm-container">
          <div className="lm-section-heading">
            <div>
              <h2>Explore Categories</h2>
              <p>Browse by what you're looking for</p>
            </div>
          </div>

          {loading ? (
            <div className="lm-categories">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="lm-shimmer" style={{ height: 80, borderRadius: 13 }} />
              ))}
            </div>
          ) : (
            <div className="lm-categories">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.slug}
                  className="lm-category"
                  onClick={() =>
                    navigate(
                      `${ROUTES.category}?category=${cat.slug}`
                    )
                  }
                  aria-label={`Browse ${cat.label}`}
                >
                  <span className="lm-category-icon">{cat.icon}</span>
                  <span className="lm-category-name">{cat.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ──────── 4. CAMPAIGN SPOTLIGHT ──────── */}
      {activeCampaign && (
        <section className="lm-section">
          <div className="lm-container">
            <div className="lm-campaign">
              <div className="lm-campaign-banner">
                {activeCampaign.banner_image && (
                  <img
                    className="lm-campaign-banner-img"
                    src={activeCampaign.banner_image}
                    alt=""
                    aria-hidden="true"
                  />
                )}
                <div className="lm-campaign-banner-overlay" />
                <div className="lm-campaign-banner-content">
                  <span className="lm-campaign-tag">
                    🔥 Campaign
                  </span>
                  <h2 className="lm-campaign-title">
                    {activeCampaign.title ??
                      activeCampaign.name ??
                      "Special Campaign"}
                  </h2>
                  {activeCampaign.description && (
                    <p className="lm-campaign-sub">
                      {activeCampaign.description}
                    </p>
                  )}
                  <button
                    className="lm-campaign-btn"
                    onClick={() =>
                      navigate(
                        `${ROUTES.campaign}/${activeCampaign.slug ?? activeCampaign.id}`
                      )
                    }
                  >
                    View Campaign
                  </button>
                </div>
              </div>

              {/* FIX 1: Only products actually in this campaign */}
              {campaignProducts.length > 0 && (
                <div className="lm-campaign-products">
                  {campaignProducts.slice(0, 6).map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onClick={handleMarketProductClick}
                      source="market"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ──────── 5. FLASH DEALS (Market) ──────── */}
      {loading ? (
        <section className="lm-section lm-section--alt">
          <div className="lm-container">
            <div className="lm-section-heading">
              <div className="lm-flash-header">
                <span className="lm-flash-title">⚡ Flash Deals</span>
              </div>
            </div>
            <SkeletonGrid count={6} scroll />
          </div>
        </section>
      ) : (
        hasFlash && (
          <section className="lm-section lm-section--alt">
            <div className="lm-container">
              <div className="lm-section-heading">
                <div className="lm-flash-header">
                  <span className="lm-flash-title">
                    ⚡ Flash Deals
                  </span>
                  {DEALS_HAVE_MIDNIGHT_EXPIRY && (
                    <div
                      className="lm-flash-timer"
                      aria-live="polite"
                      aria-label={`Deals end in ${countdown}`}
                    >
                      {countdown.split(":").map((v, i) => (
                        <span key={i}>{v}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className="lm-see-all"
                  onClick={() => navigate(ROUTES.deals)}
                >
                  See all →
                </button>
              </div>
              <div className="lm-pgrid lm-pgrid--scroll">
                {flashDeals.slice(0, 10).map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onClick={handleMarketProductClick}
                    source="market"
                  />
                ))}
              </div>
            </div>
          </section>
        )
      )}

      {/* ──────── 6. FEATURED ON LOEMART MARKET ──────── */}
      <section className="lm-section">
        <div className="lm-container">
          <div className="lm-section-heading">
            <div>
              {/* FIX 2: "Featured" — not "Trending" */}
              <h2>Featured on Loemart Market</h2>
              <p>Handpicked products from top sellers</p>
            </div>
            <button
              className="lm-see-all"
              onClick={() => navigate(ROUTES.market)}
            >
              See all →
            </button>
          </div>

          {loading ? (
            <SkeletonGrid count={8} />
          ) : featuredDisplay.length > 0 ? (
            <div className="lm-pgrid">
              {featuredDisplay.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onClick={handleMarketProductClick}
                  source="market"
                />
              ))}
            </div>
          ) : (
            <div className="lm-empty">
              No featured products available right now.
            </div>
          )}
        </div>
      </section>

      {/* ──────── 7. FRESH ON LOEMART LOCAL ──────── */}
      {!loading && localProducts.length > 0 && (
        <section className="lm-section lm-section--alt">
          <div className="lm-container">
            <div className="lm-section-heading">
              <div>
                <h2>Fresh on Loemart Local</h2>
                <p>New listings near you</p>
              </div>
              <button
                className="lm-see-all"
                onClick={() => navigate(ROUTES.local)}
              >
                See all →
              </button>
            </div>
            <div className="lm-pgrid">
              {localProducts.slice(0, 8).map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onClick={handleLocalProductClick}
                  source="local"
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ──────── 8. SELLER CTA ──────── */}
      <section className="lm-section">
        <div className="lm-container">
          <div className="lm-local-banner">
            <div>
              <h2>Start Selling on Loemart</h2>
              <p>
                List your products for free and reach thousands of
                buyers across both Local and Market.
              </p>
            </div>
            <button
              className="lm-banner-btn"
              onClick={() => navigate(ROUTES.sell)}
            >
              Register as a Seller
            </button>
          </div>
        </div>
      </section>

      {/* ──────── 9. WHY LOEMART ──────── */}
      <section className="lm-section lm-section--alt">
        <div className="lm-container">
          <div className="lm-section-heading">
            <div>
              <h2>Why Loemart?</h2>
              <p>Built for how Africa actually shops</p>
            </div>
          </div>
          <div className="lm-benefit-grid">
            {BENEFITS.map((b) => (
              <div key={b.title} className="lm-benefit">
                <span className="lm-benefit-icon">{b.icon}</span>
                <h3>{b.title}</h3>
                <p>{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────── 10. FOOTER ──────── */}
      <Footer />

      {/* ──────── PERSISTENT UI ──────── */}
      <BottomNav />
      <FloatingCartButton count={cartCount} />

      <button
        className={`lm-scroll-top${showScrollTop ? " visible" : ""}`}
        onClick={() =>
          window.scrollTo({ top: 0, behavior: "smooth" })
        }
        aria-label="Scroll to top"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
    </div>
  );
}