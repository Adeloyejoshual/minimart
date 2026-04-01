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
          `${API_BASE}/api/product/${id}`
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

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;
  if (error) return <div style={{ padding: 20, color: "red" }}>{error}</div>;
  if (!product) return null;

  const media = product.media || {};
  const images = media.images || [];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
      <h1>{product.title}</h1>

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
              alt=""
              style={{
                width: 250,
                height: 250,
                objectFit: "cover",
                borderRadius: 8,
              }}
            />
          ))
        ) : (
          <p>No images available</p>
        )}
      </div>

      {/* DESCRIPTION */}
      <div style={{ marginTop: 20 }}>
        <h3>Description</h3>
        <p>{product.description || "No description"}</p>
      </div>

      {/* SELLER */}
      <div style={{ marginTop: 20 }}>
        <h3>Seller</h3>
        <p>{product.seller_name || "Unknown"}</p>
        <p>{product.seller_email || "N/A"}</p>
      </div>

      {/* META */}
      <div style={{ marginTop: 20, fontSize: 12, color: "#666" }}>
        <p>Category: {product.category_name}</p>
        <p>Subcategory: {product.subcategory_name}</p>
        <p>Status: {product.status}</p>
        <p>Views: {product.views}</p>
      </div>
    </div>
  );
}