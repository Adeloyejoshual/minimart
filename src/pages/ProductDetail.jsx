// src/components/ProductDetail.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  FunnelIcon, 
  StarIcon,
  UserIcon,
  ChatBubbleLeftIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
  ArrowLongRightIcon
} from '@heroicons/react/24/outline';

import ProductHeader from "../components/ProductHeader";
import '../styles/ProductDetail.css';

const ProductDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const similarEndRef = useRef(null);
  
  // Enhanced state
  const [product, setProduct] = useState(null);
  const [sellerStats, setSellerStats] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [similarPage, setSimilarPage] = useState(1);
  const [hasMoreSimilar, setHasMoreSimilar] = useState(true);

  // Clean phone number
  const cleanPhoneNumber = useCallback((phone) => {
    return phone ? phone.replace(/[^+d]/g, '') : '';
  }, []);

  // Dynamic attributes configuration
  const attributeConfig = useMemo(() => ({
    category: { icon: '📱', label: 'Category' },
    brand: { icon: '🏷️', label: 'Brand' },
    condition: { icon: '⭐', label: 'Condition' },
    ram: { icon: '💾', label: 'RAM' },
    storage: { icon: '🗄️', label: 'Storage' },
    sim: { icon: '📡', label: 'SIM' },
    features: { icon: '⚙️', label: 'Features' },
    color: { icon: '🎨', label: 'Color' },
    warranty: { icon: '🛡️', label: 'Warranty' },
    model: { icon: '📝', label: 'Model' }
  }), []);

  // Fetch main product
  useEffect(() => {
    if (!slug || slug === 'undefined') {
      setError('Invalid product slug');
      setLoading(false);
      return;
    }

    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/product/slug/${slug}`);
        
        if (!response.ok) {
          if (response.status === 404) throw new Error('Product not found');
          throw new Error('Failed to fetch product');
        }
        
        const data = await response.json();
        setProduct(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [slug]);

  // Fetch similar products with pagination
  const fetchSimilarProducts = useCallback(async (page = 1, append = false) => {
    if (!product) return;
    
    setSimilarLoading(true);
    try {
      let url = `/api/homepage?limit=12&page=${page}`;
      if (product.attributes?.brand) {
        url = `/api/homepage?brand=${encodeURIComponent(product.attributes.brand)}&limit=12&page=${page}&exclude=${product.id}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const newProducts = (data.latest || data.recommended || [])
          .filter(p => p.id !== product.id && p.slug !== slug);
        
        if (append) {
          setSimilarProducts(prev => [...prev, ...newProducts]);
        } else {
          setSimilarProducts(newProducts);
        }
        
        setHasMoreSimilar(newProducts.length === 12);
        setSimilarPage(page);
      }
    } catch (err) {
      console.error('Related products fetch failed:', err);
    } finally {
      setSimilarLoading(false);
    }
  }, [product, slug]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreSimilar && !similarLoading) {
          fetchSimilarProducts(similarPage + 1, true);
        }
      },
      { threshold: 0.1 }
    );

    if (similarEndRef.current) {
      observer.observe(similarEndRef.current);
    }

    return () => observer.disconnect();
  }, [similarPage, hasMoreSimilar, similarLoading, fetchSimilarProducts]);

  const fetchSellerStats = useCallback(async () => {
    if (!product?.contact?.email) return;
    try {
      const response = await fetch(`/api/product/slug/${slug}/seller-stats`);
      if (response.ok) {
        const data = await response.json();
        setSellerStats(data);
      }
    } catch (err) {
      console.error('Seller stats fetch failed:', err);
    }
  }, [product?.contact?.email, slug]);

  const fetchReviews = useCallback(async () => {
    try {
      setReviewsLoading(true);
      const response = await fetch(`/api/product/slug/${slug}/reviews?limit=5`);
      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
        setReviewStats(data.stats);
      }
    } catch (err) {
      console.error('Reviews fetch failed:', err);
    } finally {
      setReviewsLoading(false);
    }
  }, [slug]);

  const trackView = useCallback(async () => {
    if (product?.id) {
      try {
        await fetch(`/api/homepage/products/${product.id}/view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        console.error('View tracking failed:', err);
      }
    }
  }, [product?.id]);

  useEffect(() => {
    if (product && !error) {
      trackView();
      fetchSellerStats();
      fetchReviews();
      fetchSimilarProducts(1, false);
    }
  }, [product, error, trackView, fetchSellerStats, fetchReviews, fetchSimilarProducts]);

  const contactInfo = useMemo(() => ({
    phone: cleanPhoneNumber(product?.contact?.phone),
    whatsapp: cleanPhoneNumber(product?.contact?.whatsapp)
  }), [product?.contact?.phone, product?.contact?.whatsapp, cleanPhoneNumber]);

  const handleFavorite = useCallback(() => {
    setIsFavorited(!isFavorited);
  }, [isFavorited]);

  // Premium Attributes Display
  const renderAttributes = useMemo(() => {
    if (!product?.attributes) return null;

    const validAttributes = Object.entries(product.attributes)
      .filter(([key, value]) => value && attributeConfig[key]);

    if (validAttributes.length === 0) return null;

    return (
      <div className="premium-attributes luxury-card">
        <div className="section-header">
          <h3 className="mini-title flex items-center gap-3">
            <FunnelIcon className="w-6 h-6" />
            Product Specifications
          </h3>
        </div>
        <div className="attributes-grid">
          {validAttributes.map(([key, value]) => {
            const config = attributeConfig[key];
            return (
              <div key={key} className="attribute-item glassmorphism p-4 rounded-2xl border border-white/20">
                <div className="attribute-icon text-2xl mb-2">{config.icon}</div>
                <div className="attribute-label text-xs opacity-75 uppercase tracking-wider font-medium">{config.label}</div>
                <div className="attribute-value font-black text-lg bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
                  {Array.isArray(value) ? value.join(', ') : String(value)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [product?.attributes, attributeConfig]);

  if (loading) {
    return <div className="loading-skeleton-premium">Loading premium product...</div>;
  }

  if (error && !loading) {
    return (
      <div className="error-state-premium min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-8">
        <div className="max-w-md mx-auto text-center">
          <div className="w-28 h-28 bg-gradient-to-br from-red-400 to-pink-500 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-2xl">
            <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-3xl font-black bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-4">
            {error}
          </h2>
          <Link to="/" className="premium-btn inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg shadow-2xl">
            Browse Marketplace
            <ArrowLongRightIcon className="w-6 h-6" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="product-detail-premium min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Premium Sticky Header */}
      <ProductHeader
        product={product}
        similarProductsCount={similarProducts.length}
        reviewStats={reviewStats}
        onFavorite={handleFavorite}
        isFavorited={isFavorited}
      />

      <div className="homepage-container product-detail-container pt-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Product Section - Full Width Image First */}
        <div className="hero-product-section mb-20">
          {/* Luxury Gallery - Now Full Width at Top */}
          <div className="gallery-premium space-y-8 mb-20">
            <div className="main-image-container luxury-card group overflow-hidden rounded-3xl shadow-2xl">
              <img
                src={product.images?.[0] || '/api/placeholder/600/400'}
                alt={product.title}
                className="w-full h-[500px] lg:h-[600px] object-cover transition-all duration-700 group-hover:scale-105"
                onError={(e) => { e.target.src = '/api/placeholder/600/400'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500" />
            </div>
            
            {product.images?.length > 1 && (
              <div className="thumbnail-premium flex gap-4 overflow-x-auto pb-4 -m-4 px-4 scrollbar-hide">
                {product.images.slice(1, 9).map((img, idx) => (
                  <div key={idx} className="thumbnail-item flex-shrink-0 w-28 h-28 luxury-card rounded-2xl overflow-hidden shadow-xl hover:scale-110 transition-all duration-300 cursor-pointer">
                    <img
                      src={img}
                      alt={`${product.title} ${idx + 2}`}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.src = '/api/placeholder/120/96'; }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product Info - Now Full Width Below Images */}
          <div className="product-info-premium space-y-12">
            {/* Meta & Status */}
            <div className="product-meta-premium">
              <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-gray-600 mb-6">
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  {product.clicks_count?.toLocaleString() || 0} views
                </span>
                <span>•</span>
                <span>ID: {product.id.slice(0, 8)}...</span>
              </div>
              <div className={`status-badge-premium inline-flex px-6 py-3 rounded-2xl text-sm font-black shadow-lg ${
                product.status === 'active' 
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-white' 
                  : 'bg-gradient-to-r from-amber-400 to-orange-500 text-white'
              }`}>
                {product.status?.toUpperCase() || 'LIVE'}
              </div>
            </div>

            {/* Price & Quick Specs */}
            <div className="price-hero">
              <div className="price-display text-5xl lg:text-7xl font-black bg-gradient-to-r from-gray-900 via-indigo-900 to-purple-900 bg-clip-text text-transparent mb-8 leading-tight">
                ₦{Number(product.price || 0).toLocaleString()}
              </div>
              <div className="quick-location flex items-center gap-3 p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/50 shadow-xl">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" />
                  </svg>
                </div>
                <div>
                  <div className="font-bold text-xl text-gray-900">{product.location_state}</div>
                  <div className="text-sm text-gray-600">{product.location_city}</div>
                </div>
              </div>
            </div>

            {/* Dynamic Attributes */}
            {renderAttributes}

            {/* Luxury Contact */}
            <div className="contact-premium luxury-card" id="contact">
              <h3 className="mini-title mb-8 flex items-center gap-3 text-2xl font-black">
                <ChatBubbleLeftIcon className="w-8 h-8" />
                Contact Seller Instantly
              </h3>
              <div className="contact-buttons-stack space-y-4">
                <a
                  href={`https://wa.me/${contactInfo.whatsapp || contactInfo.phone}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="premium-contact-btn whatsapp-hero flex items-center gap-4 px-8 py-6 rounded-3xl font-black text-lg shadow-2xl hover:shadow-3xl transition-all duration-300 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
                >
                  💬 WhatsApp Chat
                  <div className="w-20 h-10 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm font-bold">
                    START
                  </div>
                </a>
                <a
                  href={`tel:${contactInfo.phone}`}
                  className="premium-contact-btn flex items-center gap-4 px-8 py-6 rounded-3xl font-bold text-lg shadow-2xl hover:shadow-3xl transition-all duration-300 bg-gradient-to-r from-slate-900 to-gray-800 hover:from-slate-800 hover:to-gray-700 text-white"
                >
                  📞 Call Now
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Seller Profile - Luxury */}
        {sellerStats && (
          <div className="seller-profile-premium luxury-card mb-24 p-12 rounded-4xl">
            <div className="seller-header flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 mb-12">
              <div className="flex items-center gap-8">
                <div className="seller-avatar w-28 h-28 bg-gradient-to-br from-orange-500 via-pink-500 to-purple-500 rounded-3xl flex items-center justify-center shadow-2xl border-4 border-white/30">
                  <UserIcon className="w-14 h-14 text-white" />
                </div>
                <div>
                  <h2 className="seller-name text-4xl lg:text-5xl font-black bg-gradient-to-r from-gray-900 to-slate-800 bg-clip-text text-transparent leading-tight">
                    {sellerStats.store_name || 'Premium Seller'}
                  </h2>
                  <p className="seller-subtitle text-xl text-gray-600 mt-2 font-medium">
                    {sellerStats.years_on_platform || 0}+ years trusted on Minimart
                  </p>
                </div>
              </div>
              {sellerStats.verified_id && (
                <div className="verified-premium flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-2xl font-black text-white shadow-2xl">
                  <ShieldCheckIcon className="w-6 h-6" />
                  VERIFIED SELLER
                </div>
              )}
            </div>
            <div className="seller-stats-premium grid grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { value: sellerStats.total_ads || 0, label: 'Total Listings', color: 'from-orange-500 to-orange-600' },
                { value: sellerStats.total_feedback || 0, label: 'Reviews', color: 'from-emerald-500 to-teal-500' },
                { value: sellerStats.followers || 0, label: 'Followers', color: 'from-blue-500 to-indigo-600' },
                { value: sellerStats.avg_rating || 0, label: 'Rating', color: 'from-purple-500 to-pink-500' }
              ].map(({ value, label, color }, idx) => (
                <div key={idx} className="stat-card luxury-card p-8 rounded-3xl text-center group hover:scale-105 transition-all duration-300">
                  <div className={`stat-number text-4xl lg:text-5xl font-black bg-gradient-to-r ${color} bg-clip-text text-transparent mb-3`}>
                    {Number(value).toLocaleString()}
                  </div>
                  <div className="stat-label text-lg font-bold text-gray-700 uppercase tracking-wider">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Infinite Scroll Similar Products */}
        <div className="similar-products-premium luxury-card rounded-4xl overflow-hidden">
          <div className="similar-header p-12 border-b border-white/20">
            <h2 className="text-4xl lg:text-5xl font-black bg-gradient-to-r from-gray-900 to-slate-800 bg-clip-text text-transparent flex items-center gap-6">
              🔥 Similar Premium Products
              <span className="text-2xl text-gray-500 font-normal">({similarProducts.length} found)</span>
            </h2>
          </div>
          
          <div className="similar-grid-container">
            {similarLoading && similarProducts.length === 0 ? (
              <div className="p-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-8">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="similar-skeleton luxury-card h-96 rounded-3xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="p-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-8">
                {similarProducts.map((item) => (
                  <Link 
                    key={item.id} 
                    to={`/product/${item.slug}`} 
                    className="similar-card-premium luxury-card block h-96 lg:h-[440px] rounded-3xl overflow-hidden group hover:scale-[1.02] transition-all duration-500 shadow-xl hover:shadow-3xl"
                  >
                    <div className="card-image h-[65%] overflow-hidden relative">
                      <img
                        src={item.images?.[0] || '/api/placeholder/400/300'}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        onError={(e) => { e.target.src = '/api/placeholder/400/300'; }}
                      />
                      <div className="absolute top-4 left-4">
                        <span className={`status-badge-tiny px-3 py-1 rounded-full text-xs font-bold ${
                          item.status === 'active' ? 'bg-emerald-500/90 text-white' : 'bg-amber-500/90 text-white'
                        }`}>
                          {item.status?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="card-body p-6 h-[35%] flex flex-col">
                      <h3 className="title font-bold text-xl text-gray-900 line-clamp-2 mb-4 group-hover:text-indigo-600 transition-colors">{item.title}</h3>
                      <div className="price-section mb-4">
                        <div className="price text-2xl font-black bg-gradient-to-r from-gray-900 to-indigo-900 bg-clip-text text-transparent">
                          ₦{Number(item.price || 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="location-stack text-sm space-y-1 text-gray-600">
                        <div className="flex items-center gap-2 font-semibold">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" />
                          </svg>
                          {item.location_state}
                        </div>
                        <div className="text-xs opacity-75">{item.location_city}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Infinite Scroll Trigger */}
            {hasMoreSimilar && (
              <div ref={similarEndRef} className="infinite-scroll-trigger p-12 flex items-center justify-center">
                {similarLoading ? (
                  <div className="loading-indicator">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
                    <p className="mt-4 text-lg font-semibold text-gray-600">Loading more premium products...</p>
                  </div>
                ) : (
                  <button 
                    onClick={() => fetchSimilarProducts(similarPage + 1, true)}
                    className="load-more-premium px-12 py-6 rounded-3xl font-black text-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-2xl hover:shadow-3xl transition-all duration-300"
                  >
                    Load More Products
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;