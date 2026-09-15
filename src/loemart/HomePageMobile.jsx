/**
 * src/pages/Minimart.jsx (Homepage)
 * 10/10 Production Ready: Trust Badges, Promo Banners, Syncing Cart, Masonry Grid.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

/* ONE Unified Stylesheet */
import "../styles/Minimart.css";

/* Components */
import MobileTopBar from "./mobile/MobileTopBar";
import MobileHero from "./mobile/MobileHero";
import MobileSections from "./mobile/MobileSections";
import MasonryCard from "./mobile/MasonryCard";
import MobileFooter from "./mobile/MobileFooter";
import Footer from "../components/Footer";
import FloatingCartButton from "../components/FloatingCartButton";
import { SearchSheet, FilterSheet } from "./mobile/MobileSheets";

import { 
  API, 
  DEFAULT_LIMIT, 
  normalize, 
  getSearchHistory, 
  addToSearchHistory 
} from "./mobile/mobileHelpers";

const CART_URL = `${API}/cart`;

export default function Minimart({ user }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isFirstMount = useRef(true);

  // URL States
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") ?? "");
  const [activeCategory, setActiveCategory] = useState(searchParams.get("category") ?? "all");
  const [activeSort, setActiveSort] = useState(searchParams.get("sort") ?? "newest");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");

  // UI States
  const [searchOpen, setSearchOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchHistory, setSearchHistory] = useState(getSearchHistory);

  // Data States
  const [products, setProducts] = useState([]);
  const [flashDeals, setFlashDeals] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // Cart Data Map (Syncs all steppers instantly)
  const [cartMap, setCartMap] = useState({});
  const [cartCount, setCartCount] = useState(0);

  /* ── CART SYNC ENGINE ── */
  const syncCart = useCallback(async () => {
    const token = localStorage.getItem("marketplace_token");
    let map = {};
    let total = 0;
    
    if (user && token) {
      try {
        const res = await axios.get(CART_URL, { headers: { Authorization: `Bearer ${token}` } });
        const items = res.data?.data?.items || [];
        total = res.data?.data?.total_qty || 0;
        items.forEach(i => map[i.product_id] = { itemId: i.id, qty: i.qty });
      } catch { /* ignore */ }
    } else {
      const guestCart = JSON.parse(localStorage.getItem("mm_cart") || "[]");
      guestCart.forEach(i => {
        total += i.qty;
        map[i.productId] = { itemId: i.id, qty: i.qty };
      });
    }
    setCartMap(map);
    setCartCount(total);
  }, [user]);

  useEffect(() => {
    syncCart();
    window.addEventListener("cart-updated", syncCart);
    window.addEventListener("storage", syncCart);
    return () => {
      window.removeEventListener("cart-updated", syncCart);
      window.removeEventListener("storage", syncCart);
    };
  }, [syncCart]);

  /* ── DATA FETCHING ── */
  const fetchProducts = useCallback(async ({ 
    query = searchQuery, cat = activeCategory, sort = activeSort, 
    min = minPrice, max = maxPrice, newOffset = 0, append = false 
  } = {}) => {
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const params = { limit: DEFAULT_LIMIT, offset: newOffset, sort };
      if (normalize(query)) params.search = normalize(query);
      if (cat !== "all") params.category = cat;
      if (min && Number(min) > 0) params.minPrice = min;
      if (max && Number(max) > 0) params.maxPrice = max;

      const { data } = await axios.get(`${API}/products`, { params });
      const rows = data?.data?.products || [];
      setProducts(append ? [...products, ...rows] : rows);
      setPagination(data?.data?.pagination || null);
      setOffset(newOffset);
    } catch (err) {
      if (!append) toast.error("Failed to load catalog");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchQuery, activeCategory, activeSort, minPrice, maxPrice, products]);

  // Initial Curated Fetch
  useEffect(() => {
    axios.get(`${API}/products`, { params: { trending: "true", limit: 6 } })
      .then(res => setFlashDeals(res.data?.data?.products || []));
  }, []);

  // Main Catalog Fetch
  useEffect(() => {
    if (isFirstMount.current) { 
      isFirstMount.current = false; 
      fetchProducts({ newOffset: 0 }); 
      return; 
    }
    fetchProducts({ newOffset: 0 });
  }, [activeCategory, activeSort, fetchProducts]);

  /* ── HANDLERS ── */
  const handleSearchSelect = (q) => {
    setSearchQuery(q);
    setSearchOpen(false);
    addToSearchHistory(q);
    setSearchHistory(getSearchHistory());
    setSearchParams(q ? { q } : {});
    fetchProducts({ query: q, newOffset: 0 });
  };

  const clearAllFilters = () => {
    setSearchQuery(""); setActiveCategory("all"); setActiveSort("newest");
    setMinPrice(""); setMaxPrice(""); setSearchParams({});
    fetchProducts({ query: "", cat: "all", sort: "newest", min: "", max: "", newOffset: 0 });
  };

  const hasMore = pagination ? (offset + DEFAULT_LIMIT) < pagination.total : false;
  const hasFilters = !!(searchQuery || activeCategory !== "all" || minPrice || maxPrice);

  return (
    <div className="mm-page">
      {/* 1. Top Navigation & Categories */}
      <MobileTopBar
        searchQuery={searchQuery}
        onSearchOpen={() => setSearchOpen(true)}
        onClearSearch={() => { setSearchQuery(""); fetchProducts({ query: "", newOffset: 0 }); }}
        activeCategory={activeCategory}
        onCategoryChange={(cat) => { setActiveCategory(cat); setSearchParams(cat === "all" ? {} : { category: cat }); }}
        onFilterOpen={() => setShowFilters(true)}
        hasFilters={hasFilters}
      />

      {/* 2. Hero Banner */}
      <div className="mm-hero-wrap">
        <MobileHero user={user} onPostAd={() => navigate(user ? "/minimart/post-ad" : "/auth")} />
      </div>

      {/* 3. Trust Strip, Promo Banner & Flash Deals Rail */}
      <MobileSections flashDeals={flashDeals} />

      {/* 4. Main Catalog (Masonry Grid) */}
      <section className="mdp-psec mdp-psec--recommended">
        <div className="mdp-psec__head mm-catalog-head">
          <div>
            <h3 className="mdp-psec__title">All Products</h3>
            <p className="mm-catalog-sub">Real-time marketplace listings</p>
          </div>
          {hasFilters && (
            <button className="mdp-psec__all" onClick={clearAllFilters}>
              Clear Filters
            </button>
          )}
        </div>

        {loading && products.length === 0 ? (
          <div className="pr-masonry">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="pr-masonry-skel" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="mm-error">
            <p>No products found.</p>
            <button className="pr-load-more-btn" onClick={clearAllFilters} style={{ marginTop: 10 }}>Clear Filters</button>
          </div>
        ) : (
          <div className="pr-masonry">
            {products.map((item) => (
              <MasonryCard 
                key={item.id} 
                product={item} 
                cartInfo={cartMap[item.id]} 
                onCartUpdate={syncCart} 
              />
            ))}
          </div>
        )}

        {!loading && hasMore && (
          <div className="pr-load-more-wrap">
            <button 
              className="pr-load-more-btn" 
              onClick={() => fetchProducts({ newOffset: offset + DEFAULT_LIMIT, append: true })}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading..." : "Load More"}
            </button>
          </div>
        )}
      </section>

      {/* 5. Floating Cart FAB */}
      {cartCount > 0 && <FloatingCartButton count={cartCount} onClick={() => navigate("/shop/cart")} />}
      
      {/* 6. Footers */}
      <Footer />
      <MobileFooter user={user} cartCount={cartCount} onPostAd={() => navigate(user ? "/minimart/post-ad" : "/auth")} />

      {/* 7. Modals / Sheets */}
      <SearchSheet 
        open={searchOpen} onClose={() => setSearchOpen(false)} 
        query={searchQuery} setQuery={setSearchQuery} 
        onSelect={handleSearchSelect} history={searchHistory} 
      />

      <FilterSheet
        open={showFilters} onClose={() => setShowFilters(false)}
        minPrice={minPrice} setMinPrice={setMinPrice}
        maxPrice={maxPrice} setMaxPrice={setMaxPrice}
        activeSort={activeSort} setActiveSort={setActiveSort}
        onReset={() => { setMinPrice(""); setMaxPrice(""); setActiveSort("newest"); }}
        onApply={() => { setShowFilters(false); fetchProducts({ newOffset: 0 }); }}
      />
    </div>
  );
}