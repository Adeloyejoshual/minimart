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

  /* ---------------- LOAD PRODUCTS ---------------- */
  const loadProducts = async () => {
    const snap = await getDocs(
      query(collection(db, "products"), orderBy("createdAt", "desc"))
    );

    const products = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }));

    setAllProducts(products);

    /* -------- TRENDING SCORE -------- */
    const scored = products.map(p => ({
      ...p,
      trendingScore:
        (p.views || 0) * 3 +
        (p.clicks || 0) * 2 +
        (p.searchHits || 0),
    }));

    const trending = [...scored]
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 8);

    setTrendingProducts(trending);

    /* -------- TRENDING BY CATEGORY -------- */
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

  /* ---------------- AUTO SLIDER ---------------- */
  useEffect(() => {
    if (!trendingProducts.length) return;

    const interval = setInterval(() => {
      setCurrentSlide(prev =>
        prev === trendingProducts.length - 1 ? 0 : prev + 1
      );
    }, 4000);

    return () => clearInterval(interval);
  }, [trendingProducts]);

  /* ---------------- FILTER + SEARCH ---------------- */
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

    const promoted = filtered.filter(p =>
      promoPlanIds.includes(p.promotionPlan)
    );

    const promotedIds = new Set(promoted.map(p => p.id));
    const regular = filtered.filter(p => !promotedIds.has(p.id));

    const mixed = [...promoted.slice(0, 5), ...shuffleArray(regular)];
    setDisplayProducts(mixed);
  }, [allProducts, selectedCategory, searchQuery]);

  const shuffleArray = arr => [...arr].sort(() => Math.random() - 0.5);

  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh", paddingBottom: 50 }}>
      <TopNav />

      {/* Post Ad & Search */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          maxWidth: 1000,
          margin: "20px auto",
          gap: 15,
        }}
      >
        <PostAdModal />
        <input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
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
          maxWidth: 1000,
          margin: "10px auto",
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        {categories.map(c => (
          <button
            key={c.name}
            onClick={() =>
              setSelectedCategory(selectedCategory === c.name ? "" : c.name)
            }
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border:
                selectedCategory === c.name
                  ? "2px solid #0D6EFD"
                  : "1px solid #dee2e6",
              background:
                selectedCategory === c.name ? "#e0ecff" : "#fff",
              cursor: "pointer",
            }}
          >
            <span style={{ marginRight: 6 }}>{c.icon}</span>
            {c.name}
          </button>
        ))}
      </div>

      {/* 🔥 TRENDING SLIDER */}
      {trendingProducts[currentSlide] && (
        <section style={{ maxWidth: 1000, margin: "20px auto" }}>
          <h2 style={{ color: "#0D6EFD" }}>🔥 Trending Now</h2>
          <div
            onClick={() =>
              navigate(`/product/${trendingProducts[currentSlide].id}`)
            }
            style={{
              height: 260,
              borderRadius: 12,
              backgroundImage: `url(${
                trendingProducts[currentSlide].imageUrl ||
                trendingProducts[currentSlide].images?.[0]
              })`,
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
                borderRadius: "0 0 12px 12px",
              }}
            >
              <h3>{trendingProducts[currentSlide].title}</h3>
              <p>
                ₦
                {Number(
                  trendingProducts[currentSlide].price
                ).toLocaleString("en-NG")}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* PRODUCTS FEED (UNCHANGED STRUCTURE) */}
      <section style={{ maxWidth: 1000, margin: "20px auto" }}>
        <h2 style={{ color: "#0D6EFD" }}>Products Feed</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 20,
          }}
        >
          {displayProducts.length ? (
            displayProducts.map(p => {
              const isPromoted = promoPlanIds.includes(p.promotionPlan);
              const imageSrc =
                p.imageUrl || p.images?.[0] || "/placeholder.png";

              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/product/${p.id}`)}
                  style={{
                    position: "relative",
                    border: "1px solid #dee2e6",
                    padding: 10,
                    borderRadius: 8,
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  {isPromoted && (
                    <div
                      style={{
                        position: "absolute",
                        top: 6,
                        left: 6,
                        background: "#ffc107",
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      PROMO
                    </div>
                  )}

                  <img
                    src={imageSrc}
                    alt={p.title}
                    style={{
                      width: "100%",
                      height: 150,
                      objectFit: "cover",
                      borderRadius: 5,
                      marginBottom: 8,
                    }}
                    onError={e =>
                      (e.target.src = "/placeholder.png")
                    }
                  />

                  <p style={{ fontWeight: 600 }}>{p.title}</p>

                  {p.city && p.state && (
                    <p style={{ fontSize: 12, color: "#6c757d" }}>
                      {p.city}, {p.state}
                    </p>
                  )}

                  <p
                    style={{
                      fontWeight: "bold",
                      color: "#198754",
                    }}
                  >
                    ₦{Number(p.price).toLocaleString("en-NG")}
                  </p>
                </div>
              );
            })
          ) : (
            <p>No products found.</p>
          )}
        </div>
      </section>
    </div>
  );
}