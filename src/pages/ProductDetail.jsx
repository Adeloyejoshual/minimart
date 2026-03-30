import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ProductDetailHeader from "../components/ProductDetailHeader"; // ✅ header with back & share
import BottomNav from "../components/BottomNav";
import "../styles/ProductDetail.css";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [activeImage, setActiveImage] = useState("");
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [sellerProducts, setSellerProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ================= FETCH PRODUCT =================
  useEffect(() => {
    const controller = new AbortController();

    async function fetchProduct() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `https://minimart-ivrm.onrender.com/api/product/${id}`,
          { signal: controller.signal }
        );

        if (!res.ok) throw new Error("Failed to fetch product");

        const data = await res.json();

        setProduct(data.product || null);
        setRelatedProducts(data.related || []);
        setSellerProducts(data.sellerProducts || []);

        const imgs = Array.isArray(data.product?.images) ? data.product.images : [];
        setActiveImage(imgs[0] || "");
      } catch (err) {
        if (err.name !== "AbortError") setError("Unable to load product");
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
    return () => controller.abort();
  }, [id]);

  // ================= HELPERS =================
  const navigateToSeller = () => {
    if (product?.seller?.id) {
      navigate(`/seller/${product.seller.id}`);
    }
  };

  const getLocation = () =>
    `${product?.location?.state || ""} ${product?.location?.city || ""}`.trim() || "Nigeria";

  const formatKey = (key) =>
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const openContact = () => {
    const contact = product?.contact || {};
    if (contact.whatsapp) window.open(`https://wa.me/${contact.whatsapp}`, "_blank");
    else if (contact.phone) window.location.href = `tel:${contact.phone}`;
  };

  const hasValue = (v) => {
    if (v === null || v === undefined) return false;
    if (typeof v === "string" && v.trim() === "") return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  };

  const filteredAttributes = Object.entries(product?.attributes || {}).filter(([_, v]) =>
    hasValue(v)
  );

  // ================= LOADING / ERROR STATES =================
  if (loading)
    return (
      <>
        <ProductDetailHeader title="Loading..." />
        <div className="product-detail">Loading product...</div>
        <BottomNav />
      </>
    );

  if (error)
    return (
      <>
        <ProductDetailHeader title="Error" />
        <div className="product-detail">{error}</div>
        <BottomNav />
      </>
    );

  if (!product)
    return (
      <>
        <ProductDetailHeader title="Not Found" />
        <div className="product-detail">Product not found</div>
        <BottomNav />
      </>
    );

  // ================= RENDER =================
  return (
    <>
      <ProductDetailHeader title={product.title} />

      <div className="product-detail">

        {/* ================= IMAGES ================= */}
        <div className="image-section">
          <img
            src={activeImage || "https://via.placeholder.com/400"}
            alt={product.title}
            className="main-img"
          />

          <div className="thumbnails">
            {product.images.map((img, i) => (
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
          <h1 className="title">{product.title}</h1>
          <h2 className="price">₦{Number(product.price || 0).toLocaleString()}</h2>
          <p className="location">📍 {getLocation()}</p>
          {product.category?.name && (
            <p className="category">
              Category: <strong>{product.category.name}</strong>
            </p>
          )}
          <p className="description">{product.description || "No description available"}</p>

          {/* ================= SELLER ================= */}
          {product.seller?.id && (
            <div className="seller" onClick={navigateToSeller} style={{ cursor: "pointer" }}>
              <img
                src={product.seller.avatar || "https://via.placeholder.com/50"}
                alt={product.seller.name}
                className="seller-avatar"
              />
              <span className="seller-name">{product.seller.name}</span>
            </div>
          )}

          {/* ================= SPECIFICATIONS ================= */}
          {filteredAttributes.length > 0 && (
            <div className="attributes">
              <h3>Specifications</h3>
              <div className="attr-grid">
                {filteredAttributes.map(([key, value]) => (
                  <div key={key} className="attr-item">
                    <span className="attr-key">{formatKey(key)}</span>
                    <span className="attr-value">{Array.isArray(value) ? value.join(", ") : value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= DELIVERY ================= */}
          {product.delivery?.available && (
            <div className="delivery">
              <h3>Delivery</h3>
              <p><strong>Type:</strong> {product.delivery.type}</p>
              {product.delivery.type === "fixed" && (
                <p><strong>Fee:</strong> ₦{Number(product.delivery.fee || 0).toLocaleString()}</p>
              )}
              {product.delivery.note && <p><strong>Note:</strong> {product.delivery.note}</p>}
            </div>
          )}

          {/* ================= CONTACT ================= */}
          {(product.contact?.phone || product.contact?.whatsapp) && (
            <div className="contact">
              <h3>Seller Contact</h3>
              {product.contact.phone && <p>📞 {product.contact.phone}</p>}
              {product.contact.whatsapp && <p>💬 {product.contact.whatsapp}</p>}
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