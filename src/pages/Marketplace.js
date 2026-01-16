import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import TopNav from "../components/TopNav";
import CategoryFilter from "../components/CategoryFilter";
import SearchBar from "../components/SearchBar";
import { useNavigate } from "react-router-dom";
import categories from "../config/categories";

export default function Marketplace() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  // Real-time Firestore listener
  useEffect(() => {
    const now = new Date();
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allProducts = snapshot.docs
        .map((d) => {
          const data = d.data();

          // Auto-revert expired promotions
          if (data.isPromoted && data.promotionExpiresAt?.toDate() < now) {
            data.isPromoted = false;
          }

          return { id: d.id, ...data };
        })
        .filter((p) => p.marketType === "marketplace" || p.marketType === "minimart");

      // Promoted first
      allProducts.sort((a, b) =>
        b.isPromoted === a.isPromoted ? 0 : b.isPromoted ? -1 : 1
      );

      setProducts(allProducts);
      setFilteredProducts(allProducts);
    });

    return () => unsubscribe();
  }, []);

  // Filter by category / subcategory / search
  useEffect(() => {
    let result = [...products];

    if (selectedCategory) {
      result = result.filter((p) => p.mainCategory === selectedCategory);
    }

    if (selectedSubCategory) {
      result = result.filter((p) => p.subCategory === selectedSubCategory);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.mainCategory?.toLowerCase().includes(q) ||
          p.subCategory?.toLowerCase().includes(q)
      );
    }

    setFilteredProducts(result);
  }, [products, selectedCategory, selectedSubCategory, searchQuery]);

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

      {/* Add Product Button */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <button
          onClick={() => navigate("/add-product?market=marketplace")}
          style={{
            background: "#0d6efd",
            color: "#fff",
            padding: "10px 20px",
            border: "none",
            borderRadius: 5,
            cursor: "pointer",
          }}
        >
          + Add Product / Post Ad
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto 20px" }}>
        <SearchBar onSearch={setSearchQuery} />

        {/* Main Category Filter */}
        <CategoryFilter
          categories={Object.keys(categories)}
          selected={selectedCategory}
          onChange={(cat) => {
            setSelectedCategory(cat);
            setSelectedSubCategory(""); // reset subcategory
          }}
        />

        {/* Subcategory Filter */}
        {selectedCategory && categories[selectedCategory]?.length > 0 && (
          <CategoryFilter
            categories={categories[selectedCategory]}
            selected={selectedSubCategory}
            onChange={setSelectedSubCategory}
            label="Subcategory"
          />
        )}
      </div>

      {/* Products Grid */}
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
              {p.isPromoted && (
                <span style={{ color: "red", fontWeight: "bold" }}>Promoted</span>
              )}
              <img
                src={p.coverImage || (p.images && p.images[0]) || "/placeholder.png"}
                width="150"
                style={{ borderRadius: 5, marginBottom: 10 }}
                alt={p.title || "Product Image"}
              />
              <p style={{ fontWeight: "600", color: "#212529", margin: 0 }}>
                {p.title || p.name}
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