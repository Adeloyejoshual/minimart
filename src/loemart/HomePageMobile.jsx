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
  getCampaignTag
} from '../loemart/mobile/mobileHelpers';
import '../styles/Minimart.css';

export default function HomePageMobile() {
  const navigate = useNavigate();

  // Primary live state
  const [allProducts, setAllProducts] = useState([]);
  const [activeCampaigns, setActiveCampaigns] = useState([]);
  const [campaignProducts, setCampaignProducts] = useState([]);
  const [flashDeals, setFlashDeals] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [sponsoredProducts, setSponsoredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  // Midnight WAT Countdown Timer state
  const [timeLeft, setTimeLeft] = useState({ hours: '00', minutes: '00', seconds: '00' });

  // 1. Midnight WAT Timer Effect
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      // Convert to WAT (UTC+1)
      const watOffset = 1 * 60 * 60 * 1000;
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
      const watNow = new Date(utcTime + watOffset);

      const midnightWAT = new Date(watNow);
      midnightWAT.setHours(23, 59, 59, 999);

      const diff = midnightWAT.getTime() - watNow.getTime();

      if (diff <= 0) {
        setTimeLeft({ hours: '00', minutes: '00', seconds: '00' });
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({
        hours: String(h).padStart(2, '0'),
        minutes: String(m).padStart(2, '0'),
        seconds: String(s).padStart(2, '0')
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Fetch Live Products & Campaigns from API
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Fetch products and campaigns concurrently
        const [prodRes, campRes] = await Promise.all([
          fetch('/api/products').catch(() => null),
          fetch('/api/campaigns').catch(() => null)
        ]);

        let items = [];
        if (prodRes && prodRes.ok) {
          const data = await prodRes.json();
          items = Array.isArray(data) ? data : (data.products || data.data || []);
        }

        let campaignsData = [];
        if (campRes && campRes.ok) {
          const cData = await campRes.json();
          campaignsData = Array.isArray(cData) ? cData : (cData.campaigns || cData.data || []);
        }

        setActiveCampaigns(campaignsData);
        setAllProducts(items);

        // Filter Live Campaign Tagged Items
        const campItems = items.filter(item => {
          const tag = getCampaignTag(item);
          return tag !== null || item.campaign_id || item.is_campaign;
        });
        setCampaignProducts(campItems);

        // Filter Flash Deals (items with original price & discounted price)
        const flash = items.filter(item => {
          const price = item.price || item.sale_price;
          const origPrice = item.original_price || item.old_price || item.regular_price;
          return calcDiscountPct(origPrice, price) > 0;
        });
        setFlashDeals(flash.slice(0, 10));

        // Admin-flagged sections
        setTrendingProducts(items.filter(item => item.is_trending || item.trending));
        setFeaturedProducts(items.filter(item => item.is_featured || item.featured));
        setSponsoredProducts(items.filter(item => item.is_sponsored || item.sponsored));

        // Dynamic categories extraction
        const uniqueCats = Array.from(
          new Set(items.map(i => i.category || i.category_name).filter(Boolean))
        );
        setCategories(uniqueCats);

      } catch (err) {
        console.error('Failed to load home page data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Active Category Filter for Masonry Grid
  const displayedProducts = activeCategory === 'All'
    ? allProducts
    : allProducts.filter(p => (p.category || p.category_name) === activeCategory);

  const handleCategorySelect = (catName) => {
    haptic('light');
    setActiveCategory(catName);
  };

  const handleViewAllCategory = (catName) => {
    haptic('medium');
    navigate(`/search?category=${encodeURIComponent(catName)}`);
  };

  return (
    <div className="home-page-mobile-wrapper" style={{ minHeight: '100vh', backgroundColor: '#f5f5f7', paddingBottom: '70px' }}>
      
      {/* Sticky Top Bar with Search & Nav */}
      <MobileTopBar 
        categories={categories}
        activeCategory={activeCategory}
        onSelectCategory={handleCategorySelect}
      />

      {/* Hero Carousel */}
      <MobileHeroBanner />

      {/* 1. ADMIN CAMPAIGN SPOTLIGHT (Auto-hides if no active campaign items exist) */}
      {(campaignProducts.length > 0 || activeCampaigns.length > 0) && (
        <MobileCampaignSpotlight 
          campaign={activeCampaigns[0] || null} 
          products={campaignProducts} 
        />
      )}

      {/* 2. LIVE FLASH DEALS SECTION (With Midnight WAT Countdown) */}
      {flashDeals.length > 0 && (
        <div className="mdp-psec" style={{ margin: '12px', padding: '14px', background: '#fff', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#ff6000', fontWeight: '900', fontSize: '1.1rem' }}>⚡ FLASH SALE</span>
              <div style={{ display: 'flex', gap: '4px', background: '#111', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                <span>{timeLeft.hours}</span>:<span>{timeLeft.minutes}</span>:<span>{timeLeft.seconds}</span>
              </div>
            </div>
            <button 
              onClick={() => navigate('/search?filter=flash')} 
              style={{ background: 'none', border: 'none', color: '#ff6000', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              See All &gt;
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none' }}>
            {flashDeals.map(item => {
              const imgUrl = primaryImg(item.image_url || item.images);
              const price = item.price || item.sale_price;
              const origPrice = item.original_price || item.old_price;
              const discount = calcDiscountPct(origPrice, price);

              return (
                <div 
                  key={item.id} 
                  onClick={() => { haptic('light'); navigate(`/product/${item.id}`); }}
                  style={{ flex: '0 0 120px', cursor: 'pointer', background: '#fafafa', borderRadius: '8px', padding: '6px', border: '1px solid #eee' }}
                >
                  <div style={{ position: 'relative', width: '100%', height: '100px', borderRadius: '6px', overflow: 'hidden' }}>
                    <img src={imgUrl} alt={item.title || item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {discount > 0 && (
                      <span style={{ position: 'absolute', top: '4px', left: '4px', background: '#ff6000', color: '#fff', fontSize: '0.6rem', fontWeight: 'bold', padding: '2px 4px', borderRadius: '3px' }}>
                        -{discount}%
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: '6px' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: '600', margin: '0 0 2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.title || item.name}
                    </p>
                    <p style={{ fontSize: '0.8rem', fontWeight: '800', color: '#ff6000', margin: 0 }}>
                      {formatPrice(price)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. ADMIN SPONSORED PRODUCTS (Auto-hides if empty) */}
      {sponsoredProducts.length > 0 && (
        <div className="mdp-psec" style={{ margin: '12px', padding: '14px', background: '#fff', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: '800', color: '#111' }}>Sponsored Picks</span>
            <span style={{ fontSize: '0.65rem', background: '#eee', padding: '2px 6px', borderRadius: '4px', color: '#666' }}>Promoted</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
            {sponsoredProducts.map(item => (
              <div 
                key={item.id} 
                onClick={() => { haptic('light'); navigate(`/product/${item.id}`); }}
                style={{ flex: '0 0 130px', background: '#fff', borderRadius: '8px', border: '1px solid #eaeaea', padding: '8px', cursor: 'pointer' }}
              >
                <img src={primaryImg(item.image_url || item.images)} alt="" style={{ width: '100%', height: '90px', objectFit: 'cover', borderRadius: '6px' }} />
                <p style={{ fontSize: '0.75rem', fontWeight: '600', margin: '6px 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title || item.name}</p>
                <p style={{ fontSize: '0.8rem', fontWeight: '800', color: '#ff6000', margin: 0 }}>{formatPrice(item.price || item.sale_price)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. ADMIN TRENDING ITEMS (Auto-hides if empty) */}
      {trendingProducts.length > 0 && (
        <div className="mdp-psec" style={{ margin: '12px', padding: '14px', background: '#fff', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: '800', color: '#111' }}>🔥 Trending Now</span>
            <button onClick={() => navigate('/search?sort=trending')} style={{ background: 'none', border: 'none', color: '#ff6000', fontWeight: '700', fontSize: '0.8rem' }}>View All</button>
          </div>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px' }}>
            {trendingProducts.map(item => (
              <div 
                key={item.id} 
                onClick={() => { haptic('light'); navigate(`/product/${item.id}`); }}
                style={{ flex: '0 0 130px', background: '#fff', borderRadius: '8px', border: '1px solid #eaeaea', padding: '8px', cursor: 'pointer' }}
              >
                <img src={primaryImg(item.image_url || item.images)} alt="" style={{ width: '100%', height: '90px', objectFit: 'cover', borderRadius: '6px' }} />
                <p style={{ fontSize: '0.75rem', fontWeight: '600', margin: '6px 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title || item.name}</p>
                <p style={{ fontSize: '0.8rem', fontWeight: '800', color: '#ff6000', margin: 0 }}>{formatPrice(item.price || item.sale_price)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MAIN CATALOG / MASONRY GRID */}
      <div style={{ padding: '0 12px', marginTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0, color: '#111' }}>
            {activeCategory === 'All' ? 'Explore Catalog' : activeCategory}
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#888' }}>
            {displayedProducts.length} items
          </span>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[1, 2, 3, 4].map(n => (
              <div key={n} style={{ height: '220px', background: '#e0e0e0', borderRadius: '12px', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : displayedProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: '12px' }}>
            <p style={{ fontSize: '0.9rem', color: '#666', margin: 0 }}>No products found in this category.</p>
          </div>
        ) : (
          <div className="pr-masonry" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {displayedProducts.map(product => (
              <MasonryCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>

      {/* Persistent Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}