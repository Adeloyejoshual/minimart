// pages/ProductDetail.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

import ProductHeader from "../components/ProductHeader";
import "../styles/ProductDetail.css";

const ProductDetail = () => {
  const { slug } = useParams();
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
    return phone ? phone.replace(/[^d+]/g, "") : "";
  }, []);

  const attributeConfig = useMemo(
    () => ({
      category: { label: "Category" },
      brand: { label: "Brand" },
      condition: { label: "Condition" },
      ram: { label: "RAM" },
      storage: { label: "Storage" },
      sim: { label: "SIM" },
      features: { label: "Features" },
      color: { label: "Color" },
      warranty: { label: "Warranty" },
      model: { label: "Model" }
    }),
    []
  );

  useEffect(() => {
    if (!slug || slug === "undefined") {
      setError("Invalid product slug");
      setLoading(false);
      return;
    }

    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/product/slug/${slug}`);
        if (!response.ok) {
          if (response.status === 404) throw new Error("Product not found");
          throw new Error("Failed to fetch product");
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

  const fetchSimilarProducts = useCallback(
    async (page = 1, append = false) => {
      if (!product) return;
      setSimilarLoading(true);
      try {
        let url = `/api/homepage?limit=12&page=${page}`;
        if (product.attributes?.brand) {
          url = `/api/homepage?brand=${encodeURIComponent(
            product.attributes.brand
          )}&limit=12&page=${page}&exclude=${product.id}`;
        }
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          const newProducts = (data.latest || data.recommended || []).filter(
            (p) => p.id !== product.id && p.slug !== slug
          );
          if (append) {
            setSimilarProducts((prev) => [...prev, ...newProducts]);
          } else {
            setSimilarProducts(newProducts);
          }
          setHasMoreSimilar(newProducts.length === 12);
          setSimilarPage(page);
        }
      } catch (err) {
        console.error("Related products fetch failed:", err);
      } finally {
        setSimilarLoading(false);
      }
    },
    [product, slug]
  );

  const fetchSellerStats = useCallback(async () => {
    const sellerId = product?.seller?.id;
    if (!sellerId) return;
    try {
      const response = await fetch(`/api/seller/${sellerId}/stats`);
      if (response.ok) {
        const data = await response.json();
        setSellerStats(data);
      }
    } catch (err) {
      console.error("Seller stats fetch failed:", err);
    }
  }, [product?.seller?.id]);

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
      console.error("Reviews fetch failed:", err);
    } finally {
      setReviewsLoading(false);
    }
  }, [slug]);

  const trackView = useCallback(async () => {
    if (product?.id) {
      try {
        await fetch(`/api/homepage/products/${product.id}/view`, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        console.error("View tracking failed:", err);
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

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreSimilar && !similarLoading) {
          fetchSimilarProducts(similarPage + 1, true);
        }
      },
      { threshold: 0.1 }
    );
    if (similarEndRef.current) observer.observe(similarEndRef.current);
    return () => observer.disconnect();
  }, [similarPage, hasMoreSimilar, similarLoading, fetchSimilarProducts]);

  const contactInfo = useMemo(
    () => ({
      phone: cleanPhoneNumber(product?.contact?.phone),
      whatsapp: cleanPhoneNumber(product?.contact?.whatsapp)
    }),
    [product?.contact?.phone, product?.contact?.whatsapp, cleanPhoneNumber]
  );

  const handleFavorite = useCallback(() => setIsFavorited(!isFavorited), [isFavorited]);

  const renderAttributes = useMemo(() => {
    if (!product?.attributes) return null;
    const validAttributes = Object.entries(product.attributes).filter(
      ([key, value]) => value && attributeConfig[key]
    );
    if (validAttributes.length === 0) return null;
    return (
      <div className="attributes-section">
        <div className="section-header">
          <h3 className="mini-title">Product Specifications</h3>
        </div>
        <div className="attributes-grid">
          {validAttributes.map(([key, value]) => (
            <div key={key} className="attribute-item">
              <div className="attribute-label text-xs font-medium uppercase text-gray-600">
                {attributeConfig[key].label}
              </div>
              <div className="attribute-value font-bold text-lg">
                {Array.isArray(value) ? value.join(", ") : String(value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }, [product?.attributes, attributeConfig]);

  if (loading) return <div className="loading-skeleton">Loading product...</div>;

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
      />

      <div className="homepage-container product-detail-container">
        <div className="main-grid">
          <div className="gallery-section">
            <div className="gallery">
              <div className="main-image-container">
                <img
                  src={product.images?.[0] || "/api/placeholder/600/400"}
                  alt={product.title}
                  className="main-image"
                  onError={(e) => { e.target.src = "/api/placeholder/600/400"; }}
                />
              </div>
            </div>
          </div>

          <div className="product-info">
            <h1 className="product-title">{product.title}</h1>
            
            {sellerStats && (
              <div className="seller-card card mt-6 p-5 border border-gray-100 rounded-2xl bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center font-bold text-white text-xl">
                      {product.seller?.name?.charAt(0)?.toUpperCase() || "S"}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg">
                        {product.seller?.store_name || product.seller?.name || "Marketplace Seller"}
                      </h4>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{sellerStats.total_listings} active ads</span>
                        <span className="text-yellow-600 font-bold">★ {Number(sellerStats.avg_rating || 0).toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                  <Link
                    to={`/seller/${product.seller?.id}`}
                    className="px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-lg hover:bg-indigo-100 transition"
                  >
                    View Profile
                  </Link>
                </div>
              </div>
            )}

            <div className="price-specs-card card mt-4">
              <div className="product-price">₦{Number(product.price || 0).toLocaleString()}</div>
            </div>
            
            {renderAttributes}
            
            {product.description && (
              <div className="description-section">
                <h3 className="text-xl font-bold text-gray-900">Product Details</h3>
                <p className="text-gray-700 text-lg leading-relaxed">{product.description}</p>
              </div>
            )}
            
            <div className="action-buttons">
              {contactInfo.whatsapp && (
                <a
                  href={`https://wa.me/${contactInfo.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="action-btn whatsapp-btn"
                >
                  Chat on WhatsApp
                </a>
              )}
              <button onClick={handleFavorite} className="action-btn">
                {isFavorited ? "★ Favorited" : "☆ Save"}
              </button>
            </div>
          </div>
        </div>

        {/* Similar Products and Footer sections... */}
      </div>
    </div>
  );
};

export default ProductDetail;