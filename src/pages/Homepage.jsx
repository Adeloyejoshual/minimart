// src/pages/Homepage.jsx
import { useEffect, useState } from "react";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import { locationsByState } from "../config/locationsByState";
import "../styles/Homepage.css";

export default function Homepage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const states = Object.keys(locationsByState || []);
  const cities = selectedState ? locationsByState[selectedState] : [];

  // ---------------- FETCH PRODUCTS ----------------
  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/products");
        const data = await res.json();
        setProducts(data || []);
      } catch (err) {
        console.error("Failed to fetch products:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

  // ---------------- FETCH CATEGORIES ----------------
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories");
        const data = await res.json();
        setCategories(data || []);
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      }
    }
    fetchCategories();
  }, []);

  // ---------------- FILTER PRODUCTS ----------------
  const filteredProducts = products.filter(product => {
    const location = product.dynamic?.location || {};
    const countryState = location.state || "";
    const city = location.city || "";
    const categoryMatch = selectedCategory ? product.category_id === selectedCategory : true;
    const stateMatch = selectedState ? countryState === selectedState : true;
    const cityMatch = selectedCity ? city === selectedCity : true;

    return stateMatch && cityMatch && categoryMatch;
  });

  return (
    <>
      <TopNav />

      {/* ================= FILTER BAR ================= */}
      <div className="filter-bar">
        <select value={selectedState} onChange={e => { setSelectedState(e.target.value); setSelectedCity(""); }}>
          <option value="">Select State</option>
          {states.map(state => (
            <option key={state} value={state}>{state}</option>
          ))}
        </select>

        <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} disabled={!selectedState}>
          <option value="">Select City</option>
          {cities.map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>

        <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
          <option value="">Select Category</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="homepage-container">
        {loading ? (
          <p>Loading products...</p>
        ) : filteredProducts.length === 0 ? (
          <p>No products match your selection</p>
        ) : (
          <div className="product-grid">
            {filteredProducts.map(product => {
              const { id, title, price, description, images, dynamic } = product;
              const mainImage = images?.[0] || "/placeholder.png";
              const location = dynamic?.location?.city || dynamic?.location?.state || "";

              return (
                <div key={id} className="product-card">
                  <img src={mainImage} alt={title} className="product-image" />
                  <div className="product-details">
                    <p className="product-price">₦{Number(price).toLocaleString()}</p>
                    <h3 className="product-title">{title}</h3>
                    <p className="product-description">{description?.slice(0, 80)}...</p>
                    <p className="product-location">{location}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </>
  );
}