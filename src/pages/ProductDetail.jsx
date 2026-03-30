// src/pages/ProductDetail.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/ProductDetail.css";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [activeImage, setActiveImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchProduct = async () => {
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

        const imgs = Array.isArray(data.product?.images) ? data.product.images : [];
        setActiveImage(imgs[0] || "");
      } catch (err) {
        if (err.name !== "AbortError") setError("Unable to load product");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
    return () => controller.abort();
  }, [id]);

  const openContact = () => {
    const contact = product?.contact || {};
    if (contact.whatsapp) window.open(`https://wa.me/${contact.whatsapp}`, "_blank");
    else if (contact.phone) window.location.href = `tel:${contact.phone}`;
  };

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

  return (
    <>
      <TopNav />

      <div className="product-detail">
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

        <div className="details-section">
          <h1>{product.title}</h1>
          <h2>₦{Number(product.price || 0).toLocaleString()}</h2>
          <p className="desc">{product.description || "No description available"}</p>

          {(product.contact?.phone || product.contact?.whatsapp) && (
            <button className="contact-btn" onClick={openContact}>
              Contact Seller
            </button>
          )}
        </div>
      </div>

      <BottomNav />
    </>
  );
}