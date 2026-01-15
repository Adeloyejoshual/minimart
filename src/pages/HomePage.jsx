// pages/HomePage.jsx
import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, where, limit } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import CategoryFilter from "../components/CategoryFilter";

export default function HomePage() {
  const navigate = useNavigate();
  const [miniMartProducts, setMiniMartProducts] = useState([]);
  const [marketplaceProducts, setMarketplaceProducts] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");

  const categories = [
    { name: "Vehicles", sub: ["Cars", "Motorcycles", "Trucks"] },
    { name: "Property", sub: ["Houses", "Apartments", "Land"] },
    { name: "Mobile Phones & Tablets", sub: ["Phones", "Tablets", "Accessories"] },
    { name: "Electronics", sub: ["TVs", "Laptops", "Audio"] },
    { name: "Home, Furniture & Appliances", sub: ["Furniture", "Appliances", "Decor"] },
    { name: "Fashion", sub: ["Men", "Women", "Kids"] },
    { name: "Beauty & Personal Care", sub: ["Skincare", "Hair", "Makeup"] },
  ];

  useEffect(() => {
    const loadProducts = async () => {
      // MiniMart Products
      let miniQ = query(
        collection(db, "products"),
        where("marketType", "==", "minimart"),
        orderBy("createdAt", "desc")
      );
      const miniSnap = await getDocs(miniQ);
      let miniProds = miniSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (selectedCategory)
        miniProds = miniProds.filter(p => p.category === selectedCategory);
      setMiniMartProducts(miniProds);

      // Marketplace Products
      let marketQ = query(
        collection(db, "products"),
        where("marketType", "==", "marketplace"),
        orderBy("createdAt", "desc")
      );
      const marketSnap = await getDocs(marketQ);
      let marketProds = marketSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (selectedCategory)
        marketProds = marketProds.filter(p => p.category === selectedCategory);
      setMarketplaceProducts(marketProds);

      // Trending Products (top 5 recent across both markets)
      const trendingSnap = await getDocs(
        query(collection(db, "products"), orderBy("createdAt", "desc"), limit(5))
      );
      setTrendingProducts(trendingSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    loadProducts();
  }, [selectedCategory]);

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
        <h1 style={{ margin: 0, fontSize: "2rem" }}>
          Welcome to MiniMart + Marketplace
        </h1>
        <p style={{ marginTop: 10, fontSize: "1.1rem" }}>
          Buy and sell safely. Verified sellers in MiniMart. ⚠️ Marketplace payments: inspect before paying.
        </p>
      </div>

      {/* Trending Products */}
      <section style={{ maxWidth: 1000, margin: "20px auto" }}>
        <h2 style={{ color: "#DC3545" }}>🔥 Trending Products</h2>
        <div style={{ display: "flex", gap: 15, overflowX: "auto", padding: "10px 0" }}>
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
              }}
            >
              <img src={p.imageUrl} alt={p.name} style={{ width: "100%", borderRadius: 5 }} />
              <p style={{ fontWeight: 600, margin: "5px 0 0 0" }}>{p.name}</p>
              <p style={{ color: "#198754", fontWeight: "bold" }}>₦{p.price}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Category Filter */}
      <div style={{ maxWidth: 1000, margin: "20px auto" }}>
        <CategoryFilter
          categories={categories.map(c => c.name)}
          selected={selectedCategory}
          onChange={setSelectedCategory}
        />
      </div>

      {/* MiniMart Section */}
      <section style={{ maxWidth: 1000, margin: "20px auto" }}>
        <h2 style={{ color: "#0D6EFD" }}>MiniMart (Verified Sellers)</h2>
        <button
          onClick={() => navigate("/add-product?market=minimart")}
          style={{
            padding: "8px 16px",
            background: "#198754",
            color: "#fff",
            border: "none",
            borderRadius: 5,
            cursor: "pointer",
            fontWeight: 600,
            marginBottom: 10,
          }}
        >
          Add Product
        </button>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          {miniMartProducts.map(p => (
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
              <img src={p.imageUrl} width="150" style={{ borderRadius: 5, marginBottom: 10 }} />
              <p style={{ fontWeight: 600, color: "#212529", margin: 0 }}>{p.name}</p>
              <p style={{ color: "#198754", fontWeight: "bold", marginTop: 4 }}>₦{p.price}</p>
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
              <img src={p.imageUrl} width="150" style={{ borderRadius: 5, marginBottom: 10 }} />
              <p style={{ fontWeight: 600, color: "#212529", margin: 0 }}>{p.name}</p>
              <p style={{ color: "#dc3545", fontWeight: "bold", marginTop: 4 }}>₦{p.price}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}