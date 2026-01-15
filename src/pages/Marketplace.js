// src/pages/Marketplace.jsx
import { useEffect, useState } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../firebase";
import TopNav from "../components/TopNav";
import CategoryFilter from "../components/CategoryFilter";
import SearchBar from "../components/SearchBar";
import { useNavigate } from "react-router-dom";

export default function Marketplace() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const categories = [
    "Vehicles",
    "Property",
    "Mobile Phones & Tablets",
    "Electronics",
    "Home, Furniture & Appliances",
    "Fashion",
    "Beauty & Personal Care",
    "Services",
    "Repair & Construction",
    "Commercial Equipment & Tools",
    "Leisure & Activities",
    "Babies & Kids",
    "Food, Agriculture & Farming",
    "Animals & Pets",
    "Jobs",
    "Seeking Work - CVs",
  ];

  // Load all Marketplace + MiniMart products
  useEffect(() => {
    const loadProducts = async () => {
      const q = query(collection(db, "products"));
      const snap = await getDocs(q);
      const allProducts = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => p.marketType === "marketplace" || p.marketType === "minimart");
      setProducts(allProducts);
      setFilteredProducts(allProducts);
    };
    loadProducts();
  }, []);

  // Filter by category & search
  useEffect(() => {
    let result = [...products];

    if (selectedCategory) {
      result = result.filter((p) => p.category === selectedCategory);
    }

    if (searchQuery) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    setFilteredProducts(result);
  }, [products, selectedCategory, searchQuery]);

  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh", paddingBottom: 50 }}>
      <TopNav />

      <div
        style={{
          background: "#fffbe6",
          color: "#856404",
          padding: "12px 20px",
          borderRadius: 8,
          margin: "20px auto",
          maxWidth: 800,
          fontWeight: 500,
          textAlign: "center",
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        }}
      >
        ⚠️ Do NOT pay before delivery. Always inspect the product before paying.
        MiniMart is not responsible for Marketplace payments.
      </div>

      <h2 style={{ textAlign: "center", color: "#0D6EFD", marginTop: 20 }}>Marketplace</h2>

      <div style={{ maxWidth: 900, margin: "0 auto 20px" }}>
        <SearchBar onSearch={(q) => setSearchQuery(q)} />
        <CategoryFilter
          categories={categories}
          selected={selectedCategory}
          onChange={setSelectedCategory}
        />
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          maxWidth: 900,
          margin: "0 auto",
          justifyContent: "center",
        }}
      >
        {filteredProducts.length > 0 ? (
          filteredProducts.map((p) => (
            <div
              key={p.id}
              style={{
                border: "1px solid #dee2e6",
                padding: 10,
                width: 180,
                cursor: "pointer",
                borderRadius: 8,
                background: "#ffffff",
                boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              onClick={() => navigate(`/product/${p.id}`)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.03)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.05)";
              }}
            >
              <img
                src={p.imageUrl}
                width="150"
                style={{ borderRadius: 5, marginBottom: 10 }}
              />
              <p style={{ fontWeight: "600", color: "#212529", margin: 0 }}>
                {p.name}
              </p>
              <p style={{ color: "#198754", fontWeight: "bold", marginTop: 4 }}>
                ₦{p.price}
              </p>
            </div>
          ))
        ) : (
          <p style={{ marginTop: 50, color: "#6c757d", fontSize: 16 }}>
            No products found.
          </p>
        )}
      </div>
    </div>
  );
}