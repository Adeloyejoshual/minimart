// src/pages/HomePage.jsx
import { useEffect, useState, useRef } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  startAfter,
  limit,
  doc,
  updateDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import PostAdModal from "../components/PostAdModal";
import categories from "../config/categories";
import { promotionPlans } from "../config/promotionPlans";
import { FiMapPin } from "react-icons/fi";

const PRODUCTS_PER_PAGE = 12; // for infinite scroll

export default function HomePage() {
  const navigate = useNavigate();
  const feedContainerRef = useRef(null);

  const [trendingProducts, setTrendingProducts] = useState([]);
  const [feedProducts, setFeedProducts] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const shuffleArray = arr => arr.sort(() => Math.random() - 0.5);
  const formatPrice = price => `₦${Number(price).toLocaleString()}`;

  // -------------------- Trending --------------------
  const loadTrending = async () => {
    const snap = await getDocs(
      query(collection(db, "products"), orderBy("createdAt", "desc"), limit(20))
    );
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const promoted = products.filter(p => promotionPlans.some(plan => plan.id === p.promotionPlan));
    const shuffled = shuffleArray(products);
    const trending = [...promoted.slice(0, 3), ...shuffled.slice(0, 2)];
    setTrendingProducts(trending);
  };

  // -------------------- Marketplace / MiniMart Feed --------------------
  const buildFeedQuery = (startDoc = null) => {
    const conditions = [where("marketType", "in", ["marketplace", "minimart"])];
    if (selectedCategory) conditions.push(where("mainCategory", "==", selectedCategory));

    let q = query(
      collection(db, "products"),
      ...conditions,
      orderBy("createdAt", "desc"),
      limit(PRODUCTS_PER_PAGE)
    );

    if (startDoc) q = query(q, startAfter(startDoc));
    return q;
  };

  const loadFeed = async (loadMore = false) => {
    if (!hasMore && loadMore) return;
    if (loadMore) setLoadingMore(true);

    const snap = await getDocs(buildFeedQuery(loadMore ? lastDoc : null));
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    setFeedProducts(prev => (loadMore ? [...prev, ...products] : products));
    setLastDoc(snap.docs[snap.docs.length - 1] || null);
    setHasMore(snap.docs.length === PRODUCTS_PER_PAGE);
    if (loadMore) setLoadingMore(false);
  };

  const resetFeed = () => {
    setLastDoc(null);
    setHasMore(true);
    loadFeed(false);
  };

  useEffect(() => {
    loadTrending();
    resetFeed();
  }, []);

  useEffect(() => {
    resetFeed();
  }, [selectedCategory, searchQuery]);

  // -------------------- Infinite Scroll --------------------
  useEffect(() => {
    const handleScroll = () => {
      if (!feedContainerRef.current || loadingMore || !hasMore) return;
      const { scrollTop, clientHeight, scrollHeight } = document.documentElement;
      if (scrollTop + clientHeight >= scrollHeight - 300) loadFeed(true);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastDoc, loadingMore, hasMore]);

  // -------------------- Product Click --------------------
  const handleProductClick = async p => {
    navigate(`/product/${p.id}`);
    const productRef = doc(db, "products", p.id);
    await updateDoc(productRef, { clicks: (p.clicks || 0) + 1 });
  };

  // -------------------- Product Card --------------------
  const productCardStyle = {
    padding: 12,
    borderRadius: 8,
    background: "#fff",
    boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    cursor: "pointer",
    position: "relative",
  };

  const renderProductCard = (p, trending = false) => {
    const promotion = promotionPlans.find(plan => plan.id === p.promotionPlan);
    const isPromoted = !!promotion;

    return (
      <div
        key={p.id}
        onClick={() => handleProductClick(p)}
        style={{
          ...productCardStyle,
          minWidth: trending ? 140 : 180,
          minHeight: trending ? 200 : 260,
          padding: trending ? 8 : 12,
          border: `2px solid ${p.marketType === "minimart" ? "#0D6EFD" : "#dee2e6"}`
        }}
      >
        {/* Top-left Promo */}
        {isPromoted && (
          <div style={{
            position: "absolute",
            top: 6,
            left: 6,
            background: "#ffc107",
            padding: "2px 6px",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            zIndex: 1,
          }}>{promotion.icon}</div>
        )}

        {/* Image */}
        <img
          src={p.images?.[0] || "/placeholder.png"}
          alt={p.title || p.name}
          style={{ width: "100%", height: trending ? 80 : 100, objectFit: "cover", borderRadius: 5, marginBottom: 6 }}
        />

        {/* Title */}
        <p style={{ fontWeight: 600, textAlign: "center", fontSize: 13, margin: 0 }}>{p.title || p.name}</p>

        {/* Price */}
        <p style={{
          color: p.marketType === "minimart" ? "#198754" : "#dc3545",
          fontWeight: "bold",
          marginTop: 4,
          fontSize: 13
        }}>{formatPrice(p.price)}</p>

        {/* Location (Marketplace only) */}
        {p.marketType !== "minimart" && (p.state || p.city) && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, marginTop: 2 }}>
            <FiMapPin size={12} />
            <span>{[p.state, p.city].filter(Boolean).join(" ")}</span>
          </div>
        )}

        {/* Bottom info row: condition (left), promo (right) */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
          fontSize: 11,
          marginTop: 2
        }}>
          <span>{p.condition || ""}</span>
          {isPromoted && <span>{promotion.icon}</span>}
        </div>
      </div>
    );
  };

  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh", paddingBottom: 50 }} ref={feedContainerRef}>
      <TopNav />

      {/* Search & Post Ad */}
      <div style={{ maxWidth: 1000, margin: "20px auto", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Search products by name, title, brand, category..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #cce0ff", outline: "none" }}
        />
        <PostAdModal />
      </div>

      {/* Category Filter */}
      <div style={{ maxWidth: 1000, margin: "10px auto 20px auto", display: "flex", flexWrap: "wrap", gap: 10 }}>
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
          >{c.icon} {c.name}</button>
        ))}
      </div>

      {/* Trending */}
      <section style={{ maxWidth: 1000, margin: "20px auto" }}>
        <h2 style={{ color: "#DC3545", marginBottom: 10 }}>🔥 Trending Products</h2>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "8px 0" }}>
          {trendingProducts.map(p => renderProductCard(p, true))}
        </div>
      </section>

      {/* Feed */}
      <section style={{ maxWidth: 1000, margin: "20px auto" }}>
        <h2 style={{ color: "#0D6EFD", marginBottom: 10 }}>Products Feed</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 20 }}>
          {feedProducts.map(p => renderProductCard(p))}
        </div>

        {loadingMore && <p style={{ textAlign: "center", marginTop: 20 }}>Loading more products...</p>}
        {!hasMore && <p style={{ textAlign: "center", marginTop: 20, color: "#666" }}>No more products.</p>}
      </section>
    </div>
  );
}