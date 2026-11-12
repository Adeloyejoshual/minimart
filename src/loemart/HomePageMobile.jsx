import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileTopBar from '../loemart/mobile/MobileTopBar';
import MobileHeroBanner from '../loemart/mobile/MobileHeroBanner';
import MobileCampaignSpotlight from '../loemart/mobile/MobileCampaignSpotlight';
import MasonryCard from '../loemart/mobile/MasonryCard';
import VariantBottomSheet from '../pages/MarketDetail/VariantBottomSheet';
import FloatingCartButton from '../components/FloatingCartButton';
import Footer from '../components/Footer';
import BottomNav from '../components/BottomNav';
import {
  formatPrice,
  calcDiscountPct,
  primaryImg,
  getProductPath,
  fetchCategories,
  getMidnightWATTimeLeft,
  partitionAdminProductSections,
  fetchProductsPage,
  fetchCampaigns,
} from '../loemart/mobile/mobileHelpers';
import '../styles/Minimart.css';

/* ══════════════════════════════════════════════════════════
   PAGINATION CONFIG
   PAGE_LIMIT is used for EVERY request. Page N at a different
   page size than page N-1 overlaps earlier results, which is
   what caused the same product to appear 3-4 times.
══════════════════════════════════════════════════════════ */
const PAGE_LIMIT = 30;
const AUTO_PAGES = 3; // pages loaded automatically while scrolling
const SORT_MODE = 'diverse'; // categories interleaved by the backend

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */

const productKey = (p) => String(p?.id ?? p?.product_id ?? '');

/** Append incoming products, skipping any id already present. */
function mergeUnique(prev, incoming) {
  const seen = new Set(prev.map(productKey));
  const out = [...prev];
  for (const item of incoming) {
    const k = productKey(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function getAuthToken() {
  const keys = [
    'token', 'buyer_token', 'auth_token', 'access_token',
    'lm_token', 'lm-token', 'jwt',
  ];
  for (const k of keys) {
    const val = localStorage.getItem(k) || sessionStorage.getItem(k);
    if (val) return val;
  }
  try {
    const rawUser =
      localStorage.getItem('user') || localStorage.getItem('buyer');
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed.token || parsed.accessToken) {
        return parsed.token || parsed.accessToken;
      }
    }
  } catch { /* ignore */ }
  return null;
}

/* ══════════════════════════════════════════════════════════
   HOOK: Live cart count
══════════════════════════════════════════════════════════ */
function useCartCount() {
  const [count, setCount] = useState(0);

  const refreshCart = useCallback(async () => {
    try {
      const token = getAuthToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/cart', {
        headers,
        credentials: 'include',
      });

      if (res.ok) {
        const json = await res.json();
        const payload = json?.data?.data || json?.data || {};
        const total =
          payload.total_qty ??
          payload.item_count ??
          (Array.isArray(payload.items) ? payload.items.length : 0);
        setCount(Number(total) || 0);
        return;
      }

      const guestCartRaw =
        localStorage.getItem('lm-cart') || localStorage.getItem('cart');
      if (guestCartRaw) {
        const guestParsed = JSON.parse(guestCartRaw);
        if (Array.isArray(guestParsed)) {
          setCount(guestParsed.length);
          return;
        }
      }
      setCount(0);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    refreshCart();
    window.addEventListener('cart-updated', refreshCart);
    window.addEventListener('storage', refreshCart);
    window.addEventListener('focus', refreshCart);
    return () => {
      window.removeEventListener('cart-updated', refreshCart);
      window.removeEventListener('storage', refreshCart);
      window.removeEventListener('focus', refreshCart);
    };
  }, [refreshCart]);

  return { count, refreshCart };
}

/* ══════════════════════════════════════════════════════════
   PAGE COMPONENT
══════════════════════════════════════════════════════════ */
export default function HomePageMobile() {
  const navigate = useNavigate();
  const { count: cartCount, refreshCart } = useCartCount();

  const [products, setProducts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState({
    hours: '00', minutes: '00', seconds: '00',
  });

  const [pagesLoaded, setPagesLoaded] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Refs hold the live pagination state so rapid scroll events can never
  // request the same page twice or read a stale page number.
  const nextPageRef = useRef(1);
  const loadingRef = useRef(false);
  const sentinelRef = useRef(null);

  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(160);

  const [selectedProductForVariant, setSelectedProductForVariant] =
    useState(null);
  const [isVariantSheetOpen, setIsVariantSheetOpen] = useState(false);

  const canAutoLoad = hasMore && pagesLoaded < AUTO_PAGES && !loading;
  const showLoadMoreBtn = hasMore && pagesLoaded >= AUTO_PAGES && !loading;

  /* ══════════════════════════════════════════════════════════
     EFFECTS
  ══════════════════════════════════════════════════════════ */

  // 0. Header height
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.offsetHeight;
      if (h > 0) setHeaderHeight(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  // 1. Countdown
  useEffect(() => {
    const tick = () => setTimeLeft(getMidnightWATTimeLeft());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // 2. Scroll-to-top
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 3. Initial data load
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      loadingRef.current = true;
      try {
        const [productData, rawCampaigns, apiCategories] = await Promise.all([
          fetchProductsPage(1, PAGE_LIMIT, SORT_MODE).catch(() => ({
            products: [], hasMore: false, nextPage: 2,
          })),
          fetchCampaigns().catch(() => []),
          fetchCategories().catch(() => []),
        ]);

        if (!isMounted) return;

        const rawProducts = Array.isArray(productData.products)
          ? productData.products : [];

        // Server order is already category-interleaved and stable.
        // Only dedupe; never reshuffle.
        const initial = mergeUnique([], rawProducts);

        setProducts(initial);
        nextPageRef.current = productData.nextPage;
        setPagesLoaded(1);
        setHasMore(productData.hasMore);
        setCampaigns(Array.isArray(rawCampaigns) ? rawCampaigns : []);

        if (apiCategories.length > 0) {
          setCategories(apiCategories);
        } else {
          setCategories(
            Array.from(
              new Set(
                initial.map((p) => p.category || p.category_name).filter(Boolean)
              )
            )
          );
        }
      } catch (err) {
        console.error('Failed to load mobile homepage data:', err);
      } finally {
        loadingRef.current = false;
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, []);

  /**
   * Fetch the next page and append it.
   * Used by both the scroll observer and the "Load More" button.
   */
  const loadNextPage = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoadingMore(true);

    const pageToFetch = nextPageRef.current;

    try {
      const result = await fetchProductsPage(pageToFetch, PAGE_LIMIT, SORT_MODE);
      const incoming = Array.isArray(result.products) ? result.products : [];

      if (incoming.length > 0) {
        setProducts((prev) => mergeUnique(prev, incoming));
        setCategories((prev) => {
          const newCats = incoming
            .map((p) => p.category || p.category_name)
            .filter(Boolean);
          return Array.from(new Set([...prev, ...newCats]));
        });
      }

      nextPageRef.current = pageToFetch + 1;
      setPagesLoaded((n) => n + 1);
      setHasMore(incoming.length > 0 ? result.hasMore : false);
    } catch (err) {
      console.error('Failed to load more products:', err);
    } finally {
      setLoadingMore(false);
      loadingRef.current = false;
    }
  }, [hasMore]);

  // 4. Sentinel (infinite scroll for the first AUTO_PAGES pages)
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !canAutoLoad) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadNextPage(); },
      { rootMargin: '400px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadNextPage, canAutoLoad]);

  // 5. Catch-up: if the page is short, keep loading until it fills the screen
  useEffect(() => {
    if (loadingMore || loading || !canAutoLoad) return;
    const timer = setTimeout(() => {
      const dist =
        document.documentElement.scrollHeight -
        window.scrollY -
        window.innerHeight;
      if (dist < 800) loadNextPage();
    }, 150);
    return () => clearTimeout(timer);
  }, [products.length, loadingMore, loading, canAutoLoad, loadNextPage]);

  /* ══════════════════════════════════════════════════════════
     HANDLERS
  ══════════════════════════════════════════════════════════ */

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const handleCategorySelect = (catName) => {
    setActiveCategory(catName === 'All' ? 'All' : catName);
  };

  const handleProductClick = (item) => {
    let variants = item?.variants || [];
    if (typeof variants === 'string') {
      try { variants = JSON.parse(variants); } catch { variants = []; }
    }
    if (Array.isArray(variants) && variants.length > 1) {
      setSelectedProductForVariant(item);
      setIsVariantSheetOpen(true);
    } else {
      navigate(getProductPath(item));
    }
  };

  const handleFloatingCartClick = () => navigate('/cart');

  /* ══════════════════════════════════════════════════════════
     DERIVED DATA
  ══════════════════════════════════════════════════════════ */

  const sections = partitionAdminProductSections(products);

  const displayedCatalog =
    activeCategory === 'All'
      ? sections.all
      : sections.all.filter(
          (p) => (p.category || p.category_name) === activeCategory
        );

  const reachedEnd = !hasMore && !loading && displayedCatalog.length > 0;

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */

  return (
    <div
      className="home-page-mobile-wrapper"
      style={{
        minHeight: '100vh',
        backgroundColor: '#f5f5f7',
        paddingTop: headerHeight,
        paddingBottom: '80px',
        overflowX: 'clip',
      }}
    >
      <MobileTopBar
        ref={headerRef}
        categories={categories}
        activeCategory={activeCategory}
        onSelectCategory={handleCategorySelect}
        cartCount={cartCount}
      />

      <MobileHeroBanner />

      {(campaigns.length > 0 || sections.campaign.length > 0) && (
        <MobileCampaignSpotlight
          campaign={campaigns[0] || null}
          products={sections.campaign}
          onOpenVariantSheet={handleProductClick}
        />
      )}

      {sections.flash.length > 0 && (
        <div className="mdp-psec" style={{ margin: 12, padding: 14, background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#ff6000', fontWeight: 900, fontSize: '1.05rem', letterSpacing: '-0.3px' }}>⚡ FLASH SALE</span>
              <div style={{ display: 'flex', gap: 3, background: '#111', color: '#fff', padding: '3px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                <span>{timeLeft.hours}</span>:<span>{timeLeft.minutes}</span>:<span>{timeLeft.seconds}</span>
              </div>
            </div>
            <button type="button" onClick={() => navigate('/m/search?filter=flash')} style={{ background: 'none', border: 'none', color: '#ff6000', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}>See All &gt;</button>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
            {sections.flash.slice(0, 10).map((item) => {
              const id = item.id || item.product_id;
              const imgUrl = primaryImg(item.primaryImg || item.images || item.image_url, item);
              const price = item.price ?? item.selling_price ?? item.sale_price;
              const oldPrice = item.oldPrice ?? item.old_price ?? item.original_price ?? item.regular_price;
              const discount = calcDiscountPct(price, oldPrice);
              const title = item.title || item.name || 'Flash Deal';
              return (
                <div key={id} onClick={() => handleProductClick(item)} style={{ flex: '0 0 148px', width: 148, cursor: 'pointer', background: '#fff', borderRadius: 12, border: '1px solid #eef0f4', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                  <div style={{ width: '100%', aspectRatio: '1/1', background: '#f8f9fc', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, boxSizing: 'border-box' }}>
                    <img src={imgUrl} alt={title} loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain' }} />
                    {discount > 0 && <span style={{ position: 'absolute', top: 6, left: 6, background: '#ff6000', color: '#fff', fontSize: '0.62rem', fontWeight: 900, padding: '2px 5px', borderRadius: 4 }}>-{discount}%</span>}
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, margin: '0 0 4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#111' }}>{title}</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 900, color: '#ff6000', margin: 0 }}>{formatPrice(price)}</p>
                    {discount > 0 && <p style={{ fontSize: '0.68rem', color: '#999', textDecoration: 'line-through', margin: '2px 0 0' }}>{formatPrice(oldPrice)}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sections.sponsored?.length > 0 && (
        <div className="mdp-psec" style={{ margin: 12, padding: 14, background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#111' }}>⭐ Sponsored Deals</span>
            <button type="button" onClick={() => navigate('/m/search?filter=sponsored')} style={{ background: 'none', border: 'none', color: '#ff6000', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}>View All</button>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
            {sections.sponsored.map((item) => {
              const id = item.id || item.product_id;
              const imgUrl = primaryImg(item.primaryImg || item.images || item.image_url, item);
              const price = item.price ?? item.selling_price ?? item.sale_price;
              return (
                <div key={id} onClick={() => handleProductClick(item)} style={{ flex: '0 0 148px', width: 148, background: '#fff', borderRadius: 12, border: '1px solid #eef0f4', overflow: 'hidden', cursor: 'pointer' }}>
                  <div style={{ width: '100%', aspectRatio: '1/1', background: '#f8f9fc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, boxSizing: 'border-box' }}>
                    <img src={imgUrl} alt="" loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#111' }}>{item.title || item.name}</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 900, color: '#ff6000', margin: 0 }}>{formatPrice(price)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sections.trending.length > 0 && (
        <div className="mdp-psec" style={{ margin: 12, padding: 14, background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#111' }}>🔥 Trending Now</span>
            <button type="button" onClick={() => navigate('/m/search?filter=trending')} style={{ background: 'none', border: 'none', color: '#ff6000', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}>View All</button>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
            {sections.trending.map((item) => {
              const id = item.id || item.product_id;
              const imgUrl = primaryImg(item.primaryImg || item.images || item.image_url, item);
              const price = item.price ?? item.selling_price ?? item.sale_price;
              return (
                <div key={id} onClick={() => handleProductClick(item)} style={{ flex: '0 0 148px', width: 148, background: '#fff', borderRadius: 12, border: '1px solid #eef0f4', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                  <div style={{ width: '100%', aspectRatio: '1/1', background: '#f8f9fc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, boxSizing: 'border-box' }}>
                    <img src={imgUrl} alt="" loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#111' }}>{item.title || item.name}</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 900, color: '#ff6000', margin: 0 }}>{formatPrice(price)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ padding: '0 12px', marginTop: 16 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 900, margin: '0 0 12px', color: '#111' }}>
          {activeCategory === 'All' ? 'Explore Catalog' : activeCategory}
        </h3>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {[1, 2, 3, 4].map((n) => (
              <div key={n} style={{ height: 220, background: '#e8e8ec', borderRadius: 12 }} />
            ))}
          </div>
        ) : displayedCatalog.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: 14 }}>
            <p style={{ fontSize: '0.9rem', color: '#666', margin: 0 }}>No items found in this section.</p>
            {activeCategory !== 'All' && (
              <button type="button" onClick={() => setActiveCategory('All')} style={{ marginTop: 12, background: '#ff6000', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 800, cursor: 'pointer' }}>Show full catalog</button>
            )}
          </div>
        ) : (
          <>
            <div className="pr-masonry" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {displayedCatalog.map((product) => (
                <MasonryCard key={productKey(product)} product={product} onOpenVariantSheet={handleProductClick} />
              ))}
            </div>

            {canAutoLoad && (
              <div ref={sentinelRef} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px 0', minHeight: 60 }}>
                {loadingMore && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#888', fontSize: '0.85rem', fontWeight: 600 }}>
                    <span className="lm-spinner" />Loading more...
                  </div>
                )}
              </div>
            )}

            {showLoadMoreBtn && (
              <div style={{ textAlign: 'center', padding: '28px 0 12px' }}>
                <button type="button" onClick={loadNextPage} disabled={loadingMore} style={{ background: loadingMore ? '#ccc' : '#ff6000', color: '#fff', border: 'none', borderRadius: 14, padding: '16px 48px', fontWeight: 900, fontSize: '0.95rem', cursor: loadingMore ? 'wait' : 'pointer', boxShadow: '0 4px 16px rgba(255,96,0,0.3)', letterSpacing: '0.2px', transition: 'all 0.2s ease' }}>
                  {loadingMore ? 'Loading...' : 'Load More Products'}
                </button>
              </div>
            )}

            {reachedEnd && (
              <p style={{ textAlign: 'center', color: '#bbb', fontSize: '0.8rem', fontWeight: 600, padding: '24px 0 8px' }}>✓ You've seen everything</p>
            )}
          </>
        )}
      </div>

      <Footer />
      <BottomNav />

      <FloatingCartButton count={cartCount} onClick={handleFloatingCartClick} />

      <button type="button" onClick={scrollToTop} aria-label="Scroll to top" style={{ position: 'fixed', bottom: 150, right: 18, zIndex: 900, width: 46, height: 46, borderRadius: '50%', border: 'none', background: '#fff', color: '#ff6000', boxShadow: '0 3px 12px rgba(0,0,0,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 900, opacity: showScrollTop ? 1 : 0, pointerEvents: showScrollTop ? 'auto' : 'none', transform: showScrollTop ? 'translateY(0)' : 'translateY(16px)', transition: 'opacity 0.3s ease, transform 0.3s ease' }}>↑</button>

      <VariantBottomSheet
        isOpen={isVariantSheetOpen}
        onClose={() => { setIsVariantSheetOpen(false); refreshCart(); }}
        product={selectedProductForVariant}
      />

      <style>{`
        .lm-spinner {
          width: 20px; height: 20px;
          border: 3px solid #e0e0e0; border-top-color: #ff6000;
          border-radius: 50%; animation: lm-spin 0.7s linear infinite;
          display: inline-block;
        }
        @keyframes lm-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
