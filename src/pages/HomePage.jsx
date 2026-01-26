import React, { useEffect, useState, useRef } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import TopNav from "../components/TopNav";
import categories from "../config/categories";
import { promotionPlans } from "../config/promotionPlans";
import "./HomePage.css";

export default function HomePage() {
  const navigate = useNavigate();
  const sliderRef = useRef(null);

  const [allProducts, setAllProducts] = useState([]);
  const [displayProducts, setDisplayProducts] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [columns, setColumns] = useState(2);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const getPromotionPlan = id => promotionPlans.find(p => p.id === id);

  const calculateAIScore = product => {
    const views = product.views || 0;
    const sold = product.soldCount || 0;
    const plan = getPromotionPlan(product.promotionPlan);
    const boost = plan ? plan.priority * 40 : 0;
    return views * 2 + sold * 5 + boost;
  };

  const truncateTitle = title =>
    title?.length > 40 ? title.slice(0, 40) + "..." : title;

  // Load products
  useEffect(() => {
    const load = async () => {
      const snap = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc")));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllProducts(data);

      const trending = [...data]
        .map(p => ({ ...p, score: calculateAIScore(p) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

      setTrendingProducts(trending);
    };
    load();
  }, []);

  // Recommendations
  useEffect(() => {
    const lastViewed = JSON.parse(localStorage.getItem("lastViewedProduct"));
    if (!lastViewed) return;

    const scored = allProducts
      .filter(p => p.id !== lastViewed.id)
      .map(p => ({
        ...p,
        recScore: calculateAIScore(p)
      }))
      .sort((a, b) => b.recScore - a.recScore)
      .slice(0, 6);

    setRecommendedProducts(scored);
  }, [allProducts]);

  // Filter
  useEffect(() => {
    let filtered = [...allProducts];
    if (selectedCategory) filtered = filtered.filter(p => p.category === selectedCategory);

    const promoted = filtered.filter(p => p.promotionPlan);
    const regular = filtered.filter(p => !p.promotionPlan);
    setDisplayProducts([...promoted, ...regular]);
  }, [allProducts, selectedCategory]);

  // Responsive columns
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setColumns(w < 500 ? 2 : w < 900 ? 3 : 4);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const handlers = useSwipeable({
    onSwipedLeft: () => setCurrentSlide(p => (p + 1) % trendingProducts.length),
    onSwipedRight: () => setCurrentSlide(p => (p === 0 ? trendingProducts.length - 1 : p - 1)),
    onSwipeStart: () => setIsDragging(true),
    onSwipeEnd: () => setIsDragging(false),
    trackMouse: true
  });

  return (
    <div className="home">
      <TopNav />

      {/* Categories */}
      <div className="categories">
        {categories.map(c => (
          <button
            key={c.name}
            className={selectedCategory === c.name ? "active" : ""}
            onClick={() => setSelectedCategory(selectedCategory === c.name ? "" : c.name)}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {/* Trending */}
      {trendingProducts.length > 0 && (
        <section className="section">
          <h2>🔥 Trending</h2>
          <div className="trending-slider" ref={sliderRef} {...handlers}>
            {trendingProducts.map(p => (
              <div
                key={p.id}
                className="product-card trending"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                onClick={() => navigate(`/product/${p.id}`)}
              >
                <img src={p.images?.[0] || "/placeholder.png"} alt="" />
                <div className="info">
                  <p>{truncateTitle(p.title)}</p>
                  <span className="price">₦{Number(p.price).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recommended */}
      {recommendedProducts.length > 0 && (
        <section className="section">
          <h2>🤖 Recommended For You</h2>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {recommendedProducts.map(p => (
              <div key={p.id} className="product-card" onClick={() => navigate(`/product/${p.id}`)}>
                <img src={p.images?.[0] || "/placeholder.png"} alt="" />
                <div className="info">
                  <p>{truncateTitle(p.title)}</p>
                  <span className="price">₦{Number(p.price).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Feed */}
      <section className="section">
        <h2>🛍 Products</h2>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {displayProducts.map(p => (
            <div key={p.id} className="product-card" onClick={() => navigate(`/product/${p.id}`)}>
              <div className="badge-row">
                {p.discount && <span className="discount">-{p.discount}%</span>}
                {p.stock < 5 && <span className="limited">Limited</span>}
              </div>
              <img src={p.images?.[0] || "/placeholder.png"} alt="" />
              <div className="info">
                <p>{truncateTitle(p.title)}</p>
                <span className="price">₦{Number(p.price).toLocaleString()}</span>
                <div className="meta">
                  ⭐ {p.rating || 4.5} • {p.soldCount || 0} sold
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}