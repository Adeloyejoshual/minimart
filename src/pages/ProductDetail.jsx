// src/pages/ProductDetail.jsx - ENTERPRISE PRODUCTION v2.4 (PERFORMANCE + 12 RELATED)
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/ProductDetail.css";

const API_BASE = "https://minimart-ivrm.onrender.com/api/marketplace";
const REQUEST_TIMEOUT = 10000;

axios.defaults.timeout = REQUEST_TIMEOUT;

export default function ProductDetail({ user }) {
  const { slug, id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);

  const productId = id || slug;

  const fetchProduct = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data } = await axios.get(`${API_BASE}/products/${productId}`);
      setProduct(data);
      
      // ✅ SHOW MORE: Fetch 12 related products
      const relatedRes = await axios.get(`${API_BASE}/products/related/${productId}?limit=12`);
      setRelatedProducts(relatedRes.data || []);
    } catch (err) {
      console.error("Product fetch failed:", err);
      setError("Product not found");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [fetchProduct]);

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0
    }).format(amount || 0);
  }, []);

  // ✅ FIXED: Proper whitespace regex + industry standard slugify [web:58][web:61]
  const generateSlug = useCallback((title) => {
    if (!title) return '';
    return title
      .toString()
      .toLowerCase()
      .trim()
      // Remove accents/diacritics first
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      // Remove special characters except word chars, spaces, hyphens
      .replace(/[^ws-]/g, '')
      // Replace whitespace with hyphens
      .replace(/s+/g, '-')
      // Clean up duplicate hyphens
      .replace(/-+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-|-$/g, '');
  }, []);

  const goBack = () => navigate(-1);
  const addToCart = () => console.log("Add to cart:", productId);
  const toggleWishlist = () => console.log("Toggle wishlist:", productId);

  // ✅ PERFORMANCE: Memoize related products display
  const displayedRelatedProducts = useMemo(() => 
    relatedProducts.slice(0, 12), 
    [relatedProducts]
  );

  if (loading) {
    return (
      <div className="product-detail-page">
        <TopNav user={user} />
        <div className="product-detail-skeleton">
          <div className="skeleton-hero">
            <div className="skeleton-image-large"></div>
            <div className="skeleton-info">
              <div className="skeleton-title-large"></div>
              <div className="skeleton-price-large"></div>
              <div className="skeleton-description"></div>
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="product-detail-page">
        <TopNav user={user} />
        <div className="error-state">
          <div className="error-icon">📦</div>
          <h2>Product Not Found</h2>
          <p>The product you're looking for doesn't exist or has been removed.</p>
          <button onClick={goBack} className="back-btn">← Back to Products</button>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="product-detail-page">
      <TopNav user={user} />
      
      <section className="product-hero">
        <div className="hero-image">
          {/* ✅ RESPONSIVE IMAGES: srcset for bandwidth optimization */}
          <img 
            src={product.image || '/placeholder-product.png'}
            srcSet={`
              ${product.image}?w=300 300w,
              ${product.image}?w=500 500w,
              ${product.image}?w=800 800w
            `}
            sizes="(max-width: 768px) 300px, (max-width: 1200px) 500px, 800px"
            alt={product.title || 'Product'}
            loading="lazy"
            decoding="async"
            width="500"
            height="375"
            onError={(e) => e.currentTarget.src = '/placeholder-product.png'}
          />
        </div>
        <div className="hero-content">
          <button onClick={goBack} className="back-button" aria-label="Go back">← Back</button>
          <h1 className="product-title">{product.title}</h1>
          <div className="product-price">{formatCurrency(product.price)}</div>
          
          <div className="product-stock">
            {product.stock !== undefined 
              ? (product.stock > 0 ? `In Stock: ${product.stock}` : 'Out of Stock') 
              : 'Stock not specified'
            }
          </div>
          
          <div className="product-actions">
            <button 
              className="primary-cta" 
              onClick={addToCart}
              disabled={product.stock === 0}
              aria-label="Add to cart"
            >
              🛒 {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
            </button>
            <button 
              className="secondary-cta" 
              onClick={toggleWishlist}
              aria-label="Add to wishlist"
            >
              ♡ Wishlist
            </button>
          </div>
        </div>
      </section>

      <section className="product-details">
        <div className="details-grid">
          <div className="detail-section">
            <h2>Description</h2>
            <div className="product-description">{product.description}</div>
          </div>
          
          {product.seller && (
            <div className="seller-info">
              <h3>Seller Information</h3>
              <div className="seller-details">
                <div className="seller-avatar">👤</div>
                <div>
                  <div className="seller-name">{product.seller.name}</div>
                  <div className="seller-rating">★★★★☆ (124 reviews)</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ✅ 12 RELATED PRODUCTS */}
      {displayedRelatedProducts.length > 0 && (
        <section className="related-products">
          <h2 className="section-title">You might also like ({displayedRelatedProducts.length})</h2>
          <div className="related-grid">
            {displayedRelatedProducts.map((related) => (
              <article 
                key={related.id || related._id}
                className="related-card"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/product/${generateSlug(related.title)}/${related.id || related._id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/product/${generateSlug(related.title)}/${related.id || related._id}`)}
              >
                <img 
                  src={related.image || '/placeholder-product.png'}
                  alt={related.title}
                  className="related-image"
                  loading="lazy"
                />
                <div className="related-info">
                  <h3 className="related-title">{related.title}</h3>
                  <div className="related-price">{formatCurrency(related.price)}</div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <BottomNav />
    </div>
  );
}