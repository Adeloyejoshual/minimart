import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE = "https://minimart-ivrm.onrender.com";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState("");
  const [related, setRelated] = useState([]);

  /* ================= FETCH PRODUCT ================= */
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);

        const res = await axios.get(
          `${API_BASE}/products/${id}`
        );

        setProduct(res.data);
        setActiveImage(res.data?.images?.[0] || "");
      } catch (err) {
        console.error("Product fetch failed:", err);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchProduct();
  }, [id]);

  /* ================= FETCH RELATED ================= */
  useEffect(() => {
    const fetchRelated = async () => {
      try {
        if (!product?.category_id) return;

        const res = await axios.get(
          `${API_BASE}/products?skip=0&limit=50`
        );

        const all = res.data?.products || [];

        const filtered = all
          .filter(
            (p) =>
              p.category_id === product.category_id &&
              p.id !== product.id
          )
          .slice(0, 6);

        setRelated(filtered);
      } catch (err) {
        console.error("Related fetch failed:", err);
      }
    };

    fetchRelated();
  }, [product]);

  /* ================= SHARE ================= */
  const shareProduct = async () => {
    const url = window.location.href;

    const shareData = {
      title: product.title,
      text: product.description || "Check this product",
      url,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        alert("Link copied to clipboard");
      }
    } catch (err) {
      console.error("Share failed:", err);
    }
  };

  /* ================= STATES ================= */
  if (loading) return <p>Loading product...</p>;
  if (!product) return <p>Product not found</p>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>

      {/* ================= TITLE ================= */}
      <h2>{product.title}</h2>

      {/* ================= IMAGE ================= */}
      <div>
        <img
          src={activeImage}
          alt={product.title}
          style={{
            width: "100%",
            maxHeight: 400,
            objectFit: "cover",
            borderRadius: 10,
          }}
        />

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {product.images?.map((img, i) => (
            <img
              key={i}
              src={img}
              onClick={() => setActiveImage(img)}
              style={{
                width: 70,
                height: 70,
                objectFit: "cover",
                cursor: "pointer",
                borderRadius: 6,
                border:
                  activeImage === img
                    ? "2px solid blue"
                    : "1px solid #ddd",
              }}
            />
          ))}
        </div>
      </div>

      {/* ================= PRICE ================= */}
      <h3 style={{ marginTop: 15 }}>
        ₦{Number(product.price).toLocaleString()}
      </h3>

      {/* ================= LOCATION ================= */}
      <p>
        📍 {product.location?.city}, {product.location?.state}
      </p>

      {/* ================= DESCRIPTION ================= */}
      <p>{product.description}</p>

      {/* ================= ATTRIBUTES ================= */}
      {product.attributes && (
        <div style={{ marginTop: 20 }}>
          <h4>Details</h4>
          <ul>
            {Object.entries(product.attributes).map(([k, v]) => (
              <li key={k}>
                <b>{k}:</b> {v}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ================= DELIVERY ================= */}
      {product.delivery && (
        <div style={{ marginTop: 20 }}>
          <h4>Delivery</h4>
          <p>
            {product.delivery.available
              ? "Available"
              : "Not available"}
          </p>
          <p>
            {product.delivery.duration?.from} -{" "}
            {product.delivery.duration?.to} days
          </p>
          <p>Fee: ₦{product.delivery.fee || 0}</p>
          <p>{product.delivery.note}</p>
        </div>
      )}

      {/* ================= CONTACT ================= */}
      {product.contact && (
        <div style={{ marginTop: 20 }}>
          <h4>Seller Contact</h4>
          <p>{product.contact.phone}</p>
        </div>
      )}

      {/* ================= ACTIONS ================= */}
      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button
          onClick={shareProduct}
          style={{
            padding: "10px 14px",
            borderRadius: 6,
            border: "1px solid #ccc",
            cursor: "pointer",
          }}
        >
          Share Product
        </button>

        <button
          onClick={() => navigate(-1)}
          style={{
            padding: "10px 14px",
            borderRadius: 6,
            border: "1px solid #ccc",
            cursor: "pointer",
          }}
        >
          Back
        </button>
      </div>

      {/* ================= RELATED PRODUCTS ================= */}
      {related.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <h3>Related Products</h3>

          <div
            style={{
              display: "flex",
              gap: 12,
              overflowX: "auto",
            }}
          >
            {related.map((item) => (
              <div
                key={item.id}
                onClick={() =>
                  navigate(`/product/${item.id}`)
                }
                style={{
                  minWidth: 160,
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: 10,
                  cursor: "pointer",
                }}
              >
                <img
                  src={item.images?.[0]}
                  alt={item.title}
                  style={{
                    width: "100%",
                    height: 100,
                    objectFit: "cover",
                    borderRadius: 6,
                  }}
                />

                <p style={{ fontSize: 13 }}>
                  {item.title}
                </p>

                <b>
                  ₦{Number(item.price).toLocaleString()}
                </b>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}