// src/pages/HomePage.jsx
import React, { useEffect, useState, useRef } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import { FaHome, FaStore, FaShoppingCart, FaUser } from "react-icons/fa";
import TopNav from "../components/TopNav";
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
  const [cartCount, setCartCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [topNavHeight, setTopNavHeight] = useState(64); // default

  const sliderRef = useRef(null);
  const topNavRef = useRef(null);
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

  // Load products
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

  // Filter products
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

  // Responsive columns
  useEffect(() => {
    const updateColumns = () => {
      const w = window.innerWidth;
      setColumns(w < 500 ? 2 : w < 900 ? 3 : 4);
    };
    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  // Swipeable trending slider
  const handlers = useSwipeable({
    onSwipedLeft: () => setCurrentSlide(p => (p + 1) % trendingProducts.length),
    onSwipedRight: () => setCurrentSlide(p => (p === 0 ? trendingProducts.length - 1 : p - 1)),
    onSwipeStart: () => setIsDragging(true),
    onSwipeEnd: () => setIsDragging(false),
    trackMouse: true,
  });

  // Auto slide trending
  useEffect(() => {
    if (isDragging || trendingProducts.length === 0) return;
    const interval = setInterval(() => setCurrentSlide(p => (p + 1) % trendingProducts.length), 4000);
    return () => clearInterval(interval);
  }, [isDragging, trendingProducts]);

  // Measure TopNav height dynamically
  useEffect(() => {
    if (topNavRef.current) {
      setTopNavHeight(topNavRef.current.offsetHeight);
    }
  }, []);

  const truncateTitle = title => {
    if (!title) return "";
    const maxWords = 6;
    const maxChars = 40;
    let t = title.split(" ").slice(0, maxWords).join(" ");
    if (t.length > maxChars) t = t.slice(0, maxChars) + "...";
    return t;
  };

  const bottomLinks = [
    { path: "/", label: "Home", icon: <FaHome />, badge: 0 },
    { path: "/minimart", label: "MiniMart", icon: <FaStore />, badge: 0 },
    { path: "/cart", label: "Cart", icon: <FaShoppingCart />, badge: cartCount },
    { path: "/profile", label: "Account", icon: <FaUser />, badge: unreadMessages },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* TopNav pinned */}
      <div ref={topNavRef} style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000 }}>
        <TopNav searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, paddingTop: topNavHeight, paddingBottom: 60, overflowY: "auto" }}>
        {/* Categories */}
        <div style={{ maxWidth: 1200, margin: "10px auto 0", padding: "0 16px", display: "flex", gap: 8, overflowX: "auto" }}>
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

        {/* Trending */}
        {trendingProducts.length > 0 && (
          <section style={{ maxWidth: 1200, margin: "20px auto 10px", padding: "0 16px" }}>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>🔥 Trending</h2>
            <div ref={sliderRef} {...handlers} style={{ display: "flex", overflow: "hidden" }}>
              {trendingProducts.map(p => (
                <div key={p.id} onClick={() => navigate(`/product/${p.id}`)}
                  style={{
                    minWidth: `${100 / columns}%`,
                    padding: 6,
                    boxSizing: "border-box",
                    transform: `translateX(-${currentSlide * (100 / columns)}%)`,
                    transition: "transform 0.3s ease",
                  }}
                >
                  <div style={{
                    background: "#fff",
                    borderRadius: 14,
                    overflow: "hidden",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                    cursor: "pointer",
                  }}>
                    <img src={p.images?.[0] || "/placeholder.png"} alt="" style={{ width: "100%", height: 150, objectFit: "cover" }} />
                    <div style={{ padding: 10 }}>
                      <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{truncateTitle(p.title)}</p>
                      <p style={{ color: "#198754", fontWeight: "bold", marginTop: 4 }}>₦{Number(p.price).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Product Feed */}
        <section style={{
          maxWidth: 1200,
          margin: "0 auto 20px",
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

      {/* Bottom Navigation */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        borderTop: "1px solid #e0e6ef",
        background: "#f5f7fb",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        zIndex: 1000
      }}>
        {bottomLinks.map(link => (
          <div key={link.path} onClick={() => navigate(link.path)} style={{ textAlign: "center", cursor: "pointer", position: "relative" }}>
            <div style={{ fontSize: 20 }}>{link.icon}</div>
            <div style={{ fontSize: 12 }}>{link.label}</div>
            {link.badge > 0 && (
              <span style={{
                position: "absolute",
                top: -4,
                right: -10,
                background: "red",
                color: "#fff",
                fontSize: 10,
                padding: "2px 5px",
                borderRadius: "50%",
                fontWeight: "bold"
              }}>{link.badge}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}