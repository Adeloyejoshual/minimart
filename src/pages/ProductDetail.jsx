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

  const cleanPhoneNumber = useCallback((phone) => {
    return phone ? phone.replace(/[^+d]/g, '') : '';
  }, []);

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
      <ProductHeader
        product={product}
        similarProductsCount={similarProducts.length}
        reviewStats={reviewStats}
        onFavorite={handleFavorite}
        isFavorited={isFavorited}
      />

      <div className="homepage-container product-detail-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* PRODUCT IMAGES / MEDIA */}
        <div className="hero-product-section mb-20">
          {/* Main image gallery / carousel / views */}
          <div className="gallery mb-20">
            <div className="main-image-container rounded-3xl shadow-2xl overflow-hidden">
              <img
                src={product.images?.[0] || '/api/placeholder/600/400'}
                alt={product.title}
                className="w-full h-[500px] lg:h-[600px] object-cover transition-all duration-700 group-hover:scale-105"
                onError={(e) => { e.target.src = '/api/placeholder/600/400'; }}
              />
            </div>

            {/* Optional video / 360 view area */}
            <div className="view-tabs grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {/* Example: 360 view / video placeholder */}
              <div className="media-tab p-6 rounded-2xl border border-gray-200 flex flex-col items-center justify-center bg-white">
                <svg className="w-12 h-12 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 110-12 6 6 0 010 12z" />
                </svg>
                <span className="mt-3 text-sm font-medium text-gray-700">360 View</span>
              </div>

              <div className="media-tab p-6 rounded-2xl border border-gray-200 flex flex-col items-center justify-center bg-white">
                <svg className="w-12 h-12 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" />
                </svg>
                <span className="mt-3 text-sm font-medium text-gray-700">Video</span>
              </div>
            </div>

            {/* Thumbnail strip */}
            {product.images?.length > 1 && (
              <div className="thumbnails flex gap-4 overflow-x-auto pb-4 px-4 mt-6">
                {product.images.slice(1, 9).map((img, idx) => (
                  <div key={idx} className="thumbnail-item flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden shadow-xl">
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

          {/* PRODUCT INFO */}
          <div className="product-info space-y-12">
            {/* Product Name / Title */}
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {product.title}
            </h1>

            {/* Seller Name & Profile */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 text-sm font-medium text-gray-600 mb-6">
              <span>ID: {product.id.slice(0, 8)}...</span>
              <div className="h-5 w-px bg-gray-300 hidden sm:block"></div>
              <span>Seller: {sellerStats?.store_name || 'N/A'}</span>
              {sellerStats?.verified_id && (
                <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold ml-2">
                  Verified
                </span>
              )}
            </div>

            {/* Status */}
            <div className="product-meta mb-6">
              <div className={`status-badge inline-flex px-6 py-3 rounded-2xl text-sm font-bold shadow-lg ${
                product.status === 'active' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'
              }`}>
                {product.status?.toUpperCase() || 'LIVE'}
              </div>
            </div>

            {/* PRICE & OFFERS */}
            <div className="price-section">
              <div className="price-display text-5xl lg:text-7xl font-bold text-gray-900 mb-8">
                ₦{Number(product.price || 0).toLocaleString()}
              </div>
              <div className="location-display p-5 bg-white rounded-2xl shadow-lg">
                <div className="font-bold text-lg text-gray-900">{product.location_state}</div>
                <div className="text-sm text-gray-600">{product.location_city}</div>
              </div>
            </div>

            {/* Attributes / Specifications */}
            {renderAttributes}

            {/* FULL PRODUCT DESCRIPTION */}
            {product.description && (
              <div className="description-section mt-12">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Product Details</h3>
                <p className="text-gray-700 text-lg leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* CONTACT / INTERACTION */}
        <div className="actions-bar mb-16 p-8 bg-white rounded-3xl shadow-lg">
          <div className="actions flex flex-wrap gap-4">
            <button className="btn inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-lg shadow-lg bg-indigo-600 text-white hover:bg-indigo-700">
              <ChatBubbleLeftIcon className="w-5 h-5" />
              Chat with Seller
            </button>
            <button className="btn inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-lg shadow-lg bg-gray-100 text-gray-800 hover:bg-gray-200">
              Send Offer
            </button>
            <button
              onClick={handleFavorite}
              className={`btn inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-lg shadow-lg transition-all ${
                isFavorited
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              ♥
            </button>
          </div>
        </div>

        {/* REVIEWS & RATINGS */}
        {reviewsLoading ? (
          <div className="p-10 animate-pulse">
            <div className="h-6 w-80 bg-gray-200 rounded mb-6"></div>
                        {[...Array(3)].map((_, i) => (
              <div key={i} className="mb-6 p-6 bg-white rounded-2xl shadow">
                <div className="h-4 w-40 bg-gray-200 rounded mb-3"></div>
                <div className="h-3 w-60 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 w-52 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="reviews-section mb-20">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-8">
              Reviews & Ratings
            </h2>

            <div className="flex flex-wrap items-center gap-6 mb-8 text-lg text-gray-700">
              <div className="text-3xl font-bold">
                {Number(reviewStats?.avg_rating || 0).toFixed(1)}
                <span className="text-2xl text-yellow-500 ml-1">★</span>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-gray-900">
                  {Number(reviewStats?.total_reviews || 0).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Reviews</div>
              </div>
            </div>

            <div className="reviews-list space-y-6">
              {reviews.map((review, idx) => (
                <div key={idx} className="review-card p-6 bg-white rounded-2xl shadow-lg">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                      <span className="text-sm text-white font-bold">
                        {review.reviewer_name?.charAt(0)?.toUpperCase() || 'A'}
                      </span>
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 text-sm">
                        {review.reviewer_name || 'Anonymous'}
                      </div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <StarIcon
                            key={star}
                            className={`w-4 h-4 ${
                              star <= review.rating ? 'text-yellow-500' : 'text-gray-300'
                            }`}
                          />
                        ))}
                        <span className="text-sm text-gray-600 ml-2">
                          {new Date(review.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-700 leading-relaxed">
                    {review.comment}
                  </p>
                </div>
              ))}

              {reviews.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p>No reviews yet. Be the first to leave a review!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* RECOMMENDED / SIMILAR LISTINGS */}
        <div className="similar-products rounded-3xl overflow-hidden shadow-lg mb-20">
          <div className="similar-header p-10 border-b border-gray-200">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
              Similar Products
              <span className="text-xl text-gray-500 font-normal">
                {' '}({similarProducts.length} found)
              </span>
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
                      <h3 className="title font-bold text-lg text-gray-900 line-clamp-2 mb-3">
                        {item.title}
                      </h3>
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

        {/* FOOTER (optional inline section) */}
        <footer className="product-footer mb-20">
          <div className="p-10 bg-white rounded-3xl shadow-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Browse Categories</h3>
                <ul className="space-y-2">
                  <li><Link to="/category/electronics" className="text-gray-600 hover:text-indigo-600">Electronics</Link></li>
                  <li><Link to="/category/clothing" className="text-gray-600 hover:text-indigo-600">Fashion</Link></li>
                  <li><Link to="/category/homes" className="text-gray-600 hover:text-indigo-600">Home & Appliances</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Support</h3>
                <ul className="space-y-2">
                  <li><Link to="/help" className="text-gray-600 hover:text-indigo-600">Help Center</Link></li>
                  <li><Link to="/terms" className="text-gray-600 hover:text-indigo-600">Terms & Policies</Link></li>
                  <li><Link to="/contact" className="text-gray-600 hover:text-indigo-600">Contact Us</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Company</h3>
                <ul className="space-y-2">
                  <li><Link to="/about" className="text-gray-600 hover:text-indigo-600">About Minimart</Link></li>
                  <li><Link to="/blog" className="text-gray-600 hover:text-indigo-600">Blog</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Follow Us</h3>
                <div className="flex gap-4 text-gray-600">
                  <Link to="#" className="hover:text-indigo-600">Twitter</Link>
                  <Link to="#" className="hover:text-indigo-600">Instagram</Link>
                  <Link to="#" className="hover:text-indigo-600">Facebook</Link>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ProductDetail;