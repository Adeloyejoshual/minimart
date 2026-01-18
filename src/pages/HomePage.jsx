// pages/HomePage.jsx
import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, limit, where } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import categories from "../config/categories";

export default function HomePage() {
  const navigate = useNavigate();
  const [miniMartProducts, setMiniMartProducts] = useState([]);
  const [marketplaceProducts, setMarketplaceProducts] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");

  useEffect(() => {
    const loadProducts = async () => {
      const productsSnap = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc")));
      let allProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Trending: top 5 recent
      setTrendingProducts(allProducts.slice(0, 5));

      // MiniMart
      let miniProds = allProducts.filter(p => p.marketType === "minimart");
      if (selectedCategory) miniProds = miniProds.filter(p => p.mainCategory === selectedCategory);
      setMiniMartProducts(miniProds);

      // Marketplace
      let marketProds = allProducts.filter(p => p.marketType === "marketplace" || p.marketType === "minimart");
      if (selectedCategory) marketProds = marketProds.filter(p => p.mainCategory === selectedCategory);
      setMarketplaceProducts(marketProds);
    };

    loadProducts();
  }, [selectedCategory]);

  const formatPrice = price => `₦${Number(price).toLocaleString()}`;

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

      {/* Category Filter */}
      <div style={{ maxWidth: 1000, margin: "20px auto", display: "flex", flexWrap: "wrap", gap: 10 }}>
        {categories.map(cat => (
          <button
            key={cat.name}
            onClick={() => setSelectedCategory(cat.name)}
            style={{
              padding: "8px 12px",
              background: selectedCategory === cat.name ? "#0D6EFD" : "#fff",
              color: selectedCategory === cat.name ? "#fff" : "#212529",
              border: "1px solid #0D6EFD",
              borderRadius: 5,
              cursor: "pointer",
            }}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
        {selectedCategory && (
          <button
            onClick={() => setSelectedCategory("")}
            style={{
              padding: "8px 12px",
              background: "#fff",
              color: "#212529",
              border: "1px solid #dc3545",
              borderRadius: 5,
              cursor: "pointer",
            }}
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* Trending Products */}
      <section style={{ maxWidth: 1000, margin: "20px auto" }}>
        <h2 style={{ color: "#DC3545" }}>🔥 Trending Products</h2>
        <div style={{ display: "flex", gap: 15, overflowX: "auto", padding: "10px 0", paddingBottom: 20 }}>
          {trendingProducts.map(p => (
            <div
              key={p.id}
              onClick={() => navigate(`/product/${p.id}`)}
              style={{
                minWidth: 180,
                cursor: "pointer",
                borderRadius: 8,
                background: "#fff",
                padding: 10,
                boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                flexShrink: 0,
              }}
            >
              <img
                src={p.images?.[0]}
                alt={p.title || p.name}
                style={{ width: "100%", borderRadius: 5, marginBottom: 8 }}
              />
              <p style={{ fontWeight: 600, margin: "5px 0 0 0" }}>{p.title || p.name}</p>
              <p style={{ color: "#198754", fontWeight: "bold" }}>{formatPrice(p.price)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MiniMart Section */}
      <section style={{ maxWidth: 1000, margin: "20px auto" }}>
        <h2 style={{ color: "#0D6EFD" }}>MiniMart (Verified Sellers)</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          {miniMartProducts.map(p => (
            <div
              key={p.id}
              onClick={() => navigate(`/product/${p.id}`)}
              style={{
                border: "2px solid #0D6EFD",
                padding: 10,
                width: 180,
                cursor: "pointer",
                borderRadius: 8,
                background: "#fff",
                boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
              }}
            >
              <img
                src={p.images?.[0]}
                width="150"
                style={{ borderRadius: 5, marginBottom: 10 }}
              />
              <p style={{ fontWeight: 600, color: "#212529", margin: 0 }}>{p.title || p.name}</p>
              <p style={{ color: "#0D6EFD", fontWeight: "bold", marginTop: 4 }}>{formatPrice(p.price)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Marketplace Section */}
      <section style={{ maxWidth: 1000, margin: "40px auto" }}>
        <div style={{ background: "#fff3cd", padding: 10, borderRadius: 5, marginBottom: 10, color: "#856404" }}>
          ⚠️ Do NOT pay before delivery. Always inspect the product before paying.
        </div>
        <h2 style={{ color: "#0D6EFD" }}>Marketplace</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          {marketplaceProducts.map(p => (
            <div
              key={p.id}
              onClick={() => navigate(`/product/${p.id}`)}
              style={{
                border: "1px solid #dee2e6",
                padding: 10,
                width: 180,
                cursor: "pointer",
                borderRadius: 8,
                background: "#fff",
                boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
              }}
            >
              <img
                src={p.images?.[0]}
                width="150"
                style={{ borderRadius: 5, marginBottom: 10 }}
              />
              <p style={{ fontWeight: 600, color: "#212529", margin: 0 }}>{p.title || p.name}</p>
              <p style={{ color: "#dc3545", fontWeight: "bold", marginTop: 4 }}>{formatPrice(p.price)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}