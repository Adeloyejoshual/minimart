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
import "../styles/homepage.css"; // Homepage styles

const ProductDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  
  // Main states (unchanged)
  const [product, setProduct] = useState(null);
  const [sellerStats, setSellerStats] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [error, setError] = useState(null);

  // All useEffect, useCallback, and helper functions remain exactly the same
  const cleanPhoneNumber = useCallback((phone) => {
    return phone ? phone.replace(/[^+d]/g, '') : '';
  }, []);

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
  }), [product?.contact?.phone, product?.contact?.whatsapp, cleanPhoneNumber]);

  // Loading skeleton (simplified using homepage styles)
  const LoadingSkeleton = () => (
    <div className="page-content">
      <div className="homepage-container">
        <div className="card animate-pulse">
          <div className="card-image h-[400px]"></div>
          <div className="card-body space-y-4">
            <div className="h-8 bg-gray-200 rounded-lg w-3/4"></div>
            <div className="h-12 bg-gray-200 rounded-xl w-1/2"></div>
            <div className="space-y-3">
              <div className="h-6 bg-gray-200 rounded w-full"></div>
              <div className="h-6 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Error state (homepage style)
  if (error || !product) {
    return (
      <div className="page-content bg-[#f6f8fc]">
        <div className="homepage-container">
          <div className="card max-w-md mx-auto text-center p-12">
            <div className="w-24 h-24 bg-red-100 rounded-2xl mx-auto mb-8 flex items-center justify-center">
              <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="title text-gray-900 mb-4">{error || 'Product not found'}</h2>
            <p className="location text-gray-600 mb-12">The product you're looking for doesn't exist or has been removed.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate(-1)}
                className="load-more-btn max-w-xs"
              >
                <ArrowLeftIcon className="w-5 h-5 mr-2 inline -ml-1" />
                Go Back
              </button>
              <Link
                to="/"
                className="load-more-btn max-w-xs bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600"
              >
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
    <div className="page-content bg-[#f6f8fc]">
      <div className="homepage-container max-w-6xl">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="group inline-flex items-center mb-8 px-6 py-3 bg-white border border-gray-200 rounded-2xl hover:bg-white hover:shadow-xl transition-all duration-300 hover:-translate-y-1 text-sm font-semibold text-gray-900 card"
        >
          <ArrowLeftIcon className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform duration-300" />
          Back to Marketplace
        </button>

        {/* Main Product Section */}
        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          {/* Product Gallery */}
          <div className="space-y-6">
            <div className="card group relative overflow-hidden">
              <div className="card-image h-[400px] lg:h-[500px]">
                <img
                  src={product.images?.[0] || '/api/placeholder/600/400'}
                  alt={product.title}
                  className="card-image img"
                  onError={(e) => { e.target.src = '/api/placeholder/600/400'; }}
                />
              </div>
            </div>
            
            {product.images?.length > 1 && (
              <div className="horizontal-scroll">
                {product.images.slice(1, 9).map((img, idx) => (
                  <div key={idx} className="scroll-item">
                    <div className="card scroll-item-card h-full">
                      <div className="card-image">
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
          <div className="space-y-8 lg:pt-4">
            {/* Header */}
            <div>
              <h1 className="text-4xl lg:text-5xl font-black text-gray-900 leading-tight mb-4">
                {product.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-6 location">
                <span>ID: {product.id.slice(0, 8)}...</span>
                <span className="w-px h-4 bg-gray-300 mx-2" />
                <span>{product.views?.toLocaleString() || 0} views</span>
                <span>•</span>
                <span>{product.clicks_count?.toLocaleString() || 0} clicks</span>
              </div>
              <div className={`inline-flex px-4 py-2 rounded-full text-xs font-bold border ${
                product.status === 'draft' 
                  ? 'bg-yellow-100 text-yellow-800 border-yellow-200' 
                  : product.status === 'active'
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : 'bg-blue-100 text-blue-800 border-blue-200'
              }`}>
                {product.status?.toUpperCase() || 'UNKNOWN'}
              </div>
            </div>

            {/* Price & Specs */}
            <div className="card p-8 lg:p-10">
              <div className="price text-5xl lg:text-6xl mb-8">
                ₦{Number(product.price || 0).toLocaleString()}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center location">
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

            {/* Contact Section */}
            <div className="card pt-8 border-t border-gray-200">
              <div className="section-header mb-6">
                <h3 className="mini-title">
                  <ChatBubbleLeftIcon className="w-6 h-6" />
                  Contact Seller
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card p-6 hover:shadow-xl">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center mr-4">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                    </div>
                    <div>
                      <div className="font-bold text-lg text-gray-900">Phone</div>
                      <div className="text-green-700 font-semibold">{product.contact.phone}</div>
                    </div>
                  </div>
                  <a
                    href={`tel:${contactInfo.phone}`}
                    className="block load-more-btn bg-green-500 hover:bg-green-600 max-w-none text-lg"
                  >
                    📞 Call Now
                  </a>
                </div>
                {contactInfo.whatsapp && (
                  <div className="card p-6 hover:shadow-xl">
                    <div className="flex items-center mb-4">
                      <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center mr-4">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M17 9a1 1 0 010 2h-2v1a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6a1 1 0 011-1h1V5a1 1 0 012 0v1h2a1 1 0 010 2h-2V9h2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-bold text-lg text-gray-900">WhatsApp</div>
                        <div className="text-green-700 font-semibold">{product.contact.whatsapp}</div>
                      </div>
                    </div>
                    <a
                      href={`https://wa.me/${contactInfo.whatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block load-more-btn bg-green-600 hover:bg-green-700 max-w-none text-lg"
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
          <div className="card p-10 lg:p-12 mb-16 border border-orange-100">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-10">
              <div className="flex items-center space-x-6 mb-8 lg:mb-0">
                <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-xl">
                  <UserIcon className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl lg:text-4xl font-black text-gray-900">
                    {sellerStats.store_name || 'Trusted Seller'}
                  </h2>
                  <p className="location mt-2">
                    {sellerStats.years_on_platform || 0}+ years on Minimart
                  </p>
                </div>
              </div>
              {sellerStats.verified_id && (
                <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-xl">
                  <ShieldCheckIcon className="w-6 h-6 inline mr-2" />
                  Verified Seller
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { value: sellerStats.total_ads || 0, label: 'Total Ads', color: 'text-orange-600' },
                { value: sellerStats.total_feedback || 0, label: 'Feedback', color: 'text-green-600' },
                { value: sellerStats.followers || 0, label: 'Followers', color: 'text-blue-600' },
                { value: sellerStats.avg_rating || 0, label: 'Rating', color: 'text-purple-600' }
              ].map(({ value, label, color }, idx) => (
                <div key={idx} className="group p-6 bg-white rounded-2xl border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 card">
                  <div className={`text-3xl font-black ${color} mb-2`}>
                    {Number(value).toLocaleString()}
                  </div>
                  <div className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col lg:flex-row gap-6 mb-20 max-w-4xl mx-auto">
          <a
            href={`https://wa.me/${contactInfo.whatsapp || contactInfo.phone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="load-more-btn bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-xl py-5 max-w-none flex-1"
          >
            💬 Contact Seller on WhatsApp
          </a>
          <button className="load-more-btn bg-gray-800 hover:bg-gray-900 text-xl py-5 max-w-none flex-1">
            ❌ Mark as Unavailable
          </button>
        </div>

        {/* Reviews Section */}
        <div className="card overflow-hidden mb-20">
          <div className="section-header p-8 bg-gradient-to-r from-purple-50 to-pink-50">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-xl">
                <StarIcon className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-black text-gray-900">Customer Reviews</h2>
                {reviewStats && (
                  <div className="flex items-center space-x-6 text-lg text-gray-600 mt-2 location">
                    <span>{reviewStats.avg_rating?.toFixed(1) || 0} ★ Average</span>
                    <span>•</span>
                    <span>{reviewStats.total_reviews?.toLocaleString() || 0} Reviews</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-8">
            {reviewsLoading ? (
              <div className="grid md:grid-cols-2 gap-8">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="animate-pulse p-8 bg-gray-50 rounded-2xl card">
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
              <div className="space-y-6">
                {reviews.map((review) => (
                  <div key={review.id} className="group flex items-start space-x-6 p-6 bg-white rounded-2xl hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border border-gray-100 card">
                    <div className="w-14 h-14 bg-gradient-to-br from-gray-400 to-gray-500 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="font-bold text-lg text-white">
                        {review.reviewer_name?.charAt(0)?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-4">
                        <div className="font-bold text-lg text-gray-900 truncate pr-4 title">
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
                          <StarIcon key={i} className={`w-5 h-5 ${i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                        ))}
                      </div>
                      {review.comment && (
                        <p className="text-gray-700 leading-relaxed location">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <StarIcon className="w-24 h-24 text-gray-300 mx-auto mb-8" />
                <h3 className="text-2xl font-black text-gray-500 mb-4 title">No Reviews Yet</h3>
                <p className="text-lg text-gray-400 mb-8 max-w-md mx-auto">
                  Be the first to share your experience with this product
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Similar Products */}
        <div className="card overflow-hidden">
          <div className="section-header p-8 bg-gradient-to-r from-indigo-50 to-purple-50">
            <h2 className="mini-title text-3xl">
              {similarProducts.length > 0 ? '🔥 Similar Products' : '🌟 Explore More'}
              <span className="ml-4 text-lg text-gray-500">
                ({similarProducts.length || 0} items)
              </span>
            </h2>
          </div>
          
          {similarLoading ? (
            <div className="p-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-200 rounded-2xl h-80" />
              ))}
            </div>
          ) : similarProducts.length > 0 ? (
            <div className="p-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
              {similarProducts.map((item) => (
                <Link
                  key={item.id}
                  to={`/product/${item.slug}`}
                  className="card group h-80 lg:h-96 block"
                >
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
                    <div className="price mb-2">
                      ₦{Number(item.price || 0).toLocaleString()}
                    </div>
                    <div className="location">
                      {item.location?.state}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <FunnelIcon className="w-24 h-24 text-gray-300 mx-auto mb-8" />
              <h3 className="text-2xl font-black text-gray-500 mb-4 title">No Similar Products</h3>
              <p className="text-lg text-gray-400 mb-12 max-w-md mx-auto">
                Check out these popular items instead
              </p>
              <Link
                to="/"
                className="load-more-btn inline-flex items-center text-lg"
              >
                Browse Marketplace
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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