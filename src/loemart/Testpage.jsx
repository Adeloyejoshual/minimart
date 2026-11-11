// src/pages/Testpage.jsx
import React, { useState, useEffect, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";

// ═══ IMPORTED COMPONENTS ═══
import Footer from "../components/Footer";
import BottomNav from "../components/BottomNav";
import FloatingCartButton from "../components/FloatingCartButton";

// ═══ CODE 1 HELPERS (Loemart Market) ═══
import {
  fetchProductsPage,
  fetchCampaigns,
  formatPrice,
  calcDiscountPct,
  primaryImg,
  getProductPath,
} from "../loemart/mobile/mobileHelpers";

// ═══ STYLES ═══
import "../styles/Testpage.css";

/* ══════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════ */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const API = `${BASE_URL}/api`;
const PH = "https://placehold.co/400x400/f5f4f2/b0a89e?text=No+Image";

const categories = [
  { icon: "📱", name: "Phones & Tablets", slug: "phones" },
  { icon: "💻", name: "Computers", slug: "computers" },
  { icon: "📺", name: "Electronics", slug: "electronics" },
  { icon: "👗", name: "Fashion", slug: "fashion" },
  { icon: "🛋️", name: "Home & Living", slug: "home" },
  { icon: "🛒", name: "Groceries", slug: "groceries" },
  { icon: "💄", name: "Beauty", slug: "beauty" },
  { icon: "🚗", name: "Automotive", slug: "automotive" },
];

const benefits = [
  { icon: "🛍️", title: "More Ways to Shop", text: "Explore local listings or shop products through our online marketplace." },
  { icon: "🤝", title: "Connect with Sellers", text: "Discover local sellers and connect directly when shopping locally." },
  { icon: "🚚", title: "Managed Delivery", text: "Enjoy managed delivery on eligible marketplace purchases." },
  { icon: "🌍", title: "Built for Local Commerce", text: "Discover products, support businesses and grow with Loemart." },
];

/* ══════════════════════════════════════════════════════════
   AUTH + CART COUNT
══════════════════════════════════════════════════════════ */
function getAuthToken() {
  const keys = ["token", "buyer_token", "auth_token", "access_token", "lm_token", "jwt"];
  for (const k of keys) {
    const v = localStorage.getItem(k) || sessionStorage.getItem(k);
    if (v) return v;
  }
  try {
    const raw = localStorage.getItem("user") || localStorage.getItem("buyer");
    if (raw) {
      const p = JSON.parse(raw);
      if (p.token || p.accessToken) return p.token || p.accessToken;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function useCartCount() {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const token = getAuthToken();
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/cart", { headers, credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        const payload = json?.data?.data || json?.data || {};
        const total =
          payload.total_qty ??
          payload.item_count ??
          (Array.isArray(payload.items) ? payload.items.length : 0);
        setCount(Number(total) || 0);
        return;
      }

      const guest = localStorage.getItem("lm-cart") || localStorage.getItem("cart");
      if (guest) {
        const parsed = JSON.parse(guest);
        if (Array.isArray(parsed)) {
          setCount(parsed.length);
          return;
        }
      }
      setCount(0);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("cart-updated", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("cart-updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  return { count, refresh };
}

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
const getImg = (p) => {
  if (!p) return PH;
  try {
    const url = primaryImg(p.primaryImg || p.images || p.image_url, p);
    if (url) return url;
  } catch {
    /* ignore */
  }
  if (p.image) return p.image;
  if (Array.isArray(p.images) && p.images.length) {
    return typeof p.images[0] === "string" ? p.images[0] : p.images[0]?.url || PH;
  }
  return PH;
};

const getPrice = (p) => p?.price ?? p?.selling_price ?? p?.sale_price ?? 0;

const getOldPrice = (p) =>
  p?.old_price ??
  p?.oldPrice ??
  p?.original_price ??
  p?.regular_price ??
  p?.attributes?.original_price ??
  0;

const getDiscount = (p) => {
  try {
    return calcDiscountPct(getPrice(p), getOldPrice(p)) || 0;
  } catch {
    const orig = Number(getOldPrice(p));
    const curr = Number(getPrice(p));
    if (orig > curr && curr > 0) return Math.round(((orig - curr) / orig) * 100);
    return 0;
  }
};

const fmtPrice = (n) => {
  try {
    return formatPrice(n);
  } catch {
    return `₦${Number(n || 0).toLocaleString("en-NG")}`;
  }
};

const getMidnightWATTimeLeft = () => {
  const now = new Date();
  const wat = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
  const end = new Date(wat);
  end.setHours(24, 0, 0, 0);
  let diff = Math.max(0, Math.floor((end - wat) / 1000));
  const h = String(Math.floor(diff / 3600)).padStart(2, "0");
  diff %= 3600;
  const m = String(Math.floor(diff / 60)).padStart(2, "0");
  const s = String(diff % 60).padStart(2, "0");
  return { hours: h, minutes: m, seconds: s };
};

/* ══════════════════════════════════════════════════════════
   SVG ICONS
══════════════════════════════════════════════════════════ */
const Ico = ({ children, size = 18, fill = "none", stroke = "currentColor", sw = 2, ...r }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke={stroke}
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...r}
  >
    {children}
  </svg>
);

const SearchIcon = ({ size = 17 }) => (
  <Ico size={size} sw={2.2}>
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </Ico>
);

const UserIcon = ({ size = 18 }) => (
  <Ico size={size}>
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </Ico>
);

const ChevUpIcon = ({ size = 16 }) => (
  <Ico size={size} sw={2.5}>
    <path d="M18 15l-6-6-6 6" />
  </Ico>
);

const FlashIcon = ({ size = 14 }) => (
  <Ico size={size} fill="currentColor" stroke="none">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </Ico>
);

const PinIcon = ({ size = 13 }) => (
  <Ico size={size}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </Ico>
);

const StarIcon = ({ size = 12 }) => (
  <Ico size={size} fill="currentColor" stroke="none">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </Ico>
);

const MenuIcon = ({ size = 22 }) => (
  <Ico size={size} sw={2}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </Ico>
);

const XIcon = ({ size = 22 }) => (
  <Ico size={size} sw={2}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Ico>
);

const GiftIcon = ({ size = 14 }) => (
  <Ico size={size}>
    <polyline points="20 12 20 22 4 22 4 12" />
    <rect x="2" y="7" width="20" height="5" />
    <line x1="12" y1="22" x2="12" y2="7" />
    <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
    <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
  </Ico>
);

/* ══════════════════════════════════════════════════════════
   PRODUCT CARD
══════════════════════════════════════════════════════════ */
const ProductCard = memo(function ProductCard({ product, onClick, variant = "default" }) {
  if (!product) return null;

  const img = getImg(product);
  const title = product.title || product.name || "Product";
  const price = getPrice(product);
  const oldPrice = getOldPrice(product);
  const disc = getDiscount(product);
  const loc = product.location_city || product.location?.city || "";
  const isLocal = variant === "local";

  return (
    <article
      className={`lm-pcard${isLocal ? " lm-pcard--local" : ""}`}
      onClick={() => onClick(product)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick(product)}
    >
      <div className="lm-pcard-img-wrap">
        <img
          src={img}
          alt={title}
          loading="lazy"
          className="lm-pcard-img"
          onError={(e) => {
            e.currentTarget.src = PH;
          }}
        />
        {disc > 0 && <span className="lm-pcard-disc">-{disc}%</span>}
        {product.is_promoted && !isLocal && (
          <span className="lm-pcard-promo">
            <StarIcon size={9} /> Sponsored
          </span>
        )}
        {isLocal && loc && (
          <span className="lm-pcard-loc">
            <PinIcon size={9} /> {loc}
          </span>
        )}
      </div>

      <div className="lm-pcard-body">
        <p className="lm-pcard-title">{title}</p>
        <div className="lm-pcard-pricing">
          <span className="lm-pcard-price">{fmtPrice(price)}</span>
          {disc > 0 && <span className="lm-pcard-old">{fmtPrice(oldPrice)}</span>}
        </div>
        {isLocal && product.seller_name && (
          <p className="lm-pcard-seller">{product.seller_name}</p>
        )}
      </div>
    </article>
  );
});

/* ══════════════════════════════════════════════════════════
   SKELETON CARD
══════════════════════════════════════════════════════════ */
const SkeletonCard = memo(() => (
  <div className="lm-pcard lm-pcard--skeleton" aria-hidden="true">
    <div className="lm-pcard-img-wrap lm-shimmer" style={{ aspectRatio: "1/1" }} />
    <div className="lm-pcard-body">
      <div className="lm-shimmer" style={{ height: 14, borderRadius: 4, marginBottom: 8 }} />
      <div className="lm-shimmer" style={{ height: 18, borderRadius: 4, width: "60%" }} />
    </div>
  </div>
));

/* ══════════════════════════════════════════════════════════
   CAMPAIGN SPOTLIGHT
══════════════════════════════════════════════════════════ */
const CampaignSpotlight = memo(function CampaignSpotlight({
  campaign,
  products,
  onProductClick,
  onViewAll,
}) {
  if (!campaign && (!products || products.length === 0)) return null;

  const title = campaign?.title || campaign?.name || "Special Campaign";
  const subtitle =
    campaign?.subtitle || campaign?.description || "Limited-time offers on featured products";
  const bannerImg = campaign?.banner_image || campaign?.image || null;
  const campaignColor = campaign?.color || "#FF5C00";

  return (
    <section className="lm-section" style={{ paddingTop: 20 }}>
      <div className="lm-container">
        <div className="lm-campaign" style={{ "--campaign-color": campaignColor }}>
          {/* Banner */}
          <div className="lm-campaign-banner">
            {bannerImg && (
              <img
                src={bannerImg}
                alt={title}
                className="lm-campaign-banner-img"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <div className="lm-campaign-banner-overlay" />
            <div className="lm-campaign-banner-content">
              <span className="lm-campaign-tag">
                <GiftIcon size={13} /> Campaign Spotlight
              </span>
              <h2 className="lm-campaign-title">{title}</h2>
              <p className="lm-campaign-sub">{subtitle}</p>
              <button className="lm-campaign-btn" onClick={onViewAll}>
                Shop Campaign →
              </button>
            </div>
          </div>

          {/* Campaign Products */}
          {products && products.length > 0 && (
            <div className="lm-campaign-products">
              {products.slice(0, 6).map((p) => (
                <ProductCard
                  key={p.id || p.product_id}
                  product={p}
                  onClick={onProductClick}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
});

/* ══════════════════════════════════════════════════════════
   MAIN HOMEPAGE COMPONENT
══════════════════════════════════════════════════════════ */
export default function Testpage() {
  const navigate = useNavigate();
  const { count: cartCount } = useCartCount();

  /* ── State ── */
  const [marketProducts, setMarketProducts] = useState([]);
  const [localProducts, setLocalProducts] = useState([]);
  const [flashDeals, setFlashDeals] = useState([]);
  const [trending, setTrending] = useState([]);
  const [campaign, setCampaign] = useState(null);
  const [campaignProducts, setCampaignProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState({ hours: "00", minutes: "00", seconds: "00" });
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  /* ── Countdown Timer ── */
  useEffect(() => {
    const tick = () => setTimeLeft(getMidnightWATTimeLeft());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  /* ── Scroll Listener ── */
  useEffect(() => {
    const fn = () => setShowScrollTop(window.scrollY > 500);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  /* ── Data Loading ── */
  useEffect(() => {
    let mounted = true;

    async function loadAll() {
      setLoading(true);
      const token = getAuthToken();
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      try {
        const [marketRes, localRes, campaignsRes] = await Promise.allSettled([
          // Code 1: Market products via mobileHelpers
          fetchProductsPage(1, 30).catch(() => ({ products: [], hasMore: false })),

          // Code 2: Local products via homepage API
          fetch(`${API}/homepage?limit=12&page=0`, { headers, credentials: "include" })
            .then((r) => (r.ok ? r.json() : { products: [] }))
            .catch(() => ({ products: [] })),

          // Campaigns via mobileHelpers
          fetchCampaigns().catch(() => []),
        ]);

        if (!mounted) return;

        /* ── Code 1 Market Products ── */
        if (marketRes.status === "fulfilled") {
          const data = marketRes.value || {};
          const prods = Array.isArray(data.products) ? data.products : [];

          // Flash Deals = products with discounts
          const deals = prods.filter((p) => getDiscount(p) > 0).slice(0, 10);

          // Trending = promoted / featured products
          const trend = prods
            .filter((p) => p.is_promoted || p.featured || p.is_featured)
            .slice(0, 8);

          setMarketProducts(prods.slice(0, 8));
          setFlashDeals(deals.length > 0 ? deals : prods.slice(0, 8));
          setTrending(trend.length > 0 ? trend : prods.slice(0, 8));
        }

        /* ── Code 2 Local Products ── */
        if (localRes.status === "fulfilled") {
          const data = localRes.value || {};
          const prods = Array.isArray(data.products) ? data.products : [];
          setLocalProducts(prods.slice(0, 8));
        }

        /* ── Campaigns ── */
        if (campaignsRes.status === "fulfilled") {
          const campaigns = Array.isArray(campaignsRes.value) ? campaignsRes.value : [];
          if (campaigns.length > 0) {
            setCampaign(campaigns[0]);
            const campProds = campaigns[0].products || campaigns[0].items || [];
            setCampaignProducts(
              Array.isArray(campProds) && campProds.length > 0
                ? campProds
                : marketRes.status === "fulfilled"
                  ? (marketRes.value.products || []).slice(0, 6)
                  : []
            );
          }
        }
      } catch (err) {
        console.warn("[Testpage] Load error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAll();
    return () => {
      mounted = false;
    };
  }, []);

  /* ── Handlers ── */
  const handleProductClick = (product) => {
    if (!product) return;
    const id = product.id || product.product_id;

    if (id) {
      fetch(`${API}/homepage/products/${id}/click`, {
        method: "POST",
        keepalive: true,
      }).catch(() => {});
    }

    try {
      const path = getProductPath(product);
      if (path) {
        navigate(path);
        return;
      }
    } catch {
      /* fallback */
    }

    if (product.slug) navigate(`/product/${product.slug}`);
    else if (id) navigate(`/product/${id}`);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleCartClick = () => navigate("/cart");

  /* ── Derived ── */
  const hasMarket = marketProducts.length > 0;
  const hasLocal = localProducts.length > 0;
  const hasFlash = flashDeals.length > 0;
  const hasTrending = trending.length > 0;
  const hasCampaign = !!campaign || campaignProducts.length > 0;

  /* ══════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════ */
  return (
    <div className="lm-test">
      {/* ══════════ HEADER ══════════ */}
      <header className="lm-header">
        <div className="lm-container lm-header-inner">
          <a
            href="/"
            className="lm-logo"
            onClick={(e) => {
              e.preventDefault();
              navigate("/");
            }}
          >
            loemart<span>.</span>
          </a>

          <form className="lm-search" onSubmit={handleSearch}>
            <span className="lm-search-ic">
              <SearchIcon size={16} />
            </span>
            <input
              type="search"
              placeholder="Search products, brands, locations…"
              aria-label="Search Loemart"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit">Search</button>
          </form>

          <div className="lm-header-actions">
            <button className="lm-hdr-btn" onClick={() => navigate("/login")}>
              <UserIcon size={17} /> <span>Account</span>
            </button>
            <button
              className="lm-mobile-menu-btn"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Menu"
            >
              <MenuIcon size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* ══════════ MOBILE DRAWER ══════════ */}
      <div
        className={`lm-mobile-overlay${mobileMenuOpen ? " open" : ""}`}
        onClick={() => setMobileMenuOpen(false)}
      >
        <div className="lm-mobile-drawer" onClick={(e) => e.stopPropagation()}>
          <button
            className="lm-mobile-drawer-close"
            onClick={() => setMobileMenuOpen(false)}
          >
            <XIcon size={22} />
          </button>
          <a className="lm-mobile-link" href="/nearby" onClick={() => setMobileMenuOpen(false)}>
            🏪 Loemart Local
          </a>
          <a className="lm-mobile-link" href="/trending" onClick={() => setMobileMenuOpen(false)}>
            🛍️ Loemart Market
          </a>
          <a className="lm-mobile-link" href="/deals" onClick={() => setMobileMenuOpen(false)}>
            🔥 Deals
          </a>
          <a className="lm-mobile-link" href="/latest" onClick={() => setMobileMenuOpen(false)}>
            ✨ Latest
          </a>
          <a className="lm-mobile-link" href="/minimart/add" onClick={() => setMobileMenuOpen(false)}>
            📦 Start Selling
          </a>
          <a className="lm-mobile-link" href="/login" onClick={() => setMobileMenuOpen(false)}>
            👤 Account
          </a>
        </div>
      </div>

      {/* ══════════ HERO ══════════ */}
      <section className="lm-hero">
        <div className="lm-container">
          <div className="lm-hero-content">
            <span className="lm-eyebrow">🇳🇬 Nigeria&apos;s Neighbourhood Marketplace</span>
            <h1>
              Everything you need.
              <br />
              <em>One Loemart.</em>
            </h1>
            <p>
              Discover amazing products, connect with local sellers and shop conveniently
              across Nigeria. One platform. Two ways to shop.
            </p>
          </div>

          <div className="lm-marketplaces">
            {/* Local */}
            <article className="lm-market-card lm-local" onClick={() => navigate("/nearby")}>
              <div>
                <div className="lm-card-tag">Marketplace 01 · Local</div>
                <div className="lm-card-icon">🏪</div>
                <h2>Loemart Local</h2>
                <p>
                  Buy and sell around you. Discover local listings, connect directly with
                  sellers and arrange pickup or delivery.
                </p>
              </div>
              <div className="lm-card-bottom">
                <span className="lm-card-btn">Explore Local →</span>
                <span className="lm-arrow">↗</span>
              </div>
            </article>

            {/* Market */}
            <article className="lm-market-card lm-market" onClick={() => navigate("/trending")}>
              <div>
                <div className="lm-card-tag">Marketplace 02 · Online Shopping</div>
                <div className="lm-card-icon">🛍️</div>
                <h2>Loemart Market</h2>
                <p>
                  Discover products, add your favourites to cart and enjoy convenient
                  online checkout with Managed Delivery.
                </p>
              </div>
              <div className="lm-card-bottom">
                <span className="lm-card-btn">Shop Marketplace →</span>
                <span className="lm-arrow">↗</span>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ══════════ CATEGORIES ══════════ */}
      <section className="lm-section">
        <div className="lm-container">
          <div className="lm-section-heading">
            <div>
              <h2>Explore Categories</h2>
              <p>Discover what you&apos;re looking for.</p>
            </div>
            <button className="lm-see-all" onClick={() => navigate("/trending")}>
              Explore all →
            </button>
          </div>
          <div className="lm-categories">
            {categories.map((cat) => (
              <div
                className="lm-category"
                key={cat.name}
                onClick={() => navigate(`/search?category=${cat.slug}`)}
              >
                <span className="lm-category-icon">{cat.icon}</span>
                <span className="lm-category-name">{cat.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ CAMPAIGN SPOTLIGHT ══════════ */}
      {hasCampaign && (
        <CampaignSpotlight
          campaign={campaign}
          products={campaignProducts}
          onProductClick={handleProductClick}
          onViewAll={() =>
            navigate(campaign?.slug ? `/campaign/${campaign.slug}` : "/trending")
          }
        />
      )}

      {/* ══════════ FLASH DEALS (Code 1) ══════════ */}
      {(loading || hasFlash) && (
        <section className="lm-section" style={{ paddingTop: hasCampaign ? 20 : 55 }}>
          <div className="lm-container">
            <div className="lm-section-heading">
              <div className="lm-flash-header">
                <div className="lm-flash-title">
                  <FlashIcon size={18} /> Flash Deals
                </div>
                <div className="lm-flash-timer">
                  <span>{timeLeft.hours}</span>:<span>{timeLeft.minutes}</span>:
                  <span>{timeLeft.seconds}</span>
                </div>
              </div>
              <button className="lm-see-all" onClick={() => navigate("/deals")}>
                See all →
              </button>
            </div>

            {loading ? (
              <div className="lm-pgrid--scroll">
                {[1, 2, 3, 4, 5].map((i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : (
              <div className="lm-pgrid--scroll">
                {flashDeals.map((p) => (
                  <ProductCard
                    key={p.id || p.product_id}
                    product={p}
                    onClick={handleProductClick}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ══════════ TRENDING ON MARKET (Code 1) ══════════ */}
      {(loading || hasTrending) && (
        <section className="lm-section lm-section--alt">
          <div className="lm-container">
            <div className="lm-section-heading">
              <div>
                <h2>🔥 Trending on Loemart Market</h2>
                <p>Popular products with great deals.</p>
              </div>
              <button className="lm-see-all" onClick={() => navigate("/trending")}>
                Shop all →
              </button>
            </div>

            {loading ? (
              <div className="lm-pgrid">
                {[1, 2, 3, 4].map((i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : (
              <div className="lm-pgrid">
                {trending.slice(0, 8).map((p) => (
                  <ProductCard
                    key={p.id || p.product_id}
                    product={p}
                    onClick={handleProductClick}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ══════════ ALL MARKET PRODUCTS (Code 1 Preview) ══════════ */}
      {hasMarket && (
        <section className="lm-section">
          <div className="lm-container">
            <div className="lm-section-heading">
              <div>
                <h2>🛍️ Shop Loemart Market</h2>
                <p>Discounted products ready for delivery.</p>
              </div>
              <button className="lm-see-all" onClick={() => navigate("/trending")}>
                View all →
              </button>
            </div>
            <div className="lm-pgrid">
              {marketProducts.map((p) => (
                <ProductCard
                  key={p.id || p.product_id}
                  product={p}
                  onClick={handleProductClick}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════ LOCAL LISTINGS (Code 2) ══════════ */}
      {(loading || hasLocal) && (
        <section className="lm-section lm-section--alt">
          <div className="lm-container">
            <div className="lm-section-heading">
              <div>
                <h2>🏪 Fresh on Loemart Local</h2>
                <p>Recent listings from sellers near you.</p>
              </div>
              <button className="lm-see-all" onClick={() => navigate("/nearby")}>
                Explore local →
              </button>
            </div>

            {loading ? (
              <div className="lm-pgrid">
                {[1, 2, 3, 4].map((i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : hasLocal ? (
              <div className="lm-pgrid">
                {localProducts.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    onClick={handleProductClick}
                    variant="local"
                  />
                ))}
              </div>
            ) : (
              <div className="lm-empty">
                <p>No local listings yet. Be the first to sell!</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ══════════ SELL CTA ══════════ */}
      {!loading && (
        <section className="lm-section" style={{ paddingTop: 10 }}>
          <div className="lm-container">
            <div className="lm-local-banner">
              <div>
                <h2>Have something to sell?</h2>
                <p>
                  Turn your items into opportunities. Reach potential buyers and list your
                  products on Loemart Local — it&apos;s completely free.
                </p>
              </div>
              <button className="lm-banner-btn" onClick={() => navigate("/minimart/add")}>
                Start Selling →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ══════════ BENEFITS ══════════ */}
      <section className="lm-section lm-section--alt">
        <div className="lm-container">
          <div className="lm-section-heading">
            <div>
              <h2>Why Loemart?</h2>
              <p>More opportunities. More convenience. One platform.</p>
            </div>
          </div>
          <div className="lm-benefit-grid">
            {benefits.map((b) => (
              <article className="lm-benefit" key={b.title}>
                <div className="lm-benefit-icon">{b.icon}</div>
                <h3>{b.title}</h3>
                <p>{b.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ IMPORTED FOOTER ══════════ */}
      <Footer />

      {/* ══════════ IMPORTED BOTTOM NAV ══════════ */}
      <BottomNav />

      {/* ══════════ IMPORTED FLOATING CART BUTTON ══════════ */}
      <FloatingCartButton count={cartCount} onClick={handleCartClick} />

      {/* ══════════ SCROLL TO TOP ══════════ */}
      <button
        className={`lm-scroll-top${showScrollTop ? " visible" : ""}`}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Scroll to top"
      >
        <ChevUpIcon size={18} />
      </button>
    </div>
  );
}