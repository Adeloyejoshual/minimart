// src/components/ProductDetail.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

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

  // Only text labels, no icons
  const attributeConfig = useMemo(() => ({
    category: { label: 'Category' },
    brand: { label: 'Brand' },
    condition: { label: 'Condition' },
    ram: { label: 'RAM' },
    storage: { label: 'Storage' },
    sim: { label: 'SIM' },
    features: { label: 'Features' },
    color: { label: 'Color' },
    warranty: { label: 'Warranty' },
    model: { label: 'Model' }
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
  }), [
    product?.contact?.phone,
    product?.contact?.whatsapp,
    cleanPhoneNumber
  ]);

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
          <h3 className="mini-title">Product Specifications</h3>
        </div>
        <div className="attributes-grid">
          {validAttributes.map(([key, value]) => {
            const { label } = attributeConfig[key];
            return (
              <div key={key} className="attribute-item">
                <div className="attribute-label text-xs font-medium uppercase text-gray-600">
                  {label}
                </div>
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
      <div className="error-state">
        <div className="error-content">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {error}
          </h2>
          <Link to="/" className="btn">
            Browse Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="product-detail-page">
      <ProductHeader
        product={product}
        similarProductsCount={similarProducts.length}
        reviewStats={reviewStats}
        onFavorite={handleFavorite}
        isFavorited={isFavorited}
      />

      <div className="homepage-container product-detail-container">
        {/* MAIN GRID – Images first, then info */}
        <div className="main-grid">
          {/* LEFT – Product Images First */}
          <div className="gallery-section">
            <div className="gallery">
              {/* Main image */}
              <div className="main-image-container">
                <img
                  src={product.images?.[0] || '/api/placeholder/600/400'}
                  alt={product.title}
                  className="main-image"
                  onError={(e) => { e.target.src = '/api/placeholder/600/400'; }}
                />
              </div>

              {/* Thumbnail strip – small under main image */}
              {product.images?.length > 1 && (
                <div className="thumbnail-scroll">
                  {product.images.slice(1, 9).map((img, idx) => (
                    <div key={idx} className="thumbnail-item">
                      <div className="card">
                        <img
                          src={img}
                          alt={`${product.title} ${idx + 2}`}
                          className="w-full h-full object-cover rounded-lg"
                          onError={(e) => { e.target.src = '/api/placeholder/120/96'; }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT – Product info */}
          <div className="product-info">
            <h1 className="product-title">{product.title}</h1>

            {/* Status */}
            <div className="product-meta">
              <span className={`status-badge ${
                product.status === 'active' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'
              }`}>
                {product.status?.toUpperCase()}
              </span>
            </div>

            {/* Price */}
            <div className="price-specs-card card">
              <div className="product-price">₦{Number(product.price || 0).toLocaleString()}</div>
            </div>

            {/* Location – state + state (state + city) */}
            <div className="location-display">
              <div className="font-bold text-lg text-gray-900">{product.location_state}</div>
              <div className="text-sm text-gray-600">{product.location_city}</div>
            </div>

            {/* Specs (attributes) */}
            {renderAttributes}

            {/* Full description */}
            {product.description && (
              <div className="description-section">
                <h3 className="text-xl font-bold text-gray-900">Product Details</h3>
                <p className="text-gray-700 text-lg leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="action-buttons">
              <button className="action-btn whatsapp-btn">Chat with Seller</button>
              <button
                onClick={handleFavorite}
                className="action-btn"
              >
                {isFavorited ? '★ Favorited' : '☆ Save'}
              </button>
            </div>
          </div>
        </div>

        {/* REVIEWS */}
        <div className="reviews-card card">
          <div className="reviews-header">
            <h2>Reviews & Ratings</h2>
            {reviewStats && (
              <div className="reviews-stats">
                <span>{Number(reviewStats.avg_rating || 0).toFixed(1)} ★</span>
                <span>{reviewStats.total_reviews} Reviews</span>
              </div>
            )}
          </div>

          <div className="review-list">
            {reviewsLoading ? (
              <div className="p-10">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="mb-6 p-6 bg-white rounded-2xl shadow">
                    <div className="h-4 w-40 bg-gray-200 rounded mb-3"></div>
                    <div className="h-3 w-60 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 w-52 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : reviews.length === 0 ? (
              <div className="empty-state">No reviews yet.</div>
            ) : (
              reviews.map((review, idx) => (
                <div key={idx} className="review-card card">
                  <div className="reviewer-avatar">
                    {review.reviewer_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="review-header">
                      <span className="font-bold">{review.reviewer_name || 'Anonymous'}</span>
                      <span>{new Date(review.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star} style={{ color: star <= review.rating ? '#fbbf24' : '#d1d5db' }}>
                          ★
                        </span>
                      ))}
                    </div>
                    <p>{review.comment}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SIMILAR PRODUCTS – first image big, others small under */}
        <div className="similar-card card">
          <div className="similar-header">
            <h2>Similar Products ({similarProducts.length})</h2>
          </div>

          <div className="similar-grid">
            {similarLoading && similarProducts.length === 0 ? (
              <>
                {Array.from({ length: 12 }, (_, i) => (
                  <div key={i} className="similar-skeleton skeleton h-80 rounded-2xl animate-pulse"></div>
                ))}
              </>
            ) : (
              similarProducts.map((item) => (
                <Link
                  key={item.id}
                  to={`/product/${item.slug}`}
                  className="similar-card card"
                >
                  {/* First image big */}
                  <div className="card-image">
                    <img
                      src={item.images?.[0] || '/api/placeholder/400/300'}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.src = '/api/placeholder/400/300'; }}
                    />
                  </div>

                  {/* Other small images under */}
                  {item.images?.length > 1 && (
                    <div className="flex gap-1 mt-2">
                      {item.images.slice(1, 4).map((thumb, idx) => (
                        <img
                          key={idx}
                          src={thumb || '/api/placeholder/60/60'}
                          alt={`${item.title} thumb ${idx + 1}`}
                          className="w-8 h-8 object-cover rounded-md"
                          onError={(e) => { e.target.src = '/api/placeholder/60/60'; }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Title + state + state */}
                  <div className="mt-2">
                    <div className="title text-sm font-bold text-gray-900 mb-1">
                      {item.title}
                    </div>
                    <div className="text-xs text-gray-600 font-semibold">
                      {item.location_state}
                    </div>
                    <div className="text-xs text-gray-500">
                      {item.location_city}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Infinite scroll trigger */}
          {hasMoreSimilar && (
            <div ref={similarEndRef} className="infinite-scroll-trigger">
              {similarLoading ? (
                <div className="skeleton h-10 w-40 mx-auto my-4"></div>
              ) : (
                <button
                  onClick={() => fetchSimilarProducts(similarPage + 1, true)}
                  className="w-full px-4 py-3 text-sm font-bold text-white bg-indigo-600 rounded-lg"
                >
                  Load More Products
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="product-footer">
          <div className="footer-content">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Browse Categories</h3>
                <ul className="space-y-2">
                  <li><Link to="/category/electronics">Electronics</Link></li>
                  <li><Link to="/category/clothing">Fashion</Link></li>
                  <li><Link to="/category/homes">Home & Appliances</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Support</h3>
                <ul className="space-y-2">
                  <li><Link to="/help">Help Center</Link></li>
                  <li><Link to="/terms">Terms & Policies</Link></li>
                  <li><Link to="/contact">Contact Us</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Company</h3>
                <ul className="space-y-2">
                  <li><Link to="/about">About Minimart</Link></li>
                  <li><Link to="/blog">Blog</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Follow Us</h3>
                <div className="flex gap-4">
                  <Link to="#">Twitter</Link>
                  <Link to="#">Instagram</Link>
                  <Link to="#">Facebook</Link>
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