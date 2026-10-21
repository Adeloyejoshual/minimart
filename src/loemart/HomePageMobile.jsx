/**
 * src/loemart/mobile/Minimart.jsx
 * Loemart Mobile Homepage & Marketplace Catalog
 * Features: Auto-pruned Recently Viewed ("Based on your views"), live category filter,
 * variant-aware stock checks, and infinite scrolling.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  Search,
  Sparkles,
  Flame,
  Tag,
  ShieldCheck,
  Truck,
  Award,
  Smartphone,
  Shirt,
  Watch,
  Home,
  SlidersHorizontal,
  X,
  Loader2,
  ChevronRight,
  Gift,
  AlertCircle,
} from "lucide-react";

import MasonryCard from "./MasonryCard";
import {
  API,
  getRecentlyViewed,
  syncRecentlyViewed,
} from "./mobileHelpers";
import "./styles/Minimart.css";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS & STATIC DATA
══════════════════════════════════════════════════════════════ */
const QUICK_NAV = [
  { id: "new", label: "New", icon: Sparkles, color: "#10b981", filter: "is_new=true" },
  { id: "hot", label: "Hot", icon: Flame, color: "#ef4444", filter: "trending=true" },
  { id: "deals", label: "Deals", icon: Tag, color: "#f59e0b", filter: "isFlashDeal=true" },
  { id: "search", label: "Search", icon: Search, color: "#3b82f6", action: "focus-search" },
];

const PROMO_CATEGORIES = [
  { id: "phones", name: "Phones", icon: Smartphone },
  { id: "fashion", name: "Fashion", icon: Shirt },
  { id: "watches", name: "Watches", icon: Watch },
  { id: "home", name: "Home", icon: Home },
];

/* ══════════════════════════════════════════════════════════════
   STOCK EVALUATOR
══════════════════════════════════════════════════════════════ */
function isInStock(product) {
  if (!product) return false;

  // 1. Explicit out-of-stock markers
  if (
    product.is_out_of_stock === true ||
    product.out_of_stock === true ||
    product.stock_status === "out_of_stock" ||
    product.status === "out_of_stock"
  ) {
    return false;
  }

  // 2. Check variant stock sum if variants exist
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const totalVariantStock = product.variants.reduce((sum, v) => {
      const q = Number(v?.stock ?? v?.quantity ?? 0);
      return sum + (Number.isFinite(q) && q > 0 ? q : 0);
    }, 0);
    return totalVariantStock > 0;
  }

  // 3. Explicit numeric stock
  const rawStock = product.stock ?? product.quantity;
  if (rawStock !== null && rawStock !== undefined) {
    const parsed = Number(rawStock);
    if (Number.isFinite(parsed)) {
      return parsed > 0;
    }
  }

  // 4. Default for simple active products
  return true;
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function Minimart() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef(null);

  /* ── State ── */
  const [products, setProducts] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || "");
  const [sortOption, setSortOption] = useState(searchParams.get("sort") || "newest");
  const [quickFilter, setQuickFilter] = useState(searchParams.get("filter") || "");

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [wishlist, setWishlist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("lm_wishlist") || "[]");
    } catch {
      return [];
    }
  });

  /* ── 1. Recently Viewed Auto-Pruning Sync ── */
  useEffect(() => {
    // Fast initial load from localStorage
    const local = getRecentlyViewed();
    setRecentlyViewed(local);

    // Live backend validation against deleted / inactive items
    syncRecentlyViewed()
      .then((prunedList) => {
        setRecentlyViewed(prunedList);
      })
      .catch(() => {});
  }, []);

  /* ── 2. Fetch Categories ── */
  useEffect(() => {
    axios
      .get(`${API}/categories`)
      .then((res) => {
        const catData = res.data?.data || res.data || [];
        setCategories(Array.isArray(catData) ? catData : []);
      })
      .catch(() => setCategories([]));
  }, []);

  /* ── 3. Fetch Products Catalog ── */
  const fetchProducts = useCallback(
    async (isPageOne = true) => {
      if (isPageOne) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const targetPage = isPageOne ? 1 : page;
        const params = new URLSearchParams();
        params.set("page", String(targetPage));
        params.set("limit", "24");
        params.set("sort", sortOption);

        if (selectedCategory) params.set("category", selectedCategory);
        if (searchQuery.trim()) params.set("search", searchQuery.trim());

        if (quickFilter === "is_new=true") params.set("is_new", "true");
        if (quickFilter === "trending=true") params.set("trending", "true");
        if (quickFilter === "isFlashDeal=true") params.set("featured", "true");

        const res = await axios.get(`${API}/products?${params.toString()}`);
        const responseData = res.data?.data || res.data || {};
        const rawProducts = Array.isArray(responseData.products)
          ? responseData.products
          : Array.isArray(responseData)
          ? responseData
          : [];

        // Strict soft-delete exclusion
        const activeProducts = rawProducts.filter(
          (p) => p && !p.deleted_at && p.status !== "deleted"
        );

        if (isPageOne) {
          setProducts(activeProducts);
          setPage(2);
        } else {
          setProducts((prev) => [...prev, ...activeProducts]);
          setPage((p) => p + 1);
        }

        const pagination = responseData.pagination;
        if (pagination) {
          setHasMore(pagination.hasNext ?? targetPage < pagination.totalPages);
        } else {
          setHasMore(activeProducts.length >= 24);
        }
      } catch (err) {
        console.error("Fetch products failed:", err);
        setError("Failed to load catalog products. Please try again.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [selectedCategory, searchQuery, sortOption, quickFilter, page]
  );

  /* Trigger reload when main filters change */
  useEffect(() => {
    fetchProducts(true);
    // eslint-disable-next-deps
  }, [selectedCategory, searchQuery, sortOption, quickFilter]);

  /* ── 4. Wishlist Handler ── */
  const toggleWishlist = useCallback((productId) => {
    setWishlist((prev) => {
      const next = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      localStorage.setItem("lm_wishlist", JSON.stringify(next));
      toast.success(
        prev.includes(productId) ? "Removed from wishlist" : "Saved to wishlist",
        { duration: 2000, icon: "❤️" }
      );
      return next;
    });
  }, []);

  /* ── 5. Quick Nav Click Handler ── */
  const handleQuickNav = (item) => {
    if (item.action === "focus-search") {
      searchInputRef.current?.focus();
      return;
    }
    if (quickFilter === item.filter) {
      setQuickFilter("");
    } else {
      setQuickFilter(item.filter);
    }
  };

  /* ── 6. Category Select Handler ── */
  const handleCategorySelect = (catName) => {
    if (selectedCategory === catName) {
      setSelectedCategory("");
    } else {
      setSelectedCategory(catName);
    }
  };

  return (
    <div className="mm-page">
      {/* ── Search Bar Header ── */}
      <header className="mm-header">
        <div className="mm-search-bar">
          <Search size={18} className="mm-search-icon" />
          <input
            ref={searchInputRef}
            type="search"
            className="mm-search-input"
            placeholder="Search phones, fashion, electronics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="mm-search-clear"
              onClick={() => setSearchQuery("")}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {/* ── Quick Nav Grid ── */}
      <nav className="mm-quick-nav">
        {QUICK_NAV.map((item) => {
          const Icon = item.icon;
          const isActive = quickFilter === item.filter;
          return (
            <button
              key={item.id}
              type="button"
              className={`mm-qnav-btn${isActive ? " mm-qnav-btn--active" : ""}`}
              onClick={() => handleQuickNav(item)}
            >
              <div
                className="mm-qnav-icon-wrap"
                style={{ backgroundColor: `${item.color}15`, color: item.color }}
              >
                <Icon size={20} />
              </div>
              <span className="mm-qnav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Guarantees Bar ── */}
      <section className="mm-guarantees">
        <div className="mm-guarantee-item">
          <ShieldCheck size={14} className="mm-guarantee-icon" />
          <span>BUYER PROTECTION</span>
        </div>
        <span className="mm-guarantee-divider">|</span>
        <div className="mm-guarantee-item">
          <Truck size={14} className="mm-guarantee-icon" />
          <span>FAST DELIVERY</span>
        </div>
        <span className="mm-guarantee-divider">|</span>
        <div className="mm-guarantee-item">
          <Award size={14} className="mm-guarantee-icon" />
          <span>VERIFIED QUALITY</span>
        </div>
      </section>

      {/* ── Category Strip ── */}
      <section className="mm-categories-strip">
        {PROMO_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedCategory.toLowerCase() === cat.name.toLowerCase();
          return (
            <button
              key={cat.id}
              type="button"
              className={`mm-cat-card${isSelected ? " mm-cat-card--selected" : ""}`}
              onClick={() => handleCategorySelect(cat.name)}
            >
              <div className="mm-cat-icon">
                <Icon size={22} />
              </div>
              <span className="mm-cat-name">{cat.name}</span>
            </button>
          );
        })}
      </section>

      {/* ── Promo Banners ── */}
      <section className="mm-banners-grid">
        <div
          className="mm-banner mm-banner--hero"
          onClick={() => handleCategorySelect("Electronics")}
        >
          <span className="mm-banner-tag">MUST HAVE</span>
          <h2 className="mm-banner-title">
            Tech
            <br />
            Clearance
          </h2>
          <p className="mm-banner-sub">Up to 50% Off</p>
        </div>

        <div className="mm-banner-stack">
          <div
            className="mm-banner mm-banner--sub"
            onClick={() => setQuickFilter("is_new=true")}
          >
            <h3>New Drops</h3>
            <p>Explore</p>
          </div>
          <div
            className="mm-banner mm-banner--sub mm-banner--alt"
            onClick={() => setQuickFilter("trending=true")}
          >
            <h3>Bestsellers</h3>
            <p>Shop now</p>
          </div>
        </div>
      </section>

      {/* ── Based on Your Views (Recently Viewed) ── */}
      {recentlyViewed.length > 0 && (
        <section className="mm-section">
          <div className="mm-section-header">
            <h2 className="mm-section-title">
              <Gift size={20} className="mm-section-icon" />
              Based on your views
            </h2>
          </div>

          <div className="mm-recent-rail">
            {recentlyViewed.map((prod) => (
              <div key={prod.id || prod.product_id} className="mm-recent-item">
                <MasonryCard
                  product={prod}
                  isWished={wishlist.includes(String(prod.id || prod.product_id))}
                  onWishlist={() => toggleWishlist(String(prod.id || prod.product_id))}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Catalog Section Header & Sort ── */}
      <section className="mm-catalog-header">
        <div>
          <h2 className="mm-catalog-title">All Products</h2>
          <p className="mm-catalog-sub">Explore the full catalog</p>
        </div>

        <div className="mm-sort-wrap">
          <SlidersHorizontal size={14} />
          <select
            className="mm-sort-select"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
          >
            <option value="newest">Sort & Filter</option>
            <option value="newest">Newest First</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="trending">Trending</option>
          </select>
        </div>
      </section>

      {/* ── Active Filter Badges ── */}
      {(selectedCategory || searchQuery || quickFilter) && (
        <div className="mm-active-filters">
          {selectedCategory && (
            <span className="mm-filter-badge">
              Category: {selectedCategory}
              <X size={12} onClick={() => setSelectedCategory("")} />
            </span>
          )}
          {searchQuery && (
            <span className="mm-filter-badge">
              Search: "{searchQuery}"
              <X size={12} onClick={() => setSearchQuery("")} />
            </span>
          )}
          {quickFilter && (
            <span className="mm-filter-badge">
              Filter Active
              <X size={12} onClick={() => setQuickFilter("")} />
            </span>
          )}
        </div>
      )}

      {/* ── Product Grid ── */}
      {loading ? (
        <div className="mm-loading-state">
          <Loader2 size={32} className="mm-spinner" />
          <p>Loading catalog...</p>
        </div>
      ) : error ? (
        <div className="mm-error-state">
          <AlertCircle size={32} />
          <p>{error}</p>
          <button type="button" onClick={() => fetchProducts(true)}>
            Retry
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="mm-empty-state">
          <p>No products match your criteria.</p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("");
              setSearchQuery("");
              setQuickFilter("");
            }}
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="mm-grid">
          {products.map((prod) => (
            <MasonryCard
              key={prod.id || prod.product_id}
              product={prod}
              isWished={wishlist.includes(String(prod.id || prod.product_id))}
              onWishlist={() => toggleWishlist(String(prod.id || prod.product_id))}
            />
          ))}
        </div>
      )}

      {/* ── Infinite Scroll / Load More ── */}
      {!loading && hasMore && products.length > 0 && (
        <div className="mm-load-more">
          <button
            type="button"
            className="mm-load-btn"
            onClick={() => fetchProducts(false)}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <Loader2 size={16} className="mm-spinner" /> Loading...
              </>
            ) : (
              <>
                Load More Products <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}