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

  /* ================= FETCH ONLY ONCE ================= */
  useEffect(() => {
    if (loaded) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        const res = await fetch(
          "https://minimart-ivrm.onrender.com/api/homepage"
        );
        const data = await res.json();

        const latest = data.latest || [];
        const promoted = data.promoted || [];

        setProducts(latest);

        setTrending(
          promoted.length > 0
            ? promoted.slice(0, 10)
            : [...latest].slice(0, 10)
        );

        setLoaded(true);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [loaded]);

  /* ================= PERFORMANCE FILTERS ================= */
  const cheapDeals = useMemo(
    () => products.filter((p) => p.price < 50000).slice(0, 10),
    [products]
  );

  const recommended = useMemo(
    () => products.slice(0, 12),
    [products]
  );

  /* ================= HELPERS (FAST) ================= */
  const getImage = (p) =>
    p.images?.[0] ||
    "https://via.placeholder.com/300x200?text=No+Image";

  const getLocation = (p) =>
    p.location?.state && p.location?.city
      ? `${p.location.state}, ${p.location.city}`
      : p.location?.state || "Nigeria";

  /* ================= CARD (MEMOIZED FOR LOW-END PHONES) ================= */
  const Card = useCallback(
    ({ p }) => (
      <div
        className="masonry-card"
        onClick={() => navigate(`/product/${p.id}`)}
      >
        <img src={getImage(p)} loading="lazy" />
        <div className="info">
          <div className="price">
            ₦{Number(p.price).toLocaleString()}
          </div>
          <div className="title">{p.title}</div>
          <div className="location">📍 {getLocation(p)}</div>
        </div>
      </div>
    ),
    [navigate]
  );

  /* ================= SWIPER SECTION ================= */
  const Section = ({ title, items }) => (
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

  return (
    <>
      <TopNav />

      <div className="homepage-container">

        {/* ================= SWIPER LAYERS ================= */}
        <Section title="🔥 Trending" items={trending} />
        <Section title="💰 Cheap Deals" items={cheapDeals} />
        <Section title="✨ Recommended" items={recommended} />

        {/* ================= MASONRY FEED ================= */}
        <div className="section">
          <h2>🛒 All Products</h2>

          <div className="masonry-grid">
            {products.map((p) => (
              <Card key={p.id} p={p} />
            ))}
          </div>

          {loading && (
            <p className="loading-text">Loading...</p>
          )}
        </div>
      </div>

      <BottomNav />
    </>
  );
}