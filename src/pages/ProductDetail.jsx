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

  // Attributes Display
  const renderAttributes = useMemo(() => {
    if (!product?.attributes) return null;

    const validAttributes = Object.entries(product.attributes)
      .filter(([key, value]) => value && attributeConfig[key]);

    if (validAttributes.length === 0) return null;

    return (
      <div className="attributes-section">
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
              <div key={key} className="attribute-item p-4 rounded-xl border border-gray-200">
                <div className="attribute-icon text-2xl mb-2">{config.icon}</div>
                <div className="attribute-label text-xs opacity-75 uppercase tracking-wider font-medium">{config.label}</div>
                <div className="attribute-value font-bold text-lg">
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
    return <div className="loading-skeleton">Loading product...</div>;
  }

  if (error && !loading) {
    return (
      <div className="error-state min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-8">
        <div className="max-w-md mx-auto text-center">
          <div className="w-28 h-28 bg-gradient-to-br from-red-400 to-pink-500 rounded-3xl mx-auto mb-8 flex items-center justify-center shadow-2xl">
            <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {error}
          </h2>
          <Link to="/" className="btn inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-lg shadow-lg">
            Browse Marketplace
            <ArrowLongRightIcon className="w-6 h-6" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="product-detail min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Sticky Header */}
      <ProductHeader
        product={product}
        similarProductsCount={similarProducts.length}
        reviewStats={reviewStats}
        onFavorite={handleFavorite}
        isFavorited={isFavorited}
      />

      <div className="homepage-container product-detail-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Product Section - Image First */}
        <div className="hero-product-section mb-20">
          {/* Image Gallery */}
          <div className="gallery space-y-8 mb-20">
            <div className="main-image-container rounded-3xl shadow-2xl overflow-hidden">
              <img
                src={product.images?.[0] || '/api/placeholder/600/400'}
                alt={product.title}
                className="w-full h-[500px] lg:h-[600px] object-cover transition-all duration-700 group-hover:scale-105"
                onError={(e) => { e.target.src = '/api/placeholder/600/400'; }}
              />
            </div>
            
            {product.images?.length > 1 && (
              <div className="thumbnails flex gap-4 overflow-x-auto pb-4 px-4">
                {product.images.slice(1, 9).map((img, idx) => (
                  <div key={idx} className="thumbnail-item flex-shrink-0 w-28 h-28 rounded-2xl overflow-hidden shadow-xl">
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

          {/* Product Info */}
          <div className="product-info space-y-12">
            {/* Status */}
            <div className="product-meta">
              <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-gray-600 mb-6">
                <span>ID: {product.id.slice(0, 8)}...</span>
              </div>
              <div className={`status-badge inline-flex px-6 py-3 rounded-2xl text-sm font-bold shadow-lg ${
                product.status === 'active' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-yellow-500 text-white'
              }`}>
                {product.status?.toUpperCase() || 'LIVE'}
              </div>
            </div>

            {/* Price & Location */}
            <div className="price-section">
              <div className="price-display text-5xl lg:text-7xl font-bold text-gray-900 mb-8">
                ₦{Number(product.price || 0).toLocaleString()}
              </div>
              <div className="location-display p-5 bg-white rounded-2xl shadow-lg">
                <div className="font-bold text-lg text-gray-900">{product.location_state}</div>
                <div className="text-sm text-gray-600">{product.location_city}</div>
              </div>
            </div>

            {/* Attributes */}
            {renderAttributes}
          </div>
        </div>

        {/* Seller Profile */}
        {sellerStats && (
          <div className="seller-profile mb-24 p-10 rounded-3xl shadow-lg">
            <div className="seller-header flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 mb-12">
              <div className="flex items-center gap-8">
                <div className="seller-avatar w-24 h-24 bg-gradient-to-br from-orange-500 via-pink-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <UserIcon className="w-12 h-12 text-white" />
                </div>
                <div>
                  <h2 className="seller-name text-3xl lg:text-4xl font-bold text-gray-900">
                    {sellerStats.store_name || 'Seller'}
                  </h2>
                  <p className="seller-subtitle text-lg text-gray-600 mt-2">
                    {sellerStats.years_on_platform || 0}+ years trusted on Minimart
                  </p>
                </div>
              </div>
              {sellerStats.verified_id && (
                <div className="verified flex items-center gap-3 px-6 py-3 bg-green-500 rounded-xl font-bold text-white shadow-lg">
                  <ShieldCheckIcon className="w-5 h-5" />
                  VERIFIED SELLER
                </div>
              )}
            </div>
            <div className="seller-stats grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { value: sellerStats.total_ads || 0, label: 'Listings' },
                { value: sellerStats.total_feedback || 0, label: 'Reviews' },
                { value: sellerStats.followers || 0, label: 'Followers' },
                { value: sellerStats.avg_rating || 0, label: 'Rating' }
              ].map(({ value, label }, idx) => (
                <div key={idx} className="stat-card p-6 rounded-2xl text-center">
                  <div className="stat-number text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
                    {Number(value).toLocaleString()}
                  </div>
                  <div className="stat-label text-base font-bold text-gray-700 uppercase tracking-wider">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Similar Products */}
        <div className="similar-products rounded-3xl overflow-hidden shadow-lg">
          <div className="similar-header p-10 border-b border-gray-200">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
              Similar Products
              <span className="text-xl text-gray-500 font-normal"> ({similarProducts.length} found)</span>
            </h2>
          </div>
          
          <div className="similar-grid-container">
            {similarLoading && similarProducts.length === 0 ? (
              <div className="p-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="similar-skeleton h-80 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="p-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                {similarProducts.map((item) => (
                  <Link 
                    key={item.id} 
                    to={`/product/${item.slug}`} 
                    className="similar-card block h-80 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    <div className="card-image h-[65%] overflow-hidden">
                      <img
                        src={item.images?.[0] || '/api/placeholder/400/300'}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.src = '/api/placeholder/400/300'; }}
                      />
                      <div className="absolute top-3 left-3">
                        <span className={`status-badge px-2 py-1 rounded-full text-xs font-bold ${
                          item.status === 'active' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'
                        }`}>
                          {item.status?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="card-body p-5 h-[35%]">
                      <h3 className="title font-bold text-lg text-gray-900 line-clamp-2 mb-3">{item.title}</h3>
                      <div className="price mb-3">
                        <div className="text-xl font-bold text-gray-900">
                          ₦{Number(item.price || 0).toLocaleString()}
                        </div>
                      </div>
                                            <div className="location text-sm text-gray-600">
                        <div className="flex items-center gap-2 font-semibold">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" />
                          </svg>
                          {item.location_state}
                        </div>
                        <div className="text-xs text-gray-500">{item.location_city}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Infinite Scroll Trigger */}
            {hasMoreSimilar && (
              <div ref={similarEndRef} className="infinite-scroll-trigger p-10 flex items-center justify-center">
                {similarLoading ? (
                  <div className="loading-indicator">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
                    <p className="mt-4 text-sm text-gray-600">Loading more products...</p>
                  </div>
                ) : (
                  <button 
                    onClick={() => fetchSimilarProducts(similarPage + 1, true)}
                    className="load-more px-8 py-4 rounded-2xl font-bold text-base bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg hover:shadow-xl transition-all duration-300"
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