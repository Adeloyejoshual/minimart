import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo,
} from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";

import { API_URL, PAGE_SIZE, buildSortOptions, getProductImage, formatPrice, calcDiscount } from "../config/marketplace";
import categories     from "../config/categories";
import useDebounce    from "../hooks/useDebounce";
import useWishlist    from "../hooks/useWishlist";
import useScreenWidth from "../hooks/useScreenWidth";

import TopBar        from "./Minimart/TopBar";
import SubBar        from "./Minimart/SubBar";
import ProductCard   from "./Minimart/ProductCard";
import SkeletonCard  from "./Minimart/SkeletonCard";
import FilterDrawer  from "./Minimart/FilterDrawer";
import EmptyState    from "./Minimart/EmptyState";
import FAB           from "./Minimart/FAB";
import { CloseIcon, HeartIcon, StarIcon, EyeIcon, TagIcon } from "./Minimart/icons";

import "../styles/Minimart.css";

/* ════════════════════════════════════════════════════════════
   HERO BANNER
════════════════════════════════════════════════════════════ */
const HeroBanner = memo(function HeroBanner({ featured, onShop, onPost, user }) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef(null);

  const slides = useMemo(() => {
    if (featured.length > 0) {
      return featured.slice(0, 3).map((p) => ({
        id:       p.id,
        title:    p.name,
        subtitle: p.short_description || p.description?.slice(0, 60) || "Great deal available",
        price:    formatPrice(p.price),
        image:    getProductImage(p),
        slug:     p.slug ?? p.id,
        badge:    p.is_trending ? "🔥 Trending" : p.is_featured ? "⭐ Featured" : null,
        discount: calcDiscount(p.price, p.original_price),
      }));
    }
    /* Fallback static slides */
    return [
      {
        id:       "s1",
        title:    "Shop Smarter",
        subtitle: "Discover thousands of products from verified sellers",
        price:    null,
        image:    null,
        badge:    null,
        discount: 0,
      },
      {
        id:       "s2",
        title:    "Best Deals Today",
        subtitle: "Electronics, fashion, food and more — all in one place",
        price:    null,
        image:    null,
        badge:    "🔥 Hot",
        discount: 0,
      },
    ];
  }, [featured]);

  /* Auto-rotate */
  useEffect(() => {
    if (slides.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timerRef.current);
  }, [slides.length]);

  const slide = slides[current];

  return (
    <div className="mp-hero">
      {/* Background image */}
      <div
        className="mp-hero-bg"
        style={slide.image ? { backgroundImage: `url(${slide.image})` } : {}}
      />
      <div className="mp-hero-overlay" />

      {/* Content */}
      <div className="mp-hero-content">
        {slide.badge && (
          <span className="mp-hero-badge">{slide.badge}</span>
        )}
        <h2 className="mp-hero-title">{slide.title}</h2>
        <p className="mp-hero-sub">{slide.subtitle}</p>

        {slide.price && (
          <div className="mp-hero-price-row">
            <span className="mp-hero-price">{slide.price}</span>
            {slide.discount >= 10 && (
              <span className="mp-hero-discount">-{slide.discount}% OFF</span>
            )}
          </div>
        )}

        <div className="mp-hero-actions">
          <button
            className="mp-hero-btn-primary"
            onClick={() => slide.slug && slide.id !== "s1" && slide.id !== "s2"
              ? onShop(slide.slug)
              : onShop(null)
            }
          >
            Shop Now
          </button>
          {user && (
            <button className="mp-hero-btn-secondary" onClick={onPost}>
              + Post Ad
            </button>
          )}
        </div>
      </div>

      {/* Dots */}
      {slides.length > 1 && (
        <div className="mp-hero-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              className={`mp-hero-dot ${i === current ? "mp-hero-dot--active" : ""}`}
              onClick={() => { setCurrent(i); clearInterval(timerRef.current); }}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   TRENDING SECTION — horizontal scroll with big cards
════════════════════════════════════════════════════════════ */
const TrendingSection = memo(function TrendingSection({ products, onWishlist, wishlist }) {
  const navigate = useNavigate();
  if (!products.length) return null;

  return (
    <div className="mp-section">
      <div className="mp-section-header">
        <div className="mp-section-title-wrap">
          <span className="mp-section-icon">🔥</span>
          <div>
            <h3 className="mp-section-title">Trending Now</h3>
            <p className="mp-section-sub">Most viewed today</p>
          </div>
        </div>
        <button className="mp-section-see-all" onClick={() => navigate("?sort=trending")}>
          See all →
        </button>
      </div>

      <div className="mp-trending-scroll">
        {products.map((p) => {
          const img = getProductImage(p);
          const pct = calcDiscount(p.price, p.original_price);
          const wishlisted = wishlist.has(p.id);

          return (
            <div
              key={p.id}
              className="mp-trending-card"
              onClick={() => navigate(`/shop/${p.slug ?? p.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate(`/shop/${p.slug ?? p.id}`)}
            >
              {/* Image */}
              <div className="mp-trending-img-wrap">
                {img ? (
                  <img src={img} alt={p.name} loading="lazy" className="mp-trending-img" />
                ) : (
                  <div className="mp-trending-placeholder">
                    <TagIcon size={28} />
                  </div>
                )}

                {pct >= 10 && (
                  <span className="mp-trending-discount">-{pct}%</span>
                )}

                <button
                  className={`mp-trending-wish ${wishlisted ? "mp-trending-wish--active" : ""}`}
                  onClick={(e) => { e.stopPropagation(); onWishlist(p.id); }}
                  aria-label={wishlisted ? "Remove" : "Save"}
                >
                  <HeartIcon filled={wishlisted} size={14} />
                </button>
              </div>

              {/* Info */}
              <div className="mp-trending-info">
                <p className="mp-trending-name">{p.name}</p>
                <p className="mp-trending-price">{formatPrice(p.price)}</p>
                {p.view_count > 0 && (
                  <p className="mp-trending-views">
                    <EyeIcon size={11} />
                    {p.view_count > 999 ? `${(p.view_count / 1000).toFixed(1)}k` : p.view_count} views
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   FEATURED SECTION — large cards with gradient overlay
════════════════════════════════════════════════════════════ */
const FeaturedSection = memo(function FeaturedSection({ products }) {
  const navigate = useNavigate();
  if (!products.length) return null;

  return (
    <div className="mp-section">
      <div className="mp-section-header">
        <div className="mp-section-title-wrap">
          <span className="mp-section-icon">⭐</span>
          <div>
            <h3 className="mp-section-title">Featured Picks</h3>
            <p className="mp-section-sub">Hand-picked by our team</p>
          </div>
        </div>
        <button className="mp-section-see-all" onClick={() => navigate("?featured=true")}>
          See all →
        </button>
      </div>

      <div className="mp-featured-grid">
        {/* Large card — first item */}
        {products[0] && (() => {
          const p   = products[0];
          const img = getProductImage(p);
          const pct = calcDiscount(p.price, p.original_price);
          return (
            <div
              className="mp-featured-large"
              onClick={() => navigate(`/shop/${p.slug ?? p.id}`)}
              role="button"
              tabIndex={0}
            >
              {img ? (
                <img src={img} alt={p.name} loading="lazy" />
              ) : (
                <div className="mp-featured-no-img"><TagIcon size={48} /></div>
              )}
              <div className="mp-featured-gradient" />
              <div className="mp-featured-info">
                {pct >= 10 && <span className="mp-feat-badge">-{pct}%</span>}
                <p className="mp-feat-name">{p.name}</p>
                <p className="mp-feat-price">{formatPrice(p.price)}</p>
              </div>
            </div>
          );
        })()}

        {/* Small cards — next 4 items */}
        <div className="mp-featured-smalls">
          {products.slice(1, 5).map((p) => {
            const img = getProductImage(p);
            const pct = calcDiscount(p.price, p.original_price);
            return (
              <div
                key={p.id}
                className="mp-featured-small"
                onClick={() => navigate(`/shop/${p.slug ?? p.id}`)}
                role="button"
                tabIndex={0}
              >
                {img ? (
                  <img src={img} alt={p.name} loading="lazy" />
                ) : (
                  <div className="mp-featured-no-img-sm"><TagIcon size={20} /></div>
                )}
                <div className="mp-featured-gradient" />
                <div className="mp-feat-small-info">
                  {pct >= 10 && <span className="mp-feat-badge-sm">-{pct}%</span>}
                  <p className="mp-feat-small-name">{p.name}</p>
                  <p className="mp-feat-small-price">{formatPrice(p.price)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   CATEGORY QUICK ACCESS
════════════════════════════════════════════════════════════ */
const CategoryGrid = memo(function CategoryGrid({ onSelect, active }) {
  const top = categories.slice(0, 10);

  return (
    <div className="mp-section">
      <div className="mp-section-header">
        <div className="mp-section-title-wrap">
          <span className="mp-section-icon">🛍️</span>
          <div>
            <h3 className="mp-section-title">Browse Categories</h3>
            <p className="mp-section-sub">Find what you're looking for</p>
          </div>
        </div>
      </div>

      <div className="mp-cat-quick-grid">
        {top.map((c) => (
          <button
            key={c.id}
            className={`mp-cat-quick-btn ${active === c.id ? "mp-cat-quick-btn--active" : ""}`}
            onClick={() => onSelect(active === c.id ? "" : c.id)}
          >
            <span className="mp-cat-quick-icon">{c.icon}</span>
            <span className="mp-cat-quick-label">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   DEALS BANNER — promotional strip
════════════════════════════════════════════════════════════ */
const DealsBanner = memo(function DealsBanner({ products, onShop }) {
  const navigate   = useNavigate();
  const discounted = products.filter((p) => calcDiscount(p.price, p.original_price) >= 10).slice(0, 6);
  if (!discounted.length) return null;

  return (
    <div className="mp-section">
      <div className="mp-deals-banner">
        <div className="mp-deals-header">
          <div>
            <h3 className="mp-deals-title">🏷️ Hot Deals</h3>
            <p className="mp-deals-sub">Limited time discounts</p>
          </div>
          <div className="mp-deals-timer">
            <span>Ends soon</span>
          </div>
        </div>

        <div className="mp-deals-scroll">
          {discounted.map((p) => {
            const img = getProductImage(p);
            const pct = calcDiscount(p.price, p.original_price);

            return (
              <div
                key={p.id}
                className="mp-deal-card"
                onClick={() => navigate(`/shop/${p.slug ?? p.id}`)}
                role="button"
                tabIndex={0}
              >
                <div className="mp-deal-img-wrap">
                  {img ? (
                    <img src={img} alt={p.name} loading="lazy" />
                  ) : (
                    <div className="mp-deal-placeholder"><TagIcon size={22} /></div>
                  )}
                  <span className="mp-deal-badge">-{pct}%</span>
                </div>
                <div className="mp-deal-info">
                  <p className="mp-deal-name">{p.name}</p>
                  <div className="mp-deal-prices">
                    <span className="mp-deal-price">{formatPrice(p.price)}</span>
                    <span className="mp-deal-original">{formatPrice(p.original_price)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   NEW ARRIVALS
════════════════════════════════════════════════════════════ */
const NewArrivals = memo(function NewArrivals({ products, wishlist, onWishlist }) {
  const navigate = useNavigate();
  if (!products.length) return null;

  return (
    <div className="mp-section">
      <div className="mp-section-header">
        <div className="mp-section-title-wrap">
          <span className="mp-section-icon">✨</span>
          <div>
            <h3 className="mp-section-title">New Arrivals</h3>
            <p className="mp-section-sub">Just listed today</p>
          </div>
        </div>
      </div>

      <div className="mp-arrivals-scroll">
        {products.slice(0, 8).map((p) => {
          const img        = getProductImage(p);
          const wishlisted = wishlist.has(p.id);
          const pct        = calcDiscount(p.price, p.original_price);

          return (
            <div
              key={p.id}
              className="mp-arrival-card"
              onClick={() => navigate(`/shop/${p.slug ?? p.id}`)}
              role="button"
              tabIndex={0}
            >
              <div className="mp-arrival-img-wrap">
                {img ? (
                  <img src={img} alt={p.name} loading="lazy" />
                ) : (
                  <div className="mp-arrival-placeholder"><TagIcon size={22} /></div>
                )}
                {pct >= 10 && <span className="mp-arrival-discount">-{pct}%</span>}
                <button
                  className={`mp-arrival-wish ${wishlisted ? "mp-arrival-wish--active" : ""}`}
                  onClick={(e) => { e.stopPropagation(); onWishlist(p.id); }}
                  aria-label={wishlisted ? "Remove" : "Save"}
                >
                  <HeartIcon filled={wishlisted} size={13} />
                </button>
              </div>
              <div className="mp-arrival-info">
                {p.seller_name && (
                  <p className="mp-arrival-seller">by {p.seller_name}</p>
                )}
                <p className="mp-arrival-name">{p.name}</p>
                <p className="mp-arrival-price">{formatPrice(p.price)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════ */
export default function MinimartPage({ user }) {
  const navigate    = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { items: wishlist, toggle: toggleWishlist } = useWishlist();
  const screenW = useScreenWidth();

  /* ── URL-synced state ── */
  const [category, setCategory] = useState(searchParams.get("cat")  || "");
  const [sort,     setSort]     = useState(searchParams.get("sort") || "newest");
  const [search,   setSearch]   = useState(searchParams.get("q")    || "");
  const [minPrice, setMinPrice] = useState(searchParams.get("min")  || "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("max")  || "");

  /* ── UI state ── */
  const defaultView = screenW >= 768 ? "grid3" : "grid2";
  const [viewMode,   setViewMode]   = useState(defaultView);
  const [showFilter, setShowFilter] = useState(false);
  const [showSort,   setShowSort]   = useState(false);

  /* ── Data state ── */
  const [products,    setProducts]    = useState([]);
  const [featured,    setFeatured]    = useState([]);
  const [trending,    setTrending]    = useState([]);
  const [newest,      setNewest]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error,       setError]       = useState(null);
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(true);
  const [total,       setTotal]       = useState(0);

  /* ── Dynamic sort flags ── */
  const [dynamicFlags, setDynamicFlags] = useState({
    hasTrending:  false,
    hasFeatured:  false,
    hasSponsored: false,
  });

  const loaderRef = useRef(null);
  const sortRef   = useRef(null);
  const searchRef = useRef(null);
  const debouncedSearch = useDebounce(search, 400);

  /* ── Is homepage (no filters active) ── */
  const isHomepage = !debouncedSearch && !category && !minPrice && !maxPrice;

  const sortOptions = useMemo(
    () => buildSortOptions(dynamicFlags),
    [dynamicFlags]
  );

  /* ── Sync state → URL ── */
  useEffect(() => {
    const p = {};
    if (category)                  p.cat  = category;
    if (sort && sort !== "newest") p.sort = sort;
    if (debouncedSearch)           p.q    = debouncedSearch;
    if (minPrice)                  p.min  = minPrice;
    if (maxPrice)                  p.max  = maxPrice;
    setSearchParams(p, { replace: true });
  }, [category, sort, debouncedSearch, minPrice, maxPrice, setSearchParams]);

  /* ── Reset on filter change ── */
  useEffect(() => {
    setPage(1);
    setProducts([]);
    setHasMore(true);
    setTotal(0);
  }, [category, sort, debouncedSearch, minPrice, maxPrice]);

  /* ── Fetch main products ── */
  useEffect(() => {
    let cancelled = false;
    const isFirst = page === 1;

    if (isFirst) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    const params = {
      limit:  PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      sort,
      ...(category        && { category }),
      ...(debouncedSearch && { search: debouncedSearch }),
      ...(minPrice        && { minPrice }),
      ...(maxPrice        && { maxPrice }),
    };

    axios
      .get(API_URL, { params, timeout: 12000 })
      .then(({ data }) => {
        if (cancelled) return;
        const incoming   = data?.data?.products          ?? data?.products ?? [];
        const totalCount = data?.data?.pagination?.total ?? data?.total    ?? 0;
        setProducts((prev) => isFirst ? incoming : [...prev, ...incoming]);
        setTotal(totalCount);
        setHasMore(incoming.length === PAGE_SIZE);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[Minimart]", err.message);
        setError("Could not load products. Check your connection.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setLoadingMore(false);
      });

    return () => { cancelled = true; };
  }, [page, category, sort, debouncedSearch, minPrice, maxPrice]);

  /* ── Fetch homepage sections (once) ── */
  useEffect(() => {
    /* Featured */
    axios.get(API_URL, { params: { featured: "true", limit: 6, sort: "newest" }, timeout: 8000 })
      .then(({ data }) => {
        const items = data?.data?.products ?? data?.products ?? [];
        setFeatured(items);
        if (items.length) setDynamicFlags((f) => ({ ...f, hasFeatured: true }));
      }).catch(() => {});

    /* Trending */
    axios.get(API_URL, { params: { trending: "true", limit: 10, sort: "views" }, timeout: 8000 })
      .then(({ data }) => {
        const items = data?.data?.products ?? data?.products ?? [];
        setTrending(items);
        if (items.length) setDynamicFlags((f) => ({ ...f, hasTrending: true }));
      }).catch(() => {});

    /* Newest */
    axios.get(API_URL, { params: { limit: 8, sort: "newest" }, timeout: 8000 })
      .then(({ data }) => {
        const items = data?.data?.products ?? data?.products ?? [];
        setNewest(items);
      }).catch(() => {});

    /* Sponsored */
    axios.get(API_URL, { params: { sponsored: "true", limit: 1 }, timeout: 5000 })
      .then(({ data }) => {
        const items = data?.data?.products ?? data?.products ?? [];
        if (items.length) setDynamicFlags((f) => ({ ...f, hasSponsored: true }));
      }).catch(() => {});
  }, []);

  /* ── Infinite scroll ── */
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading && !loadingMore)
          setPage((p) => p + 1);
      },
      { rootMargin: "200px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, loadingMore]);

  /* ── Close sort on outside click ── */
  useEffect(() => {
    const fn = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target))
        setShowSort(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  /* ── Derived ── */
  const activeFiltersCount = useMemo(
    () => [category, minPrice, maxPrice].filter(Boolean).length,
    [category, minPrice, maxPrice]
  );
  const hasFilters = activeFiltersCount > 0 || !!debouncedSearch;

  const clearFilters = useCallback(() => {
    setCategory(""); setSort("newest"); setSearch("");
    setMinPrice(""); setMaxPrice("");
    searchRef.current?.focus();
  }, []);

  const retry = useCallback(() => {
    setPage(1); setProducts([]); setHasMore(true); setError(null);
  }, []);

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */
  return (
    <>
      <div className="mp-page">

        <TopBar
          user={user}
          search={search}
          onSearch={setSearch}
          category={category}
          onCategory={setCategory}
          activeFiltersCount={activeFiltersCount}
          onOpenFilter={() => setShowFilter(true)}
          searchRef={searchRef}
        />

        {/* ── HOMEPAGE LAYOUT ── */}
        {isHomepage && !loading && (
          <>
            <HeroBanner
              featured={[...trending.slice(0, 1), ...featured.slice(0, 2)]}
              onShop={(slug) => slug ? navigate(`/shop/${slug}`) : null}
              onPost={() => navigate(user ? "/minimart/post-ad" : "/auth")}
              user={user}
            />

            <CategoryGrid
              active={category}
              onSelect={setCategory}
            />

            {trending.length > 0 && (
              <TrendingSection
                products={trending}
                wishlist={wishlist}
                onWishlist={toggleWishlist}
              />
            )}

            {featured.length > 0 && (
              <FeaturedSection products={featured} />
            )}

            <DealsBanner
              products={[...trending, ...featured, ...newest]}
              onShop={(slug) => navigate(`/shop/${slug}`)}
            />

            {newest.length > 0 && (
              <NewArrivals
                products={newest}
                wishlist={wishlist}
                onWishlist={toggleWishlist}
              />
            )}

            {/* Divider before all products */}
            <div className="mp-section">
              <div className="mp-section-header">
                <div className="mp-section-title-wrap">
                  <span className="mp-section-icon">🛒</span>
                  <div>
                    <h3 className="mp-section-title">All Products</h3>
                    <p className="mp-section-sub">
                      {total > 0 ? `${total.toLocaleString()} listings available` : "Browse everything"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── SUB BAR (always visible) ── */}
        <SubBar
          total={total}
          loading={loading && page === 1}
          search={debouncedSearch}
          sort={sort}
          sortOptions={sortOptions}
          showSort={showSort}
          sortRef={sortRef}
          onToggleSort={() => setShowSort((x) => !x)}
          onSort={(v) => { setSort(v); setShowSort(false); }}
          viewMode={viewMode}
          onViewMode={setViewMode}
        />

        {/* Active filter pills */}
        {hasFilters && (
          <div className="mp-active-filters" role="list" aria-label="Active filters">
            {debouncedSearch && (
              <span className="mp-filter-pill" role="listitem">
                🔍 "{debouncedSearch}"
                <button onClick={() => setSearch("")} aria-label="Remove search">
                  <CloseIcon size={11} />
                </button>
              </span>
            )}
            {category && (
              <span className="mp-filter-pill" role="listitem">
                {categories.find((c) => c.id === category)?.icon}{" "}
                {categories.find((c) => c.id === category)?.name}
                <button onClick={() => setCategory("")} aria-label="Remove category">
                  <CloseIcon size={11} />
                </button>
              </span>
            )}
            {(minPrice || maxPrice) && (
              <span className="mp-filter-pill" role="listitem">
                ₦{minPrice || "0"} – {maxPrice ? `₦${maxPrice}` : "∞"}
                <button onClick={() => { setMinPrice(""); setMaxPrice(""); }} aria-label="Remove price">
                  <CloseIcon size={11} />
                </button>
              </span>
            )}
            <button className="mp-clear-all" onClick={clearFilters}>Clear all</button>
          </div>
        )}

        {/* Product grid */}
        <main className={`mp-grid mp-grid--${viewMode}`} role="main" aria-label="Products">
          {error && (
            <div className="mp-error" role="alert">
              <p>{error}</p>
              <button className="mp-retry" onClick={retry}>Try Again</button>
            </div>
          )}

          {!error && loading && page === 1 &&
            Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
          }

          {!error && !loading && products.length === 0 && (
            <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
          )}

          {!error && products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              wishlisted={wishlist.has(p.id)}
              onWishlist={toggleWishlist}
              viewMode={viewMode}
            />
          ))}

          {!error && (
            loadingMore ? (
              <div className="mp-load-more-row"><div className="mp-spinner" /></div>
            ) : hasMore ? (
              <div ref={loaderRef} aria-hidden="true" style={{ height: 1 }} />
            ) : products.length > 0 ? (
              <div className="mp-end-msg">✨ You've seen all {total.toLocaleString()} products</div>
            ) : null
          )}
        </main>
      </div>

      {showFilter && (
        <FilterDrawer
          minPrice={minPrice}   setMinPrice={setMinPrice}
          maxPrice={maxPrice}   setMaxPrice={setMaxPrice}
          sortOptions={sortOptions}
          sort={sort}           setSort={setSort}
          onClear={() => { clearFilters(); setShowFilter(false); }}
          onApply={() => setShowFilter(false)}
        />
      )}

      <FAB user={user} />
    </>
  );
}