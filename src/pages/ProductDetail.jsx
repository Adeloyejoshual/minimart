import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/ProductDetail.css";

export default function ProductDetail() {
  const { id } = useParams();

  const [product, setProduct] = useState(null);
  const [activeImage, setActiveImage] = useState("");
  const [loading, setLoading] = useState(true);

  /* ================= FETCH PRODUCT ================= */
  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch(
          `https://minimart-ivrm.onrender.com/api/marketplace/products/${id}`
        );
        const data = await res.json();

        setProduct(data);

        const imgs = data.images || [];
        setActiveImage(imgs[0] || "");
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
  }, [id]);

  /* ================= HELPERS ================= */
  const getLocation = () => {
    if (product?.location?.state && product?.location?.city) {
      return `${product.location.state}, ${product.location.city}`;
    }
    return "Nigeria";
  };

  const formatKey = (key) =>
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  /* ================= LOADING ================= */
  if (loading) {
    return (
      <>
        <TopNav />
        <div className="product-detail">
          <p>Loading product...</p>
        </div>
        <BottomNav />
      </>
    );
  }

  if (!product) return <p>Product not found</p>;

  const images = product.images || [];
  const attributes = product.attributes || {};
  const delivery = product.delivery || {};
  const contact = product.contact || {};

  return (
    <>
      <TopNav />

      <div className="product-detail">

        {/* ================= IMAGES ================= */}
        <div className="image-section">
          <div className="main-image">
            <img
              src={activeImage || "https://via.placeholder.com/400"}
              alt={product.title}
            />
          </div>

          <div className="thumbnails">
            {images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt="thumb"
                onClick={() => setActiveImage(img)}
                className={activeImage === img ? "active" : ""}
              />
            ))}
          </div>
        </div>

        {/* ================= DETAILS ================= */}
        <div className="details-section">

          <h1 className="title">{product.title}</h1>

          <div className="price">
            ₦{Number(product.price).toLocaleString()}
          </div>

          <div className="location">
            📍 {getLocation()}
          </div>

          <div className="description">
            {product.description || "No description available"}
          </div>

          {/* ================= ATTRIBUTES ================= */}
          {Object.keys(attributes).length > 0 && (
            <div className="attributes">
              <h3>Product Details</h3>
              <div className="attr-grid">
                {Object.entries(attributes).map(([key, value]) => {
                  if (!value) return null;

                  return (
                    <div key={key} className="attr-item">
                      <span className="attr-key">{formatKey(key)}</span>
                      <span className="attr-value">
                        {Array.isArray(value) ? value.join(", ") : value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= DELIVERY ================= */}
          {delivery?.available && (
            <div className="delivery">
              <h3>Delivery</h3>

              <p><strong>Type:</strong> {delivery.type}</p>

              {delivery.type === "fixed" && (
                <p><strong>Fee:</strong> ₦{Number(delivery.fee || 0).toLocaleString()}</p>
              )}

              {delivery.radius_km > 0 && (
                <p><strong>Coverage:</strong> {delivery.radius_km} km</p>
              )}

              {delivery.estimated_days && (
                <p><strong>Delivery Time:</strong> {delivery.estimated_days} days</p>
              )}

              {delivery.note && (
                <p><strong>Note:</strong> {delivery.note}</p>
              )}
            </div>
          )}

          {/* ================= CONTACT ================= */}
          {(contact.phone || contact.whatsapp) && (
            <div className="contact">
              <h3>Seller Contact</h3>

              {contact.phone && <p>📞 {contact.phone}</p>}
              {contact.whatsapp && <p>💬 WhatsApp: {contact.whatsapp}</p>}
            </div>
          )}

          {/* ================= ACTION ================= */}
          <button className="contact-btn">
            Contact Seller
          </button>

        </div>
      </div>

      <BottomNav />
    </>
  );
}