import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { 
  Search, ShoppingCart, Sliders, ChevronRight, 
  Flame, Star, Zap, Home, Grid, PlusSquare, User
} from "lucide-react";
import categories from "../config/categories";
import MasonryCard from "../loemart/mobile/MasonryCard";

const API = `${import.meta.env.VITE_API_BASE_URL}/api`;
const DEFAULT_LIMIT = 20;
const CART_KEY = "mm_cart";

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const primaryImg = (images) => {
  if (!images) return "/placeholder.png";
  let arr = images;
  if (typeof images === "string") {
    try { arr = JSON.parse(images); } catch { arr = [images]; }
  }
  if (!Array.isArray(arr) || !arr.length) return "/placeholder.png";
  const first = arr.find(i => i?.is_primary) || arr[0];
  return typeof first === "string" ? first : (first?.url || first?.image_url || "/placeholder.png");
};

const fmtPrice = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

/* ═══════════════════════════════════════════════════════════════
   PRO MINI CARD (For Horizontal Swiping)
═══════════════════════════════════════════════════════════════ */
const MiniPromoCard = ({ product, badge, badgeColor }) => {
  const navigate = useNavigate();
  return (
    <div 
      onClick={() => navigate(`/shop/${product.slug || product.id}`)}
      style={{ 
        minWidth: 120, width: 120, 
        background: "#fff", borderRadius: 8, 
        overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        position: "relative", cursor: "pointer", flexShrink: 0
      }}
    >
      <div style={{ width: "100%", height: 120, background: "#f8f9fa", position: "relative" }}>
        <img 
          src={primaryImg(product.images)} 
          alt={product.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          loading="lazy"
        />
        {badge && (
          <span style={{ 
            position: "absolute", top: 4, left: 4, 
            background: badgeColor || "#ff6000", color: "#fff", 
            fontSize: 10, fontWeight: 800, padding: "2px 6px", borderRadius: 4 
          }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{ padding: "8px" }}>
        <h4 style={{ 
          fontSize: 11, margin: 0, fontWeight: 500, color: "#444",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" 
        }}>
          {product.name}
        </h4>
        <p style={{ margin: "4px 0 0", fontSize: 13, fontWeight: 800, color: "#111" }}>
          {fmtPrice(product.price || product.selling_price)}
        </p>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function HomePageMobile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  /* ── State ── */
  const [feedProducts, setFeedProducts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [sponsored, setSponsored] = useState([]);
  const [flashDeals, setFlashDeals] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [activeCat, setActiveCat] = useState("all");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  
  const [wishlist, setWishlist] = useState([]);
  const [cartItems, setCartItems] = useState([]);

  /* ── Cart Sync ── */
  const syncCart = useCallback(() => {
    try { setCartItems(JSON.parse(localStorage.getItem(CART_KEY) || "[]")); } 
    catch { setCartItems([]); }
  }, []);

  useEffect(() => {
    syncCart();
    window.addEventListener("cart-updated", syncCart);
    return () => window.removeEventListener("cart-updated", syncCart);
  }, [syncCart]);

  const cartMap = useMemo(() => {
    const map = {};
    cartItems.forEach(i => map[i.productId || i.product_id] = { qty: i.qty, itemId: i.id });
    return map;
  }, [cartItems]);

  const totalCartQty = useMemo(() => cartItems.reduce((s, i) => s + (Number(i.qty) || 1), 0), [cartItems]);

  const toggleWishlist = (id) => {
    setWishlist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  /* ── Fetching logic ── */
  const fetchSections = async () => {
    try {
      // Pro apps fetch promo rows separately (Featured/Sponsored, Trending, Flash Deals)
      const [trendRes, featRes, flashRes] = await Promise.allSettled([
        axios.get(`${API}/products`, { params: { sort: "trending", limit: 6 } }),
        axios.get(`${API}/products`, { params: { featured: "true", limit: 6 } }),
        axios.get(`${API}/products`, { params: { sort: "newest", limit: 6 } }) // Assuming Flash Deals map to newest for now
      ]);
      if (trendRes.status === "fulfilled") setTrending(trendRes.value.data?.data?.products || []);
      if (featRes.status === "fulfilled") setSponsored(featRes.value.data?.data?.products || []);
      if (flashRes.status === "fulfilled") setFlashDeals(flashRes.value.data?.data?.products || []);
    } catch (error) {
      console.error("Promo sections error:", error);
    }
  };

  const fetchFeed = useCallback(async (newOffset = 0, cat = activeCat, q = searchQuery) => {
    setLoading(true);
    try {
      const params = { limit: DEFAULT_LIMIT, offset: newOffset };
      if (cat !== "all") params.category = cat;
      if (q.trim()) params.search = q.trim();

      const { data } = await axios.get(`${API}/products`, { params });
      const rows = data?.data?.products || [];
      const total = data?.data?.pagination?.total || 0;
      
      setFeedProducts(newOffset === 0 ? rows : prev => [...prev, ...rows]);
      setHasMore(newOffset + DEFAULT_LIMIT < total);
      setOffset(newOffset);
    } catch (err) {
      console.error("Feed error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeCat, searchQuery]);

  // Initial load
  useEffect(() => {
    fetchSections();
    fetchFeed(0);
  }, [fetchFeed]);

  const isSearchActive = searchQuery.trim().length > 0 || activeCat !== "all";

  return (
    <div className="mm-page" style={{ paddingBottom: 80 }}> {/* padding for bottom nav */}
      
      {/* ── HEADER (Brand Orange) ── */}
      <header style={{ 
        background: "#ff6000", padding: "env(safe-area-inset-top) 16px 12px",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingTop: 12 }}>
          <h1 onClick={() => { setActiveCat("all"); setSearchQuery(""); fetchFeed(0, "all", ""); }}
              style={{ margin: 0, color: "#fff", fontSize: 24, fontWeight: 900, cursor: "pointer" }}>
            Loemart
          </h1>
          <button onClick={() => navigate("/shop/cart")} style={{ background: "none", border: "none", color: "#fff", position: "relative" }}>
            <ShoppingCart size={24} />
            {totalCartQty > 0 && (
              <span style={{
                position: "absolute", top: -4, right: -6, background: "#fff", color: "#ff6000",
                fontSize: 11, fontWeight: 800, width: 18, height: 18, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>{totalCartQty > 9 ? "9+" : totalCartQty}</span>
            )}
          </button>
        </div>
        <div style={{ background: "#fff", borderRadius: 8, display: "flex", alignItems: "center", padding: "8px 12px" }}>
          <Search size={18} color="#999" />
          <input 
            type="search" placeholder="I'm shopping for..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchFeed(0)}
            style={{ border: "none", background: "transparent", outline: "none", width: "100%", marginLeft: 10, fontSize: 15 }}
          />
        </div>
      </header>

      {/* Show Promos ONLY if not actively searching/filtering */}
      {!isSearchActive && (
        <>
          {/* ── APP QUICK LINKS (Grid) ── */}
          <div style={{ 
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, 
            padding: "16px", background: "#fff", marginBottom: 8 
          }}>
            {categories.slice(0, 8).map(c => (
              <div key={c.id} onClick={() => { setActiveCat(c.id); fetchFeed(0, c.id, ""); }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#fff4eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                  {c.icon || "📦"}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#333", textAlign: "center", lineHeight: 1.1 }}>{c.name}</span>
              </div>
            ))}
          </div>

          {/* ── FLASH DEALS ── */}
          {flashDeals.length > 0 && (
            <div style={{ background: "#fff", padding: "16px 0", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Zap size={18} color="#ef4444" fill="#ef4444" />
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Flash Deals</h3>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#ff6000", display: "flex", alignItems: "center" }}>
                  See All <ChevronRight size={14} />
                </span>
              </div>
              <div style={{ display: "flex", overflowX: "auto", padding: "0 16px", gap: 12, scrollbarWidth: "none" }}>
                {flashDeals.map(p => <MiniPromoCard key={p.id} product={p} badge="-15%" badgeColor="#ef4444" />)}
              </div>
            </div>
          )}

          {/* ── SPONSORED / FEATURED ── */}
          {sponsored.length > 0 && (
            <div style={{ background: "#fff", padding: "16px 0", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Star size={18} color="#f59e0b" fill="#f59e0b" />
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Sponsored</h3>
                </div>
              </div>
              <div style={{ display: "flex", overflowX: "auto", padding: "0 16px", gap: 12, scrollbarWidth: "none" }}>
                {sponsored.map(p => <MiniPromoCard key={p.id} product={p} badge="Ad" badgeColor="#f59e0b" />)}
              </div>
            </div>
          )}

          {/* ── TRENDING NOW ── */}
          {trending.length > 0 && (
            <div style={{ background: "#fff", padding: "16px 0", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 16px", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Flame size={18} color="#ff6000" fill="#ff6000" />
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Trending Now</h3>
                </div>
              </div>
              <div style={{ display: "flex", overflowX: "auto", padding: "0 16px", gap: 12, scrollbarWidth: "none" }}>
                {trending.map(p => <MiniPromoCard key={p.id} product={p} badge="Hot" badgeColor="#ff6000" />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── MAIN FEED (Discover) ── */}
      <section className="mdp-psec">
        <div className="mm-catalog-head" style={{ marginBottom: 12 }}>
          <div>
            <h2 className="mdp-psec__title" style={{ fontSize: 18 }}>
              {isSearchActive ? `Search Results` : "Just For You"}
            </h2>
            <p className="mm-catalog-sub">Personalized recommendations</p>
          </div>
          <button className="mm-btn-filter-pill">
            <Sliders size={12} /> Filter
          </button>
        </div>

        {/* ── MASONRY GRID (Using your MasonryCard) ── */}
        <div className="pr-masonry">
          {loading && offset === 0 
            ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="pr-masonry-skel" />)
            : feedProducts.map((product) => (
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

        {!loading && feedProducts.length === 0 && (
          <div className="mm-error">
            <Search size={40} color="#999999" />
            <p style={{ marginTop: 16 }}>No items found.</p>
            <button 
              onClick={() => { setSearchQuery(""); setActiveCat("all"); fetchFeed(0, "all", ""); }}
              style={{ marginTop: 8, background: "#ff6000", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 999, fontWeight: "bold" }}
            >
              Clear Filters
            </button>
          </div>
        )}

        {hasMore && (
          <div className="pr-load-more-wrap">
            <button className="pr-load-more-btn" onClick={() => fetchFeed(offset + DEFAULT_LIMIT)} disabled={loading}>
              {loading ? "Loading..." : "Show More Items"}
            </button>
          </div>
        )}
      </section>

      {/* ── BOTTOM APP NAVIGATION BAR (PRO FEATURE) ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "#ffffff", borderTop: "1px solid #eaeaea",
        display: "flex", justifyContent: "space-around", alignItems: "center",
        padding: "10px 0 env(safe-area-inset-bottom)",
        boxShadow: "0 -2px 10px rgba(0,0,0,0.05)", zIndex: 100
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#ff6000", cursor: "pointer" }}>
          <Home size={22} fill="#ff6000" />
          <span style={{ fontSize: 10, fontWeight: 700, marginTop: 4 }}>Home</span>
        </div>
        <div onClick={() => navigate("/categories")} style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#666", cursor: "pointer" }}>
          <Grid size={22} />
          <span style={{ fontSize: 10, fontWeight: 600, marginTop: 4 }}>Categories</span>
        </div>
        <div onClick={() => navigate("/minimart/post-ad")} style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#666", cursor: "pointer", position: "relative", top: -8 }}>
          <div style={{ background: "#ff6000", color: "#fff", width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(255,96,0,0.3)" }}>
            <PlusSquare size={22} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, marginTop: 4 }}>Sell</span>
        </div>
        <div onClick={() => navigate("/shop/cart")} style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#666", cursor: "pointer", position: "relative" }}>
          <ShoppingCart size={22} />
          {totalCartQty > 0 && <span style={{ position: "absolute", top: -4, right: -4, background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 800, width: 14, height: 14, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>{totalCartQty}</span>}
          <span style={{ fontSize: 10, fontWeight: 600, marginTop: 4 }}>Cart</span>
        </div>
        <div onClick={() => navigate("/profile")} style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#666", cursor: "pointer" }}>
          <User size={22} />
          <span style={{ fontSize: 10, fontWeight: 600, marginTop: 4 }}>Account</span>
        </div>
      </div>

    </div>
  );
}