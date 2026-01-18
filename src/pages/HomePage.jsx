// src/pages/HomePage.jsx
import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, startAfter, limit, where } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import PostAdModal from "../components/PostAdModal";
import { promotionPlans } from "../config/promotionPlans";
import categoriesConfig from "../config/categories";

export default function HomePage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [promotedProducts, setPromotedProducts] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [lastVisible, setLastVisible] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const PRODUCTS_LIMIT = 12;
  const categories = categoriesConfig.map(c => c.name);

  // -------------------- Fetch Products --------------------
  const fetchProducts = async (loadMore = false) => {
    let q;
    if (loadMore && lastVisible) {
      q = query(
        collection(db, "products"),
        orderBy("createdAt", "desc"),
        startAfter(lastVisible),
        limit(PRODUCTS_LIMIT)
      );
    } else {
      q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(PRODUCTS_LIMIT));
    }

    const snap = await getDocs(q);
    let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filter by category
    if (selectedCategory) docs = docs.filter(p => p.category === selectedCategory);

    // Filter by search
    if (searchQuery) {
      const qLower = searchQuery.toLowerCase();
      docs = docs.filter(
        p =>
          (p.name && p.name.toLowerCase().includes(qLower)) ||
          (p.brand && p.brand.toLowerCase().includes(qLower)) ||
          (p.category && p.category.toLowerCase().includes(qLower))
      );
    }

    // Split promoted and normal
    const promotedIds = promotionPlans.map(p => p.id);
    const promoted = docs.filter(p => promotedIds.includes(p.promotionPlan));
    const normal = docs.filter(p => !promotedIds.includes(p.promotionPlan));

    if (!loadMore) {
      setPromotedProducts(promoted.slice(0, 5)); // first 5 promoted
      const mixed = shuffleArray([...promoted.slice(5), ...normal]);
      setProducts(mixed);
    } else {
      const mixed = shuffleArray([...promoted, ...normal]);
      setProducts(prev => [...prev, ...mixed]);
    }

    if (snap.docs.length) setLastVisible(snap.docs[snap.docs.length - 1]);
  };

  // -------------------- Fetch Trending --------------------
  const fetchTrending = async () => {
    const snap = await getDocs(query(collection(db, "products"), orderBy("clicks", "desc"), limit(5)));
    setTrendingProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    setLastVisible(null);
    fetchProducts(false);
    fetchTrending();
  }, [selectedCategory, searchQuery]);

  const loadMore = async () => {
    setLoadingMore(true);
    await fetchProducts(true);
    setLoadingMore(false);
  };

  const shuffleArray = arr => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // -------------------- Product Card --------------------
  const ProductCard = ({ p }) => {
    const isMiniMart = p.marketType === "minimart";
    const promo = promotionPlans.find(plan => plan.id === p.promotionPlan);

    return (
      <div
        onClick={() => navigate(`/product/${p.id}`)}
        style={{
          flex: "0 0 180px",
          cursor: "pointer",
          borderRadius: 10,
          background: "#fff",
          padding: 10,
          boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
          border: isMiniMart ? "2px solid #0D6EFD" : "1px solid #dee2e6",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ position: "relative" }}>
          <img src={p.imageUrl} alt={p.name} style={{ width: "100%", borderRadius: 6, objectFit: "cover", height: 120 }} />
          {promo && (
            <div style={{
              position: "absolute",
              top: 5,
              left: 5,
              background: promo.isFree ? "#0D6EFD" : "#FFC107",
              padding: "2px 6px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: "bold",
              color: "#fff",
            }}>
              {promo.label}
            </div>
          )}
        </div>
        <p style={{ fontWeight: 600, margin: 0, fontSize: 14 }}>{p.name}</p>
        <p style={{ color: isMiniMart ? "#0D6EFD" : "#dc3545", fontWeight: "bold", margin: 0, fontSize: 14 }}>₦{p.price}</p>
      </div>
    );
  };

  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh", paddingBottom: 50 }}>
      <TopNav />

      {/* Banner */}
      <div style={{ background: "#0D6EFD", color: "#fff", padding: "30px 20px", textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: "2rem" }}>Welcome to MiniMart + Marketplace</h1>
        <p style={{ marginTop: 10, fontSize: "1.1rem" }}>
          Buy and sell safely. Verified sellers in MiniMart. ⚠️ Marketplace payments: inspect before paying.
        </p>
      </div>

      {/* Post Ad */}
      <div style={{ textAlign: "center", marginTop: 20 }}><PostAdModal /></div>

      {/* Search Bar */}
      <div style={{ maxWidth: 600, margin: "20px auto", textAlign: "center" }}>
        <input
          type="text"
          placeholder="Search products by name, category, or brand..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #dee2e6",
            fontSize: 14,
          }}
        />
      </div>

      {/* Category Filter */}
      <div style={{ maxWidth: 1000, margin: "20px auto" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {categories.map(c => (
            <button
              key={c}
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                border: selectedCategory === c ? "2px solid #0D6EFD" : "1px solid #dee2e6",
                background: selectedCategory === c ? "#0D6EFD" : "#fff",
                color: selectedCategory === c ? "#fff" : "#212529",
                cursor: "pointer",
              }}
              onClick={() => setSelectedCategory(c === selectedCategory ? "" : c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Trending */}
      {trendingProducts.length > 0 && (
        <section style={{ maxWidth: 1000, margin: "20px auto" }}>
          <h2 style={{ color: "#DC3545" }}>🔥 Trending Products</h2>
          <div style={{ display: "flex", gap: 20, overflowX: "auto", padding: "10px 0" }}>
            {trendingProducts.map(p => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>
      )}

      {/* Promoted Products */}
      {promotedProducts.length > 0 && (
        <section style={{ maxWidth: 1000, margin: "20px auto" }}>
          <h2 style={{ color: "#FFC107" }}>⭐ Promoted Products</h2>
          <div style={{ display: "flex", gap: 20, overflowX: "auto", padding: "10px 0" }}>
            {promotedProducts.map(p => <ProductCard key={p.id} p={p} />)}
          </div>
        </section>
      )}

      {/* Mixed Feed */}
      <section style={{ maxWidth: 1000, margin: "20px auto" }}>
        <h2 style={{ color: "#0D6EFD" }}>All Products</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "flex-start" }}>
          {products.map(p => <ProductCard key={p.id} p={p} />)}
        </div>
        {products.length >= PRODUCTS_LIMIT && (
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button
              onClick={loadMore}
              disabled={loadingMore}
              style={{
                padding: "8px 16px",
                background: "#0D6EFD",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: "pointer"
              }}
            >
              {loadingMore ? "Loading..." : "Load More"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}