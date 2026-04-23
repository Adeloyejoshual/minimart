// src/components/ProductDetail.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  FunnelIcon, 
  StarIcon,
  UserIcon,
  ChatBubbleLeftIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';

import ProductHeader from "../components/ProductHeader";
import '../styles/ProductDetail.css';

const ProductDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  
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

  // Clean phone number
  const cleanPhoneNumber = useCallback((phone) => {
    return phone ? phone.replace(/[^+d]/g, '') : '';
  }, []);

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

  // Secondary data fetching
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

  const fetchRelatedProducts = useCallback(async () => {
    if (!product) return;
    setSimilarLoading(true);
    try {
      let url = '/api/homepage?limit=6';
      if (product.attributes?.brand) {
        url = `/api/homepage?brand=${encodeURIComponent(product.attributes.brand)}&limit=6&exclude=${product.id}`;
      }
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const products = (data.latest || data.recommended || [])
          .filter(p => p.id !== product.id && p.slug !== slug);
        setSimilarProducts(products.slice(0, 6));
      }
    } catch (err) {
      console.error('Related products fetch failed:', err);
    } finally {
      setSimilarLoading(false);
    }
  }, [product, slug]);

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

  // Load secondary data once product is fetched
  useEffect(() => {
    if (product && !error) {
      trackView();
      fetchSellerStats();
      fetchReviews();
      fetchRelatedProducts();
    }
  }, [product, error, trackView, fetchSellerStats, fetchReviews, fetchRelatedProducts]);

  const contactInfo = useMemo(() => ({
    phone: cleanPhoneNumber(product?.contact?.phone),
    whatsapp: cleanPhoneNumber(product?.contact?.whatsapp)
  }), [
    product?.contact?.phone,
    product?.contact?.whatsapp,
    cleanPhoneNumber
  ]);

  const handleFavorite = useCallback(() => {
    setIsFavorited(!isFavorited);
    // → Add your favorite API call here
  }, [isFavorited]);

  // Loading Skeleton
  const LoadingSkeleton = () => (
    <div className="product-detail-page">
      <div className="product-header skeleton h-16" />
      <div className="homepage-container product-detail-container pt-4">
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="card skeleton h-[400px]"></div>
            <div className="horizontal-scroll">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="scroll-item">
                  <div className="card skeleton h-24" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="skeleton h-9 w-4/5"></div>
              <div className="skeleton h-4 w-3/5"></div>
            </div>
            <div className="card p-8 skeleton h-64"></div>
          </div>
        </div>
      </div>
    </div>
  );

  // Error State
  if (error && !loading) {
    return (
      <div className="product-detail-page">
        <div className="homepage-container product-detail-container">
          <div className="card max-w-md mx-auto text-center p-12">
            <div className="w-24 h-24 bg-red-50 rounded-2xl mx-auto mb-8 flex items-center justify-center border-2 border-red-100">
              <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{error}</h2>
            <p className="text-gray-600 mb-8 leading-relaxed">The product you're looking for doesn't exist or has been removed.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate(-1)}
                className="load-more-btn max-w-xs flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Go Back
              </button>
              <Link to="/" className="load-more-btn max-w-xs bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 flex items-center gap-2">
                Browse Marketplace
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="product-detail-page">
      {/* 🔥 PROFESSIONAL STICKY HEADER */}
      <ProductHeader
        product={product}
        similarProductsCount={similarProducts.length}
        reviewStats={reviewStats}
        onFavorite={handleFavorite}
        isFavorited={isFavorited}
      />

      <div className="homepage-container product-detail-container pt-0">
        {/* Main Content */}
        <div className="main-grid">
          {/* Product Gallery */}
          <div className="gallery">
            <div className="main-image-container card group">
              <img
                src={product.images?.[0] || '/api/placeholder/600/400'}
                alt={product.title}
                className="main-image"
                onError={(e) => { e.target.src = '/api/placeholder/600/400'; }}
              />
            </div>
            
            {product.images?.length > 1 && (
              <div className="thumbnail-scroll horizontal-scroll">
                {product.images.slice(1, 9).map((img, idx) => (
                  <div key={idx} className="thumbnail-item scroll-item">
                    <div className="card">
                      <div className="card-image h-[120px]">
                        <img
                          src={img}
                          alt={`${product.title} ${idx + 2}`}
                          className="w-full h-full object-cover rounded-xl"
                          onError={(e) => { e.target.src = '/api/placeholder/120/96'; }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div className="product-info space-y-8">
            {/* Product Meta */}
            <div className="product-meta mb-6">
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-4">
                <span>ID: {product.id.slice(0, 8)}...</span>
                <span className="w-px h-4 bg-gray-300" />
                <span>{product.clicks_count?.toLocaleString() || 0} clicks</span>
              </div>
              <div className={`status-badge inline-flex px-4 py-2 rounded-full text-xs font-bold border ${
                product.status === 'draft' 
                  ? 'bg-yellow-50 text-yellow-800 border-yellow-200' 
                  : product.status === 'active'
                  ? 'bg-green-50 text-green-800 border-green-200'
                  : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}>
                {product.status?.toUpperCase() || 'UNKNOWN'}
              </div>
            </div>

            {/* Price & Specs */}
            <div className="price-specs-card card">
              <div className="product-price price mb-8">
                ₦{Number(product.price || 0).toLocaleString()}
              </div>
              <div className="specs-grid">
                <div className="space-y-4">
                  <div className="spec-row flex items-center">
                    <div className="spec-icon bg-gray-500">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" />
                      </svg>
                    </div>
                    <span className="spec-value font-bold text-gray-900">
                      {product.location?.state}, {product.location?.city}
                    </span>
                  </div>
                  {product.attributes?.brand && (
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-10 bg-gray-400 rounded-full" />
                      <span className="spec-value font-bold text-gray-900">{product.attributes.brand}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  {product.attributes?.model && (
                    <div className="spec-row">
                      <span className="spec-label">Model</span>
                      <span className="spec-value">{product.attributes.model}</span>
                    </div>
                  )}
                  {product.attributes?.storage && (
                    <div className="spec-row">
                      <span className="spec-label">Storage</span>
                      <span className="spec-value">{product.attributes.storage}</span>
                    </div>
                  )}
                  {product.attributes?.ram && (
                    <div className="spec-row">
                      <span className="spec-label">RAM</span>
                      <span className="spec-value">{product.attributes.ram}</span>
                    </div>
                  )}
                  {product.attributes?.condition && (
                    <div className="spec-row">
                      <span className="spec-label">Condition</span>
                      <span className={`spec-value px-3 py-1 rounded-full text-xs font-bold ${
                        product.attributes.condition === 'New' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {product.attributes.condition}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Contact Section */}
            <div className="contact-section card" id="contact">
              <div className="section-header contact-header">
                <h3 className="mini-title contact-title">
                  <ChatBubbleLeftIcon className="w-6 h-6" />
                  Contact Seller
                </h3>
              </div>
              <div className="contact-grid">
                <div className="contact-item card">
                  <div className="contact-header-row">
                    <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                    </div>
                    <div>
                      <div className="contact-title font-bold text-gray-900">Phone</div>
                      <div className="contact-number">{product.contact.phone}</div>
                    </div>
                  </div>
                  <a href={`tel:${contactInfo.phone}`} className="contact-btn load-more-btn">
                    📞 Call Now
                  </a>
                </div>
                {contactInfo.whatsapp && (
                  <div className="contact-item card">
                    <div className="contact-header-row">
                      <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M17 9a1 1 0 010 2h-2v1a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6a1 1 0 011-1h1V5a1 1 0 012 0v1h2a1 1 0 010 2h-2V9h2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="contact-title font-bold text-gray-900">WhatsApp</div>
                        <div className="contact-number">{product.contact.whatsapp}</div>
                      </div>
                    </div>
                    <a 
                      href={`https://wa.me/${contactInfo.whatsapp}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="contact-btn load-more-btn bg-green-600 hover:bg-green-700"
                    >
                      💬 WhatsApp Chat
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

                {/* Seller Stats */}
        {sellerStats && (
          <div className="seller-card card mb-16">
            <div className="seller-header flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-10">
              <div className="flex items-center gap-6">
                <div className="seller-icon w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-xl">
                  <UserIcon className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h2 className="seller-name text-3xl lg:text-4xl font-black text-gray-900">
                    {sellerStats.store_name || 'Trusted Seller'}
                  </h2>
                  <p className="seller-subtitle text-lg text-gray-600 mt-1">
                    {sellerStats.years_on_platform || 0}+ years on Minimart
                  </p>
                </div>
              </div>
              {sellerStats.verified_id && (
                <div className="verified-badge">
                  <ShieldCheckIcon className="w-5 h-5 inline mr-2" />
                  Verified Seller
                </div>
              )}
            </div>
            <div className="seller-stats-grid">
              {[
                { value: sellerStats.total_ads || 0, label: 'Total Ads', color: 'text-orange-600' },
                { value: sellerStats.total_feedback || 0, label: 'Feedback', color: 'text-green-600' },
                { value: sellerStats.followers || 0, label: 'Followers', color: 'text-blue-600' },
                { value: sellerStats.avg_rating || 0, label: 'Avg Rating', color: 'text-purple-600' }
              ].map(({ value, label, color }, idx) => (
                <div key={idx} className="seller-stat card group">
                  <div className={`seller-stat-number text-3xl font-black ${color} mb-2`}>
                    {Number(value).toLocaleString()}
                  </div>
                  <div className="stat-label text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="action-buttons">
          <a
            href={`https://wa.me/${contactInfo.whatsapp || contactInfo.phone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="primary-action action-btn whatsapp-btn"
          >
            💬 Contact Seller on WhatsApp
          </a>
          <button className="secondary-action action-btn unavailable-btn">
            ❌ Mark as Unavailable
          </button>
        </div>

        {/* Reviews */}
        <div className="reviews-card card mb-16">
          <div className="reviews-header section-header">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-xl">
                <StarIcon className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-gray-900 mb-2">Customer Reviews</h2>
                {reviewStats && (
                  <div className="reviews-stats">
                    <span>{reviewStats.avg_rating?.toFixed(1) || 0} ★ Average</span>
                    <span>•</span>
                    <span>{reviewStats.total_reviews?.toLocaleString() || 0} Reviews</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="reviews-content p-8">
            {reviewsLoading ? (
              <div className="grid md:grid-cols-2 gap-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="review-card card skeleton h-32" />
                ))}
              </div>
            ) : reviews.length > 0 ? (
              <div className="review-list space-y-6">
                {reviews.map((review) => (
                  <div key={review.id} className="review-card card group">
                    <div className="reviewer-avatar">
                      <span className="font-bold text-lg">
                        {review.reviewer_name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="review-content flex-1 min-w-0">
                      <div className="review-header flex items-center justify-between mb-4">
                        <div className="reviewer-name title font-bold text-lg text-gray-900 truncate">
                          {review.reviewer_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(review.created_at).toLocaleDateString('en-US', { 
                            month: 'short', day: 'numeric' 
                          })}
                        </div>
                      </div>
                      <div className="stars flex items-center gap-1 mb-4">
                        {[...Array(5)].map((_, i) => (
                          <StarIcon key={i} className={`w-5 h-5 ${i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                        ))}
                      </div>
                      {review.comment && (
                        <p className="review-text text-gray-700 leading-relaxed text-base">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <StarIcon className="empty-icon w-24 h-24 text-gray-300" />
                <h3 className="text-2xl font-black text-gray-500 mb-3 title">No Reviews Yet</h3>
                <p className="text-lg text-gray-500 mb-8 max-w-md mx-auto">
                  Be the first to share your experience with this product
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Similar Products */}
        <div className="similar-card card">
          <div className="similar-header section-header">
            <h2 className="mini-title text-3xl">
              {similarProducts.length > 0 ? '🔥 Similar Products' : '🌟 Explore More'}
              <span className="ml-4 text-lg text-gray-500">({similarProducts.length || 0} items)</span>
            </h2>
          </div>
          <div className="similar-grid">
            {similarLoading ? (
              <div className="p-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="card skeleton h-80" />
                ))}
              </div>
            ) : similarProducts.length > 0 ? (
              <div className="p-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                {similarProducts.map((item) => (
                  <Link key={item.id} to={`/product/${item.slug}`} className="similar-card card group block h-80 lg:h-96">
                    <div className="card-image h-[200px]">
                      <img
                        src={item.images?.[0] || '/api/placeholder/300/300'}
                        alt={item.title}
                        className="card-image img"
                        onError={(e) => { e.target.src = '/api/placeholder/300/300'; }}
                      />
                    </div>
                    <div className="card-body">
                      <h3 className="title mb-3">{item.title}</h3>
                      <div className="price mb-2 text-xl">
                        ₦{Number(item.price || 0).toLocaleString()}
                      </div>
                      <div className="location">{item.location?.state}</div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <FunnelIcon className="empty-icon w-24 h-24 text-gray-300" />
                <h3 className="text-2xl font-black text-gray-500 mb-4 title">No Similar Products</h3>
                <p className="text-lg text-gray-500 mb-12 max-w-md mx-auto">
                  Check out these popular items instead
                </p>
                <Link to="/" className="load-more-btn inline-flex items-center gap-2 text-lg">
                  Browse Marketplace
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;