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

  // Firestore listener
  useEffect(() => {
    const now = new Date();
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allProducts = snapshot.docs
        .map((d) => {
          const data = d.data();
          if (data.isPromoted && data.promotionExpiresAt?.toDate() < now) {
            data.isPromoted = false;
          }
          return { id: d.id, ...data };
        })
        .filter((p) => p.marketType === "marketplace" || p.marketType === "minimart");

      // Promoted first
      allProducts.sort((a, b) => (b.isPromoted === a.isPromoted ? 0 : b.isPromoted ? -1 : 1));

      setProducts(allProducts);
      setFilteredProducts(allProducts);
    });

    return () => unsubscribe();
  }, []);

  // Filtering
  useEffect(() => {
    let result = [...products];
    if (selectedCategory) result = result.filter((p) => p.mainCategory === selectedCategory);
    if (selectedSubCategory) result = result.filter((p) => p.subCategory === selectedSubCategory);
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

      {/* Warning */}
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

      {/* Add Product */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <button
          onClick={() => navigate("/add-product?market=marketplace")}
          style={{
            background: "#0d6efd",
            color: "#fff",
            padding: "10px 25px",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 500,
            fontSize: 14,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#0b5ed7"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#0d6efd"; }}
        >
          + Add Product / Post Ad
        </button>
      </div>

      {/* Filters */}
      <div style={{ maxWidth: 900, margin: "0 auto 20px" }}>
        <SearchBar onSearch={setSearchQuery} />
        <CategoryFilter
          categories={Object.keys(categories)}
          selected={selectedCategory}
          onChange={(cat) => {
            setSelectedCategory(cat);
            setSelectedSubCategory("");
          }}
        />
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
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 20,
          maxWidth: 1000,
          margin: "0 auto",
          padding: "0 10px",
        }}
      >
        {filteredProducts.length > 0 ? (
          filteredProducts.map((p) => {
            const imageSrc = p.coverImage || (p.images && p.images[0]) || "/placeholder.png";
            return (
              <div
                key={p.id}
                style={{
                  position: "relative",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "#fff",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.08)",
                  cursor: "pointer",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  display: "flex",
                  flexDirection: "column",
                }}
                onClick={() => navigate(`/product/${p.id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-5px)";
                  e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.18)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 15px rgba(0,0,0,0.08)";
                }}
              >
                {/* Image */}
                <img
                  src={imageSrc}
                  alt={p.title || "Product Image"}
                  style={{ width: "100%", height: 180, objectFit: "cover" }}
                  onError={(e) => (e.target.src = "/placeholder.png")}
                />

                {/* Price Ribbon */}
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    background: "#198754",
                    color: "#fff",
                    padding: "3px 8px",
                    fontSize: 12,
                    fontWeight: "bold",
                    borderRadius: 4,
                  }}
                >
                  ₦{p.price}
                </div>

                {/* Promoted Badge */}
                {p.isPromoted && (
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      background: "#ff4d4f",
                      color: "#fff",
                      padding: "3px 8px",
                      fontSize: 10,
                      fontWeight: "bold",
                      borderRadius: 4,
                    }}
                  >
                    PROMOTED
                  </div>
                )}

                {/* Details */}
                <div style={{ padding: 12, textAlign: "left", flex: 1 }}>
                  <p
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      margin: "5px 0",
                      minHeight: "38px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {p.title || p.name}
                  </p>
                  {p.city && p.state && (
                    <p style={{ fontSize: 12, color: "#6c757d", margin: "2px 0" }}>
                      {p.city}, {p.state}
                    </p>
                  )}
                  {p.condition && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "#6c757d",
                        margin: "2px 0",
                        fontStyle: "italic",
                      }}
                    >
                      {p.condition}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p style={{ marginTop: 50, color: "#6c757d", fontSize: 16, textAlign: "center" }}>
            No products found.
          </p>
        )}
      </div>
    </div>
  );
}