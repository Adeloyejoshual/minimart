/**
 * src/pages/Minimart.jsx (Homepage)
 * 10/10 Production Ready: Menu Drawer, Fullscreen Search Routing, Masonry Grid, Type-Safe Cart Sync
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

/* ── Stylesheet ── */
import "../styles/Minimart.css";

/* ── Components ── */
import MobileTopBar from "./mobile/MobileTopBar";
import MobileHero from "./mobile/MobileHero";
import MobileSections from "./mobile/MobileSections";
import MasonryCard from "./mobile/MasonryCard";
import Footer from "../components/Footer";
import FloatingCartButton from "../components/FloatingCartButton";

/* Sheets & Drawers */
import { FilterSheet } from "./mobile/MobileSheets";
import MenuDrawer from "./mobile/MenuDrawer";

/* Helpers */
import { 
  API, 
  DEFAULT_LIMIT, 
  WISH_KEY 
} from "./mobile/mobileHelpers";

const CART_URL = `${API}/cart`;

export default function Minimart({ user }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isFirstMount = useRef(true);

  // URL States
  const [activeCategory, setActiveCategory] = useState(searchParams.get("category") ?? "all");
  const [activeSort, setActiveSort] = useState(searchParams.get("sort") ?? "newest");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");

  // UI States
  const [showFilters, setShowFilters] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Data States
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // Curated Rails States
  const [flashDeals, setFlashDeals] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [trending, setTrending] = useState([]);

  // Cart & Wishlist Data
  const [cartMap, setCartMap] = useState({});
  const [cartCount, setCartCount] = useState(0);
  
  const [wishlist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(WISH_KEY) || "[]");
    } catch {
      return [];
    }
  });

  /* ── CART SYNC ENGINE ── */
  const syncCart = useCallback(async () => {
    const token = localStorage.getItem("marketplace_token");
    let map = {};
    let total = 0;

    const extractId = (item) => String(item?.product_id || item?.productId || item?.id || "").trim();

    if (user && token) {
      try {
        const res = await axios.get(CART_URL, { headers: { Authorization: `Bearer ${token}` } });
        const items = res.data?.data?.items || res.data?.items || [];
        total = res.data?.data?.total_qty || res.data?.total_qty || 0;

        items.forEach((i) => {
          const pid = extractId(i);
          if (pid) {
            map[pid] = { itemId: String(i.id), qty: Number(i.qty) || 1 };
          }
        });
      } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          localStorage.removeItem("marketplace_token");
        }
      }
    } else {
      try {
        const guestCart = JSON.parse(localStorage.getItem("mm_cart") || "[]");
        guestCart.forEach((i) => {
          const rawKey = String(i.productId || i.product_id || i.id || "");
          const pid = rawKey.split("__")[0].trim();
          const qty = Number(i.qty) || 1;
          total += qty;
          if (pid) {
            map[pid] = { itemId: i.id || `${pid}__default`, qty };
          }
        });
      } catch {
        /* ignore fallback errors */
      }
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

  /* ── DATA FETCHING (Catalog) ── */
  const fetchProducts = useCallback(async ({ 
    cat = activeCategory, 
    sort = activeSort, 
    min = minPrice, 
    max = maxPrice, 
    newOffset = 0, 
    append = false 
  } = {}) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const params = { limit: DEFAULT_LIMIT, offset: newOffset, sort };
      if (cat !== "all") params.category = cat;
      if (min && Number(min) > 0) params.minPrice = min;
      if (max && Number(max) > 0) params.maxPrice = max;

      const { data } = await axios.get(`${API}/products`, { params });
      const rows = data?.data?.products || [];
      
      setProducts(prev => (append ? [...prev, ...rows] : rows));
      setPagination(data?.data?.pagination || null);
      setOffset(newOffset);
    } catch {
      if (!append) toast.error("Failed to load catalog");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeCategory, activeSort, minPrice, maxPrice]);

  /* ── INITIAL MOUNT FETCHES ── */
  useEffect(() => {
    Promise.allSettled([
      axios.get(`${API}/products`, { params: { trending: "true", limit: 6 } }),
      axios.get(`${API}/products`, { params: { sort: "newest", limit: 6 } }),
      axios.get(`${API}/products`, { params: { featured: "true", limit: 6 } }),
      axios.get(`${API}/products`, { params: { sort: "views", limit: 6 } })
    ]).then(([flashRes, newRes, featRes, trendRes]) => {
      if (flashRes.status === "fulfilled") setFlashDeals(flashRes.value.data?.data?.products || []);
      if (newRes.status === "fulfilled") setNewArrivals(newRes.value.data?.data?.products || []);
      if (featRes.status === "fulfilled") setFeatured(featRes.value.data?.data?.products || []);
      if (trendRes.status === "fulfilled") setTrending(trendRes.value.data?.data?.products || []);
    });
  }, []);

  useEffect(() => {
    if (isFirstMount.current) { 
      isFirstMount.current = false; 
      fetchProducts({ newOffset: 0 }); 
      return; 
    }
    fetchProducts({ newOffset: 0 });
  }, [activeCategory, activeSort, fetchProducts]);

  /* ── HANDLERS ── */
  const clearAllFilters = () => {
    setActiveCategory("all");
    setActiveSort("newest");
    setMinPrice("");
    setMaxPrice("");
    setSearchParams({});
    fetchProducts({ cat: "all", sort: "newest", min: "", max: "", newOffset: 0 });
  };

  const hasMore = pagination ? (offset + DEFAULT_LIMIT) < pagination.total : false;
  const hasFilters = !!(activeCategory !== "all" || minPrice || maxPrice);

  return (
    <div className="mm-page">
      
      {/* 1. Top Bar */}
      <MobileTopBar
        searchQuery=""
        onSearchOpen={() => navigate("/loemart/search")}
        activeCategory={activeCategory}
        onCategoryChange={(cat) => { 
          setActiveCategory(cat); 
          setSearchParams(cat === "all" ? {} : { category: cat }); 
        }}
        onFilterOpen={() => setShowFilters(true)}
        onMenuOpen={() => setMenuOpen(true)}
        hasFilters={hasFilters}
        wishCount={wishlist.length}
      />

      {/* 2. Hero Banner */}
      <div className="mm-hero-wrap">
        <MobileHero 
          user={user} 
          onPostAd={() => navigate(user ? "/minimart/post-ad" : "/auth")} 
        />
      </div>

      {/* 3. Trust Strip, Promo Banner, and Curated Rails */}
      <MobileSections 
        flashDeals={flashDeals} 
        newArrivals={newArrivals}
        featured={featured}
        trending={trending}
      />

      {/* 4. Main Catalog (Masonry Grid) */}
      <section className="mdp-psec mdp-psec--recommended">
        
        {/* Catalog Header & Filter Pill */}
        <div className="mdp-psec__head mm-catalog-head">
          <div>
            <h3 className="mdp-psec__title">All Products</h3>
            <p className="mm-catalog-sub">Explore the full catalog</p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {hasFilters && (
              <button type="button" className="mdp-psec__all" onClick={clearAllFilters}>
                Clear
              </button>
            )}
            <button type="button" className="mm-btn-filter-pill" onClick={() => setShowFilters(true)}>
              Sort & Filter
            </button>
          </div>
        </div>

        {/* Catalog States */}
        {loading && products.length === 0 ? (
          <div className="pr-masonry">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="pr-masonry-skel" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="mm-error">
            <p>No products found.</p>
            <button 
              type="button" 
              className="pr-load-more-btn" 
              onClick={clearAllFilters} 
              style={{ marginTop: 10 }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="pr-masonry">
            {products.map((item) => {
              const pId = String(item?.id || item?.product_id || item?._id || "").trim();
              return (
                <MasonryCard 
                  key={pId || item.slug} 
                  product={item} 
                  cartInfo={cartMap[pId]} 
                  onCartUpdate={syncCart} 
                />
              );
            })}
          </div>
        )}

        {/* Load More Button */}
        {!loading && hasMore && (
          <div className="pr-load-more-wrap">
            <button 
              type="button"
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
      {cartCount > 0 && (
        <FloatingCartButton count={cartCount} onClick={() => navigate("/shop/cart")} />
      )}
      
      {/* 6. Main Footer */}
      <Footer />

      {/* 7. Drawers & Sheets */}
      <MenuDrawer 
        open={menuOpen} 
        onClose={() => setMenuOpen(false)} 
        user={user} 
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
        onReset={() => { 
          setMinPrice(""); 
          setMaxPrice(""); 
          setActiveSort("newest"); 
        }}
        onApply={() => { 
          setShowFilters(false); 
          fetchProducts({ newOffset: 0 }); 
        }}
      />
    </div>
  );
}