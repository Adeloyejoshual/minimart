// src/pages/MiniMart.jsx
import React, { useEffect, useState, useRef } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { FaStore, FaShoppingCart, FaUser } from "react-icons/fa";
import TopNav from "../components/TopNav";
import { promotionPlans } from "../config/promotionPlans";

export default function MiniMart() {
  const navigate = useNavigate();

  const [allProducts, setAllProducts] = useState([]);
  const [displayProducts, setDisplayProducts] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const [columns, setColumns] = useState(2);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const sliderRef = useRef(null);
  const promoPlanIds = promotionPlans.map(p => p.id);

  const getPromotionPlan = id => promotionPlans.find(p => p.id === id);
  const truncateTitle = title => {
    if (!title) return "";
    const maxWords = 6;
    const maxChars = 40;
    let t = title.split(" ").slice(0, maxWords).join(" ");
    if (t.length > maxChars) t = t.slice(0, maxChars) + "...";
    return t;
  };
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

  // Load products from Firestore
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "products"), where("marketType", "==", "minimart"), orderBy("createdAt", "desc"))
        );
        const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAllProducts(products);

        const scored = products.map(p => ({ ...p, trendingScore: calculateAIScore(p) }));
        setTrendingProducts(scored.sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 8));

        const promoted = products.filter(p => promoPlanIds.includes(p.promotionPlan));
        const promotedIds = new Set(promoted.map(p => p.id));
        const regular = products.filter(p => !promotedIds.has(p.id));
        setDisplayProducts([...promoted.slice(0, 5), ...shuffleArray(regular)]);
      } catch (err) {
        console.error("Failed to load products", err);
      }
    };

    loadProducts();
    loadCartAndMessages();
  }, []);

  const loadCartAndMessages = () => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    getDocs(query(collection(db, "carts"), where("userId", "==", uid))).then(snap => setCartCount(snap.docs.length));
    getDocs(query(collection(db, "messages"), where("toUser", "==", uid), where("read", "==", false))).then(snap =>
      setUnreadMessages(snap.docs.length)
    );
  };

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

  // Auto slide trending
  useEffect(() => {
    if (isDragging || trendingProducts.length === 0) return;
    const interval = setInterval(() => setCurrentSlide(p => (p + 1) % trendingProducts.length), 4000);
    return () => clearInterval(interval);
  }, [isDragging, trendingProducts]);

  const bottomLinks = [
    { path: "/", label: "Home", icon: <FaStore />, badge: 0 },
    { path: "/minimart", label: "MiniMart", icon: <FaStore />, badge: 0 },
    { path: "/cart", label: "Cart", icon: <FaShoppingCart />, badge: cartCount },
    { path: "/profile", label: "Account", icon: <FaUser />, badge: unreadMessages },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#f5f7fb" }}>
      {/* TopNav pinned */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000 }}>
        <TopNav />
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, marginTop: 72, marginBottom: 60, overflowY: "auto" }}>
        {/* Trending */}
        {trendingProducts.length > 0 && (
          <section style={{ padding: "0 16px", marginTop: 10 }}>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>🔥 Trending</h2>
            <div style={{ display: "flex", overflowX: "auto", gap: 12, paddingBottom: 6 }}>
              {trendingProducts.map(p => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/product/${p.id}`)}
                  style={{
                    minWidth: 160,
                    background: "#e6f0ff",
                    borderRadius: 14,
                    overflow: "hidden",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <img src={p.images?.[0] || "/placeholder.png"} alt="" style={{ width: "100%", height: 150, objectFit: "cover" }} />
                  <div style={{ padding: 8 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{truncateTitle(p.title)}</p>
                    <p style={{ color: "#198754", fontWeight: "bold", marginTop: 4 }}>₦{Number(p.price).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Product Feed */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 12,
            padding: "10px 16px",
          }}
        >
          {displayProducts.map(p => (
            <div
              key={p.id}
              onClick={() => navigate(`/product/${p.id}`)}
              style={{
                background: "#e6f0ff",
                borderRadius: 14,
                overflow: "hidden",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <img src={p.images?.[0] || "/placeholder.png"} alt="" style={{ width: "100%", height: 180, objectFit: "cover" }} />
              <div style={{ padding: 10 }}>
                <p style={{ fontWeight: 600, margin: 0 }}>{truncateTitle(p.title)}</p>
                <p style={{ color: "#198754", fontWeight: "bold" }}>₦{Number(p.price).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* Bottom Navigation */}
      <div
        style={{
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
          zIndex: 1000,
        }}
      >
        {bottomLinks.map(link => (
          <div key={link.path} onClick={() => navigate(link.path)} style={{ textAlign: "center", cursor: "pointer", position: "relative" }}>
            <div style={{ fontSize: 20 }}>{link.icon}</div>
            <div style={{ fontSize: 12 }}>{link.label}</div>
            {link.badge > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -4,
                  right: -10,
                  background: "red",
                  color: "#fff",
                  fontSize: 10,
                  padding: "2px 5px",
                  borderRadius: "50%",
                  fontWeight: "bold",
                }}
              >
                {link.badge}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}