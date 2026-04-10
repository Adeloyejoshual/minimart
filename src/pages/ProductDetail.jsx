/* ================= FINAL UPGRADED ProductDetail.js (CSS VERSION) ================= */
import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/ProductDetail.css"; // ✅ EXTERNAL CSS

const API_BASE = import.meta.env.VITE_API_BASE || "https://minimart-ivrm.onrender.com";

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();

  // States
  const [product, setProduct] = useState(null);
  const [mainImage, setMainImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(false);
  const [related, setRelated] = useState([]);

  /* ================= FETCH PRODUCT (CACHED API) ================= */
  useEffect(() => {
    if (!slug) return;

    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await axios.get(`${API_BASE}/api/products/${slug}`, {
          headers: { "Cache-Control": "no-cache" } // Force fresh on first load
        });

        if (!res.data?.success || !res.data.product) {
          throw new Error("Product not found");
        }

        setProduct(res.data.product);
      } catch (err) {
        setError(
          err.response?.data?.message || 
          err.message || 
          "Failed to load product"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [slug]);

  /* ================= FETCH RELATED PRODUCTS ================= */
  useEffect(() => {
    if (!product?.id) return;

    const fetchRelated = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/products/${product.id}/related`);
        setRelated(res.data?.products || []);
      } catch (err) {
        console.log("Related products fetch failed:", err.message);
      }
    };

    fetchRelated();
  }, [product?.id]);

  /* ================= IMAGE PROCESSING ================= */
  const images = useMemo(() => {
    if (!product?.images) return [];

    let imgs = product.images;
    
    // Handle stringified JSON from backend
    if (typeof imgs === "string") {
      try {
        imgs = JSON.parse(imgs);
      } catch {
        imgs = [];
      }
    }

    if (!Array.isArray(imgs)) return [];

    // Filter valid URLs only
    return imgs
      .filter(img => img && typeof img === 'string')
      .slice(0, 10); // Max 10 images
  }, [product?.images]);

  // Set main image
  useEffect(() => {
    if (images.length > 0 && !mainImage) {
      setMainImage(images[0]);
    }
  }, [images, mainImage]);

  /* ================= WHATSAPP LINK ================= */
  const whatsappLink = useMemo(() => {
    if (!product?.whatsapp && product?.contact) {
      // Fallback if backend didn't provide it
      const phone = product.contact.replace(/D/g, "");
      return `https://wa.me/${phone}?text=Hi%20I'm%20interested%20in%20${encodeURIComponent(product.title)}`;
    }
    return product?.whatsapp || null;
  }, [product]);

  /* ================= LOADING STATE ================= */
  if (loading) {
    return (
      <div className="product-detail-container">
        <div className="skeleton-loading">
          <div className="skeleton-header" />
          <div className="skeleton-grid">
            <div className="skeleton-image-large" />
            <div className="skeleton-details">
              <div className="skeleton-price" />
              <div className="skeleton-text" />
              <div className="skeleton-text-small" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ================= ERROR STATE ================= */
  if (error) {
    return (
      <div className="product-detail-container">
        <div className="error-message">
          <h2>Product Not Found</h2>
          <p>{error}</p>
          <button onClick={() => navigate(-1)} className="btn-secondary">
            ← Back to Products
          </button>
        </div>
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="product-detail-container">
      {/* 🏷️ PRODUCT HEADER */}
      <header className="product-header">
        <div className="product-info">
          <h1 className="product-title">{product.title}</h1>
          <p className="product-meta">
            {product.category_name} {product.subcategory_name && `• ${product.subcategory_name}`}
          </p>
          {product.views && <p className="product-views">👁️ {product.views.toLocaleString()} views</p>}
        </div>

        <div className="seller-actions">
          <button 
            onClick={() => navigate(`/seller/${product.seller_id}`)}
            className="btn-primary"
          >
            👤 View Seller
          </button>
          <button 
            onClick={() => navigate(`/conversations?userId=${product.seller_id}`)}
            className="btn-outline"
          >
            💬 Message
          </button>
        </div>
      </header>

      {/* 📱 MAIN CONTENT GRID */}
      <div className="product-main-grid">
        {/* 🖼️ IMAGES SECTION */}
        <div className="images-section">
          <div className="main-image-container">
            {mainImage ? (
              <img
                src={mainImage}
                alt={product.title}
                className="main-image"
                onClick={() => setZoom(true)}
                loading="lazy"
              />
            ) : (
              <div className="no-image">No Image Available</div>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="thumbnails-container">
              {images.map((img, index) => (
                <img
                  key={index}
                  src={img}
                  alt={`${product.title} ${index + 1}`}
                  className={`thumbnail ${mainImage === img ? 'active' : ''}`}
                  onClick={() => setMainImage(img)}
                  loading="lazy"
                />
              ))}
            </div>
          )}
        </div>

        {/* ℹ️ PRODUCT DETAILS */}
        <div className="details-section">
          <div className="price-container">
            <h2 className="price">₦{Number(product.price).toLocaleString()}</h2>
          </div>

          <div className="description">
            <h3>Description</h3>
            <p>{product.description || "No description available."}</p>
          </div>

          <div className="seller-info">
            <h4>Seller: {product.seller_name}</h4>
            {product.location_state && (
              <p>📍 {product.location_state}, {product.location_city}</p>
            )}
          </div>

          {/* 💬 WHATSAPP BUTTON */}
          {whatsappLink && (
            <a 
              href={whatsappLink} 
              target="_blank" 
              rel="noreferrer noopener"
              className="whatsapp-button"
            >
              💬 Chat Seller on WhatsApp
            </a>
          )}

          {/* 🚚 DELIVERY INFO */}
          {product.delivery && (
            <div className="delivery-info">
              <h4>Delivery</h4>
              <p>{JSON.stringify(product.delivery)}</p>
            </div>
          )}
        </div>
      </div>

      {/* 🔗 RELATED PRODUCTS */}
      {related.length > 0 && (
        <section className="related-section">
          <h2>Related Products</h2>
          <div className="related-grid">
            {related.map((item) => (
              <div
                key={item.id}
                className="related-card"
                onClick={() => navigate(`/product/${item.slug}`)}
              >
                <img 
                  src={item.image || '/placeholder.jpg'} 
                  alt={item.title}
                  className="related-image"
                  loading="lazy"
                />
                <h4 className="related-title">{item.title}</h4>
                <p className="related-price">₦{Number(item.price).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 🔍 IMAGE ZOOM MODAL (JUMIA STYLE) */}
      {zoom && (
        <div className="zoom-modal" onClick={(e) => e.target === e.currentTarget && setZoom(false)}>
          <img src={mainImage} alt="Zoomed" className="zoom-image" />
          <button className="zoom-close" onClick={() => setZoom(false)}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}