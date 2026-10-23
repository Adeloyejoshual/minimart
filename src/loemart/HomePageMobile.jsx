/**
 * src/pages/HomePageMobile.jsx
 * Production Mobile Homepage for Loemart
 *
 * - 100% Real Live API Data (No mock fallback items)
 * - Admin-Driven Promo Rows (Flash/Trending, Sponsored, Featured)
 * - Real Midnight Countdown Timer (Synced to WAT Midnight)
 * - Clean category navigation & Masonry catalog feed
 */

import { useState, useCallback, useEffect, useMemo, memo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  Zap,
  Flame,
  Star,
  Clock,
  ChevronRight,
  Search,
  ShoppingCart,
  Sliders,
  Package,
} from "lucide-react";

import categories from "../config/categories";
import MobileTopBar from "../loemart/mobile/MobileTopBar";
import MobileHeroBanner from "../loemart/mobile/MobileHeroBanner";
import MasonryCard from "../loemart/mobile/MasonryCard";
import {
  API,
  primaryImg,
  formatPrice,
  parseNum,
} from "../loemart/mobile/mobileHelpers";

import "../styles/Minimart.css";

const DEFAULT_LIMIT = 20;
const CART_KEY = "mm_cart";
const WISH_KEY = "loemart-wishlist";
const RECENT_KEY = "lm-recently-viewed";

/* ════════════════════════════════════════════════════════════
   REAL MIDNIGHT COUNTDOWN HOOK
════════════════════════════════════════════════════════════ */
function useRealFlashCountdown() {
  const [time, setTime] = useState({ h: "00", m: "00", s: "00" });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(23, 59, 59, 999);

      const diff = Math.max(0, midnight.getTime() - now.getTime());

      const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");

      setTime({ h, m, s });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}

/* ════════════════════════════════════════════════════════════
   MINI CARD FOR HORIZONTAL PROMO ROWS
════════════════════════════════════════════════════════════ */
const MiniPromoCard = memo(function MiniPromoCard({
  product,
  badge,
  badgeColor = "#ff6000",
}) {
  const navigate = useNavigate();
  const img = primaryImg(product?.images, product);
  const price = parseNum(product?.selling_price ?? product?.price);
  const dest = `/shop/${product?.slug || product?.id}`;

  return (
    <button
      type="button"
      className="lmm-mini"
      onClick={() => navigate(dest)}
      aria-label={product?.name || "Product"}
    >
      <div className="lmm-mini__img-wrap">
        <img src={img} alt="" className="lmm-mini__img" loading="lazy" />
        {badge && (
          <span className="lmm-mini__badge" style={{ background: badgeColor }}>
            {badge}
          </span>
        )}
      </div>
      <div className="lmm-mini__body">
        <p className="lmm-mini__name">{product?.name}</p>
        <p className="lmm-mini__price">{formatPrice(price)}</p>
      </div>
    </button>
  );
});

/* ════════════════════════════════════════════════════════════
   MAIN HOMEPAGE COMPONENT
════════════════════════════════════════════════════════════ */
export default function HomePageMobile({ user }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const flashTime = useRealFlashCountdown();

  /* ── Filter Params ── */
  const qParam = searchParams.get("q") ?? "";
  const catParam = searchParams.get("category") ?? "all";
  const sortParam = searchParams.get("sort") ?? "newest";

  const [searchQuery, setSearchQuery] = useState(qParam);
  const [activeCat, setActiveCat] = useState(catParam);
  const [activeSort, setActiveSort] = useState(sortParam);

  /* ── Feed Data ── */
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  /* ── Admin-driven Live Sections ── */
  const [flashDeals, setFlashDeals] = useState([]);
  const [sponsored, setSponsored] = useState([]);
  const [featured, setFeatured] = useState([]);

  /* ── Carts & Storage ── */
  const [cartItems, setCartItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); } catch { return []; }
  });
  const [wishlist, setWishlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem(WISH_KEY) || "[]"); } catch { return []; }
  });

  const syncCart = useCallback(() => {
    try {
      setCartItems(JSON.parse(localStorage.getItem(CART_KEY) || "[]"));
    } catch {
      setCartItems([]);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("cart-updated", syncCart);
    return () => window.removeEventListener("cart-updated", syncCart);
  }, [syncCart]);

  const cartMap = useMemo(() => {
    const map = {};
    cartItems.forEach((i) => {
      const pid = String(i.productId || i.product_id || "");
      if (pid) map[pid] = { qty: i.qty, itemId: i.id };
    });
    return map;
  }, [cartItems]);

  const totalCartQty = useMemo(() => {
    return cartItems.reduce((s, i) => s + (parseNum(i.qty) || 1), 0);
  }, [cartItems]);

  const categoryList = useMemo(
    () => [{ id: "all", name: "All Items", icon: "🏪" }, ...categories],
    []
  );

  const isSearchActive = !!(searchQuery && searchQuery.trim()) || activeCat !== "all";

  /* ════════════════════════════════════════════════════════
     LIVE API FETCHERS
  ════════════════════════════════════════════════════════ */
  const fetchFeed = useCallback(
    async ({
      q = searchQuery,
      cat = activeCat,
      sort = activeSort,
      newOffset = 0,
      append = false,
    } = {}) => {
      append ? setLoadingMore(true) : setLoading(true);
      setFetchError(null);

      try {
        const params = {
          limit: DEFAULT_LIMIT,
          offset: newOffset,
          sort: sort || "newest",
        };
        const term = (q || "").trim();
        if (term) params.search = term;
        if (cat && cat !== "all") params.category = cat;

        const { data } = await axios.get(`${API}/products`, { params, timeout: 12000 });
        const rows = data?.data?.products ?? [];
        const metaTotal = data?.data?.pagination?.total ?? rows.length;

        setProducts((prev) => (append ? [...prev, ...rows] : rows));
        setOffset(newOffset);
        setTotal(metaTotal);
        setHasMore(newOffset + DEFAULT_LIMIT < metaTotal);
      } catch (err) {
        const msg = err?.response?.data?.message || "Failed to load products";
        setFetchError(msg);
        if (!append) setProducts([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [searchQuery, activeCat, activeSort]
  );

  // Fetch real admin flags
  const fetchAdminSections = useCallback(async () => {
    try {
      const [flashRes, featRes, sponRes] = await Promise.allSettled([
        axios.get(`${API}/products`, { params: { trending: "true", limit: 10 } }),
        axios.get(`${API}/products`, { params: { featured: "true", limit: 10 } }),
        axios.get(`${API}/products`, { params: { sponsored: "true", limit: 10 } }),
      ]);

      if (flashRes.status === "fulfilled") {
        setFlashDeals(flashRes.value.data?.data?.products ?? []);
      }
      if (featRes.status === "fulfilled") {
        setFeatured(featRes.value.data?.data?.products ?? []);
      }
      if (sponRes.status === "fulfilled") {
        setSponsored(sponRes.value.data?.data?.products ?? []);
      }
    } catch (err) {
      console.error("[Live Sections Fetch Error]", err);
    }
  }, []);

  useEffect(() => {
    setSearchQuery(qParam);
    setActiveCat(catParam || "all");
    setActiveSort(sortParam || "newest");
  }, [qParam, catParam, sortParam]);

  useEffect(() => {
    fetchFeed({ newOffset: 0, append: false });
    if (!isSearchActive) {
      fetchAdminSections();
    }
  }, [fetchFeed, fetchAdminSections, isSearchActive]);

  /* ════════════════════════════════════════════════════════
     HANDLERS
  ════════════════════════════════════════════════════════ */
  const handleCategorySelect = (catId) => {
    setActiveCat(catId);
    const p = {};
    if (searchQuery.trim()) p.q = searchQuery.trim();
    if (catId !== "all") p.category = catId;
    if (activeSort !== "newest") p.sort = activeSort;
    setSearchParams(p);
  };

  const handleClearAll = () => {
    setSearchQuery("");
    setActiveCat("all");
    setActiveSort("newest");
    setSearchParams({});
  };

  const toggleWishlist = (id) => {
    setWishlist((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem(WISH_KEY, JSON.stringify(next));
      toast.success(prev.includes(id) ? "Removed from wishlist" : "Saved ❤️", { duration: 1200 });
      return next;
    });
  };

  return (
    <div className="mm-page lmm-mobile-page">
      {/* ── STICKY TOPBAR ── */}
      <MobileTopBar
        variant="home"
        brandName="Loemart"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={(q) => navigate(`/search?q=${encodeURIComponent(q)}`)}
        cartCount={totalCartQty}
        wishCount={wishlist.length}
        onBrandClick={handleClearAll}
        onCartClick={() => navigate("/shop/cart")}
        onWishClick={() => navigate("/shop/wishlist")}
      />

      {/* ── CATEGORY TOUCH STRIP (Fixes overlap from screenshot) ── */}
      <div className="lmm-cat-strip">
        {categoryList.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`lmm-cat-chip ${activeCat === c.id ? "is-active" : ""}`}
            onClick={() => handleCategorySelect(c.id)}
          >
            <span style={{ marginRight: 4 }}>{c.icon}</span>
            {c.name}
          </button>
        ))}
      </div>

      {/* Show admin banners & deal rows ONLY when viewing main catalog */}
      {!isSearchActive && (
        <>
          {/* Hero Banner */}
          <MobileHeroBanner
            user={user}
            onCta={(action) => {
              if (action === "sell") navigate(user ? "/minimart/post-ad" : "/auth");
              else document.getElementById("mobile-grid")?.scrollIntoView({ behavior: "smooth" });
            }}
          />

          {/* REAL FLASH DEALS (Renders ONLY if admin set products to trending/flash) */}
          {flashDeals.length > 0 && (
            <section className="lmm-hsec">
              <div className="lmm-hsec__head">
                <div className="lmm-hsec__title-wrap">
                  <Zap size={18} className="lmm-icon-flash" fill="#ef4444" color="#ef4444" />
                  <h2 className="lmm-hsec__title">Flash Sale</h2>
                  <div className="lmm-timer-badge">
                    <Clock size={12} />
                    <span>{flashTime.h}:{flashTime.m}:{flashTime.s}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="lmm-hsec__all"
                  onClick={() => document.getElementById("mobile-grid")?.scrollIntoView({ behavior: "smooth" })}
                >
                  See all <ChevronRight size={14} />
                </button>
              </div>

              <div className="lmm-hsec__track">
                {flashDeals.map((p) => (
                  <MiniPromoCard key={p.id} product={p} badge="Deal" badgeColor="#ef4444" />
                ))}
              </div>
            </section>
          )}

          {/* REAL SPONSORED (Renders ONLY if admin set is_sponsored = true) */}
          {sponsored.length > 0 && (
            <section className="lmm-hsec">
              <div className="lmm-hsec__head">
                <div className="lmm-hsec__title-wrap">
                  <Star size={18} fill="#f59e0b" color="#f59e0b" />
                  <h2 className="lmm-hsec__title">Sponsored Items</h2>
                </div>
              </div>

              <div className="lmm-hsec__track">
                {sponsored.map((p) => (
                  <MiniPromoCard key={p.id} product={p} badge="Ad" badgeColor="#f59e0b" />
                ))}
              </div>
            </section>
          )}

          {/* REAL FEATURED (Renders ONLY if admin set is_featured = true) */}
          {featured.length > 0 && (
            <section className="lmm-hsec">
              <div className="lmm-hsec__head">
                <div className="lmm-hsec__title-wrap">
                  <Flame size={18} fill="#ff6000" color="#ff6000" />
                  <h2 className="lmm-hsec__title">Featured Picks</h2>
                </div>
              </div>

              <div className="lmm-hsec__track">
                {featured.map((p) => (
                  <MiniPromoCard key={p.id} product={p} badge="Featured" badgeColor="#ff6000" />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── MAIN CATALOG FEED ── */}
      <section className="mdp-psec" id="mobile-grid">
        <div className="mm-catalog-head">
          <div>
            <h2 className="mdp-psec__title">
              {isSearchActive
                ? searchQuery
                  ? `Results for "${searchQuery}"`
                  : categoryList.find((c) => c.id === activeCat)?.name
                : "Discover Marketplace"}
            </h2>
            <p className="mm-catalog-sub">
              {loading ? "Loading items..." : `${total.toLocaleString()} listings available`}
            </p>
          </div>

          {isSearchActive && (
            <button type="button" className="mm-btn-filter-pill" onClick={handleClearAll}>
              Reset All
            </button>
          )}
        </div>

        {/* MASONRY PRODUCT GRID */}
        <div className="pr-masonry">
          {loading && offset === 0
            ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="pr-masonry-skel" />)
            : products.map((product) => {
                const id = product.id || product.product_id;
                return (
                  <MasonryCard
                    key={id}
                    product={product}
                    isWished={wishlist.includes(id)}
                    onWishlist={() => toggleWishlist(id)}
                    cartInfo={cartMap[String(id)] || null}
                    onCartUpdate={syncCart}
                  />
                );
              })}
        </div>

        {!loading && products.length === 0 && (
          <div className="mm-error">
            <Package size={36} color="#999" />
            <p style={{ marginTop: 12 }}>No products found in this section.</p>
            <button type="button" className="pr-load-more-btn" onClick={handleClearAll}>
              View All Products
            </button>
          </div>
        )}

        {hasMore && (
          <div className="pr-load-more-wrap">
            <button
              type="button"
              className="pr-load-more-btn"
              disabled={loadingMore}
              onClick={() => fetchFeed({ newOffset: offset + DEFAULT_LIMIT, append: true })}
            >
              {loadingMore ? "Loading..." : "Load More Products"}
            </button>
          </div>
        )}
      </section>

      {/* Inline styles for clean Mobile layout & Countdown */}
      <style>{`
        .lmm-mobile-page {
          padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px));
        }

        .lmm-cat-strip {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 10px 16px;
          background: #ffffff;
          border-bottom: 1px solid #e9ecef;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }

        .lmm-cat-strip::-webkit-scrollbar {
          display: none;
        }

        .lmm-cat-chip {
          flex-shrink: 0;
          border: 1px solid #e9ecef;
          background: #ffffff;
          color: #111111;
          font-size: 12px;
          font-weight: 700;
          padding: 6px 14px;
          border-radius: 999px;
          cursor: pointer;
          white-space: nowrap;
        }

        .lmm-cat-chip.is-active {
          background: #ff6000;
          border-color: #ff6000;
          color: #ffffff;
        }

        .lmm-hsec {
          background: #ffffff;
          padding: 14px 0;
          margin-top: 8px;
        }

        .lmm-hsec__head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px 10px;
        }

        .lmm-hsec__title-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .lmm-hsec__title {
          margin: 0;
          font-size: 16px;
          font-weight: 800;
          color: #111111;
        }

        .lmm-timer-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #fef2f2;
          color: #ef4444;
          font-size: 11px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 999px;
        }

        .lmm-hsec__all {
          border: none;
          background: none;
          color: #ff6000;
          font-size: 12px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          cursor: pointer;
        }

        .lmm-hsec__track {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding: 0 16px;
          scrollbar-width: none;
        }

        .lmm-hsec__track::-webkit-scrollbar {
          display: none;
        }

        .lmm-mini {
          flex: 0 0 120px;
          width: 120px;
          border: none;
          background: #f8f9fa;
          border-radius: 10px;
          overflow: hidden;
          padding: 0;
          text-align: left;
          cursor: pointer;
        }

        .lmm-mini__img-wrap {
          position: relative;
          width: 100%;
          height: 110px;
          background: #e9ecef;
        }

        .lmm-mini__img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .lmm-mini__badge {
          position: absolute;
          top: 6px;
          left: 6px;
          color: #ffffff;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .lmm-mini__body {
          padding: 8px;
          background: #ffffff;
        }

        .lmm-mini__name {
          margin: 0;
          font-size: 11px;
          font-weight: 600;
          color: #333333;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .lmm-mini__price {
          margin: 4px 0 0;
          font-size: 13px;
          font-weight: 800;
          color: #111111;
        }
      `}</style>
    </div>
  );
}