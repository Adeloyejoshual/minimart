// src/pages/Marketplace/AddProduct.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { addMarketplaceProduct } from "../../helpers/marketplace";

const COUNTRIES = ["Nigeria", "Ghana", "Kenya", "USA", "UK"];
const NIGERIA_STATES = ["Lagos", "Abuja", "Rivers", "Oyo", "Kaduna"];
const SAMPLE_CATEGORIES = {
  Electronics: ["Phones", "Laptops", "TVs"],
  Fashion: ["Clothes", "Shoes", "Bags"],
  Vehicles: ["Cars", "Bikes", "Trucks"],
};

export default function AddMarketplaceProduct() {
  const { isAuthenticated, loginWithRedirect, user } = useAuth0();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    subCategory: "",
    country: "Nigeria",
    state: "",
    city: "",
    images: [],
  });
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);

  if (!isAuthenticated) {
    loginWithRedirect();
    return null;
  }

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "images" && files) {
      const newImages = Array.from(files);
      setForm((prev) => ({ ...prev, images: [...prev.images, ...newImages] }));
      setPreviews((prev) => [...prev, ...newImages.map(f => URL.createObjectURL(f))]);
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const removeImage = (index) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.price || !form.category) {
      return alert("Title, Price and Category are required.");
    }

    setLoading(true);
    try {
      const data = new FormData();
      Object.keys(form).forEach(key => {
        if (key !== "images") data.append(key, form[key]);
      });
      form.images.forEach(img => data.append("images", img));

      await addMarketplaceProduct(data);
      alert("Product added successfully!");
      navigate("/marketplace");
    } catch (err) {
      console.error(err);
      alert("Failed to add product.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "16px", maxWidth: "600px", margin: "0 auto" }}>
      <h2>Add Marketplace Product</h2>

      <form onSubmit={handleSubmit}>
        {/* Product Details */}
        <label>Title*:
          <input name="title" value={form.title} onChange={handleChange} required />
        </label>

        <label>Category*:
          <select name="category" value={form.category} onChange={handleChange} required>
            <option value="">Select Category</option>
            {Object.keys(SAMPLE_CATEGORIES).map(cat => <option key={cat}>{cat}</option>)}
          </select>
        </label>

        {form.category && (
          <label>Subcategory:
            <select name="subCategory" value={form.subCategory} onChange={handleChange}>
              <option value="">Select Subcategory</option>
              {SAMPLE_CATEGORIES[form.category].map(sub => <option key={sub}>{sub}</option>)}
            </select>
          </label>
        )}

        <label>Description:
          <textarea name="description" value={form.description} onChange={handleChange} rows={4} />
        </label>

        <label>Price*:
          <input type="number" name="price" value={form.price} onChange={handleChange} required />
        </label>

        {/* Location */}
        <label>Country:
          <select name="country" value={form.country} onChange={handleChange}>
            {COUNTRIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </label>

        {form.country === "Nigeria" && (
          <>
            <label>State:
              <select name="state" value={form.state} onChange={handleChange}>
                <option value="">Select State</option>
                {NIGERIA_STATES.map(s => <option key={s}>{s}</option>)}
              </select>
            </label>

            <label>City:
              <input name="city" value={form.city} onChange={handleChange} />
            </label>
          </>
        )}

        {/* Images */}
        <label>Upload Images:
          <input type="file" name="images" multiple accept="image/*" onChange={handleChange} />
        </label>

        {previews.length > 0 && (
          <div style={{ display: "flex", gap: "8px", margin: "12px 0", flexWrap: "wrap" }}>
            {previews.map((url, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img src={url} alt="preview" style={{ width: "100px", height: "100px", objectFit: "cover", borderRadius: "8px" }} />
                <button type="button" onClick={() => removeImage(i)} style={{ position: "absolute", top: 0, right: 0, background: "red", color: "#fff", border: "none", borderRadius: "50%", width: "20px", height: "20px", cursor: "pointer" }}>×</button>
              </div>
            ))}
          </div>
        )}

        <button type="submit" disabled={loading} style={{ padding: "12px", width: "100%", marginTop: "12px", background: "#0D6EFD", color: "#fff", borderRadius: "8px" }}>
          {loading ? "Adding..." : "Add Product"}
        </button>
      </form>
    </div>
  );
}