import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE = "https://minimart-ivrm.onrender.com";

export default function ProductDetail({ user }) {
  const { slug } = useParams();  // ← now from /product/:slug
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [mainImage, setMainImage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        // ✅ Use slug in the API
        const res = await axios.get(`${API_BASE}/api/product/${slug}`);

        const data = res.data?.product;

        if (!data) throw new Error("Invalid product response");

        setProduct(data);

        // 🔥 SAFE IMAGE NORMALIZATION
        let images = data.images;

        if (!Array.isArray(images)) {
          try {
            images = JSON.parse(images || "[]");
          } catch {
            images = [];
          }
        }

        images = images.filter(Boolean);

        setMainImage(images.length > 0 ? images[0] : "");
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

    if (slug) fetchProduct();
  }, [slug]); // ← react on slug, not id

  if (loading)
    return <div style={{ padding: 20 }}>Loading...</div>;

  if (error)
    return <div style={{ padding: 20, color: "red" }}>{error}</div>;

  if (!product) return null;

  const images = Array.isArray(product.images) ? product.images : [];

  return (
    <div
      style={{
        maxWidth: 1000,
        margin: "0 auto",
        padding: 20,
      }}
    >
      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h2 style={{ margin: 0 }}>{product.title}</h2>
          <p style={{ fontSize: 12, color: "#666" }}>
            {product.category_name} • {product.subcategory_name}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => navigate(`/seller/${product.seller_id}`)}
          >
            View Seller
          </button>

          <button
            onClick={() =>
              navigate(
                `/conversations?userId=${product.seller_id}`
              )
            }
          >
            Chat Seller
          </button>
        </div>
      </div>

      {/* IMAGE SECTION */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
        }}
      >
        <div>
          <div
            style={{
              height: 350,
              background: "#f5f5f5",
            }}
          >
            {mainImage ? (
              <img
                src={mainImage}
                alt={product.title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div style={{ padding: 20 }}>No Image Available</div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 10,
            }}
          >
            {images.map((img, i) => (
              <img
                key={i}
                src={img}
                onClick={() => setMainImage(img)}
                onError={(e) => (e.target.style.display = "none")}
                style={{
                  width: 60,
                  height: 60,
                  objectFit: "cover",
                  border:
                    mainImage === img
                      ? "2px solid blue"
                      : "1px solid #ddd",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        </div>

        {/* DETAILS */}
        <div>
          <h2>₦{Number(product.price).toLocaleString()}</h2>
          <p>{product.description}</p>
          <p>
            <b>Seller:</b> {product.seller_name}
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 20,
  },
};