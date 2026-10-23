import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileTopBar from '../loemart/mobile/MobileTopBar';
import MobileHeroBanner from '../loemart/mobile/MobileHeroBanner';
import MobileCampaignSpotlight from '../loemart/mobile/MobileCampaignSpotlight';
import MasonryCard from '../loemart/mobile/MasonryCard';
import BottomNav from '../components/BottomNav';
import {
  formatPrice,
  calcDiscountPct,
  primaryImg,
  haptic,
  getMidnightWATTimeLeft,
  partitionAdminProductSections,
  fetchProducts,
  fetchCampaigns
} from '../loemart/mobile/mobileHelpers';
import '../styles/Minimart.css';

export default function HomePageMobile() {
  const navigate = useNavigate();

  // Primary state driven strictly by live API / DB data
  const [products, setProducts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  // Midnight WAT Countdown Timer state
  const [timeLeft, setTimeLeft] = useState({ hours: '00', minutes: '00', seconds: '00' });

  // 1. Live WAT Midnight Timer Interval
  useEffect(() => {
    const updateTimer = () => {
      const remaining = getMidnightWATTimeLeft();
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Fetch Live Products and Campaigns
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

        setProducts(rawProducts);
        setCampaigns(rawCampaigns);

        // Derive category list from live products
        const uniqueCats = Array.from(
          new Set(
            rawProducts
              .map(p => p.category || p.category_name)
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
    return () => { isMounted = false; };
  }, []);

  // Partition products using helper
  const sections = partitionAdminProductSections(products);

  // Filter main catalog by selected category ("All" shows full catalog)
  const displayedCatalog = activeCategory === 'All'
    ? sections.all
    : sections.all.filter(p => (p.category || p.category_name) === activeCategory);

  const handleCategorySelect = (catName) => {
    haptic(10);
    setActiveCategory(catName);
  };

  return (
    <div className="home-page-mobile-wrapper" style={{ minHeight: '100vh', backgroundColor: '#f5f5f7', paddingBottom: '75px' }}>
      
      {/* Sticky Header Bar with Search & Nav */}
      <MobileTopBar
        categories={categories}
        activeCategory={activeCategory}
        onSelectCategory={handleCategorySelect}
      />

      {/* Touch Carousel Hero Banner */}
      <MobileHeroBanner />

      {/* 1. ADMIN CAMPAIGN SPOTLIGHT (Auto-hides if empty) */}
      {(campaigns.length > 0 || sections.campaign.length > 0) && (
        <MobileCampaignSpotlight
          campaign={campaigns[0] || null}
          products={sections.campaign}
        />
      )}

      {/* 2. LIVE FLASH SALE SECTION (Auto-hides if empty) */}
      {sections.flash.length > 0 && (
        <div className="mdp-psec" style={{ margin: '12px', padding: '14px', background: '#ffffff', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#ff6000', fontWeight: '900', fontSize: '1.05rem', letterSpacing: '-0.3px' }}>⚡ FLASH SALE</span>
              <div style={{ display: 'flex', gap: '3px', background: '#111111', color: '#ffffff', padding: '2px 7px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '800' }}>
                <span>{timeLeft.hours}</span>:<span>{timeLeft.minutes}</span>:<span>{timeLeft.seconds}</span>
              </div>
            </div>
            <button
              onClick={() => { haptic(12); navigate('/search?filter=flash'); }}
              style={{ background: 'none', border: 'none', color: '#ff6000', fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              See All &gt;
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
            {sections.flash.slice(0, 10).map((item) => {
              const id = item.id || item.product_id;
              const imgUrl = primaryImg(item.images || item.image_url, item);
              const price = item.price ?? item.selling_price ?? item.sale_price;
              const oldPrice = item.old_price ?? item.original_price ?? item.regular_price;
              const discount = calcDiscountPct(price, oldPrice);
              const title = item.title || item.name || 'Flash Deal';

              return (
                <div
                  key={id}
                  onClick={() => { haptic(10); navigate(`/product/${id}`); }}
                  style={{ flex: '0 0 120px', cursor: 'pointer', background: '#fafafa', borderRadius: '10px', padding: '6px', border: '1px solid #eeeeee' }}
                >
                  <div style={{ position: 'relative', width: '100%', height: '100px', borderRadius: '8px', overflow: 'hidden' }}>
                    <img src={imgUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {discount > 0 && (
                      <span style={{ position: 'absolute', top: '4px', left: '4px', background: '#ff6000', color: '#ffffff', fontSize: '0.6rem', fontWeight: '900', padding: '2px 4px', borderRadius: '4px' }}>
                        -{discount}%
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: '6px' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: '700', margin: '0 0 2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#111' }}>
                      {title}
                    </p>
                    <p style={{ fontSize: '0.82rem', fontWeight: '900', color: '#ff6000', margin: 0 }}>
                      {formatPrice(price)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. ADMIN SPONSORED PICKS (Auto-hides if empty) */}
      {sections.sponsored.length > 0 && (
        <div className="mdp-psec" style={{ margin: '12px', padding: '14px', background: '#ffffff', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: '800', color: '#111111' }}>Sponsored Picks</span>
            <span style={{ fontSize: '0.62rem', background: '#f0f0f0', padding: '2px 6px', borderRadius: '4px', color: '#666666', fontWeight: '700' }}>Promoted</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
            {sections.sponsored.map((item) => {
              const id = item.id || item.product_id;
              const imgUrl = primaryImg(item.images || item.image_url, item);
              const price = item.price ?? item.selling_price ?? item.sale_price;

              return (
                <div
                  key={id}
                  onClick={() => { haptic(10); navigate(`/product/${id}`); }}
                  style={{ flex: '0 0 130px', background: '#ffffff', borderRadius: '10px', border: '1px solid #eaeaea', padding: '8px', cursor: 'pointer' }}
                >
                  <img src={imgUrl} alt="" style={{ width: '100%', height: '90px', objectFit: 'cover', borderRadius: '8px' }} />
                  <p style={{ fontSize: '0.75rem', fontWeight: '700', margin: '6px 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#111' }}>
                    {item.title || item.name}
                  </p>
                  <p style={{ fontSize: '0.82rem', fontWeight: '900', color: '#ff6000', margin: 0 }}>
                    {formatPrice(price)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. ADMIN TRENDING PRODUCTS (Auto-hides if empty) */}
      {sections.trending.length > 0 && (
        <div className="mdp-psec" style={{ margin: '12px', padding: '14px', background: '#ffffff', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: '800', color: '#111111' }}>🔥 Trending Now</span>
            <button
              onClick={() => { haptic(10); navigate('/search?sort=trending'); }}
              style={{ background: 'none', border: 'none', color: '#ff6000', fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              View All
            </button>
          </div>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
            {sections.trending.map((item) => {
              const id = item.id || item.product_id;
              const imgUrl = primaryImg(item.images || item.image_url, item);
              const price = item.price ?? item.selling_price ?? item.sale_price;

              return (
                <div
                  key={id}
                  onClick={() => { haptic(10); navigate(`/product/${id}`); }}
                  style={{ flex: '0 0 130px', background: '#ffffff', borderRadius: '10px', border: '1px solid #eaeaea', padding: '8px', cursor: 'pointer' }}
                >
                  <img src={imgUrl} alt="" style={{ width: '100%', height: '90px', objectFit: 'cover', borderRadius: '8px' }} />
                  <p style={{ fontSize: '0.75rem', fontWeight: '700', margin: '6px 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#111' }}>
                    {item.title || item.name}
                  </p>
                  <p style={{ fontSize: '0.82rem', fontWeight: '900', color: '#ff6000', margin: 0 }}>
                    {formatPrice(price)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MAIN MASONRY CATALOG GRID */}
      <div style={{ padding: '0 12px', marginTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '900', margin: 0, color: '#111111' }}>
            {activeCategory === 'All' ? 'Explore Catalog' : activeCategory}
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#888888', fontWeight: '600' }}>
            {displayedCatalog.length} items
          </span>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {[1, 2, 3, 4].map(n => (
              <div key={n} style={{ height: '220px', background: '#e0e0e0', borderRadius: '12px', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : displayedCatalog.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: '#ffffff', borderRadius: '14px' }}>
            <p style={{ fontSize: '0.9rem', color: '#666666', margin: 0 }}>No items found in this section.</p>
          </div>
        ) : (
          <div className="pr-masonry" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {displayedCatalog.map(product => (
              <MasonryCard key={product.id || product.product_id} product={product} />
            ))}
          </div>
        )}
      </div>

      {/* Persistent Portal Bottom Navigation */}
      <BottomNav />
    </div>
  );
}