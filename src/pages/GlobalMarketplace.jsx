// src/pages/GlobalMarketplace.jsx
import { useState, useEffect } from "react";
import { getMarketplaceProducts } from "../helpers/marketplace";
import MarketplaceFilter from "../components/MarketplaceFilter";
import "./GlobalMarketplace.css";

export default function GlobalMarketplace() {
  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch products from backend
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const data = await getMarketplaceProducts();
      setProducts(data);
      setFiltered(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Apply filter and search
  const handleFilter = (filters) => {
    let result = [...products];

    // Country/State/City
    if (filters.country) result = result.filter(p => p.country === filters.country);
    if (filters.state) result = result.filter(p => p.state === filters.state);
    if (filters.city) result = result.filter(p => p.city === filters.city);

    // Category
    if (filters.category) result = result.filter(p => p.category === filters.category);

    // Condition
    if (filters.condition) result = result.filter(p => p.condition === filters.condition);

    // Price
    if (filters.priceMin) result = result.filter(p => p.price >= Number(filters.priceMin));
    if (filters.priceMax) result = result.filter(p => p.price <= Number(filters.priceMax));

    // Live search term
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => p.title.toLowerCase().includes(term) || (p.description && p.description.toLowerCase().includes(term)));
    }

    setFiltered(result);
  };

  // Re-apply filters when search term changes
  useEffect(() => {
    handleFilter({});
  }, [searchTerm, products]);

  return (
    <div className="global-marketplace-page">
      {/* Header */}
      <div className="marketplace-header">
        <h2>Global Marketplace</h2>
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Filters */}
      <MarketplaceFilter onFilter={handleFilter} />

      {/* Product Grid */}
      <div className="products-grid">
        {filtered.length === 0 && <p style={{ padding: "1rem" }}>No products found.</p>}
        {filtered.map(p => (
          <div key={p._id} className="product-card">
            {p.image_url && <img src={p.image_url} alt={p.title} className="product-img" />}
            <h3>{p.title}</h3>
            <p>₦{p.price}</p>
            <p style={{ fontSize: "12px", color: "#555" }}>
              {p.state ? `${p.city}, ${p.state}` : p.country || "Global"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}