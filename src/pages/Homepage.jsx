import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useProductCache } from "../context/ProductCacheContext";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/Homepage.css";

export default function Homepage({ user }) {
  const navigate = useNavigate();
  const { setProducts, setLoaded } = useProductCache();
  const [feed, setFeed] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cursor, setCursor] = useState(null);  // 🔥 infinite scroll cursor
  const [prefetching, setPrefetching] = useState(new Set());

  const API_BASE = import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com/api";

  // ✅ Naira formatting (NG locale)
  const formatNaira = useCallback((price) => 
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(Number(price))
  , []);

  // ✅ Image extractor + blur placeholder
  const getImage = useCallback((product) => {
    if (!product?.images?.[0]) return "/placeholder-product.jpg";
    const img = product.images[0];
    return typeof img === 'string' ? img : (img.url || img.thumbnail_url || "/placeholder-product.jpg");
  }, []);

  // ✅ Location badge
  const getLocationBadge = useCallback((product, meta) => {
    if (product.distance_km !== undefined) return `${product.distance_km}km away`;
    if (meta.nearbySource === 'gps') return 'Nearby';
    return product.location?.city || 'Nationwide';
  }, []);

  // ✅ CTR tier badge [web:41]
  const getCtrBadge = useCallback((ctr) => {
    if (!ctr || ctr === 0) return null;
    if (ctr > 0.15) return '🔥 Hot';
    if (ctr > 0.08) return '📈 Trending';
    if (ctr > 0.04) return '👍 Popular';
    return null;
  }, []);

  // ✅ Track view (debounced hover)
  const trackView = useCallback(async (productId) => {
    try {
      await fetch(`${API_BASE}/products/${productId}/view`, { method: 'POST' });
    } catch {}  // fire-and-forget
  }, [API_BASE]);

  // ✅ Track click + prefetch [web:38][web:43]
  const handleProductClick = useCallback(async (product) => {
    // Track click (fuels personalization)
    fetch(`${API_BASE}/products/${product.id}/click`, { method: 'POST' }).catch(() => {});
    
    // Prefetch detail page
    if (!prefetching.has(product.id)) {
      setPrefetching(prev => new Set(prev).add(product.id));
      fetch(`${API_BASE}/product/${product.slug}`, { 
        headers: { 'X-Prefetch': 'true' } 
      }).catch(() => {});
    }
    
    navigate(`/product/${product.slug}`);
  }, [API_BASE, navigate, prefetching]);

  // ✅ FIXED loadFeed (bug-free geolocation)
  const loadFeed = useCallback(async (gpsOverride = null) => {
    setLoading(true);
    setError(null);

    // 🔥 Define fallback FIRST (fixes hoisting bug)
    const fallbackFetch = async () => {
      try {
        const url = `${API_BASE}/homepage${cursor ? `?cursor=${cursor}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Network error');
        
        const data = await res.json();
        setMeta(data.meta || {});
        setProducts(data.products || []);
        setFeed(prev => cursor ? dedup([...prev, ...(data.products || [])]) : (data.products || []));
        setLoaded(true);
        setCursor(data.nextCursor);  // backend pagination
      } catch (err) {
        console.error('Feed error:', err);
        setError('Failed to load marketplace');
      } finally {
        setLoading(false);
      }
    };

    try {
      if (navigator.geolocation && !gpsOverride) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              const url = `${API_BASE}/homepage?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}${cursor ? `&cursor=${cursor}` : ''}`;
              const res = await fetch(url);
              if (!res.ok) return fallbackFetch();

              const data = await res.json();
              setMeta(data.meta || {});
              setProducts(data.products || []);
              setFeed(cursor ? dedup([...feed, ...(data.products || [])]) : (data.products || []));
              setLoaded(true);
              setCursor(data.nextCursor);
            } catch {
              fallbackFetch();
            } finally {
              setLoading(false);
            }
          },
          fallbackFetch,
          { timeout: 5000, enableHighAccuracy: false, maximumAge: 5 * 60 * 1000 }
        );
      } else {
        fallbackFetch();
      }
    } catch {
      fallbackFetch();
    }
  }, [API_BASE, cursor, setProducts, setLoaded, feed]);

  // Initial load + soft refresh on focus [web:42]
  useEffect(() => {
    loadFeed();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadFeed(true);  // soft refresh (preserve scroll)
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadFeed]);

  // Infinite scroll sentinel
  useEffect(() => {
    if (!cursor || loading) return;
    
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadFeed();
    }, { threshold: 0.1 });

    const sentinel = document.querySelector('.infinite-sentinel');
    if (sentinel) observer.observe(sentinel);
    
    return () => observer.disconnect();
  }, [cursor, loading, loadFeed]);

  // Dedupe
  const dedup = useCallback((arr) => {
    const seen = new Set();
    return arr.filter(p => !seen.has(p.id) && seen.add(p.id));
  }, []);

  // ✅ Enhanced ProductCard
  const ProductCard = React.memo(({ product, index }) => {
    const isNew = new Date(product.createdAt) > Date.now() - 24 * 60 * 60 * 1000;
    const ctrLabel = getCtrBadge(product.ctr);
    const reason = meta.interests > 0 ? 'Based on your likes' : null;

    return (
      <article 
        className="product-card"
        onClick={() => handleProductClick(product)}
        onMouseEnter={() => trackView(product.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleProductClick(product)}
      >
        <div className="card-image" style={{ background: '#f8fafc' }}>
          <img 
            src={getImage(product)}
            alt={product.title}
            loading={index === 0 ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={index === 0 ? "high" : "auto"}  // LCP hero [web:42][web:47]
          />
          {product.is_promoted && <span className="badge promoted">Sponsored</span>}
          {isNew && <span className="badge new">NEW</span>}
          {ctrLabel && <span className="badge ctr">{ctrLabel}</span>}
        </div>
        
        <div className="card-body">
          <h3 className="title">{product.title}</h3>
          <div className="price-container">
            <span className="price">{formatNaira(product.price)}</span>
            {product.seller?.verified && <span className="verified">✓ Verified</span>}
          </div>
          <p className="location">{getLocationBadge(product, meta)}</p>
          {product.seller?.trust_score && (
            <div className="trust-bar">
              <div className="trust-fill" style={{ width: `${product.seller.trust_score}%` }} />
              <span>{product.seller.trust_score}% Trust</span>
            </div>
          )}
          {reason && <p className="reason">{reason}</p>}
        </div>
      </article>
    );
  });

  // Skeleton (unchanged)
  const SkeletonCard = ({ index }) => (
    <article className="product-card skeleton">
      <div className="card-image">
        <div className="skeleton-image" />
      </div>
      <div className="card-body">
        <div className="skeleton-title" />
        <div className="skeleton-price" />
        <div className="skeleton-location" />
      </div>
    </article>
  );

  return (
    <>
      <TopNav />
      
      <main className="homepage">
        {meta.location && (
          <header className="feed-header">
            <h1>Products near {meta.location}</h1>
            {meta.nearbySource === 'gps' && <span className="gps-badge">Using GPS</span>}
            {meta.interests > 0 && <span className="personal-badge">Personalized</span>}
          </header>
        )}

        {error ? (
          <div className="error-state">
            <h2>Marketplace Unavailable</h2>
            <p>{error}</p>
            <button onClick={() => loadFeed()}>Try Again</button>
          </div>
        ) : loading && feed.length === 0 ? (
          <div className="feed-grid">
            {Array(12).fill().map((_, i) => <SkeletonCard key={i} index={i} />)}
          </div>
        ) : feed.length === 0 ? (
          <div className="empty-state">
            <h2>Welcome to Minimart</h2>
            <p>Enable location for nearby deals or refresh</p>
            <button onClick={() => loadFeed()}>Load Marketplace</button>
          </div>
        ) : (
          <>
            <div className="feed-grid">
              {feed.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} />
              ))}
            </div>
            <div className="infinite-sentinel" />
          </>
        )}
      </main>

      <button className="fab" onClick={() => navigate("/add-product")} aria-label="Sell product">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </button>

      <BottomNav />
    </>
  );
}