import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const API_BASE = "https://minimart-ivrm.onrender.com";

export default function ProductDetail() {
  const { id } = useParams();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);

        const res = await axios.get(
          `${API_BASE}/api/products/${id}`
        );

        setProduct(res.data.product);
      } catch (err) {
        setError(
          err.response?.data?.message || "Failed to load product"
        );
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchProduct();
  }, [id]);

  if (loading) {
    return <div style={{ padding: 20 }}>Loading product...</div>;
  }

  if (error) {
    return <div style={{ padding: 20, color: "red" }}>{error}</div>;
  }

  if (!product) return null;

  const media = product.media || {};
  const images = media.images || [];

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
      {/* TITLE */}
      <h1>{product.title}</h1>

      {/* PRICE */}
      <h2 style={{ color: "green" }}>
        ₦{Number(product.price).toLocaleString()}
      </h2>

      {/* IMAGES */}
      <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
        {images.length > 0 ? (
          images.map((img, i) => (
            <img
              key={i}
              src={img}
              alt={`product-${i}`}
              style={{
                width: 250,
                height: 250,
                objectFit: "cover",
                borderRadius: 8,
              }}
            />
          ))
        ) : (
          <div>No images available</div>
        )}
      </div>

      {/* DESCRIPTION */}
      <div style={{ marginTop: 20 }}>
        <h3>Description</h3>
        <p>{product.description || "No description provided."}</p>
      </div>

      {/* ATTRIBUTES */}
      {product.attributes && (
        <div style={{ marginTop: 20 }}>
          <h3>Details</h3>
          <pre
            style={{
              background: "#f5f5f5",
              padding: 10,
              borderRadius: 6,
            }}
          >
            {JSON.stringify(product.attributes, null, 2)}
          </pre>
        </div>
      )}

      {/* SELLER INFO */}
      <div style={{ marginTop: 20 }}>
        <h3>Seller</h3>
        <p>Name: {product.seller_name || "Unknown"}</p>
        <p>Email: {product.seller_email || "N/A"}</p>
      </div>

      {/* META */}
      <div style={{ marginTop: 20, fontSize: 12, color: "#666" }}>
        <p>Category: {product.category_name}</p>
        <p>Subcategory: {product.subcategory_name}</p>
        <p>Views: {product.views}</p>
        <p>Status: {product.status}</p>
      </div>
    </div>
  );
}