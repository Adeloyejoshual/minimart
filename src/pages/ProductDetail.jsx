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
  const [error, setError] = useState(null);

  /* ================= FETCH ================= */
  useEffect(() => {
    const controller = new AbortController();

    async function fetchProduct() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `https://minimart-ivrm.onrender.com/api/marketplace/products/${id}`,
          { signal: controller.signal }
        );

        if (!res.ok) throw new Error("Failed to fetch product");

        const data = await res.json();

        setProduct(data);

        const imgs = Array.isArray(data.images) ? data.images : [];
        setActiveImage(imgs[0] || "");
      } catch (err) {
        if (err.name !== "AbortError") {
          setError("Unable to load product");
        }
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
    return () => controller.abort();
  }, [id]);

  /* ================= HELPERS ================= */
  const getLocation = () =>
    `${product?.location?.state || ""} ${product?.location?.city || ""}`.trim() ||
    "Nigeria";

  const formatKey = (key) =>
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const openContact = () => {
    const contact = product?.contact || {};

    if (contact.whatsapp) {
      window.open(`https://wa.me/${contact.whatsapp}`, "_blank");
    } else if (contact.phone) {
      window.location.href = `tel:${contact.phone}`;
    }
  };

  /* ================= STATES ================= */
  if (loading)
    return (
      <>
        <TopNav />
        <div className="product-detail">Loading product...</div>
        <BottomNav />
      </>
    );

  if (error)
    return (
      <>
        <TopNav />
        <div className="product-detail">{error}</div>
        <BottomNav />
      </>
    );

  if (!product)
    return (
      <>
        <TopNav />
        <div className="product-detail">Product not found</div>
        <BottomNav />
      </>
    );

  /* ================= DATA ================= */
  const images = Array.isArray(product.images) ? product.images : [];
  const attributes = product.attributes || {};
  const delivery = product.delivery || {};
  const contact = product.contact || {};

  const category = {
    name: product.category_name,
    dynamicFields: product.category_fields || []
  };

  const dynamicFields = category.dynamicFields;

  /* ================= FILTER ATTRIBUTES ================= */
  const hasValue = (v) => {
    if (v === null || v === undefined) return false;
    if (typeof v === "string" && v.trim() === "") return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  };

  const filteredAttributes = Object.entries(attributes).filter(([_, v]) =>
    hasValue(v)
  );

  /* ================= RENDER ================= */
  return (
    <>
      <TopNav />

      <div className="product-detail">

        {/* ================= IMAGES ================= */}
        <div className="image-section">
          <img
            src={activeImage || "https://via.placeholder.com/400"}
            alt={product.title}
            className="main-img"
          />

          <div className="thumbnails">
            {images.map((img, i) => (
              <img
                key={i}
                src={img}
                onClick={() => setActiveImage(img)}
                className={activeImage === img ? "active" : ""}
              />
            ))}
          </div>
        </div>

        {/* ================= DETAILS ================= */}
        <div className="details-section">

          <h1>{product.title}</h1>

          <h2>₦{Number(product.price || 0).toLocaleString()}</h2>

          <p className="location">📍 {getLocation()}</p>

          {category.name && (
            <p className="category">
              Category: <strong>{category.name}</strong>
            </p>
          )}

          <p className="desc">
            {product.description || "No description available"}
          </p>

          {/* ================= SPECIFICATIONS (DYNAMIC + CLEAN) ================= */}
          {filteredAttributes.length > 0 && (
            <div className="attributes">
              <h3>Specifications</h3>

              <div className="attr-grid">
                {filteredAttributes.map(([key, value]) => {
                  const displayValue = Array.isArray(value)
                    ? value.join(", ")
                    : value;

                  return (
                    <div key={key} className="attr-item">
                      <span className="attr-key">{formatKey(key)}</span>
                      <span className="attr-value">{displayValue}</span>
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
                <p>
                  <strong>Fee:</strong> ₦{Number(delivery.fee || 0).toLocaleString()}
                </p>
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
              {contact.whatsapp && <p>💬 {contact.whatsapp}</p>}
            </div>
          )}

          <button className="contact-btn" onClick={openContact}>
            Contact Seller
          </button>

        </div>
      </div>

      <BottomNav />
    </>
  );
}