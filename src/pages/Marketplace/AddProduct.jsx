// src/pages/Marketplace/AddMarketplaceProduct.jsx

import { useState, useRef, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";

import { categoryFields } from "../../config/categoryFields";
import { conditions, usedDetails } from "../../config/conditions";
import { ramOptions } from "../../config/ram";
import { storageOptions } from "../../config/storage";
import { colors } from "../../config/color";
import { engines } from "../../config/engine";
import { fuelTypes } from "../../config/fuelTypes";
import { featuresByCategory } from "../../config/features";
import { locationsByState } from "../../config/locationsByState";
import { brands } from "../../config/brands";
import { models } from "../../config/models";
import { sims } from "../../config/sim";
import { years } from "../../config/years";

const MAX_IMAGES = 6;

export default function AddMarketplaceProduct() {
  const { user } = useAuth0();

  const [activeSelector, setActiveSelector] = useState(null);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    bulk_price_from: "",
    bulk_price_per_piece: "",
    negotiation: "",
    category: "",
    brand: "",
    model: "",
    condition: "",
    used_detail: "",
    ram: "",
    storage: "",
    color: "",
    sim: "",
    engine: "",
    mileage: "",
    year: "",
    fuel_type: "",
    transmission: "",
    features: "",
    exchange_possible: false,
    furnished: false,
    state: "",
    city: "",
    country: "Nigeria",
    images: [],
    video_link: "",
    seller_id: user?.sub || "",
    poster_name: user?.name || "",
    phone_number: user?.phone_number || "",
    delivery: {
      pickup: false,
      nationwide: false,
      delivery_fee: "",
    },
  });

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  const visibleFields = categoryFields[form.category] || [];
  const availableBrands = brands[form.category] || [];
  const availableModels =
    form.brand && models[form.category]
      ? models[form.category][form.brand] || []
      : [];
  const categoryFeatures = featuresByCategory[form.category] || [];

  /* ---------------------- */
  /* HANDLE CHANGE */
  /* ---------------------- */
  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "brand" && { model: "" }),
      ...(field === "state" && { city: "" }),
    }));
  };

  /* ---------------------- */
  /* IMAGE HANDLING */
  /* ---------------------- */
  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);

    if (files.length > MAX_IMAGES) {
      alert(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }

    setImageFiles(files);
    setImagePreviews(files.map((file) => URL.createObjectURL(file)));
  };

  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imagePreviews]);

  /* ---------------------- */
  /* SUBMIT */
  /* ---------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title || !form.price || !form.category) {
      alert("Title, Price and Category are required.");
      return;
    }

    if (imageFiles.length === 0) {
      alert("Upload at least one image.");
      return;
    }

    try {
      setLoading(true);

      const uploadPromises = imageFiles.map((file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append(
          "upload_preset",
          import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
        );

        return fetch(
          `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/upload`,
          { method: "POST", body: formData }
        ).then((res) => res.json());
      });

      const uploadResults = await Promise.all(uploadPromises);
      const uploadedUrls = uploadResults.map((data) => data.secure_url);

      const productData = {
        ...form,
        images: uploadedUrls,
        slug: form.title.toLowerCase().replace(/\s+/g, "-"),
        created_at: new Date(),
        views: 0,
        bulk_price: {
          from: form.bulk_price_from || null,
          per_piece: form.bulk_price_per_piece || null,
        },
      };

      const response = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });

      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || "Failed to add product");

      alert("✅ Product added successfully!");

      setForm((prev) => ({
        ...prev,
        title: "",
        description: "",
        price: "",
        category: "",
        brand: "",
        model: "",
        condition: "",
        used_detail: "",
        ram: "",
        storage: "",
        color: "",
        sim: "",
        engine: "",
        mileage: "",
        year: "",
        fuel_type: "",
        transmission: "",
        features: "",
        state: "",
        city: "",
        images: [],
        video_link: "",
      }));

      setImageFiles([]);
      setImagePreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = null;
    } catch (err) {
      console.error(err);
      alert(err.message || "Error posting ad");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------- */
  /* FULL PAGE SELECTOR */
  /* ---------------------- */
  const FullPageSelector = ({ title, options, field }) => (
    <div style={styles.overlay}>
      <div style={styles.header}>
        <button onClick={() => setActiveSelector(null)}>← Back</button>
        <h3>{title}</h3>
      </div>
      <div style={styles.list}>
        {options.map((option) => (
          <div
            key={option}
            style={styles.item}
            onClick={() => {
              handleChange(field, option);
              setActiveSelector(null);
            }}
          >
            {option}
          </div>
        ))}
      </div>
    </div>
  );

  /* ---------------------- */
  /* RENDER */
  /* ---------------------- */
  return (
    <div style={styles.container}>
      <h2 style={{ textAlign: "center" }}>Post Marketplace Ad</h2>

      <form onSubmit={handleSubmit}>
        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) => handleChange("title", e.target.value)}
          style={styles.input}
        />

        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => handleChange("description", e.target.value)}
          style={styles.input}
        />

        <input
          type="number"
          placeholder="Price"
          value={form.price}
          onChange={(e) => handleChange("price", e.target.value)}
          style={styles.input}
        />

        {/* CATEGORY */}
        <div
          style={styles.selectorInput}
          onClick={() => setActiveSelector("category")}
        >
          {form.category || "Select Category"}
        </div>

        {/* Dynamic Fields */}
        {visibleFields.includes("brand") && (
          <div
            style={styles.selectorInput}
            onClick={() => setActiveSelector("brand")}
          >
            {form.brand || "Select Brand"}
          </div>
        )}

        {visibleFields.includes("model") && (
          <div
            style={styles.selectorInput}
            onClick={() => setActiveSelector("model")}
          >
            {form.model || "Select Model"}
          </div>
        )}

        {/* IMAGES */}
        <input
          type="file"
          accept="image/*"
          multiple
          ref={fileInputRef}
          onChange={handleImagesChange}
          style={{ marginTop: 15 }}
        />

        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? "Posting..." : "Post Ad"}
        </button>
      </form>

      {/* SELECTOR SCREENS */}
      {activeSelector === "category" && (
        <FullPageSelector
          title="Select Category"
          options={Object.keys(categoryFields)}
          field="category"
        />
      )}

      {activeSelector === "brand" && (
        <FullPageSelector
          title="Select Brand"
          options={availableBrands}
          field="brand"
        />
      )}

      {activeSelector === "model" && (
        <FullPageSelector
          title="Select Model"
          options={availableModels}
          field="model"
        />
      )}
    </div>
  );
}

/* ---------------------- */
/* STYLES */
/* ---------------------- */
const styles = {
  container: {
    maxWidth: 700,
    margin: "40px auto",
    padding: 20,
    borderRadius: 10,
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    background: "#fff",
  },
  input: {
    width: "100%",
    padding: 12,
    marginBottom: 15,
    border: "1px solid #ddd",
    borderRadius: 6,
  },
  selectorInput: {
    padding: 12,
    border: "1px solid #ddd",
    borderRadius: 6,
    marginBottom: 15,
    cursor: "pointer",
  },
  button: {
    width: "100%",
    padding: 14,
    background: "black",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 16,
    cursor: "pointer",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "#fff",
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: 15,
    borderBottom: "1px solid #eee",
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  list: {
    overflowY: "auto",
    flex: 1,
  },
  item: {
    padding: 15,
    borderBottom: "1px solid #f2f2f2",
    cursor: "pointer",
  },
};