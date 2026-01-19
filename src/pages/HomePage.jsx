// src/pages/HomePage.jsx
import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import PostAdModal from "../components/PostAdModal";
import categories from "../config/categories";
import { promotionPlans } from "../config/promotionPlans";

export default function HomePage() {
  const navigate = useNavigate();
  const [allProducts, setAllProducts] = useState([]);
  const [displayProducts, setDisplayProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const loadProducts = async () => {
    const snap = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc")));
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setAllProducts(products);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Filter & search logic
  useEffect(() => {
    let filtered = [...allProducts];

    if (selectedCategory) {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.title?.toLowerCase().includes(q));
    }

    const promoted = filtered.filter(p => promotionPlans.some(plan => plan.id === p.promotionPlan));
    const regular = filtered.filter(p => !promoted.includes(p));

    const promotedTop = promoted.slice(0, 5);
    const mixed = [...promotedTop, ...shuffleArray(regular)];

    setDisplayProducts(mixed);
  }, [allProducts, selectedCategory, searchQuery]);

  const shuffleArray = arr => arr.sort(() => Math.random() - 0.5);

  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh", paddingBottom: 50 }}>
      <TopNav />

      {/* Banner */}
      <div
        style={{
          background: "#0D6EFD",
          color: "#fff",
          padding: "30px 20px",
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "2rem" }}>Welcome to MiniMart + Marketplace</h1>
        <p style={{ marginTop: 10, fontSize: "1.1rem" }}>
          Buy and sell safely. Verified sellers in MiniMart. ⚠️ Marketplace payments: inspect before paying.
        </p>
      </div>

      {/* Post Ad & Search */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1000, margin: "20px auto", gap: 15 }}>
        <PostAdModal />
        <input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #cce0ff",
            outline: "none",
          }}
        />
      </div>

      {/* Category Filter */}
      <div style={{ maxWidth: 1000, margin: "10px auto", display: "flex", flexWrap: "wrap", gap: 10 }}>
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
            <span style={{ marginRight: 6 }}>{c.icon}</span>
            {c.name}
          </button>
        ))}
      </div>

      {/* Products Feed */}
      <section style={{ maxWidth: 1000, margin: "20px auto" }}>
        <h2 style={{ color: "#0D6EFD" }}>Products Feed</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 20 }}>
          {displayProducts.length ? displayProducts.map(p => {
            const isPromoted = promotionPlans.some(plan => plan.id === p.promotionPlan);
            const imageSrc = p.imageUrl || (p.images && p.images[0]) || "/placeholder.png";
            return (
              <div
                key={p.id}
                onClick={() => navigate(`/product/${p.id}`)}
                style={{
                  position: "relative",
                  border: `1px solid ${p.marketType === "minimart" ? "#0D6EFD" : "#dee2e6"}`,
                  padding: 10,
                  cursor: "pointer",
                  borderRadius: 8,
                  background: "#fff",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                  display: "flex",
                  flexDirection: "column",
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
                  }}>PROMO</div>
                )}

                {/* Product Image */}
                <img src={imageSrc} alt={p.title} style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 5, marginBottom: 10 }}
                     onError={e => e.target.src = "/placeholder.png"} />

                {/* Title */}
                <p style={{ fontWeight: 600, color: "#212529", margin: 0, minHeight: 38, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.title}
                </p>

                {/* Location */}
                {p.city && p.state && (
                  <p style={{ fontSize: 12, color: "#6c757d", margin: "4px 0" }}>
                    {p.city}, {p.state}
                  </p>
                )}

                {/* Price */}
                <p style={{ color: p.marketType === "minimart" ? "#198754" : "#dc3545", fontWeight: "bold", marginTop: 4 }}>
                  ₦{p.price}
                </p>
              </div>
            );
          }) : <p>No products found.</p>}
        </div>
      </section>
    </div>
  );
}