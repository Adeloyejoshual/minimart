/**
 * src/pages/CategoryCatalog.jsx
 *
 * Routes:
 *   /catalog
 *   /loemart/explore | /new | /trending | /deals
 *
 * Query:
 *   ?category=<UUID|slug|alias>
 *   ?campaign=December%20Deals
 *   ?q=iphone
 *   ?sort=bestselling|newest|deal|price_asc|price_desc|trending
 *   ?deal=true
 */
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  useSearchParams,
  useNavigate,
  useLocation,
} from "react-router-dom";
import axios from "axios";
import {
  FiChevronLeft,
  FiSearch,
  FiFilter,
  FiCheck,
  FiHeart,
  FiX,
} from "react-icons/fi";

/* ── HELPERS & CATEGORIES ── */
import {
  API,
  primaryImg,
  getRecentlyViewed,
  DEFAULT_LIMIT,
} from "../loemart/mobile/mobileHelpers";
import CATEGORIES from "../config/categories";

import "../styles/CategoryCatalog.css";

const WISH_KEY = "loemart-wishlist";
const PAGE_SIZE = DEFAULT_LIMIT || 20;

/* ════════════════════════════════════════════════════════════
   UTILS
════════════════════════════════════════════════════════════ */
const parseNum = (val) => {
  if (val == null || val === "") return 0;
  const n = Number(String(val).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const fmtPrice = (val) =>
  val > 0 ? `₦${Number(val).toLocaleString("en-NG")}` : "₦0";

const titleCase = (s) =>
  String(s || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const isInStock = (item) => {
  if (!item) return false;
  if (item.is_sold_out === true || item.sold_out === true) return false;
  if (item.status === "out_of_stock" || item.status === "sold_out") return false;
  if (item.in_stock === false) return false;
  if (item.stock != null && item.stock !== "" && Number(item.stock) <= 0) return false;
  return true;
};

const productId = (p) =>
  String(p?.id || p?.product_id || p?._id || "").trim();

const StarIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b" aria-hidden>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.278.91 8.26 12 2z" />
  </svg>
);

/* ════════════════════════════════════════════════════════════
   ROUTE & CATEGORY MAPPING
════════════════════════════════════════════════════════════ */
const ROUTE_MAP = {
  "/loemart/new": { title: "New Arrivals", sort: "newest" },
  "/loemart/trending": { title: "Trending Now", sort: "trending" },
  "/loemart/deals": { title: "Top Deals", sort: "deal", deal: true },
  "/loemart/explore": { title: "Explore", sort: "newest" },
  "/catalog": { title: "All Products", sort: "bestselling" },
};

const SORT_OPTIONS = [
  { val: "bestselling", label: "Top Sales" },
  { val: "newest", label: "Newest Arrivals" },
  { val: "trending", label: "Trending" },
  { val: "deal", label: "Biggest Discounts" },
  { val: "price_asc", label: "Price: Low to High" },
  { val: "price_desc", label: "Price: High to Low" },
];

/* Official UUIDs from src/config/categories.js */
const QUICK_CATS = [
  { id: "all", label: "All", path: "/catalog" },
  { id: "deals", label: "🔥 Deals", path: "/catalog?deal=true&sort=deal" },
  {
    id: "phones",
    catId: "102055d1-180a-4b8f-a39b-3b20a4838e90",
    slug: "phones-tablets",
    label: "Phones",
    path: "/catalog?category=102055d1-180a-4b8f-a39b-3b20a4838e90",
  },
  {
    id: "fashion",
    catId: "8ba64fb7-33a6-415e-a895-38d778a49075",
    slug: "fashion",
    label: "Fashion",
    path: "/catalog?category=8ba64fb7-33a6-415e-a895-38d778a49075",
  },
  {
    id: "watches",
    catId: "e5a9f2c1-8b4d-4e7a-a3c6-5b9d1e2f8a4c",
    slug: "watches-jewelry",
    label: "Watches",
    path: "/catalog?category=e5a9f2c1-8b4d-4e7a-a3c6-5b9d1e2f8a4c",
  },
  {
    id: "home",
    catId: "4bb82894-f6aa-478a-a3c6-5b9d1e2f8a4c",
    slug: "home-furniture-appliances",
    label: "Home",
    path: "/catalog?category=4bb82894-f6aa-478a-a3c6-5b9d1e2f8a4c",
  },
];

/* ════════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════════ */
export default function CategoryCatalog() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const sheetRef = useRef(null);

  const catParam = searchParams.get("category") || "";
  const campaignParam = searchParams.get("campaign") || "";
  const qParam = searchParams.get("q") || searchParams.get("search") || "";
  const sortParam = searchParams.get("sort") || "";
  const dealParam = searchParams.get("deal") || "";
  const brandParam = searchParams.get("brand") || "";

  const routeConfig = ROUTE_MAP[location.pathname] || ROUTE_MAP["/catalog"];
  const activeSort = sortParam || routeConfig.sort || "newest";
  const isDealOnly = dealParam === "true" || routeConfig.deal === true;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [showSort, setShowSort] = useState(false);

  const [wishlist, setWishlist] = useState(() => {
    try {
      const raw = localStorage.getItem(WISH_KEY) || localStorage.getItem("mm_wishlist") || "[]";
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr.map(String) : []);
    } catch {
      return new Set();
    }
  });

  /* Match category param (UUID, slug, or alias like "phones") to database category object */
  const matchedCategory = useMemo(() => {
    if (!catParam) return null;
    const lower = catParam.toLowerCase().trim();
    return CATEGORIES.find(
      (c) =>
        c.id === catParam ||
        c.slug === lower ||
        c.name.toLowerCase() === lower ||
        (lower === "phones" && c.slug === "phones-tablets") ||
        (lower === "watches" && c.slug === "watches-jewelry") ||
        (lower === "home" && c.slug === "home-furniture-appliances")
    );
  }, [catParam]);

  const pageTitle = useMemo(() => {
    if (campaignParam) return campaignParam;
    if (qParam) return `“${qParam}”`;
    if (brandParam) return titleCase(brandParam);
    if (matchedCategory) return matchedCategory.name;
    if (catParam) return titleCase(catParam);
    return routeConfig.title;
  }, [campaignParam, qParam, brandParam, matchedCategory, catParam, routeConfig.title]);

  /* ── Fetch Products ── */
  const fetchProducts = useCallback(
    async (newOffset = 0, append = false) => {
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }

      try {
        const params = {
          limit: PAGE_SIZE,
          offset: newOffset,
          sort: activeSort,
        };

        const targetCategory = matchedCategory ? matchedCategory.id : catParam;

        if (targetCategory) params.category = targetCategory;
        if (campaignParam) params.campaign = campaignParam;
        if (qParam) params.search = qParam;
        if (brandParam) params.brand = brandParam;
        if (isDealOnly) params.deal = "true";

        let { data } = await axios.get(`${API}/products`, {
          params,
          timeout: 15000,
        });

        let rows = (data?.data?.products || data?.products || []).filter(isInStock);
        let totalCount =
          data?.data?.pagination?.total ??
          data?.pagination?.total ??
          rows.length;

        /* FALLBACK: If category lookup returned 0 items, search by term */
        if (rows.length === 0 && catParam && !qParam && !append) {
          const fallbackParams = { ...params };
          delete fallbackParams.category;
          fallbackParams.search = matchedCategory
            ? matchedCategory.slug.replace(/-/g, " ")
            : catParam;

          try {
            const { data: fbData } = await axios.get(`${API}/products`, {
              params: fallbackParams,
              timeout: 15000,
            });

            const fbRows = (fbData?.data?.products || fbData?.products || []).filter(isInStock);
            if (fbRows.length > 0) {
              rows = fbRows;
              totalCount =
                fbData?.data?.pagination?.total ??
                fbData?.pagination?.total ??
                fbRows.length;
            }
          } catch {
            /* ignore fallback failure */
          }
        }

        setProducts((prev) => (append ? [...prev, ...rows] : rows));
        setTotal(Number(totalCount) || 0);
        setOffset(newOffset);
      } catch (err) {
        console.error("[CategoryCatalog]", err?.message || err);
        if (!append) {
          setProducts([]);
          setError("load_failed");
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeSort, catParam, matchedCategory, campaignParam, qParam, brandParam, isDealOnly]
  );

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchProducts(0, false);
  }, [fetchProducts]);

  /* Sheet body lock */
  useEffect(() => {
    if (!showSort) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showSort]);

  const hasMore = offset + PAGE_SIZE < total;

  const toggleWish = useCallback((id, e) => {
    e.stopPropagation();
    const sid = String(id);
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      try {
        localStorage.setItem(WISH_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const setSort = (val) => {
    const next = new URLSearchParams(searchParams);
    next.set("sort", val);
    setSearchParams(next, { replace: true });
    setShowSort(false);
  };

  const goProduct = (p) => {
    navigate(`/shop/${p.slug || productId(p)}`);
  };

  /* Related from local history */
  const related = useMemo(() => {
    try {
      const recent = getRecentlyViewed?.() || [];
      const ids = new Set(products.map(productId));
      return recent
        .filter((r) => r?.id && !ids.has(String(r.id)))
        .slice(0, 8);
    } catch {
      return [];
    }
  }, [products]);

  const isQuickActive = (item) => {
    if (item.id === "all") {
      return !catParam && !isDealOnly && !campaignParam && !qParam;
    }
    if (item.id === "deals") return isDealOnly;
    if (matchedCategory) {
      return matchedCategory.id === item.catId || matchedCategory.slug === item.slug;
    }
    return catParam.toLowerCase() === item.id.toLowerCase();
  };

  return (
    <div className="cat-page">
      {/* Header */}
      <header className="cat-header">
        <button
          type="button"
          className="cat-btn-icon"
          onClick={() => {
            if (window.history.length > 2) navigate(-1);
            else navigate("/");
          }}
          aria-label="Back"
        >
          <FiChevronLeft size={24} color="#1a1a1a" />
        </button>

        <button
          type="button"
          className="cat-search-bar"
          onClick={() => navigate("/loemart/search")}
        >
          <FiSearch size={16} color="#888" aria-hidden />
          <span>{qParam || "Search products, brands..."}</span>
        </button>
      </header>

      {/* Quick filters */}
      <div className="cat-quick-filters" role="tablist" aria-label="Quick filters">
        {QUICK_CATS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={isQuickActive(c)}
            className={`cat-q-pill${isQuickActive(c) ? " active" : ""}`}
            onClick={() => navigate(c.path)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Title */}
      <div className="cat-title-row">
        <h1 className="cat-title">{pageTitle}</h1>
        <span className="cat-count">
          {loading && products.length === 0 ? "…" : `${total} items`}
        </span>
      </div>

      {/* Grid */}
      <main className="cat-main">
        {loading && products.length === 0 ? (
          <div className="cat-grid" aria-hidden>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="cat-skel-card" />
            ))}
          </div>
        ) : error && products.length === 0 ? (
          <div className="cat-empty">
            <div className="cat-empty-icon">⚠️</div>
            <h3>Couldn’t load products</h3>
            <p>Check your connection and try again.</p>
            <button
              type="button"
              className="cat-btn-primary"
              onClick={() => fetchProducts(0, false)}
            >
              Retry
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="cat-empty">
            <div className="cat-empty-icon">📦</div>
            <h3>No products found</h3>
            <p>
              {isDealOnly
                ? "No discounted listings right now."
                : "Try another category or clear filters."}
            </p>
            <button
              type="button"
              className="cat-btn-primary"
              onClick={() => navigate("/catalog")}
            >
              View all products
            </button>
          </div>
        ) : (
          <>
            <div className="cat-grid">
              {products.map((p) => {
                const id = productId(p);
                const price = parseNum(p.price ?? p.selling_price ?? p.sale_price);
                const oldPrice = parseNum(
                  p.original_price ??
                    p.originalPrice ??
                    p.compare_at_price ??
                    p.compare_price ??
                    p.old_price
                );
                const discount =
                  oldPrice > price && price > 0
                    ? Math.round(((oldPrice - price) / oldPrice) * 100)
                    : 0;
                const img = primaryImg?.(p.images, p) || p.cover_image || p.image;
                const hasVariants = Boolean(
                  (Array.isArray(p.variants) && p.variants.length > 0) ||
                    p.has_variants ||
                    (Array.isArray(p.options) && p.options.length > 0)
                );
                const isWished = wishlist.has(id);
                const rating = Number(p.rating || 0);
                const sold = Number(p.sold_count ?? p.sold ?? 0);

                return (
                  <article
                    key={id || p.slug}
                    className="cat-card"
                    onClick={() => goProduct(p)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") goProduct(p);
                    }}
                    role="link"
                    tabIndex={0}
                  >
                    <div className="cat-card__img-box">
                      {discount > 0 && (
                        <span className="cat-card__badge">-{discount}%</span>
                      )}
                      {p.badge && !discount ? (
                        <span className="cat-card__badge cat-card__badge--soft">
                          {p.badge}
                        </span>
                      ) : null}

                      {img ? (
                        <img src={img} alt={p.name || p.title || ""} loading="lazy" />
                      ) : (
                        <div className="cat-card__img-ph">📦</div>
                      )}

                      <button
                        type="button"
                        className="cat-card__wish"
                        onClick={(e) => toggleWish(id, e)}
                        aria-label={isWished ? "Remove from saved" : "Save"}
                      >
                        <FiHeart
                          size={14}
                          fill={isWished ? "#ff6000" : "none"}
                          color={isWished ? "#ff6000" : "#666"}
                        />
                      </button>
                    </div>

                    <div className="cat-card__body">
                      <h3 className="cat-card__title">{p.name || p.title}</h3>

                      <div className="cat-card__price-row">
                        <span className="cat-card__price">
                          {hasVariants && (
                            <span className="cat-card__from">From </span>
                          )}
                          {fmtPrice(price)}
                        </span>
                        {oldPrice > price && (
                          <span className="cat-card__old">{fmtPrice(oldPrice)}</span>
                        )}
                      </div>

                      <div className="cat-card__meta">
                        {rating > 0 && (
                          <span className="cat-card__rating">
                            <StarIcon /> {rating.toFixed(1)}
                          </span>
                        )}
                        {sold > 0 && (
                          <span className="cat-card__sold">
                            {sold >= 1000
                              ? `${(sold / 1000).toFixed(1)}k sold`
                              : `${sold} sold`}
                          </span>
                        )}
                      </div>

                      {hasVariants && (
                        <div className="cat-card__variants">
                          <div className="cat-var-dots" aria-hidden>
                            <span className="cat-var-dot c1" />
                            <span className="cat-var-dot c2" />
                            <span className="cat-var-dot c3" />
                          </div>
                          <span className="cat-var-text">+ Options</span>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {!loading && hasMore && (
              <div className="cat-load-more">
                <button
                  type="button"
                  className="cat-btn-outline"
                  onClick={() => fetchProducts(offset + PAGE_SIZE, true)}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading…" : "Load more products"}
                </button>
              </div>
            )}
          </>
        )}

        {/* Related from history */}
        {related.length > 0 && (
          <section className="cat-related" aria-label="Recently viewed">
            <h2 className="cat-related__title">Recently viewed</h2>
            <div className="cat-related__scroll">
              {related.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="cat-related__card"
                  onClick={() => navigate(`/shop/${r.slug || r.id}`)}
                >
                  <div className="cat-related__img">
                    {r.image ? (
                      <img src={r.image} alt="" loading="lazy" />
                    ) : (
                      <span>📦</span>
                    )}
                  </div>
                  <span className="cat-related__name">
                    {r.name || "Product"}
                  </span>
                  <span className="cat-related__price">
                    {fmtPrice(parseNum(r.price))}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* FAB */}
      <div className="cat-floating-action">
        <button
          type="button"
          className="cat-fab-btn"
          onClick={() => setShowSort(true)}
        >
          <FiFilter size={16} aria-hidden />
          Sort &amp; Filter
        </button>
      </div>

      {/* Sort sheet */}
      {showSort && (
        <div
          className="cat-sheet-overlay"
          onClick={() => setShowSort(false)}
          role="presentation"
        >
          <div
            className="cat-sheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Sort products"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cat-sheet-head">
              <h3>Sort by</h3>
              <button
                type="button"
                className="cat-sheet-close"
                onClick={() => setShowSort(false)}
                aria-label="Close"
              >
                <FiX size={20} />
              </button>
            </div>
            <div className="cat-sheet-body">
              {SORT_OPTIONS.map((s) => (
                <button
                  key={s.val}
                  type="button"
                  className={`cat-sheet-row${
                    activeSort === s.val ? " active" : ""
                  }`}
                  onClick={() => setSort(s.val)}
                >
                  {s.label}
                  {activeSort === s.val ? <FiCheck color="#ff6000" /> : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}