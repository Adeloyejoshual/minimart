import { useState, useRef } from "react";
import { categoryFields } from "../../config/categoryFields";
import { locationsByState } from "../../config/locationsByState";
import { conditions } from "../../config/condition";
import { promotionPlans } from "../../config/promotion";

export default function AddMarketplaceProduct() {
  const [form, setForm] = useState({
    title: "",
    category: "",
    subcategory: "",
    brand: "",
    model: "",
    condition: "",
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
    furnished: "",
    features: "",
    exchange_possible: false,
    description: "",
    price: "",
    phone_number: "",
    poster_name: "",
    state: "",
    location: "",
    images: [],
    video_link: "",
    promoted: false,
    promo_plan: "",
  });

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
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

      const response = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, images: uploadedUrls }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to add product");

      alert("✅ Product added successfully!");
      setForm({
        title: "",
        category: "",
        subcategory: "",
        brand: "",
        model: "",
        condition: "",
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
        furnished: "",
        features: "",
        exchange_possible: false,
        description: "",
        price: "",
        phone_number: "",
        poster_name: "",
        state: "",
        location: "",
        images: [],
        video_link: "",
        promoted: false,
        promo_plan: "",
      });
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

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto" }}>
      <h2>Add Marketplace Product</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Title"
          value={form.title}
          onChange={(e) => handleChange("title", e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
        />

        <select
          value={form.category}
          onChange={(e) => handleChange("category", e.target.value)}
          style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
        >
          <option value="">Select Category</option>
          {Object.keys(categoryFields).map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {visibleFields.map((field) => {
          switch (field) {
            case "brand":
            case "model":
            case "color":
            case "engine":
            case "fuel_type":
            case "transmission":
            case "age_range":
            case "property_type":
            case "size":
              return (
                <input
                  key={field}
                  type="text"
                  placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                  value={form[field]}
                  onChange={(e) => handleChange(field, e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
                />
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
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              );
            case "ram":
            case "storage":
            case "mileage":
            case "year":
            case "bedrooms":
            case "bathrooms":
              return (
                <input
                  key={field}
                  type="number"
                  placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                  value={form[field]}
                  onChange={(e) => handleChange(field, e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
                />
              );
            case "exchange_possible":
            case "furnished":
            case "promoted":
              return (
                <label key={field} style={{ display: "block", marginBottom: "15px" }}>
                  <input
                    type="checkbox"
                    checked={form[field]}
                    onChange={(e) => handleChange(field, e.target.checked)}
                  /> {field.replace("_", " ").toUpperCase()}
                </label>
              );
            case "description":
              return (
                <textarea
                  key={field}
                  placeholder="Description"
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
                />
              );
            case "price":
              return (
                <input
                  key={field}
                  type="number"
                  placeholder="Price"
                  value={form.price}
                  onChange={(e) => handleChange("price", e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
                />
              );
            case "phone_number":
            case "poster_name":
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
            case "state":
              return (
                <select
                  key={field}
                  value={form.state}
                  onChange={(e) => handleChange("state", e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
                >
                  <option value="">Select State</option>
                  {Object.keys(locationsByState).map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              );
            case "location":
              return (
                <select
                  key={field}
                  value={form.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
                >
                  <option value="">Select Location</option>
                  {locationsByState[form.state]?.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              );
            case "images":
              return (
                <div key={field} style={{ marginBottom: "15px" }}>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    ref={fileInputRef}
                    onChange={handleImagesChange}
                  />
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
                    {imagePreviews.map((src, i) => (
                      <img key={i} src={src} alt="Preview" style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "5px" }} />
                    ))}
                  </div>
                </div>
              );
            case "video_link":
              return (
                <input
                  key={field}
                  type="text"
                  placeholder="Video link"
                  value={form.video_link}
                  onChange={(e) => handleChange("video_link", e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
                />
              );
            case "promo_plan":
              return form.promoted && (
                <select
                  key={field}
                  value={form.promo_plan}
                  onChange={(e) => handleChange("promo_plan", e.target.value)}
                  style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
                >
                  <option value="">Select Promotion Plan</option>
                  {promotionPlans.map((p) => (
                    <option key={p.name} value={p.name}>{p.name} - ₦{p.price}</option>
                  ))}
                </select>
              );
            default:
              return null;
          }
        })}

        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", padding: "12px", background: "black", color: "#fff", border: "none", cursor: "pointer" }}
        >
          {loading ? "Adding..." : "Post Ad"}
        </button>
      </form>
    </div>
  );
}