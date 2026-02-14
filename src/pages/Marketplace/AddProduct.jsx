// src/pages/Marketplace/AddProduct.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { addMarketplaceProduct } from "../../helpers/marketplace";

export default function AddMarketplaceProduct() {
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    subcategory: "",
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

  // ---------------- Handle input changes ----------------
  const handleChange = (e) => {
    const { name, value, files } = e.target;

    if (name === "images" && files.length) {
      const fileArray = Array.from(files);
      setForm(prev => ({ ...prev, images: fileArray }));
      setPreviews(fileArray.map(f => URL.createObjectURL(f)));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  // ---------------- Submit form ----------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    // ✅ Validate required fields
    const required = ["title", "price", "category", "state", "city"];
    for (let field of required) {
      if (!form[field]) {
        alert(`${field.charAt(0).toUpperCase() + field.slice(1)} is required`);
        return;
      }
    }

    setLoading(true);
    try {
      const data = new FormData();
      data.append("title", form.title);
      data.append("description", form.description);
      data.append("price", form.price);
      data.append("category", form.category);
      data.append("subcategory", form.subcategory);
      data.append("state", form.state);
      data.append("city", form.city);

      // Multiple images
      form.images.forEach(img => data.append("images", img));

      await addMarketplaceProduct(data);
      alert("Product added successfully!");
      navigate("/marketplace");
    } catch (err) {
      console.error(err);
      alert("Failed to add product. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "16px" }}>
      <h2>Add Marketplace Product</h2>
      <form onSubmit={handleSubmit}>

        <label>Title*:
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={handleChange}
            required
          />
        </label>

        <label>Description:
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={4}
          />
        </label>

        <label>Price*:
          <input
            type="number"
            name="price"
            value={form.price}
            onChange={handleChange}
            required
          />
        </label>

        <label>Category*:
          <input
            type="text"
            name="category"
            value={form.category}
            onChange={handleChange}
            required
          />
        </label>

        <label>Subcategory:
          <input
            type="text"
            name="subcategory"
            value={form.subcategory}
            onChange={handleChange}
          />
        </label>

        <label>State*:
          <input
            type="text"
            name="state"
            value={form.state}
            onChange={handleChange}
            required
          />
        </label>

        <label>City*:
          <input
            type="text"
            name="city"
            value={form.city}
            onChange={handleChange}
            required
          />
        </label>

        <label>Upload Images:
          <input
            type="file"
            name="images"
            accept="image/*"
            multiple
            onChange={handleChange}
          />
        </label>

        {/* Previews */}
        {previews.length > 0 && (
          <div style={{ display: "flex", gap: "8px", margin: "12px 0" }}>
            {previews.map((p, i) => (
              <img
                key={i}
                src={p}
                alt="Preview"
                style={{ width: "100px", height: "100px", objectFit: "cover", borderRadius: "8px" }}
              />
            ))}
          </div>
        )}

        <button type="submit" disabled={loading} style={{
          padding: "12px",
          width: "100%",
          borderRadius: "12px",
          background: "#0D6EFD",
          color: "#fff",
          fontWeight: 600,
          fontSize: "16px",
          border: "none",
          cursor: "pointer"
        }}>
          {loading ? "Adding..." : "Add Product"}
        </button>
      </form>
    </div>
  );
}