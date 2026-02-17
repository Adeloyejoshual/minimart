// src/pages/Marketplace/AddMarketplaceProduct.jsx
import { useState, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { categoryFields } from "../../config/categoryFields";
import { conditions, usedDetails } from "../../config/conditions";
import { ramOptions } from "../../config/ram";
import { storageOptions } from "../../config/storage";
import { colors } from "../../config/color";
import { engines } from "../../config/engine";
import { fuelTypes } from "../../config/fuelTypes";
import { featuresByCategory } from "../../config/features";
import { promotionPlans } from "../../config/promotion";
import { locationsByState } from "../../config/locationsByState";
import { brands } from "../../config/brands";
import { models } from "../../config/models";
import { sims } from "../../config/sim";
import { years } from "../../config/years";

export default function AddMarketplaceProduct() {
  const { user } = useAuth0();

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    bulk_price_from: "",
    bulk_price_per_piece: "",
    negotiation: "",
    category: "",
    subcategory: "",
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
    age_range: "",
    bedrooms: "",
    bathrooms: "",
    size: "",
    furnished: false,
    features: "",
    exchange_possible: false,
    phone_number: user?.phone_number || "",
    poster_name: user?.name || "",
    location: "",
    state: "",
    country: "Nigeria",
    city: "",
    images: [],
    video_link: "",
    promoted: false,
    promo_plan: "",
    delivery: {},
  });

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "brand") setForm((prev) => ({ ...prev, model: "" }));
  };

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);
    setImageFiles(files);
    setImagePreviews(files.map((file) => URL.createObjectURL(file)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.price || !form.category) {
      alert("Title, Price, and Category are required");
      return;
    }

    try {
      setLoading(true);
      const uploadedUrls = [];

      for (let file of imageFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append(
          "upload_preset",
          import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
        );

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/upload`,
          { method: "POST", body: formData }
        );
        const data = await res.json();
        uploadedUrls.push(data.secure_url);
      }

      const productData = {
        ...form,
        images: uploadedUrls,
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
      if (!response.ok) throw new Error(result.message || "Failed to add product");

      alert("✅ Product added successfully!");
      setForm((prev) => ({
        ...prev,
        title: "",
        description: "",
        price: "",
        bulk_price_from: "",
        bulk_price_per_piece: "",
        negotiation: "",
        category: "",
        subcategory: "",
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
        age_range: "",
        bedrooms: "",
        bathrooms: "",
        size: "",
        furnished: false,
        features: "",
        exchange_possible: false,
        location: "",
        state: "",
        city: "",
        images: [],
        video_link: "",
        promoted: false,
        promo_plan: "",
        delivery: {},
      }));
      setImageFiles([]);
      setImagePreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = null;
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  const visibleFields = categoryFields[form.category] || [];
  const availableBrands = brands[form.category] || [];
  const availableModels = form.brand ? models[form.category]?.[form.brand] || [] : [];
  const categoryFeatures = featuresByCategory[form.category] || [];
  const availableSims = sims || [];
  const availableYears = years || [];

  return (
    <div
      style={{
        maxWidth: "700px",
        margin: "40px auto",
        padding: "20px",
        border: "1px solid #eee",
        borderRadius: "10px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
      }}
    >
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>
        Post Marketplace Ad
      </h2>
      <form onSubmit={handleSubmit}>
        {/* Title & Description */}
        <input
          type="text"
          placeholder="Title"
          value={form.title}
          onChange={(e) => handleChange("title", e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
        />
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => handleChange("description", e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
        />

        {/* Price & Bulk */}
        <input
          type="number"
          placeholder="Price"
          value={form.price}
          onChange={(e) => handleChange("price", e.target.value)}
          style={{
            width: "48%",
            padding: "10px",
            marginBottom: "15px",
            marginRight: "4%",
          }}
        />
        <input
          type="number"
          placeholder="Bulk from (pieces)"
          value={form.bulk_price_from}
          onChange={(e) => handleChange("bulk_price_from", e.target.value)}
          style={{
            width: "24%",
            padding: "10px",
            marginBottom: "15px",
            marginRight: "2%",
          }}
        />
        <input
          type="number"
          placeholder="Per piece (₦)"
          value={form.bulk_price_per_piece}
          onChange={(e) => handleChange("bulk_price_per_piece", e.target.value)}
          style={{ width: "24%", padding: "10px", marginBottom: "15px" }}
        />

        {/* Negotiation */}
        <select
          value={form.negotiation}
          onChange={(e) => handleChange("negotiation", e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
        >
          <option value="">Are you open to negotiation?</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
          <option value="Not sure">Not sure</option>
        </select>

        {/* Category */}
        <select
          value={form.category}
          onChange={(e) => handleChange("category", e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
        >
          <option value="">Select Category</option>
          {Object.keys(categoryFields).map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* Dynamic Fields */}
        {visibleFields.map((field) => {
          switch (field) {
            case "brand":
              return (
                <select
                  key={field}
                  value={form.brand}
                  onChange={(e) => handleChange("brand", e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
                >
                  <option value="">Select Brand</option>
                  {availableBrands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              );
            case "model":
              return (
                <select
                  key={field}
                  value={form.model}
                  onChange={(e) => handleChange("model", e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
                >
                  <option value="">Select Model</option>
                  {availableModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              );
            case "ram":
              return (
                <select
                  key={field}
                  value={form.ram}
                  onChange={(e) => handleChange("ram", e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
                >
                  <option value="">Select RAM</option>
                  {ramOptions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              );
            case "storage":
              return (
                <select
                  key={field}
                  value={form.storage}
                  onChange={(e) => handleChange("storage", e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
                >
                  <option value="">Select Storage</option>
                  {storageOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              );
            case "color":
              return (
                <select
                  key={field}
                  value={form.color}
                  onChange={(e) => handleChange("color", e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
                >
                  <option value="">Select Color</option>
                  {colors.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              );
            case "condition":
              return (
                <select
                  key={field}
                  value={form.condition}
                  onChange={(e) => handleChange("condition", e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
                >
                  <option value="">Select Condition</option>
                  {conditions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              );
            case "used_detail":
              return (
                <select
                  key={field}
                  value={form.used_detail}
                  onChange={(e) => handleChange("used_detail", e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
                >
                  <option value="">Select Detail if Used</option>
                  {usedDetails.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              );
            default:
              return (
                <input
                  key={field}
                  type="text"
                  placeholder={field.replace("_", " ").toUpperCase()}
                  value={form[field]}
                  onChange={(e) => handleChange(field, e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
                />
              );
          }
        })}

        {/* Contact & Location */}
        <h3 style={{ marginBottom: "10px" }}>Contact & Location</h3>
        <input
          type="text"
          placeholder="Phone Number"
          value={form.phone_number}
          onChange={(e) => handleChange("phone_number", e.target.value)}
          style={{
            width: "48%",
            padding: "10px",
            marginBottom: "15px",
            marginRight: "4%",
          }}
        />
        <input
          type="text"
          placeholder="Poster Name"
          value={form.poster_name}
          onChange={(e) => handleChange("poster_name", e.target.value)}
          style={{ width: "48%", padding: "10px", marginBottom: "15px" }}
        />

        {/* State & City */}
        <select
          value={form.state}
          onChange={(e) => {
            handleChange("state", e.target.value);
            handleChange("city", "");
          }}
          style={{
            width: "48%",
            padding: "10px",
            marginBottom: "15px",
            marginRight: "4%",
          }}
        >
          <option value="">Select State</option>
          {Object.keys(locationsByState).map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>

        <select
          value={form.city}
          onChange={(e) => handleChange("city", e.target.value)}
          style={{ width: "48%", padding: "10px", marginBottom: "15px" }}
          disabled={!form.state}
        >
          <option value="">
            {form.state ? "Select City" : "Select State First"}
          </option>
          {(locationsByState[form.state] || []).map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Location / Address"
          value={form.location}
          onChange={(e) => handleChange("location", e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
        />

        {/* Images */}
        <div style={{ marginBottom: "15px" }}>
          <input
            type="file"
            accept="image/*"
            multiple
            ref={fileInputRef}
            onChange={handleImagesChange}
          />
          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginTop: "10px",
            }}
          >
            {imagePreviews.map((src, i) => (
              <img
                key={i}
                src={src}
                alt="Preview"
                style={{
                  width: "80px",
                  height: "80px",
                  objectFit: "cover",
                  borderRadius: "5px",
                }}
              />
            ))}
          </div>
        </div>

        {/* Video Link */}
        <input
          type="text"
          placeholder="Video Link"
          value={form.video_link}
          onChange={(e) => handleChange("video_link", e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
        />

        {/* Post Button */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            background: "black",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            fontSize: "16px",
          }}
        >
          {loading ? "Posting..." : "Post Ad"}
        </button>
      </form>
    </div>
  );
}