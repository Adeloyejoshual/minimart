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
import AuthLoader from '../components/AuthLoader';
import '../styles/Minimart.css';

/* ══════════════════════════════════════════════════════════
   PAGINATION CONFIG

   The catalog is split into numbered "Pages".
   Each Page = PAGES_PER_BLOCK API requests, loaded automatically
   as the user scrolls. At the bottom of a Page the user gets
   Previous / Next buttons to move through the remaining products.

   PAGE_LIMIT is the same for every request so API pages never overlap.
══════════════════════════════════════════════════════════ */
const PAGE_LIMIT = 30;
const PAGES_PER_BLOCK = 3; // 3 x 30 = 90 products per Page
const BLOCK_SIZE = PAGE_LIMIT * PAGES_PER_BLOCK;
const SORT_MODE = 'random'; // random order, categories interleaved by the backend

// One random seed per page load: refresh = new order, scrolling = stable order.
const makeSeed = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

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
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [timeLeft, setTimeLeft] = useState({
    hours: '00', minutes: '00', seconds: '00',
  });

  const [blockIndex, setBlockIndex] = useState(0); // 0 = Page 1
  const [totalProducts, setTotalProducts] = useState(null);
  const [pagesLoaded, setPagesLoaded] = useState(0); // API pages loaded in this Page
  const [hasMore, setHasMore] = useState(true); // server still has more products
  const [loadingMore, setLoadingMore] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Refs hold live pagination state so rapid scroll events can never
  // request the same API page twice or read a stale page number.
  const nextPageRef = useRef(1);
  const seedRef = useRef(makeSeed());
  const loadingRef = useRef(false);
  const sentinelRef = useRef(null);
  const blocksCacheRef = useRef({}); // lets "Previous" restore a Page instantly
  const apiCategoriesRef = useRef(false);

  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(160);

  const [selectedProductForVariant, setSelectedProductForVariant] =
    useState(null);
  const [isVariantSheetOpen, setIsVariantSheetOpen] = useState(false);

  const canAutoLoad =
    hasMore && pagesLoaded > 0 && pagesLoaded < PAGES_PER_BLOCK && !loading;
  const blockEnded = pagesLoaded >= PAGES_PER_BLOCK || !hasMore;
  const totalBlocks =
    totalProducts != null ? Math.max(1, Math.ceil(totalProducts / BLOCK_SIZE)) : null;

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
  }, [initialLoaded]);

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

  // 3. Remember each Page once it is loaded so "Previous" is instant
  useEffect(() => {
    if (loading) return;
    blocksCacheRef.current[blockIndex] = {
      products,
      pagesLoaded,
      hasMore,
      nextPage: nextPageRef.current,
    };
  }, [products, pagesLoaded, hasMore, loading, blockIndex]);

  /** Merge category names found in products (only when the API gave none). */
  const absorbCategories = useCallback((items) => {
    if (apiCategoriesRef.current) return;
    const found = items
      .map((p) => p.category || p.category_name)
      .filter(Boolean);
    if (!found.length) return;
    setCategories((prev) => Array.from(new Set([...prev, ...found])));
  }, []);

  /**
   * Open a numbered Page (block). Page 1 = blockIndex 0.
   * Uses the cache when the Page was already visited.
   */
  const loadBlock = useCallback(async (b) => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    setBlockIndex(b);

    const cached = blocksCacheRef.current[b];
    if (cached) {
      setProducts(cached.products);
      setPagesLoaded(cached.pagesLoaded);
      setHasMore(cached.hasMore);
      nextPageRef.current = cached.nextPage;
      setLoading(false);
      return;
    }

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

      setProducts(mergeUnique([], incoming));
      nextPageRef.current = firstApiPage + 1;
      setPagesLoaded(1);
      setHasMore(incoming.length > 0 ? result.hasMore : false);
      if (result.total != null) setTotalProducts(result.total);
      absorbCategories(incoming);
    } catch (err) {
      console.error('Failed to load products page:', err);
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setInitialLoaded(true);
    }
  }, [absorbCategories]);

  // 4. Initial load: campaigns + categories + Page 1
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

  /** Fetch the next API page inside the current Page and append it. */
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
  }, [hasMore, absorbCategories]);

  // 5. Sentinel (auto-load while scrolling inside a Page)
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !canAutoLoad) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadNextApiPage(); },
      { rootMargin: '400px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadNextApiPage, canAutoLoad]);

  // 6. Catch-up: if the content is short, keep loading until it fills the screen
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

  // First visit: full-screen spinner until Page 1 has loaded.
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
          <div className="pr-masonry" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {displayedCatalog.map((product) => (
              <MasonryCard key={productKey(product)} product={product} onOpenVariantSheet={handleProductClick} />
            ))}
          </div>
        )}

        {/* Auto-load sentinel (only while this Page is still filling up) */}
        {!loading && canAutoLoad && (
          <div ref={sentinelRef} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px 0', minHeight: 60 }}>
            {loadingMore && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#888', fontSize: '0.85rem', fontWeight: 600 }}>
                <span className="lm-spinner" />Loading more...
              </div>
            )}
          </div>
        )}

        {/* Previous / Next page */}
        {showPager && (
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
