// src/pages/Marketplace/AddProduct.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { categories } from "../../config/categories";
import { conditions, usedDetails } from "../../config/conditions";
import { countries, statesByCountry, citiesByState } from "../../config/locations";
import { promotionPlans } from "../../config/promotions";
import "./AddProduct.css";

export default function AddProduct() {
  const [form, setForm] = useState({
    title: "",
    category: "",
    subcategory: "",
    brand: "",
    model: "",
    condition: "New",
    usedDetail: "",
    price: "",
    discountPrice: "",
    negotiable: false,
    description: "",
    specifications: [],
    country: "",
    state: "",
    city: "",
    images: [], // local File objects before upload
    uploadedImages: [], // Cloudinary URLs
    promotionPlan: promotionPlans[0],
    ownerId: "", // Add a valid user ID here for testing
  });

  const [allStates, setAllStates] = useState([]);
  const [allCities, setAllCities] = useState([]);
  const [loading, setLoading] = useState(false);

  // Auto-detect country
  useEffect(() => {
    const detectCountry = async () => {
      try {
        const res = await axios.get("https://ipapi.co/json/");
        const country = res.data.country_name || "Nigeria";
        setForm((prev) => ({ ...prev, country }));
        setAllStates(statesByCountry[country] || []);
      } catch {
        setForm((prev) => ({ ...prev, country: "Nigeria" }));
        setAllStates(statesByCountry["Nigeria"]);
      }
    };
    detectCountry();
  }, []);

  const handleInput = (key, value) => setForm({ ...form, [key]: value });

  const handleStateChange = (state) => {
    setForm({ ...form, state, city: "" });
    setAllCities(citiesByState[state] || []);
  };

  const handleImageChange = (e) => {
    setForm({ ...form, images: [...form.images, ...Array.from(e.target.files)] });
  };

  const removeImage = (i) =>
    setForm({
      ...form,
      images: form.images.filter((_, idx) => idx !== i),
      uploadedImages: form.uploadedImages.filter((_, idx) => idx !== i),
    });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title || !form.price || form.images.length === 0)
      return alert("Title, price, and images are required");

    setLoading(true);
    try {
      // Upload images to Cloudinary
      const uploaded = [];
      for (const img of form.images) {
        const data = new FormData();
        data.append("file", img);
        data.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

        const res = await axios.post(
          `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`,
          data
        );
        uploaded.push(res.data.secure_url);
      }

      setForm((prev) => ({ ...prev, uploadedImages: uploaded }));

      // Prepare payload for backend
      const payload = {
        ...form,
        images: uploaded.map((url) => ({ url, alt: "" })), // matches schema
      };

      // Send to backend
      const res = await axios.post("/api/products", payload);
      alert(res.data.message || "Product added successfully!");

      // Reset form
      setForm({
        title: "",
        category: "",
        subcategory: "",
        brand: "",
        model: "",
        condition: "New",
        usedDetail: "",
        price: "",
        discountPrice: "",
        negotiable: false,
        description: "",
        specifications: [],
        country: form.country,
        state: "",
        city: "",
        images: [],
        uploadedImages: [],
        promotionPlan: promotionPlans[0],
        ownerId: form.ownerId,
      });
      setAllCities([]);
    } catch (err) {
      console.error("Error adding product:", err.response || err);
      alert("Error adding product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-product-page">
      <h2>Add Product</h2>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="Title"
          value={form.title}
          onChange={(e) => handleInput("title", e.target.value)}
        />

        {/* Category */}
        <select value={form.category} onChange={(e) => handleInput("category", e.target.value)}>
          <option value="">Select Category</option>
          {categories.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>

        {form.category && (
          <select value={form.subcategory} onChange={(e) => handleInput("subcategory", e.target.value)}>
            <option value="">Select Subcategory</option>
            {categories
              .find((c) => c.name === form.category)
              ?.subcategories.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
          </select>
        )}

        <input placeholder="Brand" value={form.brand} onChange={(e) => handleInput("brand", e.target.value)} />
        <input placeholder="Model / Variant" value={form.model} onChange={(e) => handleInput("model", e.target.value)} />

        <select value={form.condition} onChange={(e) => handleInput("condition", e.target.value)}>
          {conditions.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>

        {form.condition === "Used" && (
          <select value={form.usedDetail} onChange={(e) => handleInput("usedDetail", e.target.value)}>
            <option value="">Select Used Detail</option>
            {usedDetails.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        )}

        <input type="number" placeholder="Price" value={form.price} onChange={(e) => handleInput("price", e.target.value)} />
        <input
          type="number"
          placeholder="Discount Price (Optional)"
          value={form.discountPrice}
          onChange={(e) => handleInput("discountPrice", e.target.value)}
        />

        <label>
          <input type="checkbox" checked={form.negotiable} onChange={(e) => handleInput("negotiable", e.target.checked)} /> Negotiable
        </label>

        <textarea placeholder="Description" value={form.description} onChange={(e) => handleInput("description", e.target.value)} />

        {/* Location */}
        <select value={form.country} onChange={(e) => handleInput("country", e.target.value)}>
          {countries.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select value={form.state} onChange={(e) => handleStateChange(e.target.value)}>
          <option value="">Select State</option>
          {allStates.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={form.city} onChange={(e) => handleInput("city", e.target.value)}>
          <option value="">Select City</option>
          {allCities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>

        {/* Promotion */}
        <select
          value={form.promotionPlan.id}
          onChange={(e) =>
            handleInput(
              "promotionPlan",
              promotionPlans.find((p) => p.id === Number(e.target.value))
            )
          }
        >
          {promotionPlans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        {/* Images */}
        <input type="file" multiple onChange={handleImageChange} />
        <div className="image-preview">
          {form.images.map((img, i) => (
            <div key={i}>
              <img src={URL.createObjectURL(img)} alt="preview" width={100} />
              <button type="button" onClick={() => removeImage(i)}>✖</button>
            </div>
          ))}
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add Product"}
        </button>
      </form>
    </div>
  );
}