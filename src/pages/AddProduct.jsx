import React, { useState } from "react";

// MINI AddProduct for debugging
export default function AddProduct() {
  const [form, setForm] = useState({ title: "", description: "", price: "" });
  const [error, setError] = useState("");

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    if (!form.description.trim()) {
      setError("Description is required");
      return;
    }
    if (!form.price || Number(form.price) <= 0) {
      setError("Valid price required");
      return;
    }

    setError("");
    alert("✅ Valid form! In real app, this would create the product.");
  };

  return (
    <div style={{
      maxWidth: "600px",
      margin: "40px auto",
      padding: "24px",
      border: "1px solid #0077ff",
      borderRadius: "12px",
      background: "#f0f7ff",
      fontFamily: "Segoe UI, sans-serif",
    }}>
      <h1 style={{ color: "#0077ff", marginBottom: "20px" }}>Mini Add Product</h1>

      {error && (
        <div style={{
          padding: "10px",
          marginBottom: "16px",
          borderRadius: "6px",
          background: "#fee",
          color: "#c33",
          border: "1px solid #fab",
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label style={{ display: "block", fontWeight: 600, color: "#004" }}>
            Title
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Enter title"
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #99f",
              fontSize: "16px",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 600, color: "#004" }}>
            Description
          </label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Enter description"
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #99f",
              fontSize: "16px",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontWeight: 600, color: "#004" }}>
            Price (₦)
          </label>
          <input
            type="text"
            value={form.price}
            onChange={(e) => update("price", e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="Enter price"
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid #99f",
              fontSize: "16px",
            }}
          />
        </div>

        <button
          type="submit"
          style={{
            padding: "12px 20px",
            backgroundColor: "#0077ff",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          Create Product
        </button>
      </form>
    </div>
  );
}