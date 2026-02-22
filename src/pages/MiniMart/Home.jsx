// src/pages/MiniMart/Home.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { getMiniMartProducts } from "../../helpers/minimart";
import MiniMartBottomNav from "../../components/MiniMartBottomNav.jsx";

export default function MiniMartHome() {
  const [products, setProducts] = useState([]);
  const { isAuthenticated, loginWithRedirect, logout } = useAuth0();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const data = await getMiniMartProducts();
      setProducts(data);
    } catch (err) {
      console.error("Failed to fetch MiniMart products:", err);
    }
  };

  // Reusable button
  const ActionButton = ({ onClick, children, fullWidth = false, style = {} }) => (
    <button
      onClick={onClick}
      style={{
        padding: "10px 16px",
        background: "#0D6EFD",
        color: "#fff",
        border: "none",
        borderRadius: "8px",
        cursor: "pointer",
        fontWeight: 600,
        width: fullWidth ? "100%" : "auto",
        ...style,
      }}
    >
      {children}
    </button>
  );

  return (
    <div style={{ padding: "16px", maxWidth: "1200px", margin: "0 auto", paddingBottom: "80px" }}>
      {/* ===== Header ===== */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          position: "sticky",
          top: 0,
          background: "#fff",
          padding: "12px 0",
          zIndex: 10,
        }}
      >
        <h2>MiniMart Store</h2>
        {isAuthenticated ? (
          <ActionButton onClick={() => logout({ returnTo: window.location.origin })}>
            Logout
          </ActionButton>
        ) : (
          <ActionButton onClick={() => loginWithRedirect()}>
            Login / Register
          </ActionButton>
        )}
      </div>

      {/* ===== Add Product Button ===== */}
      {isAuthenticated && (
        <Link to="/minimart/add">
          <ActionButton fullWidth>Add MiniMart Product</ActionButton>
        </Link>
      )}

      {/* ===== Products Grid ===== */}
      <h3 style={{ marginTop: "24px" }}>MiniMart Products</h3>
      {products.length === 0 && <p>No products yet.</p>}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "16px",
          marginTop: "12px",
        }}
      >
        {products.map((p) => (
          <Link
            key={p.id}
            to={`/minimart/${p.id}`}
            style={{
              display: "flex",
              flexDirection: "column",
              background: "#f8fafd",
              borderRadius: "12px",
              overflow: "hidden",
              textDecoration: "none",
              color: "inherit",
              boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
              transition: "transform 0.2s",
            }}
          >
            <img
              src={p.image_url || "/placeholder.png"}
              alt={p.title}
              style={{ width: "100%", height: "150px", objectFit: "cover" }}
            />
            <h3 style={{ margin: "8px", fontSize: "16px", fontWeight: 600 }}>{p.title}</h3>
            <p style={{ margin: "0 8px 12px", color: "#0D6EFD", fontWeight: 700 }}>₦{p.price}</p>
          </Link>
        ))}
      </div>

      {/* ===== Bottom Nav ===== */}
      <MiniMartBottomNav />
    </div>
  );
}