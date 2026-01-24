// src/pages/HomePage.jsx
import { useEffect, useState, useRef } from "react";
import { collection, getDocs, query, orderBy, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import TopNav from "../components/TopNav";
import PostAdModal from "../components/PostAdModal";
import categories from "../config/categories";
import { promotionPlans } from "../config/promotionPlans";

export default function HomePage() {
  const navigate = useNavigate();

  // --- STATE ---
  const [allProducts, setAllProducts] = useState([]);
  const [displayProducts, setDisplayProducts] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [trendingByCategory, setTrendingByCategory] = useState({});
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [columns, setColumns] = useState(2);
  const [favorites, setFavorites] = useState(new Set());

  const sliderRef = useRef(null);

  const promoPlanIds = promotionPlans.map(p => p.id);

  // --- HELPERS ---
  const getPromotionPlan = planId => promotionPlans.find(p => p.id === planId);

  const getPromotionPrice = planId => {
    const plan = getPromotionPlan(planId);
    return plan ? plan.discountPrice || plan.price : 0;
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

  // --- LOAD PRODUCTS ---
  const loadProducts = async () => {
    const snap = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc")));
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setAllProducts(products);

    // Trending
    const scored = products.map(p => ({ ...p, trendingScore: calculateAIScore(p) }));
    setTrendingProducts(scored.sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 8));

    // Trending by category
    const byCategory = {};
    scored.forEach(p => {
      if (!p.category) return;
      if (!byCategory[p.category]) byCategory[p.category] = [];
      byCategory[p.category].push(p);
    });
    Object.keys(byCategory).forEach(cat => {
      byCategory[cat] = byCategory[cat].sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 5);
    });
    setTrendingByCategory(byCategory);
  };

  useEffect(() => { loadProducts(); }, []);

  // --- LOAD FAVORITES ---
  useEffect(() => {
    const loadFavorites = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const snap = await getDocs(collection(db, "users", user.uid, "favorites"));
      const favIds = new Set(snap.docs.map(doc => doc.id));
      setFavorites(favIds);
    };
    loadFavorites();
  }, []);

  // --- TOGGLE FAVORITE ---
  const toggleFavorite = async (productId) => {
    const user = auth.currentUser;
    if (!user) { alert("Please login to save favorites"); return; }
    const favRef = doc(db, "users", user.uid, "favorites", productId);

    if (favorites.has(productId)) {
      await deleteDoc(favRef);
      setFavorites(prev => { const updated = new Set(prev); updated.delete(productId); return updated; });
    } else {
      await setDoc(favRef, { productId, savedAt: new Date() });
      setFavorites(prev => new Set(prev).add(productId));
    }
  };

  // --- RESPONSIVE COLUMNS ---
  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width < 500) setColumns(1);
      else setColumns(2);
    };
    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  // --- FILTER PRODUCTS ---
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

  // --- SWIPE HANDLERS ---
  const [isDragging, setIsDragging] = useState(false);
  const handlers = useSwipeable({
    onSwipedLeft: () => setCurrentSlide(prev => (prev === trendingProducts.length - 1 ? 0 : prev + 1)),
    onSwipedRight: () => setCurrentSlide(prev => (prev === 0 ? trendingProducts.length - 1 : prev - 1)),
    onSwipeStart: () => setIsDragging(true),
    onSwipeEnd: () => setIsDragging(false),
    preventDefaultTouchmoveEvent: true,
    trackMouse: true,
  });

  // --- AUTO SLIDE ---
  useEffect(() => {
    if (isDragging || trendingProducts.length === 0) return;
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev === trendingProducts.length - 1 ? 0 : prev + 1));
    }, 4000);
    return () => clearInterval(interval);
  }, [isDragging, trendingProducts]);

  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh", paddingBottom: 50 }}>
      <TopNav />

      {/* POST AD + SEARCH */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        maxWidth: 420,
        margin: "20px auto",
        gap: 10,
        padding: "0 12px",
      }}>
        <PostAdModal />
        <input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #cce0ff",
          }}
        />
      </div>

      {/* CATEGORY FILTER */}
      <div style={{
        maxWidth: 420,
        margin: "10px auto",
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        padding: "0 12px",
      }}>
        {categories.map(c => (
          <button
            key={c.name}
            onClick={() => setSelectedCategory(selectedCategory === c.name ? "" : c.name)}
            style={{
              flex: "1 0 45%",
              padding: "6px 8px",
              borderRadius: 8,
              border: selectedCategory === c.name ? "2px solid #0D6EFD" : "1px solid #dee2e6",
              background: selectedCategory === c.name ? "#e0ecff" : "#fff",
              cursor: "pointer",
              textAlign: "center",
              minWidth: 80,
              fontSize: 12,
            }}
          >
            <span style={{ marginRight: 4 }}>{c.icon}</span>{c.name}
          </button>
        ))}
      </div>

      {/* TRENDING NOW PRO */}
      {trendingProducts.length > 0 && (
        <section style={{ maxWidth: 420, margin: "20px auto", padding: "0 12px" }}>
          <h2 style={{ color: "#0D6EFD", fontSize: 16, marginBottom: 12 }}>🔥 Trending Now</h2>
          <div ref={sliderRef} {...handlers} style={{ display: "flex", overflow: "hidden", gap: 12 }}>
            {trendingProducts.map(p => {
              const plan = getPromotionPlan(p.promotionPlan);
              const imageSrc = p.imageUrl || p.images?.[0] || "/placeholder.png";

              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/product/${p.id}`)}
                  style={{
                    flex: `0 0 ${100 / columns}%`,
                    minWidth: `${100 / columns}%`,
                    borderRadius: 12,
                    overflow: "hidden",
                    cursor: "pointer",
                    transform: `translateX(-${currentSlide * (100 / columns)}%)`,
                    transition: "transform 0.3s ease-in-out",
                    position: "relative",
                    background: "#fff",
                    border: "1px solid #dee2e6"
                  }}
                >
                  {/* IMAGE */}
                  <img
                    src={imageSrc}
                    alt={p.title}
                    onError={e => (e.target.src = "/placeholder.png")}
                    style={{ width: "100%", height: 140, objectFit: "cover" }}
                  />

                  {/* TITLE */}
                  <p title={p.title} style={{
                    fontWeight: 600,
                    fontSize: 13,
                    margin: 6,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>{p.title}</p>

                  {/* PRICE */}
                  <p style={{ fontWeight: "bold", color: "#198754", fontSize: 13, margin: "0 6px 6px" }}>
                    ₦{getPromotionPrice(p.promotionPlan).toLocaleString("en-NG")}
                  </p>

                  {/* PROMO BADGES */}
                  {plan && (
                    <div style={{ position: "absolute", top: 6, right: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{
                        background: "#ffc107",
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontWeight: 600,
                        textAlign: "center"
                      }}>PROMO</span>
                      <span style={{
                        background: plan.type === "paid" ? "#dc3545" : "#0D6EFD",
                        color: "#fff",
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 12,
                        fontWeight: 600,
                        textAlign: "center"
                      }}>{plan.icon} {plan.type === "paid" && "PRO"}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* DOTS NAVIGATION */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 8, gap: 6 }}>
            {Array(Math.ceil(trendingProducts.length / columns)).fill(0).map((_, idx) => (
              <span key={idx}
                onClick={() => setCurrentSlide(idx)}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: Math.floor(currentSlide / columns) === idx ? "#0D6EFD" : "#dee2e6",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* PRODUCTS FEED PRO */}
      <section style={{ maxWidth: 500, margin: "20px auto", padding: "0 12px" }}>
        <h2 style={{ color: "#0D6EFD", fontSize: 16, marginBottom: 12 }}>Products Feed</h2>

        {displayProducts.length ? displayProducts.map(p => {
          const plan = getPromotionPlan(p.promotionPlan);
          const imageSrc = p.imageUrl || p.images?.[0] || "/placeholder.png";

          return (
            <div
              key={p.id}
              onClick={() => navigate(`/product/${p.id}`)}
              style={{
                display: "flex",
                gap: 12,
                padding: 12,
                marginBottom: 12,
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #e9ecef",
                cursor: "pointer",
                alignItems: "center",
                transition: "all 0.2s ease",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 6px 18px rgba(0,0,0,0.1)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)"}
            >
              {/* IMAGE */}
              <div style={{ position: "relative" }}>
                <img
                  src={imageSrc}
                  alt={p.title}
                  onError={e => (e.target.src = "/placeholder.png")}
                  style={{ width: 95, height: 95, objectFit: "cover", borderRadius: 10, flexShrink: 0 }}
                />

                {/* FAVORITE BUTTON */}
                <div
                  onClick={e => { e.stopPropagation(); toggleFavorite(p.id); }}
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    background: "#fff",
                    borderRadius: "50%",
                    width: 30,
                    height: 30,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                    transition: "transform 0.2s ease"
                  }}
                >
                  <span style={{
                    color: favorites.has(p.id) ? "#dc3545" : "#adb5bd",
                    transform: favorites.has(p.id) ? "scale(1.2)" : "scale(1)",
                    transition: "all 0.2s ease"
                  }}>
                    {favorites.has(p.id) ? "❤️" : "🤍"}
                  </span>
                </div>
              </div>

              {/* DETAILS */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p title={p.title} style={{
                  fontWeight: 600, fontSize: 14, margin: 0,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                }}>{p.title}</p>

                {/* VERIFIED SELLER */}
                {p.isVerifiedSeller && (
                  <p style={{
                    fontSize: 11, color: "#0D6EFD", margin: "2px 0 4px 0",
                    fontWeight: 600, display: "flex", alignItems: "center", gap: 4
                  }}>
                    ✔ Verified Seller
                  </p>
                )}

                {p.city && p.state && (
                  <p style={{ fontSize: 12, color: "#6c757d", margin: "2px 0" }}>
                    📍 {p.city}, {p.state}
                  </p>
                )}

                <p style={{ fontWeight: "bold", color: "#198754", fontSize: 15, marginTop: 4 }}>
                  ₦{Number(p.price).toLocaleString("en-NG")}
                </p>
              </div>

              {/* PROMO BADGES */}
              {plan && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{
                    background: "#ffc107",
                    fontSize: 10,
                    padding: "3px 6px",
                    borderRadius: 4,
                    fontWeight: 700,
                    textAlign: "center"
                  }}>PROMO</span>
                  <span style={{
                    background: plan.type === "paid" ? "#dc3545" : "#0D6EFD",
                    color: "#fff",
                    fontSize: 10,
                    padding: "3px 6px",
                    borderRadius: 12,
                    fontWeight: 700,
                    textAlign: "center"
                  }}>{plan.icon} {plan.type === "paid" && "PRO"}</span>
                </div>
              )}
            </div>
          );
        }) : <p>No products found.</p>}
      </section>
    </div>
  );
}