// src/pages/HomePage.jsx
import { useEffect, useState, useMemo, useCallback } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import PostAdModal from "../components/PostAdModal";
import categories from "../config/categories";
import { promotionPlans, getPromotionPlan, getPromotionPrice, isPaidPlan } from "../config/promotionPlans";

// ------------------- SHUFFLE FUNCTION -------------------
const fisherYatesShuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ------------------- DEBOUNCE HOOK -------------------
const useDebounce = (value, delay) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

// ------------------- HOME PAGE -------------------
export default function HomePage() {
  const navigate = useNavigate();

  const [allProducts, setAllProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [trendingByCategory, setTrendingByCategory] = useState({});
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [feedLimit, setFeedLimit] = useState(20);

  const debouncedSearch = useDebounce(searchQuery, 400);

  // ------------------- HELPER: AI TRENDING SCORE -------------------
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

  // ------------------- LOAD PRODUCTS -------------------
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const snap = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc")));
      const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAllProducts(products);

      // TRENDING
      const scored = products.map((p) => ({ ...p, trendingScore: calculateAIScore(p) }));
      setTrendingProducts(scored.sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 8));

      // TRENDING BY CATEGORY
      const byCategory = {};
      scored.forEach((p) => {
        if (!p.category) return;
        if (!byCategory[p.category]) byCategory[p.category] = [];
        byCategory[p.category].push(p);
      });
      Object.keys(byCategory).forEach((cat) => {
        byCategory[cat] = byCategory[cat].sort((a, b) => b.trendingScore - a.trendingScore).slice(0, 5);
      });
      setTrendingByCategory(byCategory);
    } catch (err) {
      console.error("Error loading products:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // ------------------- AUTO SLIDER -------------------
  useEffect(() => {
    if (!trendingProducts.length) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev === trendingProducts.length - 1 ? 0 : prev + 1));
    }, 4000);
    return () => clearInterval(interval);
  }, [trendingProducts]);

  // ------------------- FILTER + DISPLAY PRODUCTS -------------------
  const displayProducts = useMemo(() => {
    let filtered = [...allProducts];

    if (selectedCategory) filtered = filtered.filter((p) => p.category === selectedCategory);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.city?.toLowerCase().includes(q) ||
          p.state?.toLowerCase().includes(q)
      );
    }

    const promoted = filtered.filter((p) => isPaidPlan(p.promotionPlan));
    const promotedIds = new Set(promoted.map((p) => p.id));
    const regular = filtered.filter((p) => !promotedIds.has(p.id));

    return [...promoted.slice(0, 5), ...fisherYatesShuffle(regular)].slice(0, feedLimit);
  }, [allProducts, selectedCategory, debouncedSearch, feedLimit]);

  // ------------------- RENDER -------------------
  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh", paddingBottom: 50 }}>
      <TopNav />

      {/* POST AD & SEARCH */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          maxWidth: 400,
          margin: "20px auto",
          gap: 10,
          padding: "0 10px",
        }}
      >
        <PostAdModal />
        <input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search products"
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #cce0ff",
          }}
        />
      </div>

      {/* CATEGORY FILTER */}
      <div
        style={{
          maxWidth: 400,
          margin: "10px auto",
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          padding: "0 10px",
        }}
      >
        {categories.map((c) => (
          <button
            key={c.name}
            onClick={() => setSelectedCategory(selectedCategory === c.name ? "" : c.name)}
            aria-pressed={selectedCategory === c.name}
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
            <span style={{ marginRight: 4 }}>{c.icon}</span>
            {c.name}
          </button>
        ))}
      </div>

      {/* 🔥 TRENDING SLIDER */}
      {trendingProducts.length > 0 && (
        <section style={{ maxWidth: 400, margin: "20px auto", padding: "0 10px" }}>
          <h2 style={{ color: "#0D6EFD", fontSize: 16, marginBottom: 10 }}>🔥 Trending Now</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)", // 2-column layout
              gap: 12,
            }}
          >
            {trendingProducts.map((product) => {
              const plan = getPromotionPlan(product.promotionPlan);
              const imageSrc = product.imageUrl || product.images?.[0] || "/placeholder.png";

              return (
                <div
                  key={product.id}
                  onClick={() => navigate(`/product/${product.id}`)}
                  style={{
                    position: "relative",
                    border: "1px solid #dee2e6",
                    borderRadius: 8,
                    background: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    padding: 8,
                  }}
                >
                  {/* LEFT PROMO */}
                  {plan && (
                    <div
                      style={{
                        position: "absolute",
                        top: 6,
                        left: 6,
                        background: "#ffc107",
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
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
                        padding: "2px 6px",
                        borderRadius: 12,
                        fontSize: 10,
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                      }}
                    >
                      <span>{plan.icon}</span>
                      {plan.type === "paid" && "PRO"}
                    </div>
                  )}

                  {/* PRODUCT IMAGE */}
                  <img
                    src={imageSrc}
                    alt={product.title}
                    style={{
                      width: "100%",
                      height: 120,
                      objectFit: "cover",
                      borderRadius: 4,
                      marginBottom: 6,
                    }}
                    onError={(e) => (e.target.src = "/placeholder.png")}
                  />

                  {/* PRODUCT TITLE */}
                  <p
                    title={product.title}
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      margin: 0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {product.title}
                  </p>

                  {/* LOCATION */}
                  {product.city && product.state && (
                    <p
                      style={{
                        fontSize: 11,
                        color: "#6c757d",
                        margin: "2px 0",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {product.city}, {product.state}
                    </p>
                  )}

                  {/* PRICE */}
                  <p
                    style={{
                      fontWeight: "bold",
                      color: "#198754",
                      fontSize: 13,
                      marginTop: "auto",
                    }}
                  >
                    ₦{getPromotionPrice(product.promotionPlan).toLocaleString("en-NG")}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* PRODUCTS FEED */}
      <section style={{ maxWidth: 400, margin: "20px auto", padding: "0 10px" }}>
        <h2 style={{ color: "#0D6EFD", fontSize: 16 }}>Products Feed</h2>

        {loading ? (
          <p>Loading products...</p>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)", // 2 columns
                gap: 12,
              }}
            >
              {displayProducts.length ? (
                displayProducts.map((p) => {
                  const plan = getPromotionPlan(p.promotionPlan);
                  const imageSrc = p.imageUrl || p.images?.[0] || "/placeholder.png";

                  return (
                    <div
                      key={p.id}
                      onClick={() => navigate(`/product/${p.id}`)}
                      style={{
                        position: "relative",
                        border: "1px solid #dee2e6",
                        padding: 8,
                        borderRadius: 8,
                        background: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      {plan && (
                        <div
                          style={{
                            position: "absolute",
                            top: 6,
                            left: 6,
                            background: "#ffc107",
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                        >
                          PROMO
                        </div>
                      )}

                      {plan && (
                        <div
                          style={{
                            position: "absolute",
                            top: 6,
                            right: 6,
                            background: plan.type === "paid" ? "#dc3545" : "#0D6EFD",
                            color: "#fff",
                            padding: "2px 6px",
                            borderRadius: 12,
                            fontSize: 10,
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                          }}
                        >
                          <span>{plan.icon}</span>
                          {plan.type === "paid" && "PRO"}
                        </div>
                      )}

                      <img
                        src={imageSrc}
                        alt={p.title}
                        style={{
                          width: "100%",
                          height: 120,
                          objectFit: "cover",
                          borderRadius: 4,
                          marginBottom: 6,
                        }}
                        onError={(e) => (e.target.src = "/placeholder.png")}
                      />

                      <p
                        title={p.title}
                        style={{
                          fontWeight: 600,
                          fontSize: 13,
                          margin: 0,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {p.title}
                      </p>

                      {p.city && p.state && (
                        <p
                          style={{
                            fontSize: 11,
                            color: "#6c757d",
                            margin: "2px 0",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {p.city}, {p.state}
                        </p>
                      )}

                      <p
                        style={{
                          fontWeight: "bold",
                          color: "#198754",
                          fontSize: 13,
                          marginTop: "auto",
                        }}
                      >
                        ₦{getPromotionPrice(p.promotionPlan).toLocaleString("en-NG")}
                      </p>
                    </div>
                  );
                })
              ) : (
                <p>No products found.</p>
              )}
            </div>

            {/* LOAD MORE BUTTON */}
            {displayProducts.length >= feedLimit && (
              <button
                onClick={() => setFeedLimit((prev) => prev + 20)}
                style={{
                  marginTop: 12,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #0D6EFD",
                  background: "#fff",
                  color: "#0D6EFD",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                Load More
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}