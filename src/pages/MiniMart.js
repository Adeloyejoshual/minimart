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
      if (selectedCategory) q = query(q, where("category", "==", selectedCategory));
      const snap = await getDocs(q);
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    load();
  }, [selectedCategory]);

  return (
    <>
      <TopNav />
      <h2>MiniMart (Verified Sellers)</h2>

      <button onClick={() => navigate("/add-product?market=minimart")}>
        Add Product
      </button>

      <CategoryFilter
        categories={categories}
        selected={selectedCategory}
        onChange={setSelectedCategory}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        {products.map((p) => (
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