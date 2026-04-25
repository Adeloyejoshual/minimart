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

  // --- NEW: Review form state ---
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [formData, setFormData] = useState({ rating: 5, comment: "" });
  const [formError, setFormError] = useState("");

  const cleanPhoneNumber = useCallback((phone) => {
    return phone ? phone.replace(/[^+d]/g, '') : '';
  }, []);

  // Only text labels, no icons
  const attributeConfig = useMemo(() => ({
    category: { label: 'Category' },
    brand:  { label: 'Brand' },
    condition: { label: 'Condition' },
    ram:    { label: 'RAM' },
    storage: { label: 'Storage' },
    sim:    { label: 'SIM' },
    features: { label: 'Features' },
    color:  { label: 'Color' },
    warranty: { label: 'Warranty' },
    model:  { label: 'Model' }
  }), []);

  // Simple 5‑star rating picker
  const StarRating = ({ value, onChange }) => {
    return (
      <div className="text-xl flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`focus:outline-none ${star <= value ? 'text-yellow-500' : 'text-gray-300'}`}
          >
            ★
          </button>
        ))}
      </div>
    );
  };

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

  // --- NEW: Seller profile click ---
  const handleSellerClick = useCallback(() => {
    if (sellerStats?.seller_id) {
      navigate(`/seller/${sellerStats.seller_id}`);
    }
  }, [sellerStats?.seller_id, navigate]);

  // --- NEW: Review form submit ---
  const handleSubmitReview = useCallback(async (e) => {
    e.preventDefault();
    if (!formData.rating || formData.rating < 1 || formData.rating > 5) {
      setFormError("Please choose a rating between 1 and 5.");
      return;
    }
    if (!formData.comment.trim()) {
      setFormError("Comment cannot be empty.");
      return;
    }

    try {
      setFormError("");

      // Replace this URL with your real review API
      const response = await fetch(`/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          rating: formData.rating,
          comment: formData.comment.trim()
        })
      });

      if (response.ok) {
        fetchReviews();
        setFormData({ rating: 5, comment: "" });
        setShowReviewForm(false);
      } else {
        const err = await response.json();
        setFormError(err.message || "Failed to submit review.");
      }
    } catch (err) {
      setFormError("Network error. Please try again.");
    }
  }, [product, formData, fetchReviews]);

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
          <h2 className="text-3xl font-bold text-gray-900 mb-4">{error}</h2>
          <Link to="/" className="btn">Browse Marketplace</Link>
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
        onSellerClick={handleSellerClick}
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
              <div className="product-price">
                ₦{Number(product.price || 0).toLocaleString()}
              </div>
            </div>

            {/* Location – state + city */}
            <div className="location-display">
              <div className="font-bold text-lg text-gray-900">
                {product.location_state || "Nigeria"}
              </div>
              <div className="text-sm text-gray-600">
                {product.location_city || "Any city"}
              </div>
            </div>

            {/* Seller badge (clickable to SellerProfile) */}
            {sellerStats && (
              <div
                className="seller-badge mt-4 p-4 bg-indigo-50 rounded-xl cursor-pointer border border-indigo-200 flex items-center gap-3"
                onClick={handleSellerClick}
              >
                <div className="w-12 h-12 rounded-full bg-indigo-300 flex items-center justify-center text-lg font-bold">
                  {sellerStats.seller_name?.charAt(0)?.toUpperCase() ||
                   sellerStats.seller_email?.charAt(0)?.toUpperCase() ||
                   'U'}
                </div>
                <div>
                  <div className="font-bold text-gray-900">
                    {sellerStats.seller_name || sellerStats.seller_email || "Unknown Seller"}
                  </div>
                  <div className="text-sm text-gray-600">
                    {sellerStats.total_reviews} reviews • {Number(sellerStats.avg_rating || 0).toFixed(1)} ★
                  </div>
                </div>
              </div>
            )}

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
            <div className="action-buttons mt-4 flex flex-col sm:flex-row gap-3">
              <button
                className="action-btn whatsapp-btn"
                onClick={() => {
                  if (contactInfo.whatsapp) {
                    window.open(`https://wa.me/${contactInfo.whatsapp}`, '_blank');
                  }
                }}
              >
                Chat with Seller
              </button>
              <button
                onClick={handleFavorite}
                className="action-btn"
              >
                {isFavorited ? '★ Favorited' : '☆ Save'}
              </button>
            </div>

            {/* --- NEW: Review + rating UI --- */}
            <div className="mt-6">
              {showReviewForm ? (
                <div className="review-form-card card p-4">
                  <h3 className="text-lg font-bold mb-3">Write a review</h3>
                  <form onSubmit={handleSubmitReview}>
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Your rating
                      </label>
                      <StarRating
                        value={formData.rating}
                        onChange={(r) => setFormData(prev => ({ ...prev, rating: r }))}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Your comment
                      </label>
                      <textarea
                        value={formData.comment}
                        onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
                        rows={4}
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                        placeholder="Share your experience with this product..."
                      />
                    </div>
                    {formError && (
                      <div className="text-sm text-red-600 mb-3">{formError}</div>
                    )}
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
                      >
                        Submit Review
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowReviewForm(false);
                          setFormError("");
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <button
                  className="text-indigo-600 hover:underline text-sm"
                  onClick={() => setShowReviewForm(true)}
                >
                  ✍️ Write a review
                </button>
              )}
            </div>
          </div>
        </div>

        {/* REVIEWS */}
        <div className="reviews-card card mt-6">
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
              <div className="empty-state p-6 text-center">
                No reviews yet.
              </div>
            ) : (
                        reviews.map((review, idx) => (
            <div key={idx} className="review-card card mb-4">
              <div className="reviewer-avatar">
                {review.reviewer_name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div>
                <div className="review-header">
                  <span className="font-bold">
                    {review.reviewer_name || 'Anonymous'}
                  </span>
                  <span>{new Date(review.created_at).toLocaleDateString()}</span>
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      style={{
                        color: star <= review.rating ? '#fbbf24' : '#d1d5db'
                      }}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <p className="text-gray-700">{review.comment}</p>
              </div>
            </div>
          ))