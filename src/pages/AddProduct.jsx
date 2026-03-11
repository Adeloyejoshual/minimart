import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function AddProduct() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    image_url: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await axios.post("/api/marketplace", {
        title: formData.title.trim(),
        description: formData.description.trim(),
        price: formData.price,
        image_url: formData.image_url.trim() || null,
      });
      setLoading(false);
      alert("Product added successfully!");
      navigate(`/product/${res.data.id}`);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to add product");
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", padding: "20px", background: "#fff", borderRadius: "12px", boxShadow: "0 6px 12px rgba(0,0,0,0.1)" }}>
      <h2 style={{ marginBottom: "20px", color: "#0D6EFD" }}>Add New Product</h2>

      {error && <p style={{ color: "red", marginBottom: "10px" }}>{error}</p>}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <input
          type="text"
          name="title"
          placeholder="Product Title"
          value={formData.title}
          onChange={handleChange}
          required
          style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }}
        />

        <textarea
          name="description"
          placeholder="Product Description"
          value={formData.description}
          onChange={handleChange}
          rows={4}
          style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }}
        />

        <input
          type="number"
          name="price"
          placeholder="Price (₦)"
          value={formData.price}
          onChange={handleChange}
          required
          style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }}
        />

        <input
          type="text"
          name="image_url"
          placeholder="Image URL (optional)"
          value={formData.image_url}
          onChange={handleChange}
          style={{ padding: "10px", borderRadius: "8px", border: "1px solid #ccc" }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px",
            background: "#0D6EFD",
            color: "#fff",
            fontWeight: 600,
            borderRadius: "10px",
            border: "none",
            cursor: "pointer"
          }}
        >
          {loading ? "Adding..." : "Add Product"}
        </button>
      </form>
    </div>
  );
}