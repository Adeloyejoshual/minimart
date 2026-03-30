import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api/marketplace";

export default function SellerProfile({ user }) {
  const { id } = useParams(); // seller id
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [loadingSeller, setLoadingSeller] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSeller();
    fetchProducts();
  }, [id]);

  /* Fetch seller info + total products */
  const fetchSeller = async () => {
    setLoadingSeller(true);
    setError("");
    try {
      const res = await axios.get(`${API}/sellers/${id}`);
      setSeller(res.data);
    } catch (err) {
      console.error("Failed to load seller:", err);
      setError("Unable to load seller profile");
    } finally {
      setLoadingSeller(false);
    }
  };

  /* Fetch products separately */
  const fetchProducts = async () => {
    setLoadingProducts(true);
    setError("");
    try {
      const res = await axios.get(`${API}/sellers/${id}/products`);
      setProducts(res.data);
    } catch (err) {
      console.error("Failed to load products:", err);
      setError("Unable to load products");
    } finally {
      setLoadingProducts(false);
    }
  };

  if (loadingSeller) return <p>Loading seller profile...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!seller) return <p>Seller not found.</p>;

  return (
    <div style={{ maxWidth: 900, margin: "auto", padding: 20 }}>
      {/* Seller Info */}
      <div style={{ display: "flex", gap: 20, marginBottom: 30 }}>
        <div>
          <img
            src={seller.avatar || "https://via.placeholder.com/150"}
            alt={seller.name}
            style={{ width: 150, height: 150, borderRadius: "50%", objectFit: "cover" }}
          />
        </div>
        <div>
          <h1>{seller.name}</h1>
          {seller.store_name && <p>Store: {seller.store_name}</p>}
          {seller.store_description && <p>{seller.store_description}</p>}
          <p>Joined: {new Date(seller.created_at).toLocaleDateString()}</p>
          <p>Total Products: {seller.total_products}</p>
        </div>
      </div>

      {/* Products */}
      <h2>Products by {seller.name}</h2>
      {loadingProducts ? (
        <p>Loading products...</p>
      ) : products.length === 0 ? (
        <p>No products listed yet.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 20,
          }}
        >
          {products.map((p) => (
            <div key={p.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 10 }}>
              {p.image && (
                <img
                  src={p.image}
                  alt={p.title}
                  style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 4 }}
                />
              )}
              <h4 style={{ margin: "10px 0 5px" }}>{p.title}</h4>
              <p style={{ margin: "0 0 5px" }}>₦{new Intl.NumberFormat().format(p.price)}</p>
              <p style={{ margin: 0 }}>Stock: {p.stock}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}