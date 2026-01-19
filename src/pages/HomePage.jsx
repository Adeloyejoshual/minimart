// src/pages/HomePage.jsx
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
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
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [trendingByCategory, setTrendingByCategory] = useState({});
  const [currentSlide, setCurrentSlide] = useState(0);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // 🔹 Load products
  const loadProducts = async () => {
    const snap = await getDocs(
      query(collection(db, "products"), orderBy("createdAt", "desc"))
    );

    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setAllProducts(products);

    // 🔥 Trending score
    const scored = products.map(p => ({
      ...p,
      score:
        (p.views || 0) * 3 +
        (p.clicks || 0) * 2 +
        (p.searchHits || 0),
    }));

    // 🔥 Global trending
    setTrendingProducts(
      [...scored].sort((a, b) => b.score - a.score).slice(0, 10)
    );

    // 📂 Trending by category
    const byCategory = {};
    scored.forEach(p => {
      if (!p.category) return;
      if (!byCategory[p.category]) byCategory[p.category] = [];
      byCategory[p.category].push(p);
    });

    Object.keys(byCategory).forEach(cat => {
      byCategory[cat] = byCategory[cat]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    });

    setTrendingByCategory(byCategory);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // 🔄 Auto-rotate slider
  useEffect(() => {
    if (!trendingProducts.length) return;
    const interval = setInterval(() => {
      setCurrentSlide(p =>
        p === trendingProducts.length - 1 ? 0 : p + 1
      );
    }, 4000);
    return () => clearInterval(interval);
  }, [trendingProducts]);

  // 🔍 Filter & search
  useEffect(() => {
    let filtered = [...allProducts];

    if (selectedCategory) {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        p =>
          p.title?.toLowerCase().includes(q) ||
          p.city?.toLowerCase().includes(q) ||
          p.state?.toLowerCase().includes(q)
      );
    }

    const promoIds = promotionPlans.map(p => p.id);
    const promoted = filtered.filter(p => promoIds.includes(p.promotionPlan));
    const promotedIds = new Set(promoted.map(p => p.id));
    const regular = filtered.filter(p => !promotedIds.has(p.id));

    const mixed = [...promoted.slice(0, 5), ...shuffleArray(regular)];
    setDisplayProducts(mixed);
  }, [allProducts, selectedCategory, searchQuery]);

  const shuffleArray = arr => [...arr].sort(() => Math.random() - 0.5);

  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh", paddingBottom: 50 }}>
      <TopNav />

      {/* 🔥 Trending Slider */}
      {trendingProducts[currentSlide] && (
        <section style={{ maxWidth: 1000, margin: "20px auto" }}>
          <div
            onClick={() =>
              navigate(`/product/${trendingProducts[currentSlide].id}`)
            }
            style={{
              height: 260,
              borderRadius: 12,
              backgroundImage: `url(${trendingProducts[currentSlide].imageUrl ||
                trendingProducts[currentSlide].images?.[0]})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              cursor: "pointer",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                bottom: 0,
                width: "100%",
                padding: 15,
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
                borderBottomLeftRadius: 12,
                borderBottomRightRadius: 12,
              }}
            >
              <h3>{trendingProducts[currentSlide].title}</h3>
              <p>
                ₦
                {Number(trendingProducts[currentSlide].price).toLocaleString(
                  "en-NG"
                )}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Post Ad & Search */}
      <div style={{ display: "flex", gap: 15, maxWidth: 1000, margin: "20px auto" }}>
        <PostAdModal />
        <input
          placeholder="Search products..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 8,
            border: "1px solid #cce0ff",
          }}
        />
      </div>

      {/* Category Filter */}
      <div style={{ maxWidth: 1000, margin: "10px auto", display: "flex", flexWrap: "wrap", gap: 10 }}>
        {categories.map(c => (
          <button
            key={c.name}
            onClick={() =>
              setSelectedCategory(selectedCategory === c.name ? "" : c.name)
            }
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: selectedCategory === c.name ? "2px solid #0D6EFD" : "1px solid #dee2e6",
              background: selectedCategory === c.name ? "#e0ecff" : "#fff",
            }}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {/* 📂 Trending by Category */}
      {Object.entries(trendingByCategory).map(([cat, items]) => (
        <section key={cat} style={{ maxWidth: 1000, margin: "20px auto" }}>
          <h3 style={{ color: "#0D6EFD" }}>🔥 Trending in {cat}</h3>
          <div style={{ display: "flex", gap: 15, overflowX: "auto" }}>
            {items.map(p => (
              <div
                key={p.id}
                onClick={() => navigate(`/product/${p.id}`)}
                style={{
                  minWidth: 180,
                  background: "#fff",
                  padding: 10,
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                <img
                  src={p.imageUrl || p.images?.[0]}
                  style={{ width: "100%", height: 120, objectFit: "cover" }}
                />
                <p>{p.title}</p>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Products Feed */}
      <section style={{ maxWidth: 1000, margin: "20px auto" }}>
        <h2 style={{ color: "#0D6EFD" }}>Products Feed</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 20 }}>
          {displayProducts.map(p => (
            <div
              key={p.id}
              onClick={() => navigate(`/product/${p.id}`)}
              style={{
                background: "#fff",
                padding: 10,
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              <img
                src={p.imageUrl || p.images?.[0] || "/placeholder.png"}
                style={{ width: "100%", height: 150, objectFit: "cover" }}
              />
              <p>{p.title}</p>
              <strong>
                ₦{Number(p.price).toLocaleString("en-NG")}
              </strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}