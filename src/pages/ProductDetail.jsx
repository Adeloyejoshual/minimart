import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import "../styles/ProductDetail.css";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [sellerProducts, setSellerProducts] = useState([]);
  const [activeImage, setActiveImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* ================= FETCH ================= */
  useEffect(() => {
    window.scrollTo(0, 0); // important UX fix

    const controller = new AbortController();

    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `https://minimart-ivrm.onrender.com/api/product/${id}`,
          { signal: controller.signal }
        );

        if (!res.ok) throw new Error("Failed to fetch");

        const data = await res.json();

        const p = data.product || null;

        setProduct(p);
        setRelated(data.related || []);
        setSellerProducts(data.sellerProducts || []);

        const imgs = Array.isArray(p?.images) ? p.images : [];
        setActiveImage(imgs[0] || "");
      } catch (err) {
        if (err.name !== "AbortError") {
          setError("Unable to load product");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
    return () => controller.abort();
  }, [id]);

  /* ================= FORMATTERS ================= */
  const formatPrice = (price) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(price || 0);

  /* ================= CONTACT ================= */
  const openContact = () => {
    const contact = product?.contact || {};

    if (contact.whatsapp) {
      window.open(`https://wa.me/${contact.whatsapp}`, "_blank");
    } else if (contact.phone) {
      window.location.href = `tel:${contact.phone}`;
    }
  };

  /* ================= STATES ================= */
  if (loading) {
    return (
      <>
        <TopNav />
        <div className="product-detail loading">Loading product...</div>
        <BottomNav />
      </>
    );
  }

  if (error) {
    return (
      <>
        <TopNav />
        <div className="product-detail error">{error}</div>
        <BottomNav />
      </>
    );
  }

  if (!product) {
    return (
      <>
        <TopNav />
        <div className="product-detail">Product not found</div>
        <BottomNav />
      </>
    );
  }

  const images = Array.isArray(product.images) ? product.images : [];

  /* ================= UI ================= */
  return (
    <>
      <TopNav />

      <div className="product-detail">

        {/* ================= IMAGE ================= */}
        <div className="image-section">
          <img
            src={activeImage || "https://via.placeholder.com/400"}
            alt={product.title}
            className="main-img"
            onError={(e) =>
              (e.target.src = "https://via.placeholder.com/400")
            }
          />

          <div className="thumbnails">
            {images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt="product"
                onClick={() => setActiveImage(img)}
                className={activeImage === img ? "active" : ""}
              />
            ))}
          </div>
        </div>

        {/* ================= DETAILS ================= */}
        <div className="details-section">
          <h1 className="product-title">{product.title}</h1>

          <h2 className="product-price">
            {formatPrice(product.price)}
          </h2>

          {/* LOCATION (PROFESSIONAL) */}
          <p className="product-meta">
            {product?.location?.city}, {product?.location?.state}
          </p>

          <p className="desc">
            {product.description || "No description available"}
          </p>

          {/* CATEGORY FIELDS */}
          {product.category?.dynamicFields?.length > 0 && (
            <div className="extra-details">
              <h3>Specifications</h3>

              {product.category.dynamicFields.map((field, i) => (
                <p key={i}>
                  <strong>{field}:</strong>{" "}
                  {product.attributes?.[field] || "N/A"}
                </p>
              ))}
            </div>
          )}

          {/* DELIVERY */}
          {product.delivery && (
            <div className="delivery-box">
              <h3>Delivery</h3>
              <p>
                {product.delivery.available
                  ? "Delivery available"
                  : "No delivery"}
              </p>
              <p>
                {product.delivery.from_days} -{" "}
                {product.delivery.to_days} days
              </p>
              <p>Fee: {formatPrice(product.delivery.fee)}</p>
            </div>
          )}

          {/* CONTACT */}
          {(product.contact?.phone || product.contact?.whatsapp) && (
            <button className="contact-btn" onClick={openContact}>
              Contact Seller
            </button>
          )}
        </div>
      </div>

      {/* ================= RELATED ================= */}
      {related.length > 0 && (
        <div className="related-section">
          <h2>Related Products</h2>

          <div className="related-grid">
            {related.map((p) => (
              <div
                key={p.id}
                className="card"
                onClick={() => navigate(`/product/${p.id}`)}
              >
                <img
                  src={p.images?.[0]}
                  alt={p.title}
                  onError={(e) =>
                    (e.target.src =
                      "https://via.placeholder.com/150")
                  }
                />
                <p className="title">{p.title}</p>
                <p className="price">{formatPrice(p.price)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= SELLER ================= */}
      {sellerProducts.length > 0 && (
        <div className="related-section">
          <h2>More from this seller</h2>

          <div className="related-grid">
            {sellerProducts.map((p) => (
              <div
                key={p.id}
                className="card"
                onClick={() => navigate(`/product/${p.id}`)}
              >
                <img
                  src={p.images?.[0]}
                  alt={p.title}
                  onError={(e) =>
                    (e.target.src =
                      "https://via.placeholder.com/150")
                  }
                />
                <p className="title">{p.title}</p>
                <p className="price">{formatPrice(p.price)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <BottomNav />
    </>
  );
}