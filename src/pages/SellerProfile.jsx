import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import TopNav from "../../components/TopNav";
import BottomNav from "../../components/BottomNav";
import MasonryGrid from "../../components/MasonryGrid";

const API_BASE = "https://minimart-ivrm.onrender.com";
const LIMIT = 20;

export default function SellerProfile() {
  const { id } = useParams();

  const [seller, setSeller]       = useState(null);
  const [products, setProducts]   = useState([]);
  const [stats, setStats]         = useState(null);
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(false);   // FIX: track when to stop
  const [loading, setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]         = useState(null);
  const [moreError, setMoreError] = useState(null);

  const sentinelRef = useRef(null);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchSeller = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${API_BASE}/api/seller/${id}`);
        setSeller(res.data.seller);
        setStats(res.data.stats);

        const initial = res.data.products ?? [];
        setProducts(initial);

        // FIX: if the first batch is already a full page, there may be more
        setHasMore(initial.length === LIMIT);
        setPage(1);
      } catch (err) {
        console.error(err);
        setError("Could not load seller. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchSeller();
  }, [id]);

  // ── Load next page ───────────────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    setMoreError(null);

    try {
      const nextPage = page + 1;
      const res = await axios.get(
        `${API_BASE}/api/seller/${id}/products?page=${nextPage}&limit=${LIMIT}`
      );

      const incoming = res.data.products ?? [];
      setProducts((prev) => [...prev, ...incoming]);
      setPage(nextPage);

      // FIX: use server-provided hasMore so we stop at the right time
      setHasMore(res.data.hasMore ?? incoming.length === LIMIT);
    } catch (err) {
      console.error(err);
      setMoreError("Failed to load more products.");
    } finally {
      setLoadingMore(false);
    }
  }, [id, page, hasMore, loadingMore]);

  // ── Infinite scroll via IntersectionObserver ─────────────────────────────────
  // FIX: wire up the sentinel ref so the page scrolls automatically
  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  // ── Event handlers (kept from original pattern) ──────────────────────────────
  const trackView = (product) => {
    // e.g. POST /api/products/:id/view
  };

  const handleClick = (product) => {
    // e.g. navigate to product page
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) return <div className="p-4">Loading...</div>;

  // FIX: show error state instead of blank screen
  if (error)  return <div className="p-4 text-red-500">{error}</div>;
  if (!seller) return <div className="p-4">Seller not found</div>;

  return (
    <div className="seller-page">
      <TopNav />

      {/* ── Header ── */}
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
              <span>⭐ {seller.rating ?? 0}</span>
              <span>{seller.is_online ? "🟢 Online" : "⚪ Offline"}</span>
              <span>Trust: {seller.trust_score}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="seller-stats">
        {[
          { label: "Products", value: stats?.total_products ?? 0 },
          { label: "Views",    value: stats?.total_views    ?? 0 },
          { label: "Sales",    value: seller.total_sales    ?? 0 },
          { label: "Clicks",   value: stats?.total_clicks   ?? 0 },
        ].map(({ label, value }) => (
          <div className="stat-box" key={label}>
            <h3>{value}</h3>
            <p>{label}</p>
          </div>
        ))}
      </div>

      {/* ── Products ── */}
      <div className="products-section">
        <h3>Products</h3>

        {/* FIX: empty state when seller has no products */}
        {products.length === 0 ? (
          <p className="empty-state">This seller has no active products yet.</p>
        ) : (
          // FIX: use MasonryGrid consistently (matches rest of the app)
          <MasonryGrid
            products={products}
            onView={trackView}
            onClick={handleClick}
          />
        )}

        {/* FIX: sentinel drives infinite scroll; hidden once nothing left */}
        {hasMore && (
          <div ref={sentinelRef} style={{ height: 1 }} />
        )}

        {/* Loading spinner while fetching next page */}
        {loadingMore && (
          <div className="load-more-spinner">Loading more…</div>
        )}

        {/* FIX: surface load-more errors so the user can retry */}
        {moreError && (
          <div className="load-more-error">
            <p>{moreError}</p>
            <button onClick={loadMore}>Retry</button>
          </div>
        )}

        {/* End-of-list message */}
        {!hasMore && products.length > 0 && (
          <p className="end-of-list">You've seen all products.</p>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
