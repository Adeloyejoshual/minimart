import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import { useProductCache } from "../context/ProductCacheContext";
import "../styles/Homepage.css";

import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

export default function Homepage() {
  const {
    products,
    setProducts,
    trending,
    setTrending,
    loaded,
    setLoaded,
  } = useProductCache();

  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  /* ================= FETCH (SAFE + OPTIMIZED) ================= */
  useEffect(() => {
    if (loaded) return;

    const controller = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);

        const res = await fetch(
          "https://minimart-ivrm.onrender.com/api/homepage",
          { signal: controller.signal }
        );

        if (!res.ok) throw new Error("Failed to fetch");

        const data = await res.json();

        const latest = Array.isArray(data?.latest) ? data.latest : [];
        const promoted = Array.isArray(data?.promoted) ? data.promoted : [];

        setProducts(latest);

        setTrending(
          promoted.length > 0
            ? promoted.slice(0, 10)
            : latest.slice(0, 10)
        );

        setLoaded(true);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Homepage fetch error:", err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => controller.abort();
  }, [loaded, setProducts, setTrending, setLoaded]);

  /* ================= DERIVED DATA ================= */
  const cheapDeals = useMemo(() => {
    return products
      .filter((p) => Number(p.price) < 50000)
      .slice(0, 10);
  }, [products]);

  const recommended = useMemo(() => {
    return products.slice(0, 12);
  }, [products]);

  /* ================= HELPERS ================= */
  const getImage = (p) =>
    p?.images?.[0] ||
    "https://via.placeholder.com/300x200?text=No+Image";

  const getLocation = (p) =>
    p?.location?.state && p?.location?.city
      ? `${p.location.state}, ${p.location.city}`
      : p?.location?.state || "Nigeria";

  /* ================= CARD ================= */
  const Card = useCallback(
    ({ p }) => (
      <div
        className="masonry-card"
        onClick={() => navigate(`/product/${p.id}`)}
      >
        <img src={getImage(p)} alt={p.title} loading="lazy" />
        <div className="info">
          <div className="price">
            ₦{Number(p.price || 0).toLocaleString()}
          </div>
          <div className="title">{p.title}</div>
          <div className="location">📍 {getLocation(p)}</div>
        </div>
      </div>
    ),
    [navigate]
  );

  /* ================= SWIPER SECTION ================= */
  const Section = ({ title, items }) => {
    if (!items.length) return null;

    return (
      <div className="section">
        <h2>{title}</h2>

        <Swiper
          modules={[Navigation, Pagination]}
          slidesPerView={2}
          spaceBetween={10}
          navigation
          pagination={{ clickable: true }}
          breakpoints={{
            480: { slidesPerView: 3 },
            768: { slidesPerView: 4 },
            1024: { slidesPerView: 6 },
          }}
        >
          {items.map((p) => (
            <SwiperSlide key={p.id}>
              <Card p={p} />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    );
  };

  /* ================= UI ================= */
  return (
    <>
      <TopNav />

      <div className="homepage-container">

        {/* ================= SECTIONS ================= */}
        <Section title="🔥 Trending" items={trending} />
        <Section title="💰 Cheap Deals" items={cheapDeals} />
        <Section title="✨ Recommended" items={recommended} />

        {/* ================= MAIN GRID ================= */}
        <div className="section">
          <h2>🛒 All Products</h2>

          {products.length === 0 && !loading ? (
            <p className="empty-text">No products available</p>
          ) : (
            <div className="masonry-grid">
              {products.map((p) => (
                <Card key={p.id} p={p} />
              ))}
            </div>
          )}

          {loading && (
            <div className="loading-text">
              Loading products...
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </>
  );
}