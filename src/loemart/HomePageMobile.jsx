import React, { useState, useEffect } from 'react';
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
  fetchProducts,
  fetchCampaigns
} from '../loemart/mobile/mobileHelpers';
import '../styles/Minimart.css';

export default function HomePageMobile() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState({ hours: '00', minutes: '00', seconds: '00' });

  // Variant Bottom Sheet State
  const [selectedProductForVariant, setSelectedProductForVariant] = useState(null);
  const [isVariantSheetOpen, setIsVariantSheetOpen] = useState(false);

  // 1. Midnight WAT Countdown Timer
  useEffect(() => {
    const updateTimer = () => {
      const remaining = getMidnightWATTimeLeft();
      setTimeLeft(remaining);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Fetch Live Products & Campaigns
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      try {
        const [rawProducts, rawCampaigns] = await Promise.all([
          fetchProducts().catch(() => []),
          fetchCampaigns().catch(() => [])
        ]);

        if (!isMounted) return;

        // Shuffle / mix so new additions do not stack strictly in linear order
        const mixedProducts = mixProducts(Array.isArray(rawProducts) ? rawProducts : []);
        setProducts(mixedProducts);
        setCampaigns(Array.isArray(rawCampaigns) ? rawCampaigns : []);

        const uniqueCats = Array.from(
          new Set(
            mixedProducts
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

  const sections = partitionAdminProductSections(products);

  const displayedCatalog =
    activeCategory === 'All'
      ? sections.all
      : sections.all.filter(
          (p) => (p.category || p.category_name) === activeCategory
        );

  const handleCategorySelect = (catName) => {
    setActiveCategory(catName === 'All' ? 'All' : catName);
  };

  /**
   * Helper to handle product clicks on horizontal scrollers or cards
   * Opens Variant Sheet if product has > 1 variants, else navigates to detail
   */
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

  return (
    <div
      className="home-page-mobile-wrapper"
      style={{
        minHeight: '100vh',
        backgroundColor: '#f5f5f7',
        paddingBottom: '80px'
      }}
    >
      {/* Sticky Top Header */}
      <MobileTopBar
        categories={categories}
        activeCategory={activeCategory}
        onSelectCategory={handleCategorySelect}
      />

      {/* Hero Touch Carousel Banner */}
      <MobileHeroBanner />

      {/* Admin Campaign Spotlight */}
      {(campaigns.length > 0 || sections.campaign.length > 0) && (
        <MobileCampaignSpotlight
          campaign={campaigns[0] || null}
          products={sections.campaign}
          onOpenVariantSheet={(p) => handleProductClick(p)}
        />
      )}

      {/* Flash Sale Section */}
      {sections.flash.length > 0 && (
        <div
          className="mdp-psec"
          style={{
            margin: '12px',
            padding: '14px',
            background: '#ffffff',
            borderRadius: '14px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  color: '#ff6000',
                  fontWeight: 900,
                  fontSize: '1.05rem',
                  letterSpacing: '-0.3px'
                }}
              >
                ⚡ FLASH SALE
              </span>
              <div
                style={{
                  display: 'flex',
                  gap: '3px',
                  background: '#111111',
                  color: '#ffffff',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums'
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
                cursor: 'pointer'
              }}
            >
              See All &gt;
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '10px',
              overflowX: 'auto',
              paddingBottom: '4px',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {sections.flash.slice(0, 10).map((item) => {
              const id = item.id || item.product_id;
              const imgUrl = primaryImg(
                item.primaryImg || item.images || item.image_url,
                item
              );
              const price = item.price ?? item.selling_price ?? item.sale_price;
              const oldPrice =
                item.oldPrice ?? item.old_price ?? item.original_price ?? item.regular_price;
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
                    background: '#ffffff',
                    borderRadius: 12,
                    border: '1px solid #eef0f4',
                    overflow: 'hidden',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
                      background: '#f8f9fc',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 6,
                      boxSizing: 'border-box'
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
                        objectFit: 'contain'
                      }}
                    />
                    {discount > 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 6,
                          left: 6,
                          background: '#ff6000',
                          color: '#ffffff',
                          fontSize: '0.62rem',
                          fontWeight: 900,
                          padding: '2px 5px',
                          borderRadius: 4
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
                        margin: '0 0 4px 0',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        color: '#111111'
                      }}
                    >
                      {title}
                    </p>
                    <p
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 900,
                        color: '#ff6000',
                        margin: 0
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
                          margin: '2px 0 0'
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

      {/* Sponsored Section */}
      {sections.sponsored?.length > 0 && (
        <div
          className="mdp-psec"
          style={{
            margin: '12px',
            padding: '14px',
            background: '#ffffff',
            borderRadius: '14px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10
            }}
          >
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#111' }}>
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
                cursor: 'pointer'
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
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {sections.sponsored.map((item) => {
              const id = item.id || item.product_id;
              const imgUrl = primaryImg(
                item.primaryImg || item.images || item.image_url,
                item
              );
              const price = item.price ?? item.selling_price ?? item.sale_price;

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
                    cursor: 'pointer'
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
                      background: '#f8f9fc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 6,
                      boxSizing: 'border-box'
                    }}
                  >
                    <img
                      src={imgUrl}
                      alt=""
                      loading="lazy"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain'
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
                        color: '#111'
                      }}
                    >
                      {item.title || item.name}
                    </p>
                    <p
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 900,
                        color: '#ff6000',
                        margin: 0
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

      {/* Trending Section */}
      {sections.trending.length > 0 && (
        <div
          className="mdp-psec"
          style={{
            margin: '12px',
            padding: '14px',
            background: '#ffffff',
            borderRadius: '14px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10
            }}
          >
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#111' }}>
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
                cursor: 'pointer'
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
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {sections.trending.map((item) => {
              const id = item.id || item.product_id;
              const imgUrl = primaryImg(
                item.primaryImg || item.images || item.image_url,
                item
              );
              const price = item.price ?? item.selling_price ?? item.sale_price;

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
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
                      background: '#f8f9fc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 6,
                      boxSizing: 'border-box'
                    }}
                  >
                    <img
                      src={imgUrl}
                      alt=""
                      loading="lazy"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain'
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
                        color: '#111'
                      }}
                    >
                      {item.title || item.name}
                    </p>
                    <p
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 900,
                        color: '#ff6000',
                        margin: 0
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

      {/* Main Catalog Masonry Grid */}
      <div style={{ padding: '0 12px', marginTop: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12
          }}
        >
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 900,
              margin: 0,
              color: '#111'
            }}
          >
            {activeCategory === 'All' ? 'Explore Catalog' : activeCategory}
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#888', fontWeight: 600 }}>
            {displayedCatalog.length} items
          </span>
        </div>

        {loading ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10
            }}
          >
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                style={{
                  height: 220,
                  background: '#e8e8ec',
                  borderRadius: 12
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
              borderRadius: 14
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
                  cursor: 'pointer'
                }}
              >
                Show full catalog
              </button>
            )}
          </div>
        ) : (
          <div
            className="pr-masonry"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10
            }}
          >
            {displayedCatalog.map((product) => (
              <MasonryCard
                key={product.id || product.product_id}
                product={product}
                onOpenVariantSheet={(p) => handleProductClick(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <Footer />

      {/* Fixed Bottom Navigation Bar */}
      <BottomNav />

      {/* VARIANT BOTTOM SHEET */}
      <VariantBottomSheet
        isOpen={isVariantSheetOpen}
        onClose={() => setIsVariantSheetOpen(false)}
        product={selectedProductForVariant}
      />
    </div>
  );
}