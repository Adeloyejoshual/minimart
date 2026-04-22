import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeftIcon, 
  FunnelIcon, 
  StarIcon,
  UserIcon,
  ChatBubbleLeftIcon,
  ShieldCheckIcon,
  ClockIcon 
} from '@heroicons/react/24/outline';

const ProductDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  // Main states
  const [product, setProduct] = useState(null);
  const [sellerStats, setSellerStats] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Clean phone number helper
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

  // Fetch seller stats
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

  // Fetch reviews
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

  // Fetch similar products
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

  // Track view
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

  // Load secondary data when product loads
  useEffect(() => {
    if (product && !error) {
      trackView();
      fetchSellerStats();
      fetchReviews();
      fetchRelatedProducts();
    }
  }, [product, error, trackView, fetchSellerStats, fetchReviews, fetchRelatedProducts]);

  // Memoized contact info
  const contactInfo = useMemo(() => ({
    phone: cleanPhoneNumber(product?.contact?.phone),
    whatsapp: cleanPhoneNumber(product?.contact?.whatsapp)
  }), [product?.contact?.phone, product?.contact?.whatsapp, cleanPhoneNumber]);

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="animate-pulse bg-white rounded-2xl shadow-xl p-8">
          <div className="h-10 bg-gray-200 rounded-lg w-64 mb-12"></div>
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <div className="h-80 lg:h-96 bg-gray-200 rounded-2xl mb-6"></div>
              <div className="grid grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-20 bg-gray-200 rounded-xl"></div>
                ))}
              </div>
            </div>
            <div className="space-y-6">
              <div className="h-8 bg-gray-200 rounded-lg w-3/4"></div>
              <div className="h-12 bg-gray-200 rounded-xl w-1/2"></div>
              <div className="space-y-4">
                <div className="h-6 bg-gray-200 rounded w-full"></div>
                <div className="h-6 bg-gray-200 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Error state
  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-12 text-center">
          <div className="w-24 h-24 bg-red-100 rounded-2xl mx-auto mb-8 flex items-center justify-center">
            <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-4">{error || 'Product not found'}</h2>
          <p className="text-gray-600 mb-12 leading-relaxed">The product you're looking for doesn't exist or has been removed.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate(-1)}
              className="flex-1 max-w-xs flex items-center justify-center px-8 py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-black transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
            >
              <ArrowLeftIcon className="w-5 h-5 mr-2" />
              Go Back
            </button>
            <Link
              to="/"
              className="flex-1 max-w-xs flex items-center justify-center px-8 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
            >
              Browse Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="group inline-flex items-center mb-12 px-6 py-3 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl hover:bg-white hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-sm font-semibold text-gray-900"
        >
          <ArrowLeftIcon className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform duration-300" />
          Back to Marketplace
        </button>

        {/* Main Product Section */}
        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          {/* Product Gallery */}
          <div className="space-y-6">
            <div className="relative group">
              <img
                src={product.images?.[0] || '/api/placeholder/600/400'}
                alt={product.title}
                className="w-full h-96 lg:h-[28rem] xl:h-[32rem] object-cover rounded-2xl shadow-2xl group-hover:scale-[1.02] transition-transform duration-500"
                onError={(e) => { e.target.src = '/api/placeholder/600/400'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
            </div>
            
            {product.images?.length > 1 && (
              <div className="grid grid-cols-4 gap-3">
                {product.images.slice(1, 9).map((img, idx) => (
                  <div key={idx} className="group relative cursor-pointer">
                    <img
                      src={img}
                      alt={`${product.title} ${idx + 2}`}
                      className="w-full h-24 object-cover rounded-xl group-hover:ring-4 group-hover:ring-blue-500/30 group-hover:shadow-lg transition-all duration-300"
                      onError={(e) => { e.target.src = '/api/placeholder/120/96'; }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div className="space-y-8 lg:pt-4">
            {/* Header */}
            <div>
              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-black bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent leading-tight mb-4">
                {product.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-6">
                <span>ID: {product.id.slice(0, 8)}...</span>
                <span className="w-px h-4 bg-gray-300 mx-2" />
                <span>{product.views?.toLocaleString() || 0} views</span>
                <span>•</span>
                <span>{product.clicks_count?.toLocaleString() || 0} clicks</span>
              </div>
              <div className={`inline-flex px-4 py-2 rounded-full text-xs font-bold ${
                product.status === 'draft' 
                  ? 'bg-yellow-100 text-yellow-800 border-yellow-200' 
                  : product.status === 'active'
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : 'bg-blue-100 text-blue-800 border-blue-200'
              } border`}>
                {product.status?.toUpperCase() || 'UNKNOWN'}
              </div>
            </div>

            {/* Price & Specs */}
            <div className="p-8 lg:p-10 bg-gradient-to-br from-gray-50/50 to-white/50 rounded-3xl backdrop-blur-sm border border-gray-100/50 shadow-xl">
              <div className="text-6xl lg:text-7xl xl:text-8xl font-black text-gray-900 mb-8 leading-none">
                ₦{Number(product.price || 0).toLocaleString()}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center">
                    <div className="w-6 h-6 bg-gray-500 rounded-xl flex items-center justify-center mr-3">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" />
                      </svg>
                    </div>
                    <span className="font-semibold text-gray-900">
                      {product.location?.state}, {product.location?.city}
                    </span>
                  </div>
                  {product.attributes?.brand && (
                    <div className="flex items-center">
                      <div className="w-2 h-10 bg-gray-400 rounded-full mr-3" />
                      <span className="font-semibold text-gray-900">{product.attributes.brand}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-3 text-sm">
                  {product.attributes?.model && (
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">Model</span>
                      <span className="font-bold text-gray-900">{product.attributes.model}</span>
                    </div>
                  )}
                  {product.attributes?.storage && (
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">Storage</span>
                      <span className="font-bold text-gray-900">{product.attributes.storage}</span>
                    </div>
                  )}
                  {product.attributes?.ram && (
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">RAM</span>
                      <span className="font-bold text-gray-900">{product.attributes.ram}</span>
                    </div>
                  )}
                  {product.attributes?.condition && (
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">Condition</span>
                      <span className={`font-bold px-3 py-1 rounded-full text-xs ${
                        product.attributes.condition === 'New' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {product.attributes.condition}
                      </span>
                    </div>
                  )}
                  {product.attributes?.sim && (
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">SIM</span>
                      <span className="font-bold text-gray-900">{product.attributes.sim}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {product.description && (
              <div className="prose prose-lg max-w-none">
                <h3 className="font-black text-2xl text-gray-900 mb-4">Description</h3>
                <div className="text-lg text-gray-700 leading-relaxed">
                  {product.description}
                </div>
              </div>
            )}

            {/* Contact Seller */}
            <div className="pt-8 border-t border-gray-100">
              <h3 className="font-black text-2xl text-gray-900 mb-6 flex items-center">
                <ChatBubbleLeftIcon className="w-8 h-8 mr-3 text-green-600" />
                Contact Seller
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-100 hover:shadow-lg transition-all">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center mr-4">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-bold text-xl text-gray-900">Phone</div>
                      <div className="text-green-700 font-semibold">{product.contact.phone}</div>
                    </div>
                  </div>
                  <a
                    href={`tel:${contactInfo.phone}`}
                    className="w-full block bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-2xl text-center shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 text-lg"
                  >
                    📞 Call Now
                  </a>
                </div>
                {contactInfo.whatsapp && (
                  <div className="p-6 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 hover:shadow-lg transition-all">
                    <div className="flex items-center mb-4">
                      <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center mr-4">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M17 9a1 1 0 010 2h-2v1a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6a1 1 0 011-1h1V5a1 1 0 012 0v1h2a1 1 0 010 2h-2V9h2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-bold text-xl text-gray-900">WhatsApp</div>
                        <div className="text-green-700 font-semibold">{product.contact.whatsapp}</div>
                      </div>
                    </div>
                    <a
                      href={`https://wa.me/${contactInfo.whatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full block bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-2xl text-center shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 text-lg"
                    >
                      💬 WhatsApp Chat
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Seller Trust Section */}
        {sellerStats && (
          <div className="bg-gradient-to-r from-orange-50/80 to-yellow-50/80 backdrop-blur-sm rounded-3xl shadow-2xl p-10 lg:p-12 mb-16 border border-orange-100/50">
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-10">
                <div className="flex items-center space-x-6 mb-8 lg:mb-0">
                  <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl flex items-center justify-center shadow-2xl">
                    <UserIcon className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <h2 className="text-3xl lg:text-4xl font-black text-gray-900">
                      {sellerStats.store_name || 'Trusted Seller'}
                    </h2>
                    <p className="text-xl text-gray-600 mt-2">
                      {sellerStats.years_on_platform || 0}+ years on Minimart
                    </p>
                  </div>
                </div>
                {sellerStats.verified_id && (
                  <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-2xl">
                    <ShieldCheckIcon className="w-6 h-6 inline mr-2" />
                    Verified Seller
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {[
                  { value: sellerStats.total_ads || 0, label: 'Total Ads', color: 'orange-600' },
                  { value: sellerStats.total_feedback || 0, label: 'Feedback', color: 'green-600' },
                  { value: sellerStats.followers || 0, label: 'Followers', color: 'blue-600' },
                  { value: sellerStats.avg_rating || 0, label: 'Rating', color: 'purple-600' }
                ].map(({ value, label, color }, idx) => (
                  <div key={idx} className="group p-6 bg-white/70 rounded-2xl backdrop-blur-sm border border-gray-100 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
                    <div className={`text-4xl font-black ${color} mb-2`}>
                      {Number(value).toLocaleString()}
                    </div>
                    <div className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col lg:flex-row gap-6 mb-20 max-w-4xl mx-auto">
          <a
            href={`https://wa.me/${contactInfo.whatsapp || contactInfo.phone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-black py-5 px-10 rounded-3xl text-xl shadow-2xl hover:shadow-3xl transform hover:-translate-y-2 transition-all duration-300 text-center"
          >
            💬 Contact Seller on WhatsApp
          </a>
          <button className="flex-1 bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black text-white font-black py-5 px-10 rounded-3xl text-xl shadow-2xl hover:shadow-3xl transform hover:-translate-y-2 transition-all duration-300">
            ❌ Mark as Unavailable
          </button>
        </div>

        {/* Reviews Section */}
        <div className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden mb-20 border border-white/50">
          <div className="p-12 border-b bg-gradient-to-r from-purple-50 to-pink-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-3xl flex items-center justify-center shadow-2xl">
                  <StarIcon className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-gray-900">Customer Reviews</h2>
                  {reviewStats && (
                    <div className="flex items-center space-x-6 text-xl text-gray-600 mt-2">
                      <span>{reviewStats.avg_rating?.toFixed(1) || 0} ★ Average</span>
                      <span>•</span>
                      <span>{reviewStats.total_reviews?.toLocaleString() || 0} Reviews</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-12">
            {reviewsLoading ? (
              <div className="grid md:grid-cols-2 gap-8">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="animate-pulse p-8 bg-gray-50 rounded-2xl">
                    <div className="flex items-center space-x-4 mb-6">
                      <div className="w-14 h-14 bg-gray-200 rounded-full" />
                      <div className="space-y-2">
                        <div className="h-5 bg-gray-200 rounded w-32" />
                        <div className="h-4 bg-gray-200 rounded w-24" />
                      </div>
                    </div>
                    <div className="h-24 bg-gray-200 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : reviews.length > 0 ? (
              <div className="space-y-8">
                {reviews.map((review) => (
                  <div key={review.id} className="group flex items-start space-x-6 p-8 bg-gradient-to-r from-gray-50 to-white rounded-3xl hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border border-gray-100">
                    <div className="w-16 h-16 bg-gradient-to-br from-gray-400 to-gray-500 rounded-2xl flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="font-bold text-xl text-white">
                        {review.reviewer_name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-4">
                        <div className="font-bold text-xl text-gray-900 truncate pr-4">
                          {review.reviewer_name}
                        </div>
                        <div className="text-sm text-gray-500 whitespace-nowrap">
                          {new Date(review.created_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 mb-6">
                        {[...Array(5)].map((_, i) => (
                          <StarIcon key={i} className={`w-6 h-6 ${i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                        ))}
                      </div>
                      {review.comment && (
                        <p className="text-gray-700 leading-relaxed text-lg line-clamp-4">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-24">
                <StarIcon className="w-24 h-24 text-gray-300 mx-auto mb-8" />
                <h3 className="text-3xl font-black text-gray-500 mb-4">No Reviews Yet</h3>
                <p className="text-xl text-gray-400 mb-8 max-w-md mx-auto">
                  Be the first to share your experience with this product
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Similar Products */}
        <div className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden border border-white/50">
          <div className="p-12 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
            <h2 className="text-4xl font-black text-gray-900 flex items-center">
              {similarProducts.length > 0 ? '🔥 Similar Products' : '🌟 Explore More'}
              <span className="ml-4 text-xl text-gray-500">
                ({similarProducts.length || 0} items)
              </span>
            </h2>
          </div>
          
          {similarLoading ? (
            <div className="p-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl h-80 lg:h-96" />
              ))}
            </div>
          ) : similarProducts.length > 0 ? (
            <div className="p-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-8">
              {similarProducts.map((item) => (
                <Link
                  key={item.id}
                  to={`/product/${item.slug}`}
                  className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-white/50 to-gray-50 hover:from-white hover:to-blue-50 border border-gray-100 hover:border-blue-200 hover:shadow-2xl hover:-translate-y-4 transition-all duration-500 h-80 lg:h-96"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative w-full h-3/4 overflow-hidden rounded-t-2xl">
                    <img
                      src={item.images?.[0] || '/api/placeholder/300/300'}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      onError={(e) => { e.target.src = '/api/placeholder/300/300'; }}
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="font-bold text-lg text-gray-900 line-clamp-2 mb-3 group-hover:text-blue-600 transition-colors h-12">
                      {item.title}
                    </h3>
                    <div className="text-2xl font-black text-gray-900 mb-2">
                      ₦{Number(item.price || 0).toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600 font-semibold">
                      {item.location?.state}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-24 text-center">
              <FunnelIcon className="w-24 h-24 text-gray-300 mx-auto mb-8" />
              <h3 className="text-3xl font-black text-gray-500 mb-4">No Similar Products</h3>
              <p className="text-xl text-gray-400 mb-12 max-w-md mx-auto">
                Check out these popular items instead
              </p>
              <Link
                to="/"
                className="inline-flex items-center px-12 py-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-black rounded-3xl text-xl shadow-2xl hover:shadow-3xl transform hover:-translate-y-2 transition-all duration-300"
              >
                Browse Marketplace
                <svg className="w-6 h-6 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;