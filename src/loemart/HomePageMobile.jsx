import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
} from 'react';
import { useNavigate } from 'react-router-dom';
import MobileTopBar from '../loemart/mobile/MobileTopBar';
import MobileHeroBanner from '../loemart/mobile/MobileHeroBanner';
import MobileCampaignSpotlight from '../loemart/mobile/MobileCampaignSpotlight';
import MasonryCard from '../loemart/mobile/MasonryCard';
import VariantBottomSheet from '../pages/MarketDetail/VariantBottomSheet';
import toast from 'react-hot-toast';
import FloatingCartButton from '../components/FloatingCartButton';
import Footer from '../components/Footer';
import BottomNav from '../components/BottomNav';
import {
  formatPrice,
  calcDiscountPct,
  primaryImg,
  getProductPath,
  mixProducts,
  getMidnightWATTimeLeft,
  partitionAdminProductSections,
  fetchProductsPage,
  fetchCampaigns,
} from '../loemart/mobile/mobileHelpers';
import '../styles/Minimart.css';

const BATCH_SIZE = 3;
const PAGE_LIMIT = 30;
const MIN_BATCH_SPINNER_MS = 700;

/* Same API base the rest of the app uses (see App.jsx) */
const BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || window.location.origin
).replace(/\/+$/, '');
const CART_API = `${BASE_URL}/api/cart`;

/* Routes */
const CART_ROUTE = '/shop/cart';

/* ══════════════════════════════════════════════════════════
   TOKEN RESOLVER
   marketplace_token is the key App.jsx actually writes.
══════════════════════════════════════════════════════════ */
const TOKEN_KEYS = [
  'marketplace_token',
  'token',
  'buyer_token',
  'auth_token',
  'access_token',
  'lm_token',
  'lm-token',
  'jwt',
];

function getAuthToken() {
  try {
    for (const k of TOKEN_KEYS) {
      const val = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (val) return val;
    }

    const rawUser =
      localStorage.getItem('marketplace_user') ||
      localStorage.getItem('user') ||
      localStorage.getItem('buyer');

    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed?.token || parsed?.accessToken) {
        return parsed.token || parsed.accessToken;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function extractCategories(list) {
  return Array.from(
    new Set(list.map((p) => p.category || p.category_name).filter(Boolean))
  );
}

/* Appends items to a list, skipping products that are already in it */
function mergeUnique(prev, items) {
  const idOf = (p) => String(p.id || p.product_id);
  const seen = new Set(prev.map(idOf));
  const extra = items.filter((p) => !seen.has(idOf(p)));
  return extra.length ? [...prev, ...extra] : prev;
}

function sumQty(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((n, i) => n + (Number(i?.qty ?? i?.quantity) || 1), 0);
}

/* Variants may arrive as an array or as a JSON string */
function parseVariants(raw) {
  let v = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      v = [];
    }
  }
  return Array.isArray(v) ? v : [];
}

const isInStock = (v) => v?.stock == null || Number(v.stock) > 0;

/**
 * Adds one product/variant to the cart.
 * Logged in → POST /api/cart/items  (same payload App.jsx uses when syncing)
 * Guest     → "mm_cart" in localStorage  ({ productId, variant, qty })
 * Throws on failure so the sheet stays open and the user can retry.
 */
async function addItemToCart({ product, variant, qty }) {
  const productId = product.id || product.product_id;
  const variantId = variant?.id ?? null;
  const token = getAuthToken();

  if (token) {
    const res = await fetch(`${CART_API}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify({
        product_id: productId,
        variant_id: variantId,
        qty,
      }),
    });

    if (!res.ok) {
      let message = 'Could not add to cart';
      try {
        const json = await res.json();
        message = json?.message || json?.error || message;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }
    return;
  }

  let cart = [];
  try {
    cart = JSON.parse(localStorage.getItem('mm_cart') || '[]');
  } catch {
    cart = [];
  }
  if (!Array.isArray(cart)) cart = [];

  const idx = cart.findIndex(
    (i) =>
      String(i.productId) === String(productId) &&
      (i.variant?.id ?? null) === variantId
  );

  if (idx >= 0) {
    cart[idx] = { ...cart[idx], qty: (Number(cart[idx].qty) || 0) + qty };
  } else {
    cart.push({ productId, variant: variant || null, qty });
  }

  localStorage.setItem('mm_cart', JSON.stringify(cart));
}

/* Guest cart is stored by App.jsx under "mm_cart" */
function readGuestCartCount() {
  const keys = ['mm_cart', 'lm-cart', 'cart'];
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return sumQty(parsed);
    } catch {
      /* ignore */
    }
  }
  return 0;
}

/* ══════════════════════════════════════════════════════════
   HOOK: Live cart count
   Logged in  → GET /api/cart
   Guest/fail → local guest cart
══════════════════════════════════════════════════════════ */
function useCartCount() {
  const [count, setCount] = useState(() => readGuestCartCount());

  const refreshCart = useCallback(async () => {
    const token = getAuthToken();

    if (!token) {
      setCount(readGuestCartCount());
      return;
    }

    try {
      const res = await fetch(CART_API, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (res.ok) {
        const json = await res.json();
        const payload = json?.data?.data || json?.data || {};
        const total =
          payload.total_qty ??
          payload.item_count ??
          (Array.isArray(payload.items) ? sumQty(payload.items) : 0);

        setCount(Number(total) || 0);
        return;
      }

      /* 401/403 etc: don't wipe the badge, show what's stored locally */
      setCount(readGuestCartCount());
    } catch {
      /* Network error: keep the badge as it was */
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
   SMALL PRESENTATIONAL PIECES
══════════════════════════════════════════════════════════ */
const sectionStyle = {
  margin: 12,
  padding: 14,
  background: '#fff',
  borderRadius: 14,
  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
};

const railStyle = {
  display: 'flex',
  gap: 10,
  overflowX: 'auto',
  paddingBottom: 4,
  scrollbarWidth: 'none',
  WebkitOverflowScrolling: 'touch',
};

const seeAllBtnStyle = {
  background: 'none',
  border: 'none',
  color: '#ff6000',
  fontWeight: 800,
  fontSize: '0.8rem',
  cursor: 'pointer',
};

/* One compact product card used by Flash / Sponsored / Trending rails */
const RailCard = memo(function RailCard({ item, onOpen, showDiscount }) {
  const imgUrl = primaryImg(
    item.primaryImg || item.images || item.image_url,
    item
  );
  const price = item.price ?? item.selling_price ?? item.sale_price;
  const oldPrice =
    item.oldPrice ??
    item.old_price ??
    item.original_price ??
    item.regular_price;
  const discount = showDiscount ? calcDiscountPct(price, oldPrice) : 0;
  const title = item.title || item.name || 'Product';

  return (
    <div
      onClick={() => onOpen(item)}
      style={{
        flex: '0 0 148px',
        width: 148,
        cursor: 'pointer',
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #eef0f4',
        overflow: 'hidden',
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
      }}
    >
      <div
        style={{
          width: '100%',
          aspectRatio: '1/1',
          background: '#f8f9fc',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 6,
          boxSizing: 'border-box',
        }}
      >
        <img
          src={imgUrl}
          alt={title}
          loading="lazy"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
          }}
        />
        {discount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              background: '#ff6000',
              color: '#fff',
              fontSize: '0.62rem',
              fontWeight: 900,
              padding: '2px 5px',
              borderRadius: 4,
            }}
          >
            -{discount}%
          </span>
        )}
      </div>
      <div style={{ padding: '8px 10px' }}>
        <p
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            margin: '0 0 4px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: '#111',
          }}
        >
          {title}
        </p>
        <p
          style={{
            fontSize: '0.85rem',
            fontWeight: 900,
            color: '#ff6000',
            margin: 0,
          }}
        >
          {formatPrice(price)}
        </p>
        {discount > 0 && (
          <p
            style={{
              fontSize: '0.68rem',
              color: '#999',
              textDecoration: 'line-through',
              margin: '2px 0 0',
            }}
          >
            {formatPrice(oldPrice)}
          </p>
        )}
      </div>
    </div>
  );
});

/* Placeholder row shown while the first load is in flight */
function RailSkeleton() {
  return (
    <div className="mdp-psec" style={sectionStyle} aria-hidden="true">
      <div
        className="lm-skel"
        style={{ width: 130, height: 16, borderRadius: 6, marginBottom: 12 }}
      />
      <div style={railStyle}>
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="lm-skel"
            style={{
              flex: '0 0 148px',
              width: 148,
              height: 200,
              borderRadius: 12,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PAGE COMPONENT
══════════════════════════════════════════════════════════ */
export default function HomePageMobile() {
  const navigate = useNavigate();
  const { count: cartCount, refreshCart } = useCartCount();

  /* ── Core State ── */
  const [products, setProducts] = useState([]); // catalog (replaced by Load More)
  const [railPool, setRailPool] = useState([]); // feeds Flash/Sponsored/Trending/Campaign (never shrinks)
  const [campaigns, setCampaigns] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [timeLeft, setTimeLeft] = useState({
    hours: '00',
    minutes: '00',
    seconds: '00',
  });

  /* ── Pagination State ── */
  const [nextPage, setNextPage] = useState(1);
  const [pagesInBatch, setPagesInBatch] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false); // full-screen spinner
  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  /* ── Fixed Header Height (prevents hero overlap) ── */
  const headerRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(160);

  /* ── Variant Sheet State ── */
  const [selectedProductForVariant, setSelectedProductForVariant] =
    useState(null);
  const [isVariantSheetOpen, setIsVariantSheetOpen] = useState(false);
  const [sheetVariants, setSheetVariants] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [sheetQty, setSheetQty] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);

  /* ── Derived Flags ── */
  const canAutoLoad =
    hasMore &&
    pagesInBatch < BATCH_SIZE &&
    !loading &&
    !batchLoading &&
    !loadError &&
    !loadMoreError;

  const showLoadMoreBtn =
    hasMore &&
    pagesInBatch >= BATCH_SIZE &&
    !loading &&
    !batchLoading &&
    !loadError;

  /* ══════════════════════════════════════════════════════════
     EFFECTS
  ══════════════════════════════════════════════════════════ */

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 0. Measure fixed header height so content never sits underneath it
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

  // 1. Midnight WAT Countdown
  useEffect(() => {
    const tick = () => setTimeLeft(getMidnightWATTimeLeft());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // 2. Initial data load (also used by the Retry button)
  const loadInitial = useCallback(async () => {
    setLoading(true);
    setLoadError(false);

    try {
      const [productData, rawCampaigns] = await Promise.all([
        fetchProductsPage(1, PAGE_LIMIT), // let this throw so we can show Retry
        fetchCampaigns().catch(() => []),
      ]);

      if (!mountedRef.current) return;

      const mixed = mixProducts(
        Array.isArray(productData?.products) ? productData.products : []
      );

      setProducts(mixed);
      setRailPool(mixed);
      setNextPage(productData.nextPage);
      setPagesInBatch(1);
      setHasMore(Boolean(productData.hasMore));
      setCampaigns(Array.isArray(rawCampaigns) ? rawCampaigns : []);
      setCategories(extractCategories(mixed));
    } catch (err) {
      console.error('Failed to load mobile homepage data:', err);
      if (mountedRef.current) setLoadError(true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // 3. Auto-load next page (appends to the current batch)
  const autoLoadNext = useCallback(async () => {
    if (loadingRef.current || !hasMore || pagesInBatch >= BATCH_SIZE) return;

    loadingRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(false);

    try {
      const result = await fetchProductsPage(nextPage, PAGE_LIMIT);
      const newItems = Array.isArray(result.products) ? result.products : [];

      if (newItems.length > 0) {
        setProducts((prev) => mergeUnique(prev, newItems));
        setRailPool((prev) => mergeUnique(prev, newItems));
      }
      setNextPage(result.nextPage);
      setPagesInBatch((prev) => prev + 1);
      setHasMore(Boolean(result.hasMore));
    } catch (err) {
      console.error('Failed to auto-load more:', err);
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
      loadingRef.current = false;
    }
  }, [nextPage, hasMore, pagesInBatch]);

  // 4. Sentinel Intersection Observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !canAutoLoad) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) autoLoadNext();
      },
      { rootMargin: '400px', threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [autoLoadNext, canAutoLoad]);

  // 5. Post-load catch-up
  useEffect(() => {
    if (loadingMore || loading || batchLoading || !canAutoLoad) return;

    const timer = setTimeout(() => {
      const distFromBottom =
        document.documentElement.scrollHeight -
        window.scrollY -
        window.innerHeight;

      if (distFromBottom < 800) autoLoadNext();
    }, 150);

    return () => clearTimeout(timer);
  }, [
    products.length,
    loadingMore,
    loading,
    batchLoading,
    canAutoLoad,
    autoLoadNext,
  ]);

  // 6. Lock page scroll while the full-screen spinner is showing
  useEffect(() => {
    if (!batchLoading) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [batchLoading]);

  /* ══════════════════════════════════════════════════════════
     HANDLERS
  ══════════════════════════════════════════════════════════ */

  /**
   * Load More button:
   *  1. Show full-screen spinner
   *  2. Fetch the NEXT set of products
   *  3. Replace the current products with the new set
   *  4. Jump to top and hide the spinner
   */
  const handleLoadMoreBatch = async () => {
    if (loadingRef.current || !hasMore) return;

    loadingRef.current = true;
    setLoadingMore(true);
    setLoadMoreError(false);
    setBatchLoading(true);

    try {
      const idOf = (p) => String(p.id || p.product_id);
      const shownIds = new Set(products.map(idOf));

      const [result] = await Promise.all([
        fetchProductsPage(nextPage, PAGE_LIMIT),
        sleep(MIN_BATCH_SPINNER_MS), // keeps the spinner from flashing
      ]);

      // Only products the user is NOT already looking at
      let fresh = (Array.isArray(result.products) ? result.products : []).filter(
        (p) => !shownIds.has(idOf(p))
      );
      let pageAfter = result.nextPage;
      let more = Boolean(result.hasMore);

      // No new products left (end of catalogue, or the page repeated):
      // start over from page 1 and reshuffle so the screen still refreshes.
      if (fresh.length === 0) {
        const first = await fetchProductsPage(1, PAGE_LIMIT);
        const firstItems = Array.isArray(first.products) ? first.products : [];
        const different = firstItems.filter((p) => !shownIds.has(idOf(p)));

        fresh = different.length >= 4 ? different : firstItems;
        pageAfter = first.nextPage;
        more = true; // always allow another refresh
      }

      if (fresh.length > 0) {
        const freshItems = mixProducts(fresh);

        setProducts(freshItems);
        setRailPool((prev) => mergeUnique(prev, freshItems));
        setCategories(extractCategories(freshItems));
        setActiveCategory('All');
        setNextPage(pageAfter);
        setPagesInBatch(1);
        setHasMore(more);
        window.scrollTo({ top: 0, behavior: 'instant' });
      } else {
        // The store genuinely has no products to show
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load next batch:', err);
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
      setBatchLoading(false);
      loadingRef.current = false;
    }
  };

  const handleCategorySelect = (catName) => {
    setActiveCategory(catName === 'All' ? 'All' : catName);
  };

  const handleProductClick = useCallback(
    (item) => {
      const variants = parseVariants(item?.variants);

      if (variants.length > 1) {
        setSheetVariants(variants);
        setSelectedVariant(variants.find(isInStock) || variants[0]);
        setSheetQty(1);
        setSelectedProductForVariant(item);
        setIsVariantSheetOpen(true);
      } else {
        navigate(getProductPath(item));
      }
    },
    [navigate]
  );

  const handleVariantConfirm = async (confirmedQty) => {
    if (!selectedProductForVariant || addingToCart) return;

    const quantity = Math.max(1, Number(confirmedQty) || sheetQty || 1);
    setAddingToCart(true);

    try {
      await addItemToCart({
        product: selectedProductForVariant,
        variant: selectedVariant,
        qty: quantity,
      });
      window.dispatchEvent(new Event('cart-updated'));
      toast.success('Added to cart');
    } catch (err) {
      toast.error(err?.message || 'Could not add to cart');
      throw err; // keeps the sheet open so the user can retry
    } finally {
      setAddingToCart(false);
    }
  };

  const handleFloatingCartClick = () => {
    navigate(CART_ROUTE);
  };

  /* ══════════════════════════════════════════════════════════
     DERIVED DATA (memoised so the countdown tick doesn't
     re-partition the whole catalogue every second)
  ══════════════════════════════════════════════════════════ */

  // Top sections (Campaign / Flash / Sponsored / Trending): built from a pool
  // that only grows, so Load More can't wipe them out.
  const sections = useMemo(
    () => partitionAdminProductSections(railPool),
    [railPool]
  );

  // Catalog: built from the current batch, which Load More replaces.
  const catalogSections = useMemo(
    () => partitionAdminProductSections(products),
    [products]
  );

  const displayedCatalog = useMemo(
    () =>
      activeCategory === 'All'
        ? catalogSections.all
        : catalogSections.all.filter(
            (p) => (p.category || p.category_name) === activeCategory
          ),
    [catalogSections, activeCategory]
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
      {/* ── Fixed Top Bar ── */}
      <MobileTopBar
        ref={headerRef}
        categories={categories}
        activeCategory={activeCategory}
        onSelectCategory={handleCategorySelect}
        cartCount={cartCount}
      />

      <MobileHeroBanner />

      {/* ── Section skeleton while the first load is in flight ── */}
      {loading && <RailSkeleton />}

      {/* ── Campaign Spotlight ── */}
      {(campaigns.length > 0 || sections.campaign.length > 0) && (
        <MobileCampaignSpotlight
          campaign={campaigns[0] || null}
          products={sections.campaign}
          onOpenVariantSheet={handleProductClick}
        />
      )}

      {/* ── Flash Sale ── */}
      {sections.flash.length > 0 && (
        <div className="mdp-psec" style={sectionStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  color: '#ff6000',
                  fontWeight: 900,
                  fontSize: '1.05rem',
                  letterSpacing: '-0.3px',
                }}
              >
                ⚡ FLASH SALE
              </span>
              <div
                style={{
                  display: 'flex',
                  gap: 3,
                  background: '#111',
                  color: '#fff',
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <span>{timeLeft.hours}</span>:<span>{timeLeft.minutes}</span>:
                <span>{timeLeft.seconds}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/m/search?filter=flash')}
              style={seeAllBtnStyle}
            >
              See All &gt;
            </button>
          </div>

          <div style={railStyle}>
            {sections.flash.slice(0, 10).map((item) => (
              <RailCard
                key={item.id || item.product_id}
                item={item}
                onOpen={handleProductClick}
                showDiscount
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Sponsored ── */}
      {sections.sponsored?.length > 0 && (
        <div className="mdp-psec" style={sectionStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <span
              style={{ fontSize: '0.95rem', fontWeight: 800, color: '#111' }}
            >
              ⭐ Sponsored Deals
            </span>
            <button
              type="button"
              onClick={() => navigate('/m/search?filter=sponsored')}
              style={seeAllBtnStyle}
            >
              View All
            </button>
          </div>
          <div style={railStyle}>
            {sections.sponsored.map((item) => (
              <RailCard
                key={item.id || item.product_id}
                item={item}
                onOpen={handleProductClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Trending ── */}
      {sections.trending.length > 0 && (
        <div className="mdp-psec" style={sectionStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <span
              style={{ fontSize: '0.95rem', fontWeight: 800, color: '#111' }}
            >
              🔥 Trending Now
            </span>
            <button
              type="button"
              onClick={() => navigate('/m/search?filter=trending')}
              style={seeAllBtnStyle}
            >
              View All
            </button>
          </div>
          <div style={railStyle}>
            {sections.trending.map((item) => (
              <RailCard
                key={item.id || item.product_id}
                item={item}
                onOpen={handleProductClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          Main Catalog
      ═══════════════════════════════════════════════════ */}
      <div style={{ padding: '0 12px', marginTop: 16 }}>
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: 900,
            margin: '0 0 12px',
            color: '#111',
          }}
        >
          {activeCategory === 'All' ? 'Explore Catalog' : activeCategory}
        </h3>

        {loading ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
            }}
          >
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="lm-skel"
                style={{ height: 220, borderRadius: 12 }}
              />
            ))}
          </div>
        ) : loadError && products.length === 0 ? (
          <div
            role="alert"
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              background: '#fff',
              borderRadius: 14,
            }}
          >
            <p
              style={{
                fontSize: '0.95rem',
                fontWeight: 800,
                color: '#111',
                margin: '0 0 6px',
              }}
            >
              Couldn't load products
            </p>
            <p style={{ fontSize: '0.85rem', color: '#666', margin: 0 }}>
              Check your connection and try again.
            </p>
            <button
              type="button"
              onClick={loadInitial}
              style={{
                marginTop: 14,
                background: '#ff6000',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '10px 22px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        ) : displayedCatalog.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              background: '#fff',
              borderRadius: 14,
            }}
          >
            <p style={{ fontSize: '0.9rem', color: '#666', margin: 0 }}>
              No items found in this section.
            </p>
            {activeCategory !== 'All' && (
              <button
                type="button"
                onClick={() => setActiveCategory('All')}
                style={{
                  marginTop: 12,
                  background: '#ff6000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Show full catalog
              </button>
            )}
          </div>
        ) : (
          <>
            <div
              className="pr-masonry"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 10,
              }}
            >
              {displayedCatalog.map((product) => (
                <MasonryCard
                  key={product.id || product.product_id}
                  product={product}
                  onOpenVariantSheet={handleProductClick}
                />
              ))}
            </div>

            {/* Sentinel (auto-load within the current batch) */}
            {canAutoLoad && (
              <div
                ref={sentinelRef}
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '24px 0',
                  minHeight: 60,
                }}
              >
                {loadingMore && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      color: '#888',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                  >
                    <span className="lm-spinner" />
                    Loading more...
                  </div>
                )}
              </div>
            )}

            {/* Load-more failed: let the user retry */}
            {loadMoreError && hasMore && !batchLoading && (
              <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
                <p
                  style={{
                    fontSize: '0.85rem',
                    color: '#666',
                    margin: '0 0 10px',
                  }}
                >
                  Couldn't load more products.
                </p>
                <button
                  type="button"
                  onClick={
                    pagesInBatch >= BATCH_SIZE
                      ? handleLoadMoreBatch
                      : autoLoadNext
                  }
                  style={{
                    background: '#ff6000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '10px 22px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Try again
                </button>
              </div>
            )}

            {/* Load More button: swaps in the next set of products */}
            {showLoadMoreBtn && !loadMoreError && (
              <div style={{ textAlign: 'center', padding: '28px 0 12px' }}>
                <button
                  type="button"
                  onClick={handleLoadMoreBatch}
                  disabled={loadingMore}
                  style={{
                    background: loadingMore ? '#ccc' : '#ff6000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 14,
                    padding: '16px 48px',
                    fontWeight: 900,
                    fontSize: '0.95rem',
                    cursor: loadingMore ? 'wait' : 'pointer',
                    boxShadow: '0 4px 16px rgba(255,96,0,0.3)',
                    letterSpacing: '0.2px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {loadingMore ? 'Loading...' : 'Load More Products'}
                </button>
              </div>
            )}

            {/* End of catalog */}
            {reachedEnd && (
              <p
                style={{
                  textAlign: 'center',
                  color: '#bbb',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  padding: '24px 0 8px',
                }}
              >
                ✓ You've seen everything
              </p>
            )}
          </>
        )}
      </div>

      <Footer />
      <BottomNav />

      {/* ── Draggable Floating Cart ── */}
      <FloatingCartButton
        count={cartCount}
        onClick={handleFloatingCartClick}
      />

      {/* Variant Bottom Sheet */}
      <VariantBottomSheet
        isOpen={isVariantSheetOpen}
        onClose={() => {
          setIsVariantSheetOpen(false);
          refreshCart();
        }}
        product={selectedProductForVariant}
        variants={sheetVariants}
        selectedVariant={selectedVariant}
        onSelectVariant={setSelectedVariant}
        qty={sheetQty}
        setQty={setSheetQty}
        stockLeft={
          selectedVariant?.stock != null
            ? Number(selectedVariant.stock)
            : selectedProductForVariant?.stock != null
            ? Number(selectedProductForVariant.stock)
            : null
        }
        maxQty={10}
        onConfirm={handleVariantConfirm}
        isSubmitting={addingToCart}
      />

      {/* ── Full-screen spinner while the next set of products loads ── */}
      {batchLoading && (
        <div
          role="status"
          aria-label="Loading more products"
          aria-busy="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f7f4ef',
          }}
        >
          <div className="lm-spinner lm-spinner-lg" />
        </div>
      )}

      <style>{`
        .lm-spinner {
          width: 20px;
          height: 20px;
          border: 3px solid #e0e0e0;
          border-top-color: #ff6000;
          border-radius: 50%;
          animation: lm-spin 0.7s linear infinite;
          display: inline-block;
        }
        .lm-spinner-lg {
          width: 44px;
          height: 44px;
          border-width: 4px;
          border-color: #ebe8e3;
          border-top-color: #ff6000;
        }
        .lm-skel {
          background: linear-gradient(90deg, #e8e8ec 25%, #f2f2f5 50%, #e8e8ec 75%);
          background-size: 200% 100%;
          animation: lm-shimmer 1.2s ease-in-out infinite;
        }
        @keyframes lm-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes lm-shimmer {
          to { background-position: -200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lm-spinner { animation-duration: 1.6s; }
          .lm-skel { animation: none; }
        }
      `}</style>
    </div>
  );
}
