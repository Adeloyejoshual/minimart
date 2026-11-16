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
import AuthLoader from '../components/AuthLoader';
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
══════════════════════════════════════════════════════════ */
const PAGE_LIMIT = 30;
const PAGES_PER_BLOCK = 3; // 3 x 30 = 90 products per visible Page
const BLOCK_SIZE = PAGE_LIMIT * PAGES_PER_BLOCK;
const SORT_MODE = 'random';
const SEARCH_ROUTE = '/m/search';

const makeSeed = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */

const productKey = (p) => String(p?.id ?? p?.product_id ?? '');

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
   INLINE ROLLING SPINNER
══════════════════════════════════════════════════════════ */
function InlineSpinner({ label = 'Loading more products…' }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '32px 0',
        minHeight: 80,
        gap: 12,
      }}
      role="status"
      aria-live="polite"
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: '3px solid #e9ecef',
          borderTop: '3px solid #ff6000',
          borderRadius: '50%',
          animation: 'lm-auth-spin .7s linear infinite',
        }}
      />
      <span style={{ color: '#888', fontSize: '0.82rem', fontWeight: 600 }}>
        {label}
      </span>
    </div>
  );
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
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [timeLeft, setTimeLeft] = useState({
    hours: '00', minutes: '00', seconds: '00',
  });

  const [blockIndex, setBlockIndex] = useState(0);
  const [totalProducts, setTotalProducts] = useState(null);
  const [pagesLoaded, setPagesLoaded] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const nextPageRef = useRef(1);
  const seedRef = useRef(makeSeed());
  const loadingRef = useRef(false);
  const sentinelRef = useRef(null);
  const blocksCacheRef = useRef({});
  const apiCategoriesRef = useRef(false);

  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(160);

  const [selectedProductForVariant, setSelectedProductForVariant] = useState(null);
  const [isVariantSheetOpen, setIsVariantSheetOpen] = useState(false);

  // Derived flags
  const canAutoLoad =
    hasMore && pagesLoaded > 0 && pagesLoaded < PAGES_PER_BLOCK && !loading;
  const blockEnded = pagesLoaded >= PAGES_PER_BLOCK || !hasMore;
  const totalBlocks =
    totalProducts != null ? Math.max(1, Math.ceil(totalProducts / BLOCK_SIZE)) : null;

  /* ══════════════════════════════════════════════════════════
     EFFECTS — Layout & misc.
  ══════════════════════════════════════════════════════════ */

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
  }, [initialLoaded]);

  useEffect(() => {
    const tick = () => setTimeLeft(getMidnightWATTimeLeft());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Cache the current block's state whenever it settles
  useEffect(() => {
    if (loading) return;
    blocksCacheRef.current[blockIndex] = {
      products,
      pagesLoaded,
      hasMore,
      nextPage: nextPageRef.current,
    };
  }, [products, pagesLoaded, hasMore, loading, blockIndex]);

  const absorbCategories = useCallback((items) => {
    if (apiCategoriesRef.current) return;
    const found = items
      .map((p) => p.category || p.category_name)
      .filter(Boolean);
    if (!found.length) return;
    setCategories((prev) => Array.from(new Set([...prev, ...found])));
  }, []);

  /* ══════════════════════════════════════════════════════════
     BLOCK LOADER — handles Next / Prev page clicks
  ══════════════════════════════════════════════════════════ */

  const loadBlock = useCallback(async (b) => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    setBlockIndex(b);

    const cached = blocksCacheRef.current[b];
    if (cached && cached.products.length > 0) {
      // Restore instantly from cache
      setProducts(cached.products);
      setPagesLoaded(cached.pagesLoaded);
      setHasMore(cached.hasMore);
      nextPageRef.current = cached.nextPage;
      setLoading(false);
      return;
    }

    // Fresh fetch
    setProducts([]);
    setPagesLoaded(0);
    setHasMore(true);
    setLoading(true);
    loadingRef.current = true;

    const firstApiPage = b * PAGES_PER_BLOCK + 1;
    nextPageRef.current = firstApiPage;

    try {
      const result = await fetchProductsPage(
        firstApiPage, PAGE_LIMIT, SORT_MODE, seedRef.current
      );
      const incoming = Array.isArray(result.products) ? result.products : [];

      if (incoming.length === 0) {
        // This block has no products → we've run past the end
        setProducts([]);
        setPagesLoaded(0);
        setHasMore(false);
        if (result.total != null) setTotalProducts(result.total);
      } else {
        setProducts(mergeUnique([], incoming));
        nextPageRef.current = firstApiPage + 1;
        setPagesLoaded(1);
        setHasMore(result.hasMore);
        if (result.total != null) setTotalProducts(result.total);
        absorbCategories(incoming);
      }
    } catch (err) {
      console.error('Failed to load products block:', err);
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setInitialLoaded(true);
    }
  }, [absorbCategories]);

  /* ══════════════════════════════════════════════════════════
     INITIAL LOAD — campaigns, categories, first block
  ══════════════════════════════════════════════════════════ */

  useEffect(() => {
    let isMounted = true;

    (async () => {
      const [rawCampaigns, apiCategories] = await Promise.all([
        fetchCampaigns().catch(() => []),
        fetchCategories().catch(() => []),
      ]);
      if (!isMounted) return;
      setCampaigns(Array.isArray(rawCampaigns) ? rawCampaigns : []);
      if (apiCategories.length > 0) {
        apiCategoriesRef.current = true;
        setCategories(apiCategories);
      }
    })();

    loadBlock(0);

    return () => { isMounted = false; };
  }, [loadBlock]);

  /* ══════════════════════════════════════════════════════════
     LOAD MORE within a block (infinite scroll)
  ══════════════════════════════════════════════════════════ */

  const loadNextApiPage = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoadingMore(true);

    const pageToFetch = nextPageRef.current;

    try {
      const result = await fetchProductsPage(
        pageToFetch, PAGE_LIMIT, SORT_MODE, seedRef.current
      );
      const incoming = Array.isArray(result.products) ? result.products : [];

      if (incoming.length > 0) {
        setProducts((prev) => mergeUnique(prev, incoming));
        absorbCategories(incoming);
        nextPageRef.current = pageToFetch + 1;
        setPagesLoaded((n) => n + 1);
        setHasMore(result.hasMore);
      } else {
        // No more items from the backend
        setHasMore(false);
      }

      if (result.total != null) setTotalProducts(result.total);
    } catch (err) {
      console.error('Failed to load more products:', err);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
      loadingRef.current = false;
    }
  }, [hasMore, absorbCategories]);

  /* ══════════════════════════════════════════════════════════
     INTERSECTION OBSERVER — auto-load when sentinel visible
  ══════════════════════════════════════════════════════════ */

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !canAutoLoad || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadNextApiPage();
      },
      { rootMargin: '400px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadNextApiPage, canAutoLoad, loadingMore]);

  // Safety net — if sentinel is already in view when products update, kick again
  useEffect(() => {
    if (loadingMore || loading || !canAutoLoad) return;
    const timer = setTimeout(() => {
      const dist =
        document.documentElement.scrollHeight -
        window.scrollY -
        window.innerHeight;
      if (dist < 800) loadNextApiPage();
    }, 150);
    return () => clearTimeout(timer);
  }, [products.length, loadingMore, loading, canAutoLoad, loadNextApiPage]);

  /* ══════════════════════════════════════════════════════════
     HANDLERS
  ══════════════════════════════════════════════════════════ */

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const goNextPage = () => {
    if (loadingRef.current || loadingMore || !hasMore) return;
    loadBlock(blockIndex + 1);
  };

  const goPrevPage = () => {
    if (loadingRef.current || loadingMore || blockIndex === 0) return;
    loadBlock(blockIndex - 1);
  };

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

  const handleSearchNavigate = (initialQuery = '') => {
    const target = initialQuery
      ? `${SEARCH_ROUTE}?q=${encodeURIComponent(initialQuery)}`
      : SEARCH_ROUTE;
    navigate(target);
  };

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

  const showPager =
    !loading && !loadingMore && products.length > 0 && blockEnded &&
    (blockIndex > 0 || hasMore);

  // Show "Next Page" even when current block is empty, as long as we can go back
  const showEmptyPager =
    !loading && !loadingMore && products.length === 0 && blockIndex > 0;

  const pagerBtnBase = {
    borderRadius: 12,
    padding: '13px 20px',
    fontWeight: 900,
    fontSize: '0.9rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */

  if (!initialLoaded) return <AuthLoader />;

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
        onSearchClick={() => handleSearchNavigate()}
      />

      <MobileHeroBanner />

      {(campaigns.length > 0 || sections.campaign.length > 0) && (
        <MobileCampaignSpotlight
          campaign={campaigns[0] || null}
          products={sections.campaign}
          onOpenVariantSheet={handleProductClick}
        />
      )}

      {/* ─── FLASH SALE ─── */}
      {sections.flash.length > 0 && (
        <div className="mdp-psec" style={{ margin: 12, padding: 14, background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#ff6000', fontWeight: 900, fontSize: '1.05rem', letterSpacing: '-0.3px' }}>⚡ FLASH SALE</span>
              <div style={{ display: 'flex', gap: 3, background: '#111', color: '#fff', padding: '3px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                <span>{timeLeft.hours}</span>:<span>{timeLeft.minutes}</span>:<span>{timeLeft.seconds}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(`${SEARCH_ROUTE}?filter=flash`)}
              style={{ background: 'none', border: 'none', color: '#ff6000', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
            >
              See All &gt;
            </button>
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

      {/* ─── SPONSORED ─── */}
      {sections.sponsored?.length > 0 && (
        <div className="mdp-psec" style={{ margin: 12, padding: 14, background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#111' }}>⭐ Sponsored Deals</span>
            <button
              type="button"
              onClick={() => navigate(`${SEARCH_ROUTE}?filter=sponsored`)}
              style={{ background: 'none', border: 'none', color: '#ff6000', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
            >
              View All
            </button>
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

      {/* ─── TRENDING ─── */}
      {sections.trending.length > 0 && (
        <div className="mdp-psec" style={{ margin: 12, padding: 14, background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#111' }}>🔥 Trending Now</span>
            <button
              type="button"
              onClick={() => navigate(`${SEARCH_ROUTE}?filter=trending`)}
              style={{ background: 'none', border: 'none', color: '#ff6000', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer' }}
            >
              View All
            </button>
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

      {/* ─── CATALOG ─── */}
      <div style={{ padding: '0 12px', marginTop: 16 }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 900, margin: '0 0 12px', color: '#111' }}>
          {activeCategory === 'All' ? 'Explore Catalog' : activeCategory}
        </h3>

        {loading ? (
          <AuthLoader />
        ) : displayedCatalog.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: 14 }}>
            <p style={{ fontSize: '0.9rem', color: '#666', margin: 0 }}>
              {blockIndex > 0
                ? "You've reached the end of our catalog 🎉"
                : 'No items found in this section.'}
            </p>
            {activeCategory !== 'All' && (
              <button
                type="button"
                onClick={() => setActiveCategory('All')}
                style={{ marginTop: 12, background: '#ff6000', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 800, cursor: 'pointer' }}
              >
                Show full catalog
              </button>
            )}
            {blockIndex > 0 && (
              <button
                type="button"
                onClick={goPrevPage}
                style={{ marginTop: 12, marginLeft: 8, background: '#fff', color: '#ff6000', border: '2px solid #ff6000', borderRadius: 8, padding: '8px 16px', fontWeight: 800, cursor: 'pointer' }}
              >
                ← Previous Page
              </button>
            )}
          </div>
        ) : (
          <div className="pr-masonry" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {displayedCatalog.map((product) => (
              <MasonryCard key={productKey(product)} product={product} onOpenVariantSheet={handleProductClick} />
            ))}
          </div>
        )}

        {/* Rolling spinner when loading more within the current block */}
        {loadingMore && <InlineSpinner />}

        {/* Invisible sentinel — triggers auto-load when scrolled into view */}
        {!loading && canAutoLoad && !loadingMore && (
          <div
            ref={sentinelRef}
            style={{ height: 1, width: '100%' }}
            aria-hidden="true"
          />
        )}

        {/* Pager — shown when block is fully loaded */}
        {(showPager || showEmptyPager) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '28px 0 12px' }}>
            <button
              type="button"
              onClick={goPrevPage}
              disabled={blockIndex === 0}
              style={{
                ...pagerBtnBase,
                flex: 1,
                background: '#fff',
                color: blockIndex === 0 ? '#bbb' : '#ff6000',
                border: `2px solid ${blockIndex === 0 ? '#e5e5e5' : '#ff6000'}`,
                cursor: blockIndex === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              ← Previous
            </button>

            <span style={{ flex: '0 0 auto', fontSize: '0.8rem', fontWeight: 800, color: '#555', textAlign: 'center', minWidth: 70 }}>
              Page {blockIndex + 1}{totalBlocks ? ` of ${totalBlocks}` : ''}
            </span>

            <button
              type="button"
              onClick={goNextPage}
              disabled={!hasMore}
              style={{
                ...pagerBtnBase,
                flex: 1,
                background: hasMore ? '#ff6000' : '#ddd',
                color: '#fff',
                border: 'none',
                boxShadow: hasMore ? '0 4px 16px rgba(255,96,0,0.3)' : 'none',
                cursor: hasMore ? 'pointer' : 'not-allowed',
              }}
            >
              Next Page →
            </button>
          </div>
        )}
      </div>

      <Footer />
      <BottomNav />

      <FloatingCartButton count={cartCount} onClick={handleFloatingCartClick} />

      <button
        type="button"
        onClick={scrollToTop}
        aria-label="Scroll to top"
        style={{
          position: 'fixed', bottom: 150, right: 18, zIndex: 900,
          width: 46, height: 46, borderRadius: '50%', border: 'none',
          background: '#fff', color: '#ff6000',
          boxShadow: '0 3px 12px rgba(0,0,0,0.15)',
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '1.3rem', fontWeight: 900,
          opacity: showScrollTop ? 1 : 0,
          pointerEvents: showScrollTop ? 'auto' : 'none',
          transform: showScrollTop ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.3s ease, transform 0.3s ease',
        }}
      >
        ↑
      </button>

      <VariantBottomSheet
        isOpen={isVariantSheetOpen}
        onClose={() => { setIsVariantSheetOpen(false); refreshCart(); }}
        product={selectedProductForVariant}
      />

      <style>{`
        @keyframes lm-auth-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}