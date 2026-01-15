
// pages/MiniMart.jsx
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import TopNav from "../components/TopNav";
import { useNavigate } from "react-router-dom";
import CategoryFilter from "../components/CategoryFilter";

export default function MiniMart() {
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
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

  useEffect(() => {
    const load = async () => {
      let q = query(collection(db, "products"), where("marketType", "==", "minimart"));
      const snap = await getDocs(q);
      let allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Filter by category if selected
      if (selectedCategory) {
        allProducts = allProducts.filter(p => p.category === selectedCategory);
      }

      setProducts(allProducts);
    };
    load();
  }, [selectedCategory]);

  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh", paddingBottom: 50 }}>
      <TopNav />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: 900,
          margin: "20px auto",
        }}
      >
        <h2 style={{ color: "#0D6EFD" }}>MiniMart (Verified Sellers)</h2>
        <button
          onClick={() => navigate("/add-product?market=minimart")}
          style={{
            padding: "10px 20px",
            background: "#198754",
            color: "#fff",
            border: "none",
            borderRadius: 5,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Add Product
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: "10px auto" }}>
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
          margin: "20px auto",
          justifyContent: "center",
        }}
      >
        {products.map(p => (
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
            onMouseEnter={e => {
              e.currentTarget.style.transform = "scale(1.03)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
            }}
            onMouseLeave={e => {
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
        ))}
      </div>
    </div>
  );
}