// src/pages/Homepage.jsx
import { useEffect, useState } from "react";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import { locationsByState } from "../config/locationsByState.js";
import "../styles/Homepage.css";

export default function Homepage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  const states = Object.keys(locationsByState);
  const cities = selectedState ? locationsByState[selectedState] : [];

  // Fetch products
  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
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

  // Fetch categories
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

  // Filter products based on state, city, and category
  const filteredProducts = products.filter(product => {
    const dynamic = product.dynamic_fields ? JSON.parse(product.dynamic_fields) : {};
    const location = typeof dynamic?.location === "object"
      ? dynamic.location.city || dynamic.location.state
      : dynamic?.location;

    const matchState = selectedState ? location?.includes(selectedState) : true;
    const matchCity = selectedCity ? location?.includes(selectedCity) : true;
    const matchCategory = selectedCategory ? product.category_id === selectedCategory : true;

    return matchState && matchCity && matchCategory;
  });

  const formatPrice = price => {
    if (!price) return "";
    const [integer, decimal] = price.toString().split(".");
    return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (decimal ? "." + decimal : "");
  };

  return (
    <>
      <TopNav />

      {/* ---------------- FILTERS ---------------- */}
      <div className="filters-container">
        <select value={selectedState} onChange={e => { setSelectedState(e.target.value); setSelectedCity(""); }}>
          <option value="">Select State</option>
          {states.map(state => <option key={state} value={state}>{state}</option>)}
        </select>

        {selectedState && (
          <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)}>
            <option value="">Select City</option>
            {cities.map(city => <option key={city} value={city}>{city}</option>)}
          </select>
        )}

        <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
          <option value="">Select Category</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* ---------------- PRODUCTS GRID ---------------- */}
      <div className="products-grid">
        {loading && <p>Loading products...</p>}
        {!loading && filteredProducts.length === 0 && <p>No products found.</p>}

        {filteredProducts.map(product => {
          const dynamic = product.dynamic_fields ? JSON.parse(product.dynamic_fields) : {};
          const location = typeof dynamic?.location === "object"
            ? dynamic.location.city || dynamic.location.state
            : dynamic?.location || "";

          const images = product.images ? JSON.parse(product.images) : [];
          const imageUrl = images[0] || "/placeholder.png";

          return (
            <div key={product.id} className="product-card">
              <img src={imageUrl} alt={product.title} className="product-image" />
              <div className="product-info">
                <h3 className="product-price">₦{formatPrice(product.price)}</h3>
                <h2 className="product-title">{product.title}</h2>
                <p className="product-description">{product.description?.slice(0, 60)}...</p>
                {location && <p className="product-location">{location}</p>}
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </>
  );
}