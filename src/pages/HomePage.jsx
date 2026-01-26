// src/pages/MiniMart.jsx
import React, { useEffect, useState, useRef } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import { FaHome, FaStore, FaShoppingCart, FaUser } from "react-icons/fa";

import TopNav from "../components/TopNav";
import categoriesList from "../config/categories";
import { promotionPlans, getPromotionPlan } from "../config/promotionPlans";

export default function MiniMart() {
  const navigate = useNavigate();

  const [allProducts, setAllProducts] = useState([]);
  const [displayProducts, setDisplayProducts] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [columns, setColumns] = useState(2);
  const [isDragging, setIsDragging] = useState(false);
  const [topSellers, setTopSellers] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const sliderRef = useRef(null);
  const promoPlanIds = promotionPlans.map((p) => p.id);

  // --------------------- Load Products ---------------------
  useEffect(() => {
    const loadProducts = async () => {
      const q = query(
        collection(db, "products"),
        where("marketType", "==", "minimart"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAllProducts(products);

      // Trending
      const scored = products.map((p) => ({ ...p, trendingScore: calculateAIScore(p) }));
      setTrendingProducts(scored.sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 8));
    };

    loadProducts();
    loadTopSellers();
    loadCartAndMessages();
  }, []);

  // --------------------- AI Trending Score ---------------------
  const calculateAIScore = (product) => {
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

  // --------------------- Top Seller Leaderboard ---------------------
  const loadTopSellers = async () => {
    const snap = await getDocs(collection(db, "users"));
    const sellers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const ranked = sellers
      .filter((s) => s.totalSales > 0)
      .map((s) => ({ ...s, score: (s.rating || 0) * 20 + s.totalSales }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    setTopSellers(ranked);
  };

  // --------------------- Filter Products ---------------------
  useEffect(() => {
    let filtered = [...allProducts];
    if (selectedCategory) filtered = filtered.filter((p) => p.category === selectedCategory);

    const promoted = filtered.filter((p) => promoPlanIds.includes(p.promotionPlan));
    const promotedIds = new Set(promoted.map((p) => p.id));
    const regular = filtered.filter((p) => !promotedIds.has(p.id));

    setDisplayProducts([...promoted.slice(0, 5), ...shuffleArray(regular)]);
  }, [allProducts, selectedCategory]);

  // --------------------- Responsive Columns ---------------------
  useEffect(() => {
    const updateColumns = () => {
      const w = window.innerWidth;
      setColumns(w < 500 ? 2 : w < 900 ? 3 : 4);
    };
    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  // --------------------- Trending Slider ---------------------
  const handlers = useSwipeable({
    onSwipedLeft: () => setCurrentSlide((p) => (p + 1) % trendingProducts.length),
    onSwipedRight: () =>
      setCurrentSlide((p) => (p === 0 ? trendingProducts.length - 1 : p - 1)),
    onSwipeStart: () => setIsDragging(true),
    onSwipeEnd: () => setIsDragging(false),
    trackMouse: true,
  });
  useEffect(() => {
    if (isDragging || trendingProducts.length === 0) return;
    const interval = setInterval(
      () => setCurrentSlide((p) => (p + 1) % trendingProducts.length),
      4000
    );
    return () => clearInterval(interval);
  }, [isDragging, trendingProducts]);

  // --------------------- Helpers ---------------------
  const shuffleArray = (arr) => [...arr].sort(() => Math.random() - 0.5);
  const truncateTitle = (title) => {
    if (!title) return "";
    const maxWords = 6;
    const maxChars = 40;
    let t = title.split(" ").slice(0, maxWords).join(" ");
    if (t.length > maxChars) t = t.slice(0, maxChars) + "...";
    return t;
  };

  // --------------------- Cart & Messages ---------------------
  const loadCartAndMessages = () => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    getDocs(query(collection(db, "carts"), where("userId", "==", uid))).then(
      (snap) => setCartCount(snap.docs.length)
    );

    getDocs(
      query(collection(db, "messages"), where("toUser", "==", uid), where("read", "==", false))
    ).then((snap) => setUnreadMessages(snap.docs.length));
  };

  const bottomLinks = [
    { path: "/", label: "Home", icon: <FaHome />, badge: 0 },
    { path: "/minimart", label: "MiniMart", icon: <FaStore />, badge: 0 },
    { path: "/cart", label: "Cart", icon: <FaShoppingCart />, badge: cartCount },
    { path: "/profile", label: "Account", icon: <FaUser />, badge: unreadMessages },
  ];

  // --------------------- Render ---------------------
  return (
    <div style={{ background: "#f5f7fb", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Pinned Header */}
      <TopNav />

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 100 }}>
        {/* Categories */}
        <div style={{ maxWidth: 1200, margin: "20px auto", padding: "0 16px", display: "flex", gap: 8, overflowX: "auto" }}>
          {categoriesList.map((c) => (
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
                fontWeight: 500,
              }}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>

        {/* Paid Promotions Ads */}
        {promotionPlans.filter(p => p.type === "paid").length > 0 && (
          <section style={{ maxWidth: 1200, margin: "20px auto", padding: "0 16px" }}>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>🔥 Promoted Plans</h2>
            <div style={{ display: "flex", gap: 12, overflowX: "auto" }}>
              {promotionPlans.filter(p => p.type === "paid").map((plan) => (
                <div key={plan.id} style={{ minWidth: 180, background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 3px 10px rgba(0,0,0,0.05)", cursor: "pointer" }}
                     onClick={() => navigate(`/promotion/${plan.id}`)}>
                  <p style={{ fontSize: 14, fontWeight: "bold", margin: 0 }}>{plan.icon} {plan.label}</p>
                  <p style={{ fontSize: 12, color: "#198754", fontWeight: "bold" }}>₦{plan.discountPrice || plan.price}</p>
                  <p style={{ fontSize: 11, color: "#555", margin: "4px 0" }}>{plan.days} Days</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Trending */}
        {trendingProducts.length > 0 && (
          <section style={{ maxWidth: 1200, margin: "20px auto", padding: "0 16px" }}>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>🔥 Trending</h2>
            <div ref={sliderRef} {...handlers} style={{ display: "flex", overflow: "hidden" }}>
              {trendingProducts.map((p) => (
                <div key={p.id} onClick={() => navigate(`/product/${p.id}`)}
                     style={{
                       minWidth: `${100 / columns}%`,
                       padding: 6,
                       boxSizing: "border-box",
                       transform: `translateX(-${currentSlide * (100 / columns)}%)`,
                       transition: "transform 0.3s ease",
                     }}>
                  <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
                    <img src={p.images?.[0] || "/placeholder.png"} alt="" style={{ width: "100%", height: 150, objectFit: "cover" }} />
                    {p.promotionPlan && (
                      <div style={{ position: "absolute", top: 8, left: 8, background: "#ffc107", color: "#000", fontSize: 11, padding: "4px 8px", borderRadius: 6, fontWeight: "bold" }}>
                        {getPromotionPlan(p.promotionPlan)?.label}
                      </div>
                    )}
                    <div style={{ padding: 10 }}>
                      <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{truncateTitle(p.title)}</p>
                      <p style={{ color: "#198754", fontWeight: "bold", marginTop: 4 }}>₦{Number(p.price).toLocaleString()}</p>
                      <p style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{p.sold || 0} Sold</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Top Seller Leaderboard */}
        {topSellers.length > 0 && (
          <section style={{ maxWidth: 1200, margin: "20px auto", padding: "0 16px" }}>
            <h2 style={{ fontSize: 18, marginBottom: 12 }}>🏆 Top Sellers</h2>
            <div style={{ display: "flex", gap: 12, overflowX: "auto" }}>
              {topSellers.map((s, i) => (
                <div key={s.id} style={{ minWidth: 160, background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 3px 10px rgba(0,0,0,0.05)" }}>
                  <p style={{ fontWeight: "bold", margin: 0 }}>#{i + 1} {s.shopName || "Seller"}</p>
                  <p style={{ fontSize: 12, color: "#555", margin: "4px 0" }}>⭐ {s.rating?.toFixed(1) || "New"} Rating</p>
                  <p style={{ fontSize: 12, color: "#198754", fontWeight: "bold" }}>{s.totalSales} Sales</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Product Feed */}
        <section style={{
          maxWidth: 1200,
          margin: "20px auto",
          padding: "0 16px",
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: 12,
        }}>
          {displayProducts.map((p, idx) => (
            <div key={p.id} onClick={() => navigate(`/product/${p.id}`)}
                 style={{
                   position: "relative",
                   background: "#fff",
                   borderRadius: 14,
                   boxShadow: "0 3px 10px rgba(0,0,0,0.05)",
                   cursor: "pointer",
                   overflow: "hidden",
                   display: "flex",
                   flexDirection: "column",
                 }}>
              <img src={p.images?.[0] || "/placeholder.png"} alt="" style={{ width: "100%", height: 180, objectFit: "cover" }} />
              {p.promotionPlan && (
                <div style={{ position: "absolute", top: 8, left: 8, background: "#ffc107", color: "#000", fontSize: 11, padding: "4px 8px", borderRadius: 6, fontWeight: "bold" }}>
                  {getPromotionPlan(p.promotionPlan)?.label}
                </div>
              )}
              <div style={{ padding: 10 }}>
                <p style={{ fontWeight: 600, margin: 0 }}>{truncateTitle(p.title)}</p>
                <p style={{ color: "#198754", fontWeight: "bold" }}>₦{Number(p.price).toLocaleString()}</p>
                <p style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{p.sold || 0} Sold</p>
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* Bottom Navigation */}
      <div style={{
        position: "fixed",
        bottom: 0,
        width: "100%",
        background: "#f5f7fb",
        padding: 8,
        borderTop: "1px solid #e0e6ef",
        display: "flex",
        justifyContent: "space-around",
        zIndex: 1000,
      }}>
        {bottomLinks.map((link) => (
          <div key={link.path} onClick={() => navigate(link.path)} style={{ textAlign: "center", cursor: "pointer", fontSize: 12, position: "relative" }}>
            <div style={{ fontSize: 20 }}>{link.icon}</div>
            <div>{link.label}</div>
            {link.badge > 0 && (
              <span style={{ position: "absolute", top: -4, right: -10, background: "red", color: "#fff", fontSize: 10, padding: "2px 5px", borderRadius: "50%", fontWeight: "bold" }}>
                {link.badge}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}