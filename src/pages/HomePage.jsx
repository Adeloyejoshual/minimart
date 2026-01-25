// src/pages/HomePage.jsx
import { useEffect, useState, useRef } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import TopNav from "../components/TopNav";
import PostAdModal from "../components/PostAdModal";
import categories from "../config/categories";
import { promotionPlans } from "../config/promotionPlans";

export default function HomePage() {
  const navigate = useNavigate();

  const [allProducts, setAllProducts] = useState([]);
  const [displayProducts, setDisplayProducts] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [columns, setColumns] = useState(2);
  const [isDragging, setIsDragging] = useState(false);

  const sliderRef = useRef(null);
  const promoPlanIds = promotionPlans.map(p => p.id);

  const getPromotionPlan = id => promotionPlans.find(p => p.id === id);

  const calculateAIScore = product => {
    const views = product.views || 0;
    const clicks = product.clicks || 0;
    const searches = product.searchHits || 0;
    const plan = getPromotionPlan(product.promotionPlan);
    const promotionBoost = plan ? plan.priority * 40 : 0;
    const createdAt = product.createdAt?.toMillis ? product.createdAt.toMillis() : Date.now();
    const daysOld = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
    const freshnessBoost = Math.max(20 - daysOld, 0);
    return views * 3 + clicks * 2 + searches + promotionBoost + freshnessBoost;
  };

  const shuffleArray = arr => [...arr].sort(() => Math.random() - 0.5);

  // --- Load products ---
  useEffect(() => {
    const loadProducts = async () => {
      const snap = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc")));
      const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllProducts(products);

      const scored = products.map(p => ({ ...p, trendingScore: calculateAIScore(p) }));
      setTrendingProducts(scored.sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 8));
    };
    loadProducts();
  }, []);

  // --- Filter products ---
  useEffect(() => {
    let filtered = [...allProducts];
    if (selectedCategory) filtered = filtered.filter(p => p.category === selectedCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        p => p.title?.toLowerCase().includes(q) ||
             p.city?.toLowerCase().includes(q) ||
             p.state?.toLowerCase().includes(q)
      );
    }

    const promoted = filtered.filter(p => promoPlanIds.includes(p.promotionPlan));
    const promotedIds = new Set(promoted.map(p => p.id));
    const regular = filtered.filter(p => !promotedIds.has(p.id));

    setDisplayProducts([...promoted.slice(0, 5), ...shuffleArray(regular)]);
  }, [allProducts, selectedCategory, searchQuery]);

  // --- Responsive columns for feed ---
  useEffect(() => {
    const updateColumns = () => setColumns(window.innerWidth < 500 ? 2 : window.innerWidth < 900 ? 3 : 4);
    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  // --- Swipeable trending slider ---
  const handlers = useSwipeable({
    onSwipedLeft: () => setCurrentSlide(p => (p + 1) % trendingProducts.length),
    onSwipedRight: () => setCurrentSlide(p => (p === 0 ? trendingProducts.length - 1 : p - 1)),
    onSwipeStart: () => setIsDragging(true),
    onSwipeEnd: () => setIsDragging(false),
    trackMouse: true,
  });

  // --- Auto slide trending ---
  useEffect(() => {
    if (isDragging || trendingProducts.length === 0) return;
    const interval = setInterval(() => setCurrentSlide(p => (p + 1) % trendingProducts.length), 4000);
    return () => clearInterval(interval);
  }, [isDragging, trendingProducts]);

  // --- Truncate title ---
  const truncateTitle = (title) => {
    if (!title) return "";
    const maxWords = 6;
    const maxChars = 40;
    let t = title.split(" ").slice(0, maxWords).join(" ");
    if (t.length > maxChars) t = t.slice(0, maxChars) + "...";
    return t;
  };

  return (
    <div style={{ background: "#f5f7fb", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Pinned TopNav */}
      <div style={{ position: "sticky", top: 0, zIndex: 999 }}>
        <TopNav />
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }}>
        {/* Search */}
        <div style={{ maxWidth: 1200, margin: "20px auto", padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            placeholder="Search for phones, cars, fashion..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #d0d7e2",
              fontSize: 14,
              outline: "none",
              boxShadow: "0 2px 6px rgba(0,0,0,0.04)"
            }}
          />
        </div>

        {/* Categories */}
        <div style={{ maxWidth: 1200, margin: "10px auto", padding: "0 16px", display: "flex", gap: 8, overflowX: "auto" }}>
          {categories.map(c => (
            <button
              key={c.name}
              onClick={() => setSelectedCategory(selectedCategory === c.name ? "" : c.name)}
              style={{
                padding: "8px 14px",
                borderRadius: 20,
                border: selectedCategory === c.name ? "2px solid #0d6efd" : "1px solid #e0e6ef",
                background: selectedCategory === c.name ? "#e7f0ff" : "#fff",
                fontSize: 13,
                whiteSpace: "nowrap",
                cursor: "pointer",
                fontWeight: 500
              }}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>

        {/* Trending Slider */}
        {trendingProducts.length > 0 && (
          <section style={{ maxWidth: 1200, margin: "25px auto", padding: "0 16px" }}>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>🔥 Trending</h2>
            <div ref={sliderRef} {...handlers} style={{ display: "flex", overflow: "hidden" }}>
              {trendingProducts.map(p => {
                const width = window.innerWidth;
                let cols = width < 500 ? 2 : width < 900 ? 3 : 4;
                return (
                  <div key={p.id} onClick={() => navigate(`/product/${p.id}`)}
                    style={{
                      minWidth: `${100 / cols}%`,
                      padding: 6,
                      boxSizing: "border-box",
                      transform: `translateX(-${currentSlide * (100 / cols)}%)`,
                      transition: "transform 0.3s ease",
                    }}
                  >
                    <div style={{
                      background: "#fff",
                      borderRadius: 14,
                      overflow: "hidden",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                      cursor: "pointer",
                      transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = "scale(1.03)";
                      e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.12)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)";
                    }}>
                      <img src={p.images?.[0] || "/placeholder.png"} alt="" style={{ width: "100%", height: 150, objectFit: "cover" }} />
                      <div style={{ padding: 10 }}>
                        <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{truncateTitle(p.title)}</p>
                        <p style={{ color: "#198754", fontWeight: "bold", marginTop: 4 }}>₦{Number(p.price).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Product Feed */}
        <section style={{
          maxWidth: 1200,
          margin: "10px auto",
          padding: "0 16px",
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: 12
        }}>
          {displayProducts.map(p => (
            <div key={p.id} onClick={() => navigate(`/product/${p.id}`)}
              style={{
                background: "#fff",
                borderRadius: 14,
                boxShadow: "0 3px 10px rgba(0,0,0,0.05)",
                cursor: "pointer",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "scale(1.03)";
                e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.12)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "0 3px 10px rgba(0,0,0,0.05)";
              }}
            >
              <img src={p.images?.[0] || "/placeholder.png"} alt="" style={{ width: "100%", height: 180, objectFit: "cover" }} />
              <div style={{ padding: 10 }}>
                <p style={{ fontWeight: 600, margin: 0 }}>{truncateTitle(p.title)}</p>
                <p style={{ fontSize: 12, color: "#6c757d", margin: "4px 0" }}>📍 {p.city}, {p.state}</p>
                <p style={{ color: "#198754", fontWeight: "bold" }}>₦{Number(p.price).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* Fixed bottom PostAd button */}
      <div style={{
        position: "sticky",
        bottom: 0,
        width: "100%",
        background: "#f5f7fb",
        padding: 12,
        display: "flex",
        justifyContent: "center",
        borderTop: "1px solid #e0e6ef",
      }}>
        <PostAdModal />
      </div>
    </div>
  );
}