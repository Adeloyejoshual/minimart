/**
 * src/pages/HomePageMobile.jsx
 * Loemart pro mobile homepage
 *
 * Stack:
 *  - MobileTopBar (brand orange, search, cart/wish badges)
 *  - MobileHeroBanner (swipe + autoplay)
 *  - Quick category grid
 *  - Flash / Sponsored / Trending horizontal rows
 *  - Recently Viewed
 *  - Masonry “Just For You” feed (MasonryCard)
 *  - Load more + empty/error states
 */

import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  memo,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  Flame,
  Star,
  Zap,
  Clock,
  ChevronRight,
  Search,
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
/* Optional premium extras if you still load them:
import "../styles/LoemartPremium.css";
*/

const DEFAULT_LIMIT = 20;
const CART_KEY = "mm_cart";
const WISH_KEY = "loemart-wishlist";
const RECENT_KEY = "lm-recently-viewed";

/* ════════════════════════════════════════════════════════════
   LOCAL HELPERS
════════════════════════════════════════════════════════════ */
function readGuestCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

function readWishlist() {
  try {
    return JSON.parse(localStorage.getItem(WISH_KEY) || "[]");
  } catch {
    return [];
  }
}

function readRecentlyViewed() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function cartCountFrom(items) {
  return items.reduce((s, i) => s + (parseNum(i.qty) || 1), 0);
}

/* ════════════════════════════════════════════════════════════
   MINI PROMO CARD (horizontal rows)
════════════════════════════════════════════════════════════ */
const MiniPromoCard = memo(function MiniPromoCard({
  product,
  badge,
  badgeColor = "#ff6000",
}) {
  const navigate = useNavigate();
  const img = primaryImg(product?.images, product) || "/placeholder.png";
  const price = parseNum(product?.selling_price ?? product?.price);
  const dest = `/shop/${product?.slug || product?.id}`;

  return (
    <button
      type="button"
      className="lmm-mini"
      onClick={() => navigate(dest)}
      aria-label={product?.name || product?.title || "Product"}
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
        <p className="lmm-mini__name">{product?.name || product?.title}</p>
        <p className="lmm-mini__price">{formatPrice(price)}</p>
      </div>
    </button>
  );
});

/* ════════════════════════════════════════════════════════════
   H-SCROLL SECTION
════════════════════════════════════════════════════════════ */
const HSection = memo(function HSection({
  icon: Icon,
  iconColor = "#ff6000",
  title,
  actionLabel = "See all",
  onAction,
  children,
}) {
  if (!children) return null;
  return (
    <section className="lmm-hsec">
      <div className="lmm-hsec__head">
        <div className="lmm-hsec__title-wrap">
          {Icon && (
            <span className="lmm-hsec__icon" style={{ color: iconColor }}>
              <Icon size={16} fill={iconColor} />
            </span>
          )}
          <h2 className="lmm-hsec__title">{title}</h2>
        </div>
        {onAction && (
          <button type="button" className="lmm-hsec__all" onClick={onAction}>
            {actionLabel} <ChevronRight size={14} />
          </button>
        )}
      </div>
      <div className="lmm-hsec__track">{children}</div>
    </section>
  );
});

/* ════════════════════════════════════════════════════════════
   FLASH COUNTDOWN (simple local urgency)
════════════════════════════════════════════════════════════ */
function useFlashCountdown(hours = 4) {
  const end = useMemo(
    () => Date.now() + hours * 3600000 + 18 * 60000 + 42000,
    [hours]
  );
  const [t, setT] = useState({ h: "04", m: "18", s: "42" });

  useEffect(() => {
    const tick = () => {
      const d = Math.max(0, end - Date.now());
      setT({
        h: String(Math.floor(d / 3600000)).padStart(2, "0"),
        m: String(Math.floor((d % 3600000) / 60000)).padStart(2, "0"),
        s: String(Math.floor((d % 60000) / 1000)).padStart(2, "0"),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [end]);

  return t;
}

/* ════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════ */
export default function HomePageMobile({ user }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const flashTime = useFlashCountdown(5);

  /* ── URL-driven filters ── */
  const qParam = searchParams.get("q") ?? "";
  const catParam = searchParams.get("category") ?? "all";
  const sortParam = searchParams.get("sort") ?? "newest";

  const [searchQuery, setSearchQuery] = useState(qParam);
  const [activeCat, setActiveCat] = useState(catParam);
  const [activeSort, setActiveSort] = useState(sortParam);

  /* ── Feed ── */
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  /* ── Promo sections ── */
  const [flashDeals, setFlashDeals] = useState([]);
  const [sponsored, setSponsored] = useState([]);
  const [trending, setTrending] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState(readRecentlyViewed);

  /* ── Cart / Wish ── */
  const [cartItems, setCartItems] = useState(readGuestCart);
  const [wishlist, setWishlist] = useState(readWishlist);

  const syncCart = useCallback(() => {
    setCartItems(readGuestCart());
  }, []);

  useEffect(() => {
    const onCart = () => syncCart();
    const onWish = () => setWishlist(readWishlist());
    const onRecent = () => setRecentlyViewed(readRecentlyViewed());
    window.addEventListener("cart-updated", onCart);
    window.addEventListener("wishlist-updated", onWish);
    window.addEventListener("focus", onRecent);
    return () => {
      window.removeEventListener("cart-updated", onCart);
      window.removeEventListener("wishlist-updated", onWish);
      window.removeEventListener("focus", onRecent);
    };
  }, [syncCart]);

  const cartMap = useMemo(() => {
    const map = {};
    cartItems.forEach((i) => {
      const pid = String(i.productId || i.product_id || "");
      if (pid) map[pid] = { qty: i.qty, itemId: i.id };
    });
    return map;
  }, [cartItems]);

  const totalCartQty = useMemo(() => cartCountFrom(cartItems), [cartItems]);

  const categoryList = useMemo(
    () => [{ id: "all", name: "All", icon: "🏪" }, ...categories],
    []
  );

  const isSearchMode =
    !!(searchQuery && searchQuery.trim()) ||
    (activeCat && activeCat !== "all");

  /* ════════════════════════════════════════════════════════
     FETCH
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

        const { data } = await axios.get(`${API}/products`, {
          params,
          timeout: 12000,
        });
        const rows = data?.data?.products ?? [];
        const metaTotal = data?.data?.pagination?.total ?? rows.length;

        setProducts((prev) => (append ? [...prev, ...rows] : rows));
        setOffset(newOffset);
        setTotal(metaTotal);
        setHasMore(newOffset + DEFAULT_LIMIT < metaTotal);
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          (err.code === "ERR_NETWORK" ? "Network error" : "Failed to load products");
        setFetchError(msg);
        if (!append) {
          setProducts([]);
          setTotal(0);
          toast.error(msg);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [searchQuery, activeCat, activeSort]
  );

  const fetchSections = useCallback(async () => {
    try {
      const [flashRes, featRes, trendRes] = await Promise.allSettled([
        axios.get(`${API}/products`, {
          params: { sort: "trending", limit: 8 },
          timeout: 10000,
        }),
        axios.get(`${API}/products`, {
          params: { featured: "true", limit: 8 },
          timeout: 10000,
        }),
        axios.get(`${API}/products`, {
          params: { sort: "views", limit: 8 },
          timeout: 10000,
        }),
      ]);

      if (flashRes.status === "fulfilled") {
        setFlashDeals(flashRes.value.data?.data?.products ?? []);
      }
      if (featRes.status === "fulfilled") {
        setSponsored(featRes.value.data?.data?.products ?? []);
      }
      if (trendRes.status === "fulfilled") {
        setTrending(trendRes.value.data?.data?.products ?? []);
      }
    } catch {
      /* non-blocking */
    }
  }, []);

  /* initial + param changes */
  useEffect(() => {
    setSearchQuery(qParam);
    setActiveCat(catParam || "all");
    setActiveSort(sortParam || "newest");
  }, [qParam, catParam, sortParam]);

  useEffect(() => {
    fetchFeed({
      q: qParam,
      cat: catParam || "all",
      sort: sortParam || "newest",
      newOffset: 0,
      append: false,
    });
    // sections only when not deep-filtering
    if (!(qParam || (catParam && catParam !== "all"))) {
      fetchSections();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qParam, catParam, sortParam]);

  /* ════════════════════════════════════════════════════════
     HANDLERS
  ════════════════════════════════════════════════════════ */
  const pushParams = useCallback(
    ({ q = searchQuery, cat = activeCat, sort = activeSort } = {}) => {
      const p = {};
      if (q && q.trim()) p.q = q.trim();
      if (cat && cat !== "all") p.category = cat;
      if (sort && sort !== "newest") p.sort = sort;
      setSearchParams(p);
    },
    [searchQuery, activeCat, activeSort, setSearchParams]
  );

  const handleSearchSubmit = useCallback(
    (q) => {
      const term = (q ?? searchQuery).trim();
      // fullscreen search page (pro)
      if (term) {
        navigate(`/search?q=${encodeURIComponent(term)}`);
        return;
      }
      navigate("/search");
    },
    [navigate, searchQuery]
  );

  const handleCategory = useCallback(
    (id) => {
      setActiveCat(id);
      pushParams({ cat: id, q: searchQuery, sort: activeSort });
    },
    [pushParams, searchQuery, activeSort]
  );

  const clearAll = useCallback(() => {
    setSearchQuery("");
    setActiveCat("all");
    setActiveSort("newest");
    setSearchParams({});
  }, [setSearchParams]);

  const toggleWishlist = useCallback((id) => {
    setWishlist((prev) => {
      const has = prev.includes(id);
      const next = has ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem(WISH_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event("wishlist-updated"));
      toast.success(has ? "Removed from wishlist" : "Saved ❤️", {
        duration: 1200,
      });
      return next;
    });
  }, []);

  const handleHeroCta = useCallback(
    (action) => {
      switch (action) {
        case "flash":
        case "explore":
          document
            .getElementById("mobile-grid")
            ?.scrollIntoView({ behavior: "smooth" });
          break;
        case "newest":
          setActiveSort("newest");
          pushParams({ sort: "newest", cat: activeCat, q: searchQuery });
          break;
        case "sell":
          navigate(user ? "/minimart/post-ad" : "/auth");
          break;
        default:
          break;
      }
    },
    [navigate, user, pushParams, activeCat, searchQuery]
  );

  const openFilters = useCallback(() => {
    // Hook up MobileFilterSheet when ready
    toast("Filters coming next", { icon: "⚙️", duration: 1400 });
  }, []);

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div className="mm-page lmm-home">
      {/* ── TOP BAR ── */}
      <MobileTopBar
        variant="home"
        brandName="Loemart"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        onSearchFocus={() => {
          // optional: navigate("/search") for instant fullscreen
        }}
        onFilterClick={openFilters}
        cartCount={totalCartQty}
        wishCount={wishlist.length}
        onBrandClick={clearAll}
        onCartClick={() => navigate("/shop/cart")}
        onWishClick={() => navigate("/shop/wishlist")}
      />

      {/* Promos only on clean home (not search/category deep states) */}
      {!isSearchMode && (
        <>
          <MobileHeroBanner user={user} onCta={handleHeroCta} />

          {/* Quick categories */}
          <div className="lmm-quick">
            {categoryList.slice(0, 8).map((c) => (
              <button
                key={c.id}
                type="button"
                className={`lmm-quick__item ${
                  activeCat === c.id ? "is-active" : ""
                }`}
                onClick={() => handleCategory(c.id)}
              >
                <span className="lmm-quick__ico" aria-hidden="true">
                  {c.icon || "📦"}
                </span>
                <span className="lmm-quick__label">{c.name}</span>
              </button>
            ))}
          </div>

          {/* Flash Deals */}
          {flashDeals.length > 0 && (
            <section className="lmm-hsec lmm-hsec--flash">
              <div className="lmm-hsec__head">
                <div className="lmm-hsec__title-wrap">
                  <span className="lmm-hsec__icon" style={{ color: "#ef4444" }}>
                    <Zap size={16} fill="#ef4444" />
                  </span>
                  <h2 className="lmm-hsec__title">Flash Deals</h2>
                  <span className="lmm-flash-timer" aria-label="Deal ends soon">
                    <Clock size={12} />
                    {flashTime.h}:{flashTime.m}:{flashTime.s}
                  </span>
                </div>
                <button
                  type="button"
                  className="lmm-hsec__all"
                  onClick={() =>
                    document
                      .getElementById("mobile-grid")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  See all <ChevronRight size={14} />
                </button>
              </div>
              <div className="lmm-hsec__track">
                {flashDeals.map((p) => (
                  <MiniPromoCard
                    key={p.id}
                    product={p}
                    badge="Deal"
                    badgeColor="#ef4444"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Sponsored */}
          {sponsored.length > 0 && (
            <HSection
              icon={Star}
              iconColor="#f59e0b"
              title="Sponsored"
              onAction={() =>
                document
                  .getElementById("mobile-grid")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              {sponsored.map((p) => (
                <MiniPromoCard
                  key={p.id}
                  product={p}
                  badge="Ad"
                  badgeColor="#f59e0b"
                />
              ))}
            </HSection>
          )}

          {/* Trending */}
          {trending.length > 0 && (
            <HSection
              icon={Flame}
              iconColor="#ff6000"
              title="Trending Now"
              onAction={() => {
                setActiveSort("trending");
                pushParams({ sort: "trending" });
              }}
            >
              {trending.map((p) => (
                <MiniPromoCard
                  key={p.id}
                  product={p}
                  badge="Hot"
                  badgeColor="#ff6000"
                />
              ))}
            </HSection>
          )}

          {/* Recently viewed */}
          {recentlyViewed.length > 0 && (
            <HSection icon={Clock} iconColor="#64748b" title="Recently Viewed">
              {recentlyViewed.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="lmm-mini"
                  onClick={() => navigate(`/shop/${p.slug || p.id}`)}
                >
                  <div className="lmm-mini__img-wrap">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt=""
                        className="lmm-mini__img"
                        loading="lazy"
                      />
                    ) : (
                      <div className="lmm-mini__ph">
                        <Package size={20} />
                      </div>
                    )}
                  </div>
                  <div className="lmm-mini__body">
                    <p className="lmm-mini__name">{p.name}</p>
                    <p className="lmm-mini__price">
                      {formatPrice(p.price)}
                    </p>
                  </div>
                </button>
              ))}
            </HSection>
          )}
        </>
      )}

      {/* ── FEED HEADER ── */}
      <section className="mdp-psec mdp-psec--recommended" id="mobile-grid">
        <div className="mm-catalog-head">
          <div>
            <h2 className="mdp-psec__title">
              {isSearchMode
                ? searchQuery
                  ? `Results for “${searchQuery}”`
                  : categoryList.find((c) => c.id === activeCat)?.name ||
                    "Browse"
                : "Just For You"}
            </h2>
            <p className="mm-catalog-sub">
              {loading && products.length === 0
                ? "Loading products…"
                : total > 0
                ? `${total.toLocaleString()} products`
                : "Explore the marketplace"}
            </p>
          </div>

          <div className="lmm-feed-actions">
            {isSearchMode && (
              <button
                type="button"
                className="mm-btn-filter-pill"
                onClick={clearAll}
              >
                Clear
              </button>
            )}
            <button
              type="button"
              className="mm-btn-filter-pill"
              onClick={openFilters}
            >
              Filters
            </button>
          </div>
        </div>

        {/* Category chips when searching / always compact strip */}
        {isSearchMode && (
          <div className="lmm-cat-strip">
            {categoryList.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`lmm-cat-chip ${
                  activeCat === c.id ? "is-active" : ""
                }`}
                onClick={() => handleCategory(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* ── MASONRY ── */}
        <div className="pr-masonry">
          {loading && products.length === 0 &&
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="pr-masonry-skel" />
            ))}

          {!loading && fetchError && products.length === 0 && (
            <div className="mm-error" style={{ gridColumn: "1 / -1" }}>
              <p>{fetchError}</p>
              <button
                type="button"
                className="pr-load-more-btn"
                onClick={() => fetchFeed({ newOffset: 0 })}
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !fetchError && products.length === 0 && (
            <div className="mm-error" style={{ gridColumn: "1 / -1" }}>
              <Search size={36} color="#999" />
              <p style={{ marginTop: 12 }}>No products found</p>
              <button
                type="button"
                className="pr-load-more-btn"
                onClick={clearAll}
              >
                Browse all
              </button>
            </div>
          )}

          {products.map((product) => {
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

        {hasMore && (
          <div className="pr-load-more-wrap">
            <button
              type="button"
              className="pr-load-more-btn"
              disabled={loadingMore}
              onClick={() =>
                fetchFeed({ newOffset: offset + DEFAULT_LIMIT, append: true })
              }
            >
              {loadingMore ? "Loading…" : "Load more products"}
            </button>
          </div>
        )}

        {!loading && !hasMore && products.length > 0 && (
          <p
            className="mm-catalog-sub"
            style={{ textAlign: "center", padding: "8px 16px 24px" }}
          >
            You’re all caught up
          </p>
        )}
      </section>

      {/* Inline styles for new lmm-* pieces so it runs without waiting on extra CSS file.
          Move these into MobileHome.css when you want. */}
      <style>{`
        .lmm-home { padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px)); }

        .lmm-quick {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px 8px;
          padding: 14px 16px;
          background: var(--wh, #fff);
          margin-bottom: 8px;
        }
        .lmm-quick__item {
          border: none; background: transparent; cursor: pointer;
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          font-family: inherit; -webkit-tap-highlight-color: transparent;
        }
        .lmm-quick__ico {
          width: 52px; height: 52px; border-radius: 50%;
          background: var(--o-bg, #fff4eb);
          display: grid; place-items: center; font-size: 22px;
        }
        .lmm-quick__item.is-active .lmm-quick__ico {
          background: var(--o, #ff6000);
        }
        .lmm-quick__label {
          font-size: 11px; font-weight: 600; color: var(--ink, #333);
          text-align: center; max-width: 72px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .lmm-hsec {
          background: var(--wh, #fff);
          padding: 14px 0 12px;
          margin-bottom: 8px;
        }
        .lmm-hsec__head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 16px 10px; gap: 8px;
        }
        .lmm-hsec__title-wrap {
          display: flex; align-items: center; gap: 6px; min-width: 0;
        }
        .lmm-hsec__icon { display: grid; place-items: center; }
        .lmm-hsec__title {
          margin: 0; font-size: 16px; font-weight: 800; color: var(--ink, #111);
          letter-spacing: -0.02em;
        }
        .lmm-hsec__all {
          border: none; background: none; color: var(--o, #ff6000);
          font-size: 12px; font-weight: 700; display: inline-flex; align-items: center;
          gap: 2px; cursor: pointer; font-family: inherit; flex-shrink: 0;
        }
        .lmm-hsec__track {
          display: flex; gap: 10px; overflow-x: auto; padding: 0 16px;
          scrollbar-width: none; -webkit-overflow-scrolling: touch;
        }
        .lmm-hsec__track::-webkit-scrollbar { display: none; }

        .lmm-flash-timer {
          display: inline-flex; align-items: center; gap: 4px;
          margin-left: 8px; padding: 3px 8px; border-radius: 999px;
          background: #fef2f2; color: #ef4444;
          font-size: 11px; font-weight: 800; font-variant-numeric: tabular-nums;
        }

        .lmm-mini {
          flex: 0 0 120px; width: 120px;
          border: none; background: var(--bg, #f8f9fa);
          border-radius: 10px; overflow: hidden; padding: 0;
          text-align: left; cursor: pointer; font-family: inherit;
          box-shadow: var(--s1, 0 2px 8px rgba(0,0,0,.04));
        }
        .lmm-mini__img-wrap {
          position: relative; width: 100%; height: 112px; background: #f0f0f0;
        }
        .lmm-mini__img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .lmm-mini__ph {
          width: 100%; height: 100%; display: grid; place-items: center; color: #bbb;
        }
        .lmm-mini__badge {
          position: absolute; top: 6px; left: 6px;
          color: #fff; font-size: 10px; font-weight: 800;
          padding: 2px 6px; border-radius: 4px;
        }
        .lmm-mini__body { padding: 8px; background: #fff; }
        .lmm-mini__name {
          margin: 0; font-size: 11px; font-weight: 600; color: #333;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .lmm-mini__price {
          margin: 4px 0 0; font-size: 13px; font-weight: 800; color: #111;
        }

        .lmm-feed-actions { display: flex; gap: 8px; align-items: center; }

        .lmm-cat-strip {
          display: flex; gap: 8px; overflow-x: auto; padding: 0 16px 12px;
          scrollbar-width: none;
        }
        .lmm-cat-strip::-webkit-scrollbar { display: none; }
        .lmm-cat-chip {
          flex-shrink: 0; border: 1px solid var(--bd, #e9ecef);
          background: #fff; color: #111; font-size: 12px; font-weight: 700;
          padding: 7px 14px; border-radius: 999px; cursor: pointer;
          font-family: inherit;
        }
        .lmm-cat-chip.is-active {
          background: var(--o, #ff6000); border-color: var(--o, #ff6000); color: #fff;
        }
      `}</style>
    </div>
  );
}