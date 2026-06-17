import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopNav    from "../components/TopNav";
import BottomNav from "../components/BottomNav";

const BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;

export default function Homepage({ user }) {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    fetch(`${BASE}/api/homepage`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setProducts(data.products || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  /* ── Loading ── */
  if (loading) {
    return (
      <>
        <TopNav user={user} />
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 32 }}>⏳</div>
          <p style={{ color: "#888", marginTop: 12 }}>Loading products…</p>
        </div>
        <BottomNav />
      </>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <>
        <TopNav user={user} />
        <div style={{
          textAlign  : "center",
          padding    : "60px 20px",
          background : "#fff5f5",
          margin     : 16,
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 32 }}>❌</div>
          <p style={{ fontWeight: 700, color: "#dc2626" }}>Failed to load</p>
          <p style={{ color: "#888", fontSize: 13 }}>{error}</p>
          <p style={{ color: "#888", fontSize: 12 }}>
            API: {BASE}/api/homepage
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop    : 16,
              padding      : "10px 24px",
              background   : "#e8630a",
              color        : "#fff",
              border       : "none",
              borderRadius : 8,
              cursor       : "pointer",
              fontWeight   : 700,
            }}
          >
            Retry
          </button>
        </div>
        <BottomNav />
      </>
    );
  }

  /* ── Empty ── */
  if (products.length === 0) {
    return (
      <>
        <TopNav user={user} />
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 40 }}>🛍️</div>
          <p style={{ fontWeight: 700 }}>No products yet</p>
          <p style={{ color: "#888", fontSize: 13 }}>
            API returned 0 products from {BASE}/api/homepage
          </p>
        </div>
        <BottomNav />
      </>
    );
  }

  /* ── Products ── */
  return (
    <>
      <TopNav user={user} />

      <div style={{ padding: "16px" }}>

        {/* Header */}
        <div style={{
          display        : "flex",
          justifyContent : "space-between",
          alignItems     : "center",
          marginBottom   : 16,
        }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
            🛒 Loemart
          </h1>
          <span style={{
            fontSize     : 12,
            color        : "#888",
            background   : "#f4f4f4",
            padding      : "4px 10px",
            borderRadius : 20,
          }}>
            {products.length} listings
          </span>
        </div>

        {/* Product Grid */}
        <div style={{
          display             : "grid",
          gridTemplateColumns : "repeat(2, 1fr)",
          gap                 : 12,
        }}>
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onClick={() => navigate(`/product/${p.slug}`)}
            />
          ))}
        </div>

      </div>

      <BottomNav />
    </>
  );
}

/* ── Product Card ── */
function ProductCard({ product, onClick }) {
  const image =
    product.image ||
    (product.images?.[0]
      ? (typeof product.images[0] === "string"
          ? product.images[0]
          : product.images[0]?.url)
      : null);

  const price = Number(product.price || 0).toLocaleString("en-NG");
  const city  = product.location?.city || product.location_city || "Nigeria";

  return (
    <div
      onClick={onClick}
      style={{
        background   : "#fff",
        borderRadius : 12,
        overflow     : "hidden",
        border       : "1px solid #eee",
        cursor       : "pointer",
        boxShadow    : "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      {/* Image */}
      <div style={{
        width      : "100%",
        aspectRatio: "4/3",
        background : "#f4f2ef",
        overflow   : "hidden",
      }}>
        {image ? (
          <img
            src={image}
            alt={product.title}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div style={{
            width          : "100%",
            height         : "100%",
            display        : "flex",
            alignItems     : "center",
            justifyContent : "center",
            fontSize       : 32,
          }}>
            📦
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "10px 10px 12px" }}>
        <p style={{
          fontSize     : 13,
          fontWeight   : 600,
          color        : "#1a1614",
          margin       : "0 0 6px",
          lineHeight   : 1.35,
          overflow     : "hidden",
          display      : "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}>
          {product.title || "Untitled"}
        </p>

        <p style={{
          fontSize   : 15,
          fontWeight : 800,
          color      : "#1a1614",
          margin     : "0 0 4px",
        }}>
          ₦{price}
        </p>

        <p style={{
          fontSize : 11,
          color    : "#a09890",
          margin   : 0,
          display  : "flex",
          alignItems: "center",
          gap      : 3,
        }}>
          📍 {city}
        </p>
      </div>
    </div>
  );
}