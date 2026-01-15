// pages/Marketplace.jsx
import { useEffect, useState } from "react";
import { collection, getDocs, query, where, or } from "firebase/firestore";
import { db } from "../firebase";
import TopNav from "../components/TopNav";
import { useNavigate } from "react-router-dom";
import CategoryFilter from "../components/CategoryFilter";

export default function Marketplace() {
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
      let q = query(collection(db, "products"));
      const snap = await getDocs(q);
      let allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Filter by category
      if (selectedCategory) {
        allProducts = allProducts.filter(p => p.category === selectedCategory);
      }

      // Include all MiniMart + Marketplace products
      allProducts = allProducts.filter(p => p.marketType === "marketplace" || p.marketType === "minimart");

      setProducts(allProducts);
    };
    load();
  }, [selectedCategory]);

  return (
    <>
      <TopNav />

      <div style={{ background: "#fff3cd", padding: 10, marginBottom: 10 }}>
        ⚠️ Do NOT pay before delivery.  
        Always inspect the product before paying.  
        MiniMart is not responsible for Marketplace payments.
      </div>

      <h2>Marketplace</h2>

      <CategoryFilter
        categories={categories}
        selected={selectedCategory}
        onChange={setSelectedCategory}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        {products.map(p => (
          <div
            key={p.id}
            style={{ border: "1px solid #ccc", padding: 10, width: 180, cursor: "pointer" }}
            onClick={() => navigate(`/product/${p.id}`)}
          >
            <img src={p.imageUrl} width="150" />
            <p><b>{p.name}</b></p>
            <p>₦{p.price}</p>
          </div>
        ))}
      </div>
    </>
  );
}