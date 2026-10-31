import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileTopBar from '../loemart/mobile/MobileTopBar';
import MobileHeroBanner from '../loemart/mobile/MobileHeroBanner';
import MobileCampaignSpotlight from '../loemart/mobile/MobileCampaignSpotlight';
import MasonryCard from '../loemart/mobile/MasonryCard';
import VariantBottomSheet from '../loemart/mobile/VariantBottomSheet';
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
const CART_STORAGE_KEY = 'lm-cart';

/* ══════════════════════════════════════════════════════════
   HOOK: live cart count from localStorage
   • Updates on cross-tab `storage` events
   • Updates on same-tab `cart-updated` custom events
     (dispatch `new Event('cart-updated')` after mutating cart)
══════════════════════════════════════════════════════════ */
function useCartCount(storageKey = CART_STORAGE_KEY) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return setCount(0);

        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed)) return setCount(parsed.length);
        if (Array.isArray(parsed?.items)) return setCount(parsed.items.length);
        if (typeof parsed?.count === 'number') return setCount(parsed.count);
        if (typeof parsed === 'number') return setCount(parsed);

        setCount(0);
      } catch {
        setCount(0);
      }
    };

    read();
    window.addEventListener('storage', read);
    window.addEventListener('cart-updated', read);

    return () => {
      window.removeEventListener('storage', read);
      window.removeEventListener('cart-updated', read);
    };
  }, [storageKey]);

  return count;
}

export default function HomePageMobile() {
  const navigate = useNavigate();
  const cartCount = useCartCount();

  /* ── Core State ── */
  const [products, setProducts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
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
  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);

  /* ── Variant Sheet State ── */
  const [selectedProductForVariant, setSelectedProductForVariant] =
    useState(null);
  const [isVariantSheetOpen, setIsVariantSheetOpen] = useState(false);

  /* ── Derived flags ── */
  const canAutoLoad = hasMore && pagesInBatch < BATCH_SIZE && !loading;
  const showLoadMoreBtn = hasMore && pagesInBatch >= BATCH_SIZE && !loading;

  /* ══════════════════════════════════════════════════════════
     EFFECTS
  ══════════════════════════════════════════════════════════ */

  // 1. Midnight WAT countdown
  useEffect(() => {
    const tick = () => setTimeLeft(getMidnightWATTimeLeft());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // 2. Initial data load
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      try {
        const [productData, rawCampaigns] = await Promise.all([
          fetchProductsPage(1, PAGE_LIMIT).catch(() => ({
            products: [],
            hasMore: false,
            nextPage: 2,
          })),
          fetchCampaigns().catch(() => []),
        ]);

        if (!isMounted) return;

        const mixed = mixProducts(
          Array.isArray(productData.products) ? productData.products : []
        );

        setProducts(mixed);
        setNextPage(productData.nextPage);
        setPagesInBatch(1);
        setHasMore(productData.hasMore);
        setCampaigns(Array.isArray(rawCampaigns) ? rawCampaigns : []);

        const uniqueCats = Array.from(
          new Set(
            mixed
              .map((p) => p.category || p.category_name)
              .filter(Boolean)
          )
        );
        setCategories(uniqueCats);
      } catch (err) {
        console.error('Failed to load mobile homepage data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // 3. Auto-load next page
  const autoLoadNext = useCallback(async () => {
    if (loadingRef.current || !hasMore || pagesInBatch >= BATCH_SIZE) return;
    loadingRef.current = true;
    setLoadingMore(true);

    try {
      const result = await fetchProductsPage(nextPage, PAGE_LIMIT);
      const newItems = Array.isArray(result.products) ? result.products : [];

      if (newItems.length > 0) {
        setProducts((prev) => [...prev, ...newItems]);
      }
      setNextPage(result.nextPage);
      setPagesInBatch((prev) => prev + 1);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error('Failed to auto-load more:', err);
    } finally {
      setLoadingMore(false);
      loadingRef.current = false;
    }
  }, [nextPage, hasMore, pagesInBatch]);

  // 4. IntersectionObserver on sentinel
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

  // 5. Post-load catch-up (fast scroll past sentinel)
  useEffect(() => {
    if (loadingMore || loading || !canAutoLoad) return;

    const timer = setTimeout(() => {
      const distFromBottom =
        document.documentElement.scrollHeight -
        window.scrollY -
        window.innerHeight;

      if (distFromBottom < 800) {
        autoLoadNext();
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [products.length, loadingMore, loading, canAutoLoad, autoLoadNext]);

  /* ══════════════════════════════════════════════════════════
     HANDLERS
  ══════════════════════════════════════════════════════════ */

  const handleLoadMoreBatch = async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoadingMore(true);

    try {
      const result = await fetchProductsPage(nextPage, PAGE_LIMIT);
      const freshItems = Array.isArray(result.products)
        ? mixProducts(result.products)
        : [];

      setProducts(freshItems);
      setNextPage(result.nextPage);
      setPagesInBatch(1);
      setHasMore(result.hasMore);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Failed to load next batch:', err);
    } finally {
      setLoadingMore(false);
      loadingRef.current = false;
    }
  };

  const handleCategorySelect = (catName) => {
    setActiveCategory(catName === 'All' ? 'All' : catName);
  };

  const handleProductClick = (item) => {
    let variants = item?.variants || [];
    if (typeof variants === 'string') {
      try {
        variants = JSON.parse(variants);
      } catch {
        variants = [];
      }
    }

    if (Array.isArray(variants) && variants.length > 1) {
      setSelectedProductForVariant(item);
      setIsVariantSheetOpen(true);
    } else {
      navigate(getProductPath(item));
    }
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
        paddingBottom: '80px',
      }}
    >
      <MobileTopBar
        categories={categories}
        activeCategory={activeCategory}
        onSelectCategory={handleCategorySelect}
        cartCount={cartCount}
      />

      <MobileHeroBanner />

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
        <div
          className="mdp-psec"
          style={{
            margin: 12,
            padding: 14,
            background: '#fff',
            borderRadius: 14,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
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
              style={{
                background: 'none',
                border: 'none',
                color: '#ff6000',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              See All &gt;
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              overflowX: 'auto',
              paddingBottom: 4,
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {sections.flash.slice(0, 10).map((item) => {
              const id = item.id || item.product_id;
              const imgUrl = primaryImg(
                item.primaryImg || item.images || item.image_url,
                item
              );
              const price =
                item.price ?? item.selling_price ?? item.sale_price;
              const oldPrice =
                item.oldPrice ??
                item.old_price ??
                item.original_price ??
                item.regular_price;
              const discount = calcDiscountPct(price, oldPrice);
              const title = item.title || item.name || 'Flash Deal';

              return (
                <div
                  key={id}
                  onClick={() => handleProductClick(item)}
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
            })}
          </div>
        </div>
      )}

      {/* ── Sponsored ── */}
      {sections.sponsored?.length > 0 && (
        <div
          className="mdp-psec"
          style={{
            margin: 12,
            padding: 14,
            background: '#fff',
            borderRadius: 14,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
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
              style={{
                background: 'none',
                border: 'none',
                color: '#ff6000',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              View All
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 10,
              overflowX: 'auto',
              paddingBottom: 4,
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {sections.sponsored.map((item) => {
              const id = item.id || item.product_id;
              const imgUrl = primaryImg(
                item.primaryImg || item.images || item.image_url,
                item
              );
              const price =
                item.price ?? item.selling_price ?? item.sale_price;

              return (
                <div
                  key={id}
                  onClick={() => handleProductClick(item)}
                  style={{
                    flex: '0 0 148px',
                    width: 148,
                    background: '#fff',
                    borderRadius: 12,
                    border: '1px solid #eef0f4',
                    overflow: 'hidden',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '1/1',
                      background: '#f8f9fc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 6,
                      boxSizing: 'border-box',
                    }}
                  >
                    <img
                      src={imgUrl}
                      alt=""
                      loading="lazy"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <p
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        margin: '0 0 4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: '#111',
                      }}
                    >
                      {item.title || item.name}
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
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Trending ── */}
      {sections.trending.length > 0 && (
        <div
          className="mdp-psec"
          style={{
            margin: 12,
            padding: 14,
            background: '#fff',
            borderRadius: 14,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
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
              style={{
                background: 'none',
                border: 'none',
                color: '#ff6000',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              View All
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 10,
              overflowX: 'auto',
              paddingBottom: 4,
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {sections.trending.map((item) => {
              const id = item.id || item.product_id;
              const imgUrl = primaryImg(
                item.primaryImg || item.images || item.image_url,
                item
              );
              const price =
                item.price ?? item.selling_price ?? item.sale_price;

              return (
                <div
                  key={id}
                  onClick={() => handleProductClick(item)}
                  style={{
                    flex: '0 0 148px',
                    width: 148,
                    background: '#fff',
                    borderRadius: 12,
                    border: '1px solid #eef0f4',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '1/1',
                      background: '#f8f9fc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 6,
                      boxSizing: 'border-box',
                    }}
                  >
                    <img
                      src={imgUrl}
                      alt=""
                      loading="lazy"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <p
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        margin: '0 0 4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: '#111',
                      }}
                    >
                      {item.title || item.name}
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
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          Main Catalog — 30 → 60 → 90 → [Load More] → repeat
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
                style={{
                  height: 220,
                  background: '#e8e8ec',
                  borderRadius: 12,
                }}
              />
            ))}
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

            {/* Sentinel — triggers auto-load while scrolling */}
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

            {/* Load More button — after 90 products */}
            {showLoadMoreBtn && (
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

      <VariantBottomSheet
        isOpen={isVariantSheetOpen}
        onClose={() => setIsVariantSheetOpen(false)}
        product={selectedProductForVariant}
      />

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
        @keyframes lm-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}