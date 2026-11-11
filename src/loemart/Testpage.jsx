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
// A mismatch will send logged-in users to /login.
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

/** Normalise any product shape into a consistent object. */
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
  };
}

/** Dig into common API wrapper shapes to find the product array. */
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
  const wat = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
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

const MarketplaceCard = memo(function MarketplaceCard({
  type,
  title,
  desc,
  cta,
  onClick,
}) {
  const handleKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };
  return (
    <div
      className={`lm-marketplace-card lm-marketplace-card--${type}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKey}
      aria-label={`${title}. ${desc}`}
    >
      <span className="lm-marketplace-card__badge">
        {type === "local" ? "Nearby" : "Online"}
      </span>
      <h3 className="lm-marketplace-card__title">{title}</h3>
      <p className="lm-marketplace-card__desc">{desc}</p>
      <span className="lm-marketplace-card__cta">{cta} →</span>
    </div>
  );
});

function ProductCard({ product, onClick, source }) {
  const discount = calcDiscountPct?.(product.oldPrice, product.price) ?? 0;
  const imgSrc = product.image || "/placeholder-product.svg";
  const priceLabel = `${formatPrice?.(product.price) ?? `₦${product.price}`}${
    discount > 0
      ? ` (${discount}% off)`
      : ""
  }`;

  return (
    <article
      className="lm-product-card"
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
      <div className="lm-product-card__img-wrap">
        <img
          src={imgSrc}
          alt={product.title}
          loading="lazy"
          className="lm-product-card__img"
        />
        {discount > 0 && (
          <span className="lm-product-card__badge">-{discount}%</span>
        )}
      </div>
      <div className="lm-product-card__body">
        <h4 className="lm-product-card__title">{product.title}</h4>
        {product.seller_name && (
          <span className="lm-product-card__seller">
            by {product.seller_name}
          </span>
        )}
        <div className="lm-product-card__prices">
          <span className="lm-product-card__price">
            {formatPrice?.(product.price) ?? `₦${product.price}`}
          </span>
          {product.oldPrice > 0 && (
            <span className="lm-product-card__old-price">
              {formatPrice?.(product.oldPrice) ?? `₦${product.oldPrice}`}
            </span>
          )}
        </div>
        {source === "local" && product.location_city && (
          <span className="lm-product-card__location">
            📍 {product.location_city}
          </span>
        )}
      </div>
    </article>
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
        /* Market products (Code 1 helpers) */
        const mktRaw = await fetchProductsPage?.(1, 24);
        const mktArr = extractProducts(mktRaw)
          .map(normalizeProduct)
          .filter(Boolean);

        /* Local products — separate endpoint */
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

        /* Campaigns */
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

  /* ── cart count ─────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;

    async function loadCart() {
      const token = getAuthToken();
      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      try {
        // Use the same API base as every other request
        const res = await fetch(`${API}/cart`, {
          headers,
          credentials: "include",
        });

        // Fall back to guest cart on ANY non-success response
        if (!res.ok) {
          if (!cancelled) setCartCount(readGuestCount());
          return;
        }

        const data = await res.json();
        const items = data?.items ?? data?.data?.items ?? data?.cart ?? [];
        const count = Array.isArray(items)
          ? items.reduce((s, i) => s + (i.qty || i.quantity || 1), 0)
          : 0;
        if (!cancelled) setCartCount(count);
      } catch {
        // Network error — fall back to guest cart
        if (!cancelled) setCartCount(readGuestCount());
      }
    }

    loadCart();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── countdown (only when real schedule exists) ─────────── */
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

  /* ── mobile drawer: Escape, scroll lock, focus ──────────── */
  useEffect(() => {
    if (!menuOpen) return;

    // Lock background scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus first focusable element inside the drawer
    requestAnimationFrame(() => {
      const drawer = document.querySelector(".lm-mobile-drawer");
      if (drawer) {
        const focusable = drawer.querySelectorAll(
          'button, a, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length) focusable[0].focus();
      }
    });

    // Close on Escape
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      // Restore focus to the hamburger button
      menuBtnRef.current?.focus();
    };
  }, [menuOpen]);

  /* ── derived data ───────────────────────────────────────── */

  // Flash deals: ONLY products with a real discount. No fallback.
  const flashDeals = marketProducts.filter(
    (p) => p.oldPrice > 0 && p.price < p.oldPrice
  );
  const hasFlash = flashDeals.length > 0;

  // Featured on Loemart Market (promoted products; renamed from
  // "Trending" because we don't yet have real popularity data).
  const featured = marketProducts.filter((p) => p.is_promoted).slice(0, 8);
  // If nothing is promoted, show the first 8 as a general grid.
  const featuredDisplay =
    featured.length > 0 ? featured : marketProducts.slice(0, 8);

  // Active campaign (first active or first overall)
  const activeCampaign =
    campaigns.find((c) => c.is_active || c.active) ?? campaigns[0] ?? null;

  // FIX 1: Only show products actually attached to the campaign.
  // Never fall back to generic market products.
  const campaignProducts = activeCampaign
    ? extractProducts(activeCampaign)
        .map(normalizeProduct)
        .filter(Boolean)
    : [];

  /* ── navigation handlers ────────────────────────────────── */

  // FIX 6: Separate handlers for Market vs Local products
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
      // TODO: Verify this matches the actual Local listing detail route
      const path = `${ROUTES.localListing}/${product.slug || product.id}`;
      navigate(path);
    },
    [navigate]
  );

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`${ROUTES.search}?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  /* ── focus trap helper for the drawer ───────────────────── */
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

  if (loading) {
    return (
      <div className="lm-page lm-loading">
        <div className="lm-spinner" aria-label="Loading homepage" />
      </div>
    );
  }

  return (
    <div className="lm-page">
      {/* ───────── 1. HEADER + SEARCH ───────── */}
      <header className="lm-header">
        <div className="lm-header__inner">
          <button
            className="lm-menu-btn"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            ref={menuBtnRef}
          >
            ☰
          </button>

          <a href={ROUTES.home} className="lm-logo" aria-label="Loemart home">
            <strong>Loe</strong>mart
          </a>

          <form
            className="lm-search"
            role="search"
            onSubmit={handleSearch}
          >
            <input
              type="search"
              placeholder="Search products, sellers, categories…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search Loemart"
            />
            <button type="submit" aria-label="Search">
              🔍
            </button>
          </form>

          <nav className="lm-header__actions">
            <button
              className="lm-icon-btn"
              onClick={() =>
                navigate(isLoggedIn() ? ROUTES.account : ROUTES.login)
              }
              aria-label={isLoggedIn() ? "My account" : "Log in"}
            >
              👤
            </button>
            <button
              className="lm-icon-btn lm-cart-btn"
              onClick={() => navigate(ROUTES.cart)}
              aria-label={`Cart, ${cartCount} items`}
            >
              🛒
              {cartCount > 0 && (
                <span className="lm-cart-badge">{cartCount}</span>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* ───────── MOBILE DRAWER ───────── */}
      {menuOpen && (
        <>
          <div
            className="lm-drawer-overlay"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <nav
            className="lm-mobile-drawer"
            aria-label="Main navigation"
            onKeyDown={handleDrawerKeyDown}
          >
            <div className="lm-drawer__header">
              <span className="lm-logo">
                <strong>Loe</strong>mart
              </span>
              <button
                className="lm-drawer__close"
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation menu"
              >
                ✕
              </button>
            </div>
            <ul className="lm-drawer__links">
              <li>
                <button onClick={() => { navigate(ROUTES.home); setMenuOpen(false); }}>
                  Home
                </button>
              </li>
              <li>
                <button onClick={() => { navigate(ROUTES.local); setMenuOpen(false); }}>
                  Loemart Local
                </button>
              </li>
              <li>
                <button onClick={() => { navigate(ROUTES.market); setMenuOpen(false); }}>
                  Loemart Market
                </button>
              </li>
              <li>
                <button onClick={() => { navigate(ROUTES.deals); setMenuOpen(false); }}>
                  Deals
                </button>
              </li>
              <li>
                <button onClick={() => { navigate(ROUTES.sell); setMenuOpen(false); }}>
                  Start Selling
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    navigate(isLoggedIn() ? ROUTES.account : ROUTES.login);
                    setMenuOpen(false);
                  }}
                >
                  {isLoggedIn() ? "My Account" : "Log In"}
                </button>
              </li>
            </ul>
          </nav>
        </>
      )}

      {/* ───────── 2. HERO + MARKETPLACE CARDS ───────── */}
      <section className="lm-hero">
        <h1 className="lm-hero__title">
          One platform. <span>Two ways to shop.</span>
        </h1>
        <p className="lm-hero__sub">
          Discover nearby listings on <strong>Loemart Local</strong> or shop
          online with checkout on <strong>Loemart Market</strong>.
        </p>

        <div className="lm-marketplace-grid">
          <MarketplaceCard
            type="local"
            title="Loemart Local"
            desc="Discover nearby listings and connect directly with sellers in your area."
            cta="Explore Local"
            onClick={() => navigate(ROUTES.local)}
          />
          <MarketplaceCard
            type="market"
            title="Loemart Market"
            desc="Shop products online with checkout and Managed Delivery by Loemart."
            cta="Shop Market"
            onClick={() => navigate(ROUTES.market)}
          />
        </div>
      </section>

      {/* ───────── 3. CATEGORIES ───────── */}
      <section className="lm-section">
        <h2 className="lm-section__title">Explore Categories</h2>
        <div className="lm-categories">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              className="lm-category"
              onClick={() =>
                navigate(`${ROUTES.category}?category=${cat.slug}`)
              }
              aria-label={`Browse ${cat.label}`}
            >
              <span className="lm-category__icon">{cat.icon}</span>
              <span className="lm-category__label">{cat.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ───────── 4. CAMPAIGN SPOTLIGHT ───────── */}
      {activeCampaign && (
        <section className="lm-section lm-campaign">
          <div className="lm-campaign__banner">
            <h2 className="lm-campaign__title">
              {activeCampaign.title ?? activeCampaign.name ?? "Special Campaign"}
            </h2>
            {activeCampaign.description && (
              <p className="lm-campaign__desc">{activeCampaign.description}</p>
            )}
            <button
              className="lm-btn lm-btn--primary"
              onClick={() =>
                navigate(
                  `${ROUTES.campaign}/${activeCampaign.slug ?? activeCampaign.id}`
                )
              }
            >
              View Campaign
            </button>
          </div>

          {/* FIX 1: Only render products that belong to this campaign */}
          {campaignProducts.length > 0 && (
            <div className="lm-product-grid">
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
        </section>
      )}

      {/* ───────── 5. FLASH DEALS (Market) ───────── */}
      {hasFlash && (
        <section className="lm-section lm-flash">
          <div className="lm-section__header">
            <h2 className="lm-section__title">⚡ Flash Deals</h2>
            {DEALS_HAVE_MIDNIGHT_EXPIRY && (
              <span className="lm-countdown" aria-live="polite">
                Ends in {countdown}
              </span>
            )}
          </div>
          <div className="lm-product-grid">
            {flashDeals.slice(0, 8).map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onClick={handleMarketProductClick}
                source="market"
              />
            ))}
          </div>
        </section>
      )}

      {/* ───────── 6. FEATURED ON LOEMART MARKET ───────── */}
      {featuredDisplay.length > 0 && (
        <section className="lm-section">
          <div className="lm-section__header">
            {/* FIX 2: Renamed from "Trending" — we don't have real
                popularity data yet. Update when views/sales data exists. */}
            <h2 className="lm-section__title">
              Featured on Loemart Market
            </h2>
            <button
              className="lm-link"
              onClick={() => navigate(ROUTES.market)}
            >
              See all →
            </button>
          </div>
          <div className="lm-product-grid">
            {featuredDisplay.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onClick={handleMarketProductClick}
                source="market"
              />
            ))}
          </div>
        </section>
      )}

      {/* ───────── 7. FRESH ON LOEMART LOCAL ───────── */}
      {localProducts.length > 0 && (
        <section className="lm-section">
          <div className="lm-section__header">
            <h2 className="lm-section__title">Fresh on Loemart Local</h2>
            <button
              className="lm-link"
              onClick={() => navigate(ROUTES.local)}
            >
              See all →
            </button>
          </div>
          <div className="lm-product-grid">
            {localProducts.slice(0, 8).map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onClick={handleLocalProductClick}
                source="local"
              />
            ))}
          </div>
        </section>
      )}

      {/* ───────── 8. SELLER CTA ───────── */}
      <section className="lm-section lm-seller-cta">
        <h2 className="lm-seller-cta__title">Start Selling on Loemart</h2>
        <p className="lm-seller-cta__desc">
          List your products for free and reach thousands of buyers across
          both Local and Market.
        </p>
        <button
          className="lm-btn lm-btn--primary lm-btn--lg"
          onClick={() => navigate(ROUTES.sell)}
        >
          Register as a Seller
        </button>
      </section>

      {/* ───────── 9. WHY LOEMART ───────── */}
      <section className="lm-section lm-benefits">
        <h2 className="lm-section__title">Why Loemart?</h2>
        <div className="lm-benefits__grid">
          {BENEFITS.map((b) => (
            <div key={b.title} className="lm-benefit-card">
              <span className="lm-benefit-card__icon">{b.icon}</span>
              <h3 className="lm-benefit-card__title">{b.title}</h3>
              <p className="lm-benefit-card__text">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── 10. FOOTER ───────── */}
      <Footer />

      {/* ───────── PERSISTENT UI ───────── */}
      <BottomNav />
      <FloatingCartButton count={cartCount} />

      {showScrollTop && (
        <button
          className="lm-scroll-top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Scroll to top"
        >
          ↑
        </button>
      )}
    </div>
  );
}