import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import { useProductCache } from "../context/ProductCacheContext";
import "../styles/Homepage.css";

// Import Swiper
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

  useEffect(() => {
    if (loaded) return;

    const fetchHomepage = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          "https://minimart-ivrm.onrender.com/api/homepage"
        );
        const data = await res.json();

        const latest = data.latest || [];
        const promoted = data.promoted || [];

        setProducts(latest);

        if (promoted.length > 0) {
          setTrending(promoted.slice(0, 10));
        } else {
          const recommended = [...latest]
            .sort((a, b) => b.price - a.price)
            .slice(0, 10);
          setTrending(recommended);
        }

        setLoaded(true);
      } catch (err) {
        console.error("Homepage fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHomepage();
  }, [loaded, setProducts, setTrending, setLoaded]);

  const cheapDeals = useMemo(
    () => products.filter((p) => p.price < 50000).slice(0, 10),
    [products]
  );

  const discover = useMemo(
    () => [...products].sort(() => 0.5 - Math.random()).slice(0, 10),
    [products]
  );

  const getImage = (p) =>
    p.images?.[0] || "https://via.placeholder.com/300x200?text=No+Image";

  const getLocation = (p) =>
    p.location?.state && p.location?.city
      ? `${p.location.state}, ${p.location.city}`
      : p.location?.state || "Nigeria";

  const Card = ({ p, compact = false }) => (
    <div
      className={`card ${compact ? "compact" : ""}`}
      onClick={() => navigate(`/product/${p.id}`)}
    >
      <div className="card-image">
        <img src={getImage(p)} alt={p.title} loading="lazy" />
      </div>
      <div className="card-body">
        <div className="price">₦{Number(p.price).toLocaleString()}</div>
        <div className="title">{p.title}</div>
        {!compact && (
          <>
            <div className="desc">{p.description}</div>
            <div className="location">📍 {getLocation(p)}</div>
          </>
        )}
      </div>
    </div>
  );

  const renderSwiperSection = (title, items) => (
    <div className="section">
      <h2>{title}</h2>
      <Swiper
        modules={[Navigation, Pagination]}
        slidesPerView={2}           // default mobile
        spaceBetween={12}
        navigation
        pagination={{ clickable: true }}
        breakpoints={{
          480: { slidesPerView: 3 },
          768: { slidesPerView: 5 },
          1024: { slidesPerView: 6 },
          1280: { slidesPerView: 10 },
        }}
      >
        {items.map((p) => (
          <SwiperSlide key={p.id}>
            <Card p={p} compact />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );

  return (
    <>
      <TopNav />

      <div className="homepage-container">
        {renderSwiperSection("🔥 Trending", trending)}
        {cheapDeals.length > 0 && renderSwiperSection("💰 Cheap Deals", cheapDeals)}
        {discover.length > 0 && renderSwiperSection("✨ Discover", discover)}

        {/* 🆕 New Arrivals */}
        <div className="section">
          <h2>🆕 New Arrivals</h2>
          <div className="products-grid">
            {products.map((p) => (
              <Card key={p.id} p={p} />
            ))}
          </div>
          {loading && <p className="loading-text">Loading...</p>}
          {!loading && products.length === 0 && <p className="loading-text">No products found</p>}
        </div>
      </div>

      <BottomNav />
    </>
  );
}