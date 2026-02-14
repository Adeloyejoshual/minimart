// src/pages/Marketplace/AddMarketplaceProduct.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";
import nigerianStates from "../../config/nigerianStates"; // array of { state, cities: [] }

export default function AddMarketplaceProduct() {
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: "",
    category: "",
    subcategory: "",
    description: "",
    price: "",
    country: "Nigeria",
    state: "",
    city: "",
    image: null,
  });

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isAuthenticated) {
    loginWithRedirect();
    return null;
  }

  // Handle input changes
  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "image" && files[0]) {
      setForm({ ...form, image: files[0] });
      setPreview(URL.createObjectURL(files[0]));
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  // Handle state change to reset city
  const handleStateChange = (e) => {
    setForm({ ...form, state: e.target.value, city: "" });
  };

  // Submit product
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.price) {
      alert("Title and Price are required.");
      return;
    }

    setLoading(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value) data.append(key, value);
      });

      const res = await axios.post("/api/marketplace", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Product added successfully!");
      navigate("/");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  // Get cities for selected state
  const cities = form.state
    ? nigerianStates.find((s) => s.state === form.state)?.cities || []
    : [];

  return (
    <div style={{ padding: "16px", maxWidth: "600px", margin: "0 auto" }}>
      <h2>Add Marketplace Product</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Title*:
          <input type="text" name="title" value={form.title} onChange={handleChange} required />
        </label>

        <label>
          Category*:
          <input type="text" name="category" value={form.category} onChange={handleChange} placeholder="Electronics, Fashion..." />
        </label>

        <label>
          Subcategory:
          <input type="text" name="subcategory" value={form.subcategory} onChange={handleChange} placeholder="Mobile Phones, Laptops..." />
        </label>

        <label>
          Description:
          <textarea name="description" value={form.description} onChange={handleChange} rows={4} />
        </label>

        <label>
          Price*:
          <input type="number" name="price" value={form.price} onChange={handleChange} required />
        </label>

        <label>
          State*:
          <select name="state" value={form.state} onChange={handleStateChange} required>
            <option value="">Select State</option>
            {nigerianStates.map((s) => (
              <option key={s.state} value={s.state}>{s.state}</option>
            ))}
          </select>
        </label>

        <label>
          City / LGA*:
          <select name="city" value={form.city} onChange={handleChange} required>
            <option value="">Select City / LGA</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label>
          Product Image:
          <input type="file" name="image" accept="image/*" onChange={handleChange} />
        </label>

        {preview && (
          <div style={{ margin: "12px 0" }}>
            <img src={preview} alt="Preview" style={{ width: "150px", borderRadius: "12px", objectFit: "cover" }} />
            <button type="button" onClick={() => { setForm({ ...form, image: null }); setPreview(null); }}>Remove</button>
          </div>
        )}

        <button type="submit" disabled={loading} style={{ padding: "12px", width: "100%", background: "#0D6EFD", color: "#fff", border: "none", borderRadius: "12px", fontSize: "16px" }}>
          {loading ? "Adding..." : "Add Product"}
        </button>
      </form>
    </div>
  );
}