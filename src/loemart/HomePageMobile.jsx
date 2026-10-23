import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Search, ShoppingCart, Sliders } from "lucide-react";
import categories from "../config/categories";

// Import your advanced MasonryCard component
import MasonryCard from "../loemart/mobile/MasonryCard";

const API = `${import.meta.env.VITE_API_BASE_URL}/api`;
const DEFAULT_LIMIT = 20;
const CART_KEY = "mm_cart";

export default function HomePageMobile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  /* ── State ── */
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [activeCat, setActiveCat] = useState("all");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  
  const [wishlist, setWishlist] = useState([]);
  const [cartItems, setCartItems] = useState([]);

  const categoryList = useMemo(() => [{ id: "all", name: "All Items" }, ...categories], []);

  /* ── Cart Sync (For Header Badge & Card Steppers) ── */
  const syncCart = useCallback(() => {
    try {
      setCartItems(JSON.parse(localStorage.getItem(CART_KEY) || "[]"));
    } catch {
      setCartItems([]);
    }
  }, []);

  useEffect(() => {
    syncCart();
    window.addEventListener("cart-updated", syncCart);
    return () => window.removeEventListener("cart-updated", syncCart);
  }, [syncCart]);

  // Map cart items for the MasonryCard to read its own quantity
  const cartMap = useMemo(() => {
    const map = {};
    cartItems.forEach(i => {
      map[i.productId || i.product_id] = { qty: i.qty, itemId: i.id };
    });
    return map;
  }, [cartItems]);

  const totalCartQty = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + (Number(item.qty) || 1), 0);
  }, [cartItems]);

  /* ── Wishlist Sync ── */
  const toggleWishlist = (id) => {
    setWishlist(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  /* ── Product Fetching ── */
  const fetchProducts = useCallback(async (newOffset = 0, cat = activeCat, q = searchQuery) => {
    setLoading(true);
    try {
      const params = { limit: DEFAULT_LIMIT, offset: newOffset };
      if (cat !== "all") params.category = cat;
      if (q.trim()) params.search = q.trim();

      const { data } = await axios.get(`${API}/products`, { params });
      const rows = data?.data?.products || [];
      const total = data?.data?.pagination?.total || 0;
      
      setProducts(newOffset === 0 ? rows : prev => [...prev, ...rows]);
      setHasMore(newOffset + DEFAULT_LIMIT < total);
      setOffset(newOffset);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeCat, searchQuery]);

  // Initial load & category changes
  useEffect(() => {
    fetchProducts(0);
  }, [fetchProducts]);

  return (
    <div className="mm-page">
      
      {/* ── BRAND ORANGE HEADER ── */}
      <header style={{ 
        background: "#ff6000", /* Loemart Brand Orange */
        padding: "env(safe-area-inset-top) 16px 16px",
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 4px 16px rgba(255, 96, 0, 0.15)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingTop: 12 }}>
          
          {/* Logo Title */}
          <h1 
            onClick={() => { setActiveCat("all"); setSearchQuery(""); fetchProducts(0, "all", ""); }}
            style={{ margin: 0, color: "#ffffff", fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em", cursor: "pointer" }}
          >
            Loemart
          </h1>

          {/* Cart Icon with Badge */}
          <button 
            onClick={() => navigate("/shop/cart")}
            style={{ background: "transparent", border: "none", color: "#ffffff", position: "relative" }}
          >
            <ShoppingCart size={24} strokeWidth={2.2} />
            {totalCartQty > 0 && (
              <span style={{
                position: "absolute", top: -6, right: -8,
                background: "#ffffff", color: "#ff6000",
                fontSize: 11, fontWeight: 800,
                width: 18, height: 18, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
              }}>
                {totalCartQty > 9 ? "9+" : totalCartQty}
              </span>
            )}
          </button>
        </div>

        {/* Clean Search Bar */}
        <div style={{ 
          background: "#ffffff", borderRadius: "9999px",
          display: "flex", alignItems: "center", padding: "10px 16px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        }}>
          <Search size={18} color="#999999" />
          <input 
            type="search"
            placeholder="Search products, brands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchProducts(0)}
            style={{ 
              border: "none", background: "transparent", outline: "none",
              width: "100%", marginLeft: 10, fontSize: 15, color: "#111111",
              fontFamily: "inherit"
            }}
          />
        </div>
      </header>

      {/* ── CATEGORY PILL SCROLL ── */}
      <div style={{ 
        display: "flex", overflowX: "auto", gap: 8, padding: "16px",
        scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch"
      }}>
        {categoryList.map(c => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            style={{
              padding: "8px 16px", whiteSpace: "nowrap",
              borderRadius: "9999px", border: "1px solid",
              fontSize: 13, fontWeight: 700, transition: "all 0.2s ease",
              background: activeCat === c.id ? "#ff6000" : "#ffffff",
              color: activeCat === c.id ? "#ffffff" : "#111111",
              borderColor: activeCat === c.id ? "#ff6000" : "#e9ecef",
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* ── CATALOG SECTION ── */}
      <section className="mdp-psec mdp-psec--recommended">
        <div className="mm-catalog-head">
          <div>
            <h2 className="mdp-psec__title">
              {searchQuery ? `Results for "${searchQuery}"` : "Discover"}
            </h2>
            <p className="mm-catalog-sub">Explore the marketplace</p>
          </div>
          <button className="mm-btn-filter-pill">
            <Sliders size={12} /> Filters
          </button>
        </div>

        {/* ── MASONRY GRID ── */}
        <div className="pr-masonry">
          {loading && offset === 0 
            ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="pr-masonry-skel" />)
            : products.map((product) => (
                <MasonryCard 
                  key={product.id || product.product_id}
                  product={product} 
                  isWished={wishlist.includes(product.id || product.product_id)}
                  onWishlist={() => toggleWishlist(product.id || product.product_id)}
                  cartInfo={cartMap[product.id || product.product_id] || null}
                  onCartUpdate={syncCart}
                />
              ))
          }
        </div>

        {/* ── EMPTY STATE ── */}
        {!loading && products.length === 0 && (
          <div className="mm-error">
            <Search size={40} color="#999999" />
            <p style={{ marginTop: 16 }}>No items found.</p>
            <button 
              onClick={() => { setSearchQuery(""); setActiveCat("all"); fetchProducts(0, "all", ""); }}
              style={{
                marginTop: 8, background: "#ff6000", color: "#fff",
                border: "none", padding: "10px 20px", borderRadius: 999,
                fontWeight: "bold"
              }}
            >
              Clear Search
            </button>
          </div>
        )}

        {/* ── LOAD MORE ── */}
        {hasMore && (
          <div className="pr-load-more-wrap">
            <button 
              className="pr-load-more-btn" 
              onClick={() => fetchProducts(offset + DEFAULT_LIMIT)}
              disabled={loading}
            >
              {loading ? "Loading..." : "Load More Products"}
            </button>
          </div>
        )}
      </section>

    </div>
  );
}