// src/pages/HomePage.jsx
import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import PostAdModal from "../components/PostAdModal";
import categories from "../config/categories";
import { promotionPlans } from "../config/promotionPlans";
import { FiMapPin } from "react-icons/fi";

export default function HomePage() {
  const navigate = useNavigate();
  const [allProducts, setAllProducts] = useState([]);
  const [displayProducts, setDisplayProducts] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(34);

  // -------------------- Helpers --------------------
  const shuffleArray = arr => arr.sort(() => Math.random() - 0.5);
  const formatPrice = price => `₦${Number(price).toLocaleString()}`;

  // Load all products from Firestore
  const loadProducts = async () => {
    const snap = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc")));
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setAllProducts(products);

    const promoted = products.filter(p => promotionPlans.some(plan => plan.id === p.promotionPlan));
    const shuffled = shuffleArray(products);
    const trendingSimulated = [...promoted.slice(0, 3), ...shuffled.slice(0, 2)]; // top 5
    setTrendingProducts(trendingSimulated);
  };

  useEffect(() => { loadProducts(); }, []);

  // Increment click count
  const handleProductClick = async (p) => {
    navigate(`/product/${p.id}`);
    const productRef = doc(db, "products", p.id);
    await updateDoc(productRef, { clicks: (p.clicks || 0) + 1 });
  };

  // Filter, search, and mix feed
  useEffect(() => {
    let filtered = [...allProducts];

    if (selectedCategory)
      filtered = filtered.filter(p => p.mainCategory === selectedCategory);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        p =>
          (p.title?.toLowerCase().includes(q) ||
           p.name?.toLowerCase().includes(q) ||
           p.brand?.toLowerCase().includes(q) ||
           p.mainCategory?.toLowerCase().includes(q))
      );
      // Increment search count
      filtered.forEach(async p => {
        const productRef = doc(db, "products", p.id);
        await updateDoc(productRef, { searchCount: (p.searchCount || 0) + 1 });
      });
    }

    // Promoted first
    const promoted = filtered.filter(p => promotionPlans.some(plan => plan.id === p.promotionPlan));
    const regular = filtered.filter(p => !promoted.includes(p));
    const promotedTop = promoted.slice(0, 5);
    const mixed = shuffleArray(regular);

    setDisplayProducts([...promotedTop, ...mixed]);
    setVisibleCount(34);
  }, [allProducts, selectedCategory, searchQuery]);

  const productCardStyle = {
    padding: 12,
    borderRadius: 8,
    background: "#fff",
    boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    cursor: "pointer",
    minHeight: 260,
    position: "relative",
  };

  // -------------------- Product Card JSX --------------------
  const renderProductCard = (p, trending = false) => {
    const promotion = promotionPlans.find(plan => plan.id === p.promotionPlan);
    const isPromoted = !!promotion;

    return (
      <div
        key={p.id}
        onClick={() => handleProductClick(p)}
        style={{
          ...productCardStyle,
          flexShrink: 0,
          minWidth: trending ? 140 : 180,
          minHeight: trending ? 200 : 260,
          padding: trending ? 8 : 12,
          border: `2px solid ${p.marketType === "minimart" ? "#0D6EFD" : "#dee2e6"}`
        }}
      >
        {isPromoted && (
          <div style={{
            position: "absolute",
            top: 6,
            left: 6,
            background: "#ffc107",
            padding: "2px 6px",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            zIndex: 1,
          }}>
            {promotion.icon}
          </div>
        )}

        <img
          src={p.images?.[0]}
          alt={p.title || p.name}
          style={{ width: "100%", height: trending ? 80 : 100, objectFit: "cover", borderRadius: 5, marginBottom: 6 }}
        />

        <p style={{ fontWeight: 600, color: "#212529", margin: 0, textAlign: "center", fontSize: 13 }}>
          {p.title || p.name}
        </p>

        <p style={{ color: p.marketType === "minimart" ? "#198754" : "#dc3545", fontWeight: "bold", marginTop: 4, fontSize: 13 }}>
          {formatPrice(p.price)}
        </p>

        {/* Bottom Info */}
        <div style={{ width: "100%", marginTop: 4, display: "flex", flexDirection: "column", gap: 2, fontSize: 11 }}>
          {/* Location: only Marketplace */}
          {p.marketType !== "minimart" && (p.state || p.city) && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <FiMapPin size={12} />
              <span>{[p.state, p.city].filter(Boolean).join(" ")}</span>
            </div>
          )}

          {/* Condition left / Promo right */}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {p.condition && <span>{p.condition}</span>}
            {isPromoted && <span>{promotion.icon}</span>}
          </div>
        </div>
      </div>
    );
  };

  // -------------------- JSX --------------------
  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh", paddingBottom: 50 }}>
      <TopNav />

      {/* Search & Post Ad */}
      <div style={{ maxWidth: 1000, margin: "20px auto", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search products by name, title, brand, category..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #cce0ff", outline: "none" }}
        />
        <PostAdModal /> {/* Leads to AddProduct.js - Marketplace only */}
      </div>

      {/* Category Filter */}
      <div style={{ maxWidth: 1000, margin: "10px auto 20px auto", display: "flex", flexWrap: "wrap", gap: 10 }}>
        {categories.map(c => (
          <button
            key={c.name}
            onClick={() => setSelectedCategory(selectedCategory === c.name ? "" : c.name)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: selectedCategory === c.name ? "2px solid #0D6EFD" : "1px solid #dee2e6",
              background: selectedCategory === c.name ? "#e0ecff" : "#fff",
              cursor: "pointer",
            }}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {/* Trending Products */}
      <section style={{ maxWidth: 1000, margin: "20px auto" }}>
        <h2 style={{ color: "#DC3545", marginBottom: 10 }}>🔥 Trending Products</h2>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "8px 0" }}>
          {trendingProducts.map(p => renderProductCard(p, true))}
        </div>
      </section>

      {/* Mixed Products Feed */}
      <section style={{ maxWidth: 1000, margin: "20px auto" }}>
        <h2 style={{ color: "#0D6EFD", marginBottom: 10 }}>Products Feed</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 20 }}>
          {displayProducts.slice(0, visibleCount).map(p => renderProductCard(p))}
        </div>

        {visibleCount < displayProducts.length && (
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button
              onClick={() => setVisibleCount(prev => prev + 12)}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                background: "#0D6EFD",
                color: "#fff",
                border: "none",
                cursor: "pointer",
              }}
            >
              Load More
            </button>
          </div>
        )}
      </section>
    </div>
  );
}