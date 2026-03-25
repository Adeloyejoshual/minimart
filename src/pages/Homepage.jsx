// src/pages/Homepage.jsx
import { useEffect, useState } from "react";
import TopNav from "../components/TopNav";
import BottomNav from "../components/BottomNav";
import DropdownModal from "../components/DropdownModal";
import { locationsByState } from "../config/locationsByState";
import "../styles/Homepage.css";

export default function Homepage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const states = Object.keys(locationsByState);
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
  const filteredProducts = products.filter((p) => {
    const productCategory = p.category_id;
    const productCity = p.dynamic?.location?.city || "";
    const productState = p.dynamic?.location?.state || "";

    const matchCategory = selectedCategory ? productCategory === selectedCategory : true;
    const matchState = selectedState ? productState === selectedState : true;
    const matchCity = selectedCity ? productCity === selectedCity : true;

    return matchCategory && matchState && matchCity;
  });

  return (
    <>
      <TopNav />
      <div className="homepage-container">
        {/* ================= FILTER BAR ================= */}
        <div className="filter-bar">
          <DropdownModal
            label="State"
            value={selectedState}
            onChange={(val) => { setSelectedState(val); setSelectedCity(""); }}
            options={states}
          />
          {selectedState && (
            <DropdownModal
              label="City"
              value={selectedCity}
              onChange={setSelectedCity}
              options={cities}
            />
          )}
          <DropdownModal
            label="Category"
            value={selectedCategory}
            onChange={setSelectedCategory}
            options={categories.map(c => ({ id: c.id, name: c.name }))}
          />
        </div>

        {/* ================= PRODUCT GRID ================= */}
        {loading ? (
          <p>Loading products...</p>
        ) : filteredProducts.length === 0 ? (
          <p>No products found</p>
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