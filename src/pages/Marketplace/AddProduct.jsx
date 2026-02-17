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
import { locationsByState } from "../../config/locationsByState";
import { brands } from "../../config/brands";
import { models } from "../../config/models";
import { sims } from "../../config/sim";
import { years } from "../../config/years";

export default function AddMarketplaceProduct() {
  const { user } = useAuth0();

  const [activeSelector, setActiveSelector] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

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
    bedrooms: "",
    bathrooms: "",
    size: "",
    furnished: false,
    features: "",
    exchange_possible: false,
    phone_number: user?.phone_number || "",
    poster_name: user?.name || "",
    state: "",
    city: "",
    country: "Nigeria",
    images: [],
    video_link: "",
  });

  const handleChange = (field, value) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };

      if (field === "brand") updated.model = "";
      if (field === "state") updated.city = "";

      return updated;
    });
  };

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);
    setImageFiles(files);
    setImagePreviews(files.map((f) => URL.createObjectURL(f)));
  };

  const visibleFields = categoryFields[form.category] || [];
  const availableBrands = brands[form.category] || [];
  const availableModels =
    form.brand && models[form.category]
      ? models[form.category][form.brand] || []
      : [];
  const categoryFeatures = featuresByCategory[form.category] || [];

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
        const data = new FormData();
        data.append("file", file);
        data.append(
          "upload_preset",
          import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
        );

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/upload`,
          { method: "POST", body: data }
        );

        const result = await res.json();
        uploadedUrls.push(result.secure_url);
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

      if (!response.ok) throw new Error("Failed to post");

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
        bedrooms: "",
        bathrooms: "",
        size: "",
        furnished: false,
        features: "",
        exchange_possible: false,
        state: "",
        city: "",
        images: [],
        video_link: "",
      }));

      setImageFiles([]);
      setImagePreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = null;
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const FullPageSelector = ({ title, options, field }) => (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h3>{title}</h3>
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {options.map((item) => (
            <div
              key={item}
              style={optionStyle}
              onClick={() => {
                handleChange(field, item);
                setActiveSelector(null);
              }}
            >
              {item}
            </div>
          ))}
        </div>
        <button onClick={() => setActiveSelector(null)} style={closeBtn}>
          Close
        </button>
      </div>
    </div>
  );

  return (
    <div style={wrapper}>
      <h2>Post Marketplace Ad</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Title"
          value={form.title}
          onChange={(e) => handleChange("title", e.target.value)}
          style={input}
        />

        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => handleChange("description", e.target.value)}
          style={input}
        />

        <input
          type="number"
          placeholder="Price"
          value={form.price}
          onChange={(e) => handleChange("price", e.target.value)}
          style={input}
        />

        {/* CATEGORY */}
        <div style={selector} onClick={() => setActiveSelector("category")}>
          {form.category || "Select Category"}
        </div>

        {/* DYNAMIC FIELDS */}
        {visibleFields.map((field) => {
          if (["exchange_possible", "furnished"].includes(field)) {
            return (
              <label key={field}>
                <input
                  type="checkbox"
                  checked={form[field]}
                  onChange={(e) =>
                    handleChange(field, e.target.checked)
                  }
                />
                {field.replace("_", " ").toUpperCase()}
              </label>
            );
          }

          return (
            <div
              key={field}
              style={selector}
              onClick={() => {
                if (field === "model" && !form.brand) return;
                if (field === "city" && !form.state) return;
                setActiveSelector(field);
              }}
            >
              {form[field] || `Select ${field}`}
            </div>
          );
        })}

        <input
          type="file"
          multiple
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImagesChange}
        />

        <button type="submit" disabled={loading} style={button}>
          {loading ? "Posting..." : "Post Ad"}
        </button>
      </form>

      {/* SELECTORS */}
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
       
       {activeSelector === "condition" && (
  <FullPageSelector
    title="Select Condition"
    options={conditions}
    field="condition"
  />
)}

{activeSelector === "used_detail" && (
  <FullPageSelector
    title="Select Used Detail"
    options={usedDetails}
    field="used_detail"
  />
)}

{activeSelector === "ram" && (
  <FullPageSelector
    title="Select RAM"
    options={ramOptions}
    field="ram"
  />
)}

{activeSelector === "storage" && (
  <FullPageSelector
    title="Select Storage"
    options={storageOptions}
    field="storage"
  />
)}

{activeSelector === "color" && (
  <FullPageSelector
    title="Select Color"
    options={colors}
    field="color"
  />
)}

{activeSelector === "sim" && (
  <FullPageSelector
    title="Select SIM"
    options={sims}
    field="sim"
  />
)}

{activeSelector === "year" && (
  <FullPageSelector
    title="Select Year"
    options={years}
    field="year"
  />
)}

{activeSelector === "engine" && (
  <FullPageSelector
    title="Select Engine"
    options={engines}
    field="engine"
  />
)}

{activeSelector === "fuel_type" && (
  <FullPageSelector
    title="Select Fuel Type"
    options={fuelTypes}
    field="fuel_type"
  />
)}

{activeSelector === "features" && (
  <FullPageSelector
    title="Select Features"
    options={categoryFeatures}
    field="features"
  />
)}
      {activeSelector === "state" && (
        <FullPageSelector
          title="Select State"
          options={Object.keys(locationsByState)}
          field="state"
        />
      )}

      {activeSelector === "city" && (
        <FullPageSelector
          title="Select City"
          options={locationsByState[form.state] || []}
          field="city"
        />
      )}
    </div>
  );
}

/* STYLES */
const wrapper = {
  maxWidth: 600,
  margin: "40px auto",
  padding: 20,
  border: "1px solid #eee",
  borderRadius: 10,
};

const input = {
  width: "100%",
  padding: 10,
  marginBottom: 15,
};

const selector = {
  padding: 12,
  border: "1px solid #ccc",
  marginBottom: 15,
  cursor: "pointer",
};

const button = {
  width: "100%",
  padding: 12,
  background: "black",
  color: "white",
  border: "none",
};

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const modalStyle = {
  background: "white",
  padding: 20,
  width: "90%",
  maxWidth: 400,
  borderRadius: 10,
};

const optionStyle = {
  padding: 12,
  borderBottom: "1px solid #eee",
  cursor: "pointer",
};

const closeBtn = {
  marginTop: 10,
  padding: 10,
  width: "100%",
  background: "black",
  color: "white",
  border: "none",
};