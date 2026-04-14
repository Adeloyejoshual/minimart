import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function ProductDetail() {
  const { id, slug } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const endpoint = slug
    ? `https://minimart-ivrm.onrender.com/api/marketplace/product/${slug}`
    : `https://minimart-ivrm.onrender.com/api/marketplace/products/${id}`;

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(endpoint);

        if (!res.ok) {
          throw new Error("Product not found");
        }

        const data = await res.json();

        // 🚨 BLOCK UNPAID / INACTIVE PRODUCTS
        if (data.status !== "active" || data.is_active !== true) {
          setError("This product is not available or still pending payment.");
          setProduct(null);
          return;
        }

        setProduct(data);
      } catch (err) {
        setError(err.message || "Failed to load product");
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [endpoint]);

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <h3>Loading product...</h3>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <h3>⚠️ {error}</h3>
        <button onClick={() => navigate(-1)}>Go Back</button>
      </div>
    );
  }

  if (!product) return null;

  // Merge image sources safely
  const images =
    product.images ||
    product.media?.images ||
    [];

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: "0 auto" }}>
      {/* TITLE */}
      <h1>{product.title}</h1>

      {/* PRICE */}
      <h2 style={{ color: "green" }}>
        ₦{Number(product.price).toLocaleString()}
      </h2>

      {/* IMAGES */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {images.length > 0 ? (
          images.map((img, i) => (
            <img
              key={i}
              src={typeof img === "string" ? img : img?.url}
              alt={`product-${i}`}
              style={{
                width: 130,
                height: 130,
                objectFit: "cover",
                borderRadius: 8,
                border: "1px solid #ddd",
              }}
            />
          ))
        ) : (
          <p>No images available</p>
        )}
      </div>

      {/* DESCRIPTION */}
      <p style={{ marginTop: 20 }}>
        {product.description || "No description provided"}
      </p>

      {/* LOCATION */}
      <p>
        📍 {product.location_state} - {product.location_city}
      </p>

      {/* ATTRIBUTES */}
      {product.attributes && (
        <div style={{ marginTop: 20 }}>
          <h3>Details</h3>
          <pre
            style={{
              background: "#f4f4f4",
              padding: 10,
              borderRadius: 8,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(product.attributes, null, 2)}
          </pre>
        </div>
      )}

      {/* CONTACT */}
      <div style={{ marginTop: 20 }}>
        <h3>Contact Seller</h3>

        <p>📞 {product.phone || product.contact?.phone}</p>
        <p>💬 WhatsApp: {product.whatsapp || product.contact?.whatsapp}</p>

        {product.contact?.whatsapp_link && (
          <a
            href={product.contact.whatsapp_link}
            target="_blank"
            rel="noreferrer"
            style={{ color: "blue" }}
          >
            Chat on WhatsApp
          </a>
        )}
      </div>

      {/* BACK BUTTON */}
      <button
        onClick={() => navigate(-1)}
        style={{
          marginTop: 30,
          padding: "10px 15px",
          cursor: "pointer",
        }}
      >
        ← Go Back
      </button>
    </div>
  );
}