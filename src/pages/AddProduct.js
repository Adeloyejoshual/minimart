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

  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [trendingProducts, setTrendingProducts] = useState([]);
  const [trendingByCategory, setTrendingByCategory] = useState({});
  const [currentSlide, setCurrentSlide] = useState(0);

  const promoPlanIds = promotionPlans.map(p => p.id);

  /* ---------- HELPERS ---------- */
  const getPromotionPlan = planId =>
    promotionPlans.find(p => p.id === planId);

  const calculateAIScore = product => {
    const views = product.views || 0;
    const clicks = product.clicks || 0;
    const searches = product.searchHits || 0;

    const plan = getPromotionPlan(product.promotionPlan);
    const promotionBoost = plan ? plan.priority * 40 : 0;

    const createdAt = product.createdAt?.toMillis
      ? product.createdAt.toMillis()
      : Date.now();

    const daysOld =
      (Date.now() - createdAt) / (1000 * 60 * 60 * 24);

    const freshnessBoost = Math.max(20 - daysOld, 0);

    return (
      views * 3 +
      clicks * 2 +
      searches +
      promotionBoost +
      freshnessBoost
    );
  };

  /* ---------- LOAD PRODUCTS ---------- */
  const loadProducts = async () => {
    const snap = await getDocs(
      query(collection(db, "products"), orderBy("createdAt", "desc"))
    );

    const products = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }));

    setAllProducts(products);

    /* ---------- TRENDING ---------- */
    const scored = products.map(p => ({
      ...p,
      trendingScore: calculateAIScore(p),
    }));

    setTrendingProducts(
      [...scored].sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 8)
    );

    /* ---------- TRENDING BY CATEGORY ---------- */
    const byCategory = {};
    scored.forEach(p => {
      if (!p.category) return;
      if (!byCategory[p.category]) byCategory[p.category] = [];
      byCategory[p.category].push(p);
    });

    Object.keys(byCategory).forEach(cat => {
      byCategory[cat] = byCategory[cat]
        .sort((a, b) => b.trendingScore - a.trendingScore)
        .slice(0, 5);
    });

    setTrendingByCategory(byCategory);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  /* ---------- AUTO SLIDER ---------- */
  useEffect(() => {
    if (!trendingProducts.length) return;

    const interval = setInterval(() => {
      setCurrentSlide(prev =>
        prev === trendingProducts.length - 1 ? 0 : prev + 1
      );
    }, 4000);

    return () => clearInterval(interval);
  }, [trendingProducts]);

  /* ---------- FILTER + AI RANKING ---------- */
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

    const ranked = filtered
      .map(p => ({
        ...p,
        aiScore: calculateAIScore(p),
      }))
      .sort((a, b) => b.aiScore - a.aiScore);

    setDisplayProducts(ranked);
  }, [allProducts, selectedCategory, searchQuery]);

  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh", paddingBottom: 50 }}>
      <TopNav />

      {/* POST AD & SEARCH */}
      <div style={{ display: "flex", maxWidth: 1000, margin: "20px auto", gap: 15 }}>
        <PostAdModal redirectTo="/add-product" /> {/* Redirects to Marketplace */}
        <input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #cce0ff" }}
        />
      </div>

      {/* CATEGORY FILTER */}
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

      {/* PRODUCTS FEED */}
      <section style={{ maxWidth: 1000, margin: "20px auto" }}>
        <h2 style={{ color: "#0D6EFD" }}>Products Feed</h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 20 }}>
          {displayProducts.length ? displayProducts.map(p => {
            const plan = getPromotionPlan(p.promotionPlan);
            const imageSrc = p.imageUrl || p.images?.[0] || "/placeholder.png";

            return (
              <div
                key={p.id}
                onClick={() => navigate(`/product/${p.id}`)}
                style={{ position: "relative", border: "1px solid #dee2e6", padding: 10, borderRadius: 8, background: "#fff", cursor: "pointer" }}
              >
                {/* LEFT PROMO */}
                {plan && (
                  <div style={{ position: "absolute", top: 6, left: 6, background: "#ffc107", padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                    PROMO
                  </div>
                )}

                {/* RIGHT BOOST BADGE */}
                {plan && (
                  <div
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      background: plan.type === "paid" ? "#dc3545" : "#0D6EFD",
                      color: "#fff",
                      padding: "2px 8px",
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span>{plan.icon}</span>
                    {plan.type === "paid" && "PRO"}
                  </div>
                )}

                <img
                  src={imageSrc}
                  alt={p.title}
                  style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 5, marginBottom: 8 }}
                  onError={e => (e.target.src = "/placeholder.png")}
                />

                <p style={{ fontWeight: 600 }}>{p.title}</p>

                {p.city && p.state && (
                  <p style={{ fontSize: 12, color: "#6c757d" }}>
                    {p.city}, {p.state}
                  </p>
                )}

                <p style={{ fontWeight: "bold", color: "#198754" }}>
                  ₦{Number(p.price).toLocaleString("en-NG")}
                </p>
              </div>
            );
          }) : <p>No products found.</p>}
        </div>
      </section>
    </div>
  );
}