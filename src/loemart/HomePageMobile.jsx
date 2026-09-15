import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

/* ONE style file only */
import "../styles/Minimart.css";

/* Core mobile chrome */
import MobileTopBar from "./mobile/MobileTopBar";
import MobileHero from "./mobile/MobileHero";
import MobileFooter from "./mobile/MobileFooter";
import { SearchSheet, FilterSheet, fireCartToast } from "./mobile/MobileSheets";

import Footer from "../components/Footer";
import FloatingCartButton from "../components/FloatingCartButton";

import {
  API,
  WISH_KEY,
  SEARCH_HISTORY_KEY,
  DEFAULT_LIMIT,
  normalize,
  addToCart,
  getCartCount,
  getRecentlyViewed,
  getSearchHistory,
  addToSearchHistory,
} from "./mobile/mobileHelpers";

const CART_URL = `${API}/cart`;
const CART_ITEMS_URL = `${API}/cart/items`;

/* ── helpers ── */
function priceOf(item) {
  if (!item) return 0;
  const n = Number(item.price ?? item.sale_price ?? item.selling_price ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function origOf(item) {
  if (!item) return 0;
  const n = Number(item.original_price ?? item.compare_price ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function discOf(item) {
  const p = priceOf(item);
  const op = origOf(item);
  if (!(op > p && p > 0)) return 0;
  return Math.round(((op - p) / op) * 100);
}
function imgOf(item) {
  if (!item) return "";
  return item.image || item.image_url || item.thumbnail || "";
}
const formatPrice = (num) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(num);

function smartTruncate(text, maxChars = 45) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  let cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > 0) cut = cut.slice(0, lastSpace);
  return cut.trim() + "…";
}

/* ── cards (same class names as MarketDetail) ── */
const QuickAddBtn = ({ item, onAdd, addingIds, addedIds }) => {
  const isAdding = addingIds.has(item.id);
  const isAdded = addedIds.has(item.id);
  return (
    <button
      type="button"
      className={`mm-quick-add${isAdded ? " mm-quick-add--done" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onAdd(item);
      }}
      disabled={isAdding}
      aria-label="Add to cart"
    >
      {isAdding ? "…" : isAdded ? "✓" : "+"}
    </button>
  );
};

const HomeHorizontalCard = memo(function HomeHorizontalCard({
  item, onClick, onAdd, addingIds, addedIds,
}) {
  const price = priceOf(item);
  const original = origOf(item);
  const d = discOf(item);
  const title = smartTruncate(item.name || item.title, 40);

  return (
    <div className="mdp-rail-hcard" onClick={() => onClick(item)} role="button" tabIndex={0}>
      <div className="mdp-rail-hcard__media">
        {imgOf(item) ? (
          <img src={imgOf(item)} alt="" loading="lazy" />
        ) : (
          <div className="mdp-rail-hcard__ph">📦</div>
        )}
        {d > 0 && <span className="mdp-rail-hcard__badge">-{d}%</span>}
      </div>
      <div className="mdp-rail-hcard__body">
        <p className="mdp-rail-hcard__name">{title}</p>
        <div className="mm-card-bottom">
          <div className="mm-prices-stack">
            <span className="mdp-rail-hcard__price">{formatPrice(price)}</span>
            {original > price && (
              <span className="mdp-rail-hcard__orig">{formatPrice(original)}</span>
            )}
          </div>
          <QuickAddBtn item={item} onAdd={onAdd} addingIds={addingIds} addedIds={addedIds} />
        </div>
      </div>
    </div>
  );
});

const HomeMasonryCard = memo(function HomeMasonryCard({
  item, onClick, onAdd, addingIds, addedIds,
}) {
  const price = priceOf(item);
  const original = origOf(item);
  const d = discOf(item);
  const title = smartTruncate(item.name || item.title, 55);

  const h = useMemo(() => {
    const id = String(item.id || "x");
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i) * (i + 1)) % 3;
    return hash === 0 ? 140 : hash === 1 ? 180 : 220;
  }, [item.id]);

  return (
    <div className="pr-masonry-card" onClick={() => onClick(item)} role="button" tabIndex={0}>
      <div className="pr-masonry-card__media" style={{ height: h }}>
        {imgOf(item) ? (
          <img src={imgOf(item)} alt="" loading="lazy" className="pr-masonry-card__img" />
        ) : (
          <div className="pr-masonry-card__ph">📦</div>
        )}
        {d > 0 && <span className="pr-masonry-card__badge">-{d}%</span>}
      </div>
      <div className="pr-masonry-card__body">
        <p className="pr-masonry-card__name">{title}</p>
        <div className="mm-card-bottom">
          <div className="mm-prices-stack">
            <span className="pr-masonry-card__price">{formatPrice(price)}</span>
            {original > price && (
              <span className="pr-masonry-card__orig">{formatPrice(original)}</span>
            )}
          </div>
          <QuickAddBtn item={item} onAdd={onAdd} addingIds={addingIds} addedIds={addedIds} />
        </div>
      </div>
    </div>
  );
});

const HomeHorizontalRail = memo(function HomeHorizontalRail({
  title, items, onClick, onAdd, addingIds, addedIds,
}) {
  if (!items?.length) return null;
  return (
    <section className="mdp-psec">
      <div className="mdp-psec__head">
        <h3 className="mdp-psec__title">{title}</h3>
      </div>
      <div className="mdp-rail-hscroll">
        {items.map((item) => (
          <HomeHorizontalCard
            key={item.id}
            item={item}
            onClick={onClick}
            onAdd={onAdd}
            addingIds={addingIds}
            addedIds={addedIds}
          />
        ))}
      </div>
    </section>
  );
});

/* ── page ── */
export default function HomePageMobile({ user }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isFirstMount = useRef(true);

  const queryParam = searchParams.get("q") ?? "";
  const catParam = searchParams.get("category") ?? "all";
  const sortParam = searchParams.get("sort") ?? "newest";
  const minParam = searchParams.get("minPrice") ?? "";
  const maxParam = searchParams.get("maxPrice") ?? "";

  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState(getSearchHistory);
  const [activeCategory, setActiveCategory] = useState(catParam);
  const [activeSort, setActiveSort] = useState(sortParam);
  const [minPrice, setMinPrice] = useState(minParam);
  const [maxPrice, setMaxPrice] = useState(maxParam);
  const [showFilters, setShowFilters] = useState(false);

  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [offset, setOffset] = useState(0);

  const [featured, setFeatured] = useState([]);
  const [flashDeals, setFlashDeals] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [recentlyViewed] = useState(getRecentlyViewed);

  const [cartCount, setCartCount] = useState(0);
  const [cartAnimating, setCartAnimating] = useState(false);
  const [addingIds, setAddingIds] = useState(new Set());
  const [addedIds, setAddedIds] = useState(new Set());

  const triggerCartAnimation = useCallback(() => {
    setCartAnimating(true);
    setTimeout(() => setCartAnimating(false), 300);
  }, []);

  useEffect(() => {
    setSearchQuery(queryParam);
    setActiveCategory(catParam);
    setActiveSort(sortParam);
    setMinPrice(minParam);
    setMaxPrice(maxParam);
  }, [queryParam, catParam, sortParam, minParam, maxParam]);

  const syncCart = useCallback(async () => {
    const token = localStorage.getItem("marketplace_token");
    if (user && token) {
      try {
        const res = await axios.get(CART_URL, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000,
        });
        setCartCount(res.data?.data?.total_qty ?? res.data?.data?.item_count ?? 0);
        triggerCartAnimation();
      } catch { /* ignore */ }
    } else {
      setCartCount(getCartCount());
      triggerCartAnimation();
    }
  }, [user, triggerCartAnimation]);

  useEffect(() => {
    syncCart();
    window.addEventListener("cart-updated", syncCart);
    window.addEventListener("storage", syncCart);
    return () => {
      window.removeEventListener("cart-updated", syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, [syncCart]);

  const [wishlist, setWishlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem(WISH_KEY) || "[]"); }
    catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem(WISH_KEY, JSON.stringify(wishlist));
  }, [wishlist]);

  const fetchProducts = useCallback(async ({
    query = searchQuery, category = activeCategory, sort = activeSort,
    min = minPrice, max = maxPrice, newOffset = 0, append = false,
  } = {}) => {
    append ? setLoadingMore(true) : setLoading(true);
    setFetchError(null);
    try {
      const params = { limit: DEFAULT_LIMIT, offset: newOffset, sort };
      if (normalize(query)) params.search = normalize(query);
      if (category !== "all") params.category = category;
      if (min && Number(min) > 0) params.minPrice = min;
      if (max && Number(max) > 0) params.maxPrice = max;
      const { data } = await axios.get(`${API}/products`, { params });
      setProducts((prev) => (append ? [...prev, ...(data?.data?.products ?? [])] : (data?.data?.products ?? [])));
      setPagination(data?.data?.pagination ?? null);
      setOffset(newOffset);
    } catch (err) {
      setFetchError(err.response?.data?.message ?? "Failed to load products");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchQuery, activeCategory, activeSort, minPrice, maxPrice]);

  const fetchSections = useCallback(async () => {
    try {
      const [feat, trend, latest] = await Promise.allSettled([
        axios.get(`${API}/products`, { params: { featured: "true", limit: 8, sort: "trending" } }),
        axios.get(`${API}/products`, { params: { trending: "true", limit: 8, sort: "views" } }),
        axios.get(`${API}/products`, { params: { limit: 8, sort: "newest" } }),
      ]);
      if (feat.status === "fulfilled") setFeatured(feat.value.data?.data?.products ?? []);
      if (trend.status === "fulfilled") setFlashDeals(trend.value.data?.data?.products ?? []);
      if (latest.status === "fulfilled") setNewArrivals(latest.value.data?.data?.products ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchSections(); }, [fetchSections]);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      fetchProducts({ newOffset: 0 });
      return;
    }
    fetchProducts({ newOffset: 0, append: false });
  }, [activeCategory, activeSort, fetchProducts]);

  const handleSearchSelect = useCallback((q) => {
    setSearchQuery(q);
    setSearchOpen(false);
    addToSearchHistory(q);
    setSearchHistory(getSearchHistory());
    setSearchParams(q ? { q } : {});
    fetchProducts({ query: q, newOffset: 0 });
  }, [fetchProducts, setSearchParams]);

  const handleCategoryChange = useCallback((id) => {
    setActiveCategory(id);
    setSearchParams((prev) => {
      if (id === "all") prev.delete("category");
      else prev.set("category", id);
      return prev;
    });
    setOffset(0);
  }, [setSearchParams]);

  const handleLoadMore = useCallback(() => {
    fetchProducts({ newOffset: offset + DEFAULT_LIMIT, append: true });
  }, [fetchProducts, offset]);

  const handleApplyFilters = useCallback(() => {
    setSearchParams((prev) => {
      if (minPrice) prev.set("minPrice", minPrice); else prev.delete("minPrice");
      if (maxPrice) prev.set("maxPrice", maxPrice); else prev.delete("maxPrice");
      if (activeSort) prev.set("sort", activeSort); else prev.delete("sort");
      return prev;
    });
    fetchProducts({ min: minPrice, max: maxPrice, sort: activeSort, newOffset: 0 });
    setShowFilters(false);
  }, [fetchProducts, minPrice, maxPrice, activeSort, setSearchParams]);

  const handleResetFilters = useCallback(() => {
    setMinPrice("");
    setMaxPrice("");
    setActiveSort("newest");
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchQuery("");
    setActiveCategory("all");
    setActiveSort("newest");
    setMinPrice("");
    setMaxPrice("");
    setSearchParams({});
    fetchProducts({ query: "", category: "all", sort: "newest", min: "", max: "", newOffset: 0 });
  }, [fetchProducts, setSearchParams]);

  const handleAddToCart = useCallback(async (product) => {
    if (!product?.id || addingIds.has(product.id)) return;
    setAddingIds((prev) => new Set(prev).add(product.id));
    if (window.navigator?.vibrate) window.navigator.vibrate(10);
    try {
      const token = localStorage.getItem("marketplace_token");
      if (user && token) {
        await axios.post(CART_ITEMS_URL, { product_id: product.id, variant_id: null, qty: 1 }, {
          headers: { Authorization: `Bearer ${token}` }, timeout: 10000,
        });
        await syncCart();
      } else {
        addToCart(product);
        setCartCount(getCartCount());
        triggerCartAnimation();
      }
      window.dispatchEvent(new Event("cart-updated"));
      setAddedIds((prev) => new Set(prev).add(product.id));
      setTimeout(() => setAddedIds((prev) => { const n = new Set(prev); n.delete(product.id); return n; }), 2000);
      fireCartToast(product, navigate);
    } catch {
      toast.error("Could not add item to cart", { duration: 3000 });
    } finally {
      setAddingIds((prev) => { const n = new Set(prev); n.delete(product.id); return n; });
    }
  }, [addingIds, navigate, user, syncCart, triggerCartAnimation]);

  const goPostAd = useCallback(() => navigate(user ? "/minimart/post-ad" : "/auth"), [navigate, user]);
  const openProduct = useCallback((item) => navigate(`/shop/${item.slug || item.id}`), [navigate]);

  const hasMore = pagination ? offset + DEFAULT_LIMIT < pagination.total : false;
  const hasFilters = !!(searchQuery || activeCategory !== "all" || activeSort !== "newest" || minPrice || maxPrice);

  return (
    <div className="mm-page">
      <MobileTopBar
        searchQuery={searchQuery}
        onSearchOpen={() => setSearchOpen(true)}
        onClearSearch={() => {
          setSearchQuery("");
          setSearchParams({});
          fetchProducts({ query: "", newOffset: 0 });
        }}
        activeCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        hasFilters={hasFilters}
        wishCount={wishlist.length}
        onFilterOpen={() => setShowFilters(true)}
        showFilters={showFilters}
      />

      <div className="mm-hero-wrap">
        <MobileHero user={user} cartCount={cartCount} onPostAd={goPostAd} />
      </div>

      {/* Rails — same as MarketDetail */}
      <div className="mm-rails">
        <HomeHorizontalRail title="Flash Deals" items={flashDeals} onClick={openProduct} onAdd={handleAddToCart} addingIds={addingIds} addedIds={addedIds} />
        <HomeHorizontalRail title="Featured Listings" items={featured} onClick={openProduct} onAdd={handleAddToCart} addingIds={addingIds} addedIds={addedIds} />
        <HomeHorizontalRail title="New Arrivals" items={newArrivals} onClick={openProduct} onAdd={handleAddToCart} addingIds={addingIds} addedIds={addedIds} />
        <HomeHorizontalRail title="Recently Viewed" items={recentlyViewed} onClick={openProduct} onAdd={handleAddToCart} addingIds={addingIds} addedIds={addedIds} />
      </div>

      {/* Masonry catalog — same as MarketDetail Recommended */}
      <section className="mdp-psec mdp-psec--recommended">
        <div className="mdp-psec__head mm-catalog-head">
          <div>
            <h3 className="mdp-psec__title">All Products</h3>
            <p className="mm-catalog-sub">Recommended for you</p>
          </div>
          {hasFilters && (
            <button type="button" className="mdp-psec__all" onClick={clearAllFilters}>
              Clear filters
            </button>
          )}
        </div>

        {loading && products.length === 0 ? (
          <div className="pr-masonry">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="pr-masonry-skel" />)}
          </div>
        ) : fetchError && products.length === 0 ? (
          <div className="mm-error">
            <p>{fetchError}</p>
            <button type="button" className="pr-load-more-btn" onClick={() => fetchProducts({ newOffset: 0 })}>
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="pr-masonry">
              {products.map((item) => (
                <HomeMasonryCard
                  key={item.id}
                  item={item}
                  onClick={openProduct}
                  onAdd={handleAddToCart}
                  addingIds={addingIds}
                  addedIds={addedIds}
                />
              ))}
            </div>
            {hasMore && (
              <div className="pr-load-more-wrap">
                <button type="button" className="pr-load-more-btn" onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? "Loading…" : "Load More Products"}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {cartCount > 0 && (
        <FloatingCartButton count={cartCount} onClick={() => navigate("/shop/cart")} />
      )}

      <Footer />

      <MobileFooter
        user={user}
        cartCount={cartCount}
        cartAnimating={cartAnimating}
        wishCount={wishlist.length}
        onPostAd={goPostAd}
      />

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
        minPrice={minPrice}
        setMinPrice={setMinPrice}
        maxPrice={maxPrice}
        setMaxPrice={setMaxPrice}
        activeSort={activeSort}
        setActiveSort={setActiveSort}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />
    </div>
  );
}