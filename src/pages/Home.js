import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const [products, setProducts] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Fetch products from Firestore
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "products"));
        setProducts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        alert("Error fetching products: " + err.message);
      }
    };
    fetchProducts();
  }, []);

  // Logout function
  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate("/auth");
    } catch (err) {
      alert("Error logging out: " + err.message);
    }
  };

  return (
    <div style={{ padding: "20px", position: "relative" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>MiniMart Products</h1>

        {/* 3-dot menu */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{ fontSize: "24px", background: "none", border: "none", cursor: "pointer" }}
          >
            &#8942;
          </button>

          {menuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "30px",
                border: "1px solid #ccc",
                background: "#fff",
                borderRadius: "4px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                zIndex: 100,
              }}
            >
              <button
                onClick={handleLogout}
                style={{
                  display: "block",
                  padding: "10px 20px",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Logout
              </button>
              {/* You can add more admin actions here later */}
            </div>
          )}
        </div>
      </div>

      {/* Add Product Button */}
      <button
        onClick={() => navigate("/add-product")}
        style={{
          marginTop: "20px",
          padding: "10px 20px",
          backgroundColor: "#1976d2",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Add New Product
      </button>

      {/* Product Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "20px",
          marginTop: "20px",
        }}
      >
        {products.length === 0 ? (
          <p>No products available.</p>
        ) : (
          products.map((p) => (
            <div
              key={p.id}
              style={{
                border: "1px solid #ccc",
                borderRadius: "8px",
                overflow: "hidden",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                background: "#fff",
              }}
            >
              <img
                src={p.imageUrl}
                alt={p.name}
                style={{ width: "100%", height: "150px", objectFit: "cover" }}
              />
              <div style={{ padding: "10px" }}>
                <h3 style={{ margin: "0 0 10px 0" }}>{p.name}</h3>
                <p style={{ margin: 0, fontWeight: "bold" }}>${p.price}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Home;