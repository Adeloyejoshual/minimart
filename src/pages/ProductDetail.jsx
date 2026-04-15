import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

export default function ProductDetail() {
  const { key } = useParams(); // 👈 works for BOTH id and slug
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

  // simple UUID checker (adjust if your ID is numeric)
  const isUUID = (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError("");

        let url;

        // 👇 decide endpoint automatically
        if (isUUID(key)) {
          url = `${API_BASE}/products/${key}`; // ID route
        } else {
          url = `${API_BASE}/product/${key}`; // slug route
        }

        const res = await axios.get(url);
        setProduct(res.data);
      } catch (err) {
        console.error(err);
        setError("This product is not available or still pending payment.");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [key]);

  if (loading) return <h3 style={{ padding: 20 }}>Loading product...</h3>;

  if (error)
    return (
      <div style={{ padding: 20 }}>
        <h3>{error}</h3>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );

  if (!product) return null;

  return (
    <div style={{ padding: 20 }}>
      <h1>{product.title}</h1>

      <h2 style={{ color: "green" }}>₦{product.price}</h2>

      {/* IMAGES */}
      <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
        {product.images?.map((img, i) => (
          <img
            key={i}
            src={img}
            alt="product"
            style={{
              width: 200,
              height: 200,
              objectFit: "cover",
              borderRadius: 8,
            }}
          />
        ))}
      </div>

      <p style={{ marginTop: 15 }}>
        {product.description || "No description available."}
      </p>

      <p>
        📍 {product.location?.city}, {product.location?.state}
      </p>
    </div>
  );
}