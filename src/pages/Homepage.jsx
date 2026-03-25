// src/pages/Homepage.jsx
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "./Homepage.css";

const API_BASE = "https://minimart-ivrm.onrender.com/api/marketplace";

export default function Homepage() {
  const [products, setProducts] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(false);

  // ---------------- DETECT USER LOCATION ----------------
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
        );
        const data = await res.json();
        const state = data.address.state;
        const city = data.address.city || data.address.town;
        setUserLocation({ state, city });
      } catch (err) { console.error(err); }
    });
  }, []);

  // ---------------- LOAD PRODUCTS ----------------
  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/products`;
      if (userLocation?.state) url += `?state=${userLocation.state}&city=${userLocation.city}`;
      const res = await axios.get(url);
      setProducts(res.data.products || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [userLocation]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const formatPrice = (amount) =>
    new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="homepage-container">
      {userLocation && (
        <div className="location-banner">
          📍 Showing products in {userLocation.city}, {userLocation.state}
        </div>
      )}

      <div className="products-grid">
        {loading ? (
          <p>Loading products...</p>
        ) : products.length === 0 ? (
          <p>No products found in your area.</p>
        ) : products.map(p => (
          <div key={p.id} className="product-card">
            <img
              src={p.images?.[0] || "/placeholder-product.png"}
              alt={p.title}
              className="product-image"
            />
            <div className="product-info">
              <div className="price">{formatPrice(p.price)}</div>
              <h3 className="title">{p.title}</h3>
              <p className="description">{p.description?.slice(0, 60)}</p>
              {p.location && (
                <p className="location">{p.location.city}, {p.location.state}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}