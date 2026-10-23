import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { 
  FiSearch, FiHeart, FiShoppingCart, 
  FiPackage, FiSliders, FiCheckCircle 
} from "react-icons/fi";
import categories from "../config/categories";

const API = `${import.meta.env.VITE_API_BASE_URL}/api`;
const DEFAULT_LIMIT = 20;

/* ═══════════════════════════════════════════════════════════════
   RESILIENT PARSERS (Fixes the blank screen bugs)
═══════════════════════════════════════════════════════════════ */
const primaryImg = (images) => {
  if (!images) return null;
  let arr = images;
  if (typeof images === "string") {
    try { arr = JSON.parse(images); } catch { arr = [images]; }
  }
  if (!Array.isArray(arr) || !arr.length) return null;
  const first = arr.find(i => i?.is_primary) || arr[0];
  return typeof first === "string" ? first : (first?.url || first?.image_url || null);
};

const fmtPrice = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

/* ═══════════════════════════════════════════════════════════════
   CLEAN MOBILE CARD (Matches your brand & masonry grid)
═══════════════════════════════════════════════════════════════ */
function CleanMobileCard({ product }) {
  const navigate = useNavigate();
  const [added, setAdded] = useState(false);
  const imgSrc = primaryImg(product.images);
  
  const handleAdd = (e) => {
    e.stopPropagation();
    setAdded(true);
    // Add cart logic here
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <article 
      onClick={() => navigate(`/shop/${product.slug ?? product.id}`)}
      style={{
        background: "var(--wh)",
        borderRadius: "var(--r2)",
        overflow: "hidden",
        boxShadow: "var(--s1)",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        position: "relative"
      }}
    >
      {/* Image Area */}
      <div style={{ width: "100%", aspectRatio: "1", backgroundColor: "var(--bg)", position: "relative" }}>
        {imgSrc ? (
          <img 
            src={imgSrc} 
            alt={product.name} 
            style={{ width: "100%", height: "100%", objectFit: "cover" }} 
            loading="lazy" 
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--bd2)" }}>
            <FiPackage size={32} />
          </div>
        )}
        
        {/* Wishlist Button Overlay */}
        <button 
          style={{
            position: "absolute", top: 8, right: 8,
            background: "var(--wh)", border: "none",
            width: 28, height: 28, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "var(--s1)", color: "var(--ink2)"
          }}
        >
          <FiHeart size={14} />
        </button>
      </div>

      {/* Info Area */}
      <div style={{ padding: "10px 12px 14px", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        <h3 style={{ 
          fontSize: 13, margin: 0, color: "var(--ink)", 
          fontWeight: 600, display: "-webkit-box", 
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" 
        }}>
          {product.name}
        </h3>
        
        <div style={{ marginTop: "auto", paddingTop: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>
            {fmtPrice(product.price)}
          </span>
        </div>

        {/* Brand Orange Cart Button */}
        <button 
          onClick={handleAdd}
          style={{
            marginTop: 8,
            width: "100%", padding: "8px 0",
            background: added ? "var(--gn)" : "var(--o-bg)",
            color: added ? "var(--wh)" : "var(--o)",
            border: "none", borderRadius: "var(--r1)",
            fontSize: 12, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "all 0.2s"
          }}
        >
          {added ? <><FiCheckCircle size={14} /> Added</> : <><FiShoppingCart size={14} /> Add</>}
        </button>
      </div>
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function HomePageMobile() {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [activeCat, setActiveCat] = useState("all");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");

  const categoryList = useMemo(() => [{ id: "all", name: "All Items" }, ...categories], []);

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

  useEffect(() => {
    fetchProducts(0);
  }, [fetchProducts]);

  return (
    <div className="mm-page">
      
      {/* ── BRAND ORANGE HEADER ── */}
      <header style={{ 
        background: "var(--o)", /* Brand Orange */
        padding: "env(safe-area-inset-top) 16px 16px",
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "var(--s2)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingTop: 12 }}>
          {/* Logo Title (White on Orange) */}
          <h1 style={{ margin: 0, color: "var(--wh)", fontSize: 22, fontWeight: 900, letterSpacing: "-0.03em" }}>
            Loemart
          </h1>
          <button style={{ background: "transparent", border: "none", color: "var(--wh)", position: "relative" }}>
            <FiShoppingCart size={24} />
          </button>
        </div>

        {/* Clean White Search Bar */}
        <div style={{ 
          background: "var(--wh)", borderRadius: "var(--r-full)",
          display: "flex", alignItems: "center", padding: "10px 16px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        }}>
          <FiSearch size={18} color="var(--ink3)" />
          <input 
            type="search"
            placeholder="Search for anything..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchProducts(0)}
            style={{ 
              border: "none", background: "transparent", outline: "none",
              width: "100%", marginLeft: 10, fontSize: 15, color: "var(--ink)"
            }}
          />
        </div>
      </header>

      {/* ── CATEGORY SCROLL ── */}
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
              borderRadius: "var(--r-full)", border: "1px solid",
              fontSize: 13, fontWeight: 700, transition: "all 0.2s",
              background: activeCat === c.id ? "var(--o)" : "var(--wh)",
              color: activeCat === c.id ? "var(--wh)" : "var(--ink)",
              borderColor: activeCat === c.id ? "var(--o)" : "var(--bd)",
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* ── CATALOG SECTION (Using your exact CSS classes) ── */}
      <section className="mdp-psec mdp-psec--recommended">
        <div className="mm-catalog-head">
          <div>
            <h2 className="mdp-psec__title">
              {searchQuery ? `Results for "${searchQuery}"` : "Discover"}
            </h2>
            <p className="mm-catalog-sub">Explore the marketplace</p>
          </div>
          <button className="mm-btn-filter-pill">
            <FiSliders size={12} /> Filters
          </button>
        </div>

        {/* Exactly matching your grid class */}
        <div className="pr-masonry">
          {loading && offset === 0 
            ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="pr-masonry-skel" />)
            : products.map((product) => <CleanMobileCard key={product.id} product={product} />)
          }
        </div>

        {!loading && products.length === 0 && (
          <div className="mm-error">
            <FiSearch size={40} color="var(--ink3)" />
            <p style={{ marginTop: 16 }}>No items found.</p>
          </div>
        )}

        {hasMore && (
          <div className="pr-load-more-wrap">
            <button 
              className="pr-load-more-btn" 
              onClick={() => fetchProducts(offset + DEFAULT_LIMIT)}
              disabled={loading}
            >
              {loading ? "Loading..." : "Load More"}
            </button>
          </div>
        )}
      </section>

    </div>
  );
}