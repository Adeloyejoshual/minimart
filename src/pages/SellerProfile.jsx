import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const API_BASE = "https://minimart-ivrm.onrender.com";

export default function SellerProfile() {
  const { id } = useParams();

  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Fetch seller profile
  useEffect(() => {
    const fetchSeller = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/seller/${id}`);
        setSeller(res.data.seller);
        setProducts(res.data.products);
        setStats(res.data.stats);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSeller();
  }, [id]);

  // Load more products
  const loadMore = async () => {
    try {
      const nextPage = page + 1;
      const res = await axios.get(
        `${API_BASE}/api/seller/${id}/products?page=${nextPage}&limit=20`
      );

      setProducts((prev) => [...prev, ...res.data.products]);
      setPage(nextPage);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (!seller) return <div className="p-4">Seller not found</div>;

  return (
    <div className="seller-page">
      
      {/* ================= HEADER ================= */}
      <div className="seller-header">
        <div className="seller-info">
          <img
            src={seller.store_logo || seller.profile_image || "/default.png"}
            alt="logo"
            className="seller-logo"
          />

          <div>
            <h2>
              {seller.store_name || seller.name}
              {seller.verified && <span className="badge">✔</span>}
            </h2>

            <p className="desc">
              {seller.store_description || "No description provided"}
            </p>

            <div className="meta">
              <span>⭐ {seller.rating || 0}</span>
              <span>
                {seller.is_online ? "🟢 Online" : "⚪ Offline"}
              </span>
              <span>Trust: {seller.trust_score}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= STATS ================= */}
      <div className="seller-stats">
        <div className="stat-box">
          <h3>{stats?.total_products || 0}</h3>
          <p>Products</p>
        </div>

        <div className="stat-box">
          <h3>{stats?.total_views || 0}</h3>
          <p>Views</p>
        </div>

        <div className="stat-box">
          <h3>{seller.total_sales || 0}</h3>
          <p>Sales</p>
        </div>

        <div className="stat-box">
          <h3>{stats?.total_clicks || 0}</h3>
          <p>Clicks</p>
        </div>
      </div>

      {/* ================= PRODUCTS ================= */}
      <div className="products-section">
        <h3>Products</h3>

        <div className="product-grid">
          {products.map((p) => (
            <div key={p.id} className="product-card">
              <img
                src={p.thumbnail_url || p.main_image}
                alt={p.title}
              />

              <div className="product-info">
                <h4>{p.title}</h4>
                <p className="price">₦{p.price}</p>
                <span className="views">{p.views} views</span>
              </div>

              {p.is_promoted && (
                <span className="promoted">Promoted</span>
              )}
            </div>
          ))}
        </div>

        {/* LOAD MORE */}
        <div className="load-more">
          <button onClick={loadMore}>Load More</button>
        </div>
      </div>
    </div>
  );
}
import TopNav      from "../../components/TopNav";
import BottomNav   from "../../components/BottomNav";
import MasonryGrid from "../../components/MasonryGrid";
            <MasonryGrid
              products={products}
              onView={trackView}
              onClick={handleClick}
            />
            <div ref={sentinelRef} style={{ height: 1 }} />