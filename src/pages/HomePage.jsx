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

const INITIAL_PRODUCTS = 34;
const LOAD_MORE_COUNT = 12;

export default function HomePage() {
  const navigate = useNavigate();
  const feedRef = useRef(null);

  // -------------------- State --------------------
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [marketplaceProducts, setMarketplaceProducts] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // -------------------- Helpers --------------------
  const shuffleArray = arr => arr.sort(() => Math.random() - 0.5);
  const formatPrice = price => `₦${Number(price).toLocaleString()}`;

  // -------------------- Debounce Search --------------------
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // -------------------- Trending --------------------
  const loadTrendingProducts = async () => {
    const snap = await getDocs(
      query(collection(db, "products"), orderBy("createdAt", "desc"), limit(20))
    );
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const promoted = products.filter(p => promotionPlans.some(plan => plan.id === p.promotionPlan));
    const shuffled = shuffleArray(products);
    setTrendingProducts([...promoted.slice(0, 3), ...shuffled.slice(0, 2)]);
  };

  // -------------------- Marketplace Query --------------------
  const buildMarketplaceQuery = (startAfterDoc = null) => {
    const conditions = [where("marketType", "in", ["marketplace", "minimart"])];
    if (selectedCategory) conditions.push(where("mainCategory", "==", selectedCategory));

    let q = query(
      collection(db, "products"),
      ...conditions,
      orderBy("createdAt", "desc"),
      limit(LOAD_MORE_COUNT)
    );

    if (startAfterDoc) q = query(q, startAfter(startAfterDoc));
    return q;
  };

  const loadMarketplaceProducts = async (loadMore = false) => {
    if (!hasMore && loadMore) return;
    if (loadMore) setLoadingMore(true);

    const q = buildMarketplaceQuery(loadMore ? lastDoc : null);
    const snap = await getDocs(q);
    let products = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Local search filter
    if (debouncedSearch.trim()) {
      const qLower = debouncedSearch.toLowerCase();
      products = products.filter(p =>
        (p.title || p.name || p.brand || p.mainCategory || "")
          .toLowerCase()
          .includes(qLower)
      );
    }

    if (loadMore) {
      setMarketplaceProducts(prev => [...prev, ...products]);
    } else {
      setMarketplaceProducts(products);
    }

    setLastDoc(snap.docs[snap.docs.length - 1] || null);
    setHasMore(snap.docs.length === LOAD_MORE_COUNT);
    if (loadMore) setLoadingMore(false);
  };

  const resetMarketplace = () => {
    setLastDoc(null);
    setHasMore(true);
    loadMarketplaceProducts(false);
  };

  useEffect(() => {
    loadTrendingProducts();
    resetMarketplace();
  }, [selectedCategory, debouncedSearch]);

  // -------------------- Infinite Scroll --------------------
  useEffect(() => {
    const handleScroll = () => {
      if (loadingMore || !hasMore) return;
      const { scrollTop, clientHeight, scrollHeight } = document.documentElement;
      if (scrollTop + clientHeight >= scrollHeight - 300) {
        loadMarketplaceProducts(true);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loadingMore, hasMore, lastDoc]);

  // -------------------- Product Click --------------------
  const handleProductClick = async p => {
    navigate(`/product/${p.id}`);
    const productRef = doc(db, "products", p.id);
    await updateDoc(productRef, { clicks: (p.clicks || 0) + 1 });
  };

  // -------------------- Render Card --------------------
  const renderProductCard = (p, trending = false) => {
    const promotion = promotionPlans.find(plan => plan.id === p.promotionPlan);
    const isPromoted = !!promotion;

    return (
      <div
        key={p.id}
        onClick={() => handleProductClick(p)}
        style={{
          padding: trending ? 8 : 12,
          borderRadius: 8,
          background: "#fff",
          boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          cursor: "pointer",
          position: "relative",
          minWidth: trending ? 140 : 180,
          minHeight: trending ? 200 : 260,
          border: `2px solid ${p.marketType === "minimart" ? "#0D6EFD" : "#dee2e6"}`,
        }}
      >
        {/* Top-left promo */}
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
        <p style={{ fontWeight: 600, color: "#212529", margin: 0, textAlign: "center", fontSize: 13 }}>
          {p.title || p.name}
        </p>

        {/* Price */}
        <p style={{
          color: p.marketType === "minimart" ? "#198754" : "#dc3545",
          fontWeight: "bold",
          marginTop: 4,
          fontSize: 13
        }}>
          {formatPrice(p.price)}
        </p>

        {/* Bottom Info Row */}
        {p.marketType !== "minimart" && (p.state || p.city || p.condition || isPromoted) && (
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 11,
            marginTop: 4,
            width: "100%"
          }}>
            <div style={{ display: "flex", gap: 6 }}>
              {(p.state || p.city) && <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <FiMapPin size={12} /> {[p.state, p.city].filter(Boolean).join(" ")}
              </span>}
              {p.condition && <span>{p.condition}</span>}
            </div>
            {isPromoted && <span>{promotion.icon}</span>}
          </div>
        )}
      </div>
    );
  };

  // -------------------- JSX --------------------
  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh", paddingBottom: 50 }} ref={feedRef}>
      <TopNav />

      {/* Search & Post Ad */}
      <div style={{
        maxWidth: 1000,
        margin: "20px auto",
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap"
      }}>
        <input
          type="text"
          placeholder="Search products by name, title, brand, category..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #cce0ff", outline: "none" }}
        />
        <PostAdModal />
      </div>

      {/* Categories */}
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

      {/* Marketplace Feed */}
      <section style={{ maxWidth: 1000, margin: "20px auto" }}>
        <h2 style={{ color: "#0D6EFD", marginBottom: 10 }}>Marketplace Feed</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 20 }}>
          {marketplaceProducts.map(p => renderProductCard(p))}
        </div>

        {loadingMore && <p style={{ textAlign: "center", marginTop: 20 }}>Loading more products...</p>}
        {!hasMore && <p style={{ textAlign: "center", marginTop: 20, color: "#666" }}>No more products.</p>}
      </section>
    </div>
  );
}