// src/pages/AddProductPage.jsx
import { useEffect, useState } from "react";
import { locationsByState } from "../config/locationsByState.js"; // 👈 ADD this
import "./AddProduct.css"; // or your global styles

export default function AddProductPage() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: "",
    price: "",
    mainCategory: "",
  });

  const states = Object.keys(locationsByState || []);

  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then((res) => res.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  return (
    <div className="add-product-container">
      <h2>Add Product</h2>

      {/* CATEGORY */}
      <div className="field">
        <label>Category</label>
        <select
          value={form.mainCategory}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, mainCategory: e.target.value }))
          }
        >
          <option value="">Select category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* STATE */}
      <div className="field">
        <label>State</label>
        <select
          value=""
          onChange={() => {}}
        >
          <option value="">Select state</option>
          {states.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>

        {/* Simple test */}
        <div style={{ color: "red", marginTop: 6 }}>
          States loaded: {states.length === 0 ? "❌ NO" : "✅ YES, count = " + states.length}
        </div>
      </div>

      {/* TITLE & PRICE */}
      <div className="field">
        <label>Title</label>
        <input
          value={form.title}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, title: e.target.value }))
          }
          placeholder="Title"
        />
      </div>

      <div className="field">
        <label>Price (₦)</label>
        <input
          type="number"
          value={form.price}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, price: e.target.value }))
          }
        />
      </div>
    </div>
  );
}