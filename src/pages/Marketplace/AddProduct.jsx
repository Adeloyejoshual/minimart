// src/pages/Marketplace/AddMarketplaceProduct.jsx
import { useState, useRef, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { categoryFields } from "../../config/categoryFields";
import { conditions } from "../../config/conditions";
import { ramOptions } from "../../config/ram";
import { storageOptions } from "../../config/storage";
import { colors } from "../../config/color";
import { fuelTypes } from "../../config/fuelTypes";
import { featuresByCategory } from "../../config/features";
import { locationsByState } from "../../config/locationsByState";
import { brands } from "../../config/brands";
import { models } from "../../config/models";
import { sims } from "../../config/sim";
import { years } from "../../config/years";

export default function AddMarketplaceProduct() {
  const { user } = useAuth0();
  const fileInputRef = useRef(null);

  /* ---------------- STATE ---------------- */

  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    discount_price: "",
    quantity: "",
    category: "",
    subcategory: "",
    brand: "",
    model: "",
    condition: "",
    ram: "",
    storage: "",
    color: "",
    sim: "",
    year: "",
    fuel_type: "",
    phone_number: user?.phone_number || "",
    additional_phone: "",
    poster_name: user?.name || "",
    state: "",
    city: "",
    location: "",
    images: [],
    video_link: "",
    negotiable: false,
    exchange_possible: false,
    flash_sale: false,
    deliveryRegions: [],
  });

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  const [deliveryForm, setDeliveryForm] = useState({
    state: "",
    city: "",
    method: "Courier",
    from: "",
    to: "",
    chargeFee: false,
    fee: "",
  });

  /* ---------------- HANDLERS ---------------- */

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));

    if (field === "brand") {
      setForm((prev) => ({ ...prev, model: "" }));
    }

    if (field === "state") {
      setForm((prev) => ({ ...prev, city: "" }));
    }
  };

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);

    if (files.length > 10) {
      alert("Maximum 10 images allowed");
      return;
    }

    setImageFiles(files);
    setImagePreviews(files.map((file) => URL.createObjectURL(file)));
  };

  /* ---------------- DELIVERY ---------------- */

  const addDeliveryRegion = () => {
    if (!deliveryForm.state || !deliveryForm.city) {
      alert("Select delivery state and city");
      return;
    }

    if (!deliveryForm.from || !deliveryForm.to) {
      alert("Enter delivery time range");
      return;
    }

    if (Number(deliveryForm.from) > Number(deliveryForm.to)) {
      alert("From days cannot be greater than To days");
      return;
    }

    const region = {
      ...deliveryForm,
      isFreeDelivery:
        deliveryForm.chargeFee && Number(deliveryForm.fee) === 0,
    };

    setForm((prev) => ({
      ...prev,
      deliveryRegions: [...prev.deliveryRegions, region],
    }));

    setDeliveryForm({
      state: "",
      city: "",
      method: "Courier",
      from: "",
      to: "",
      chargeFee: false,
      fee: "",
    });
  };

  const removeDeliveryRegion = (index) => {
    setForm((prev) => ({
      ...prev,
      deliveryRegions: prev.deliveryRegions.filter((_, i) => i !== index),
    }));
  };

  /* ---------------- VALIDATION ---------------- */

  const validateForm = () => {
    const errors = {};

    if (!form.title || form.title.trim().length < 30)
      errors.title = "Title must be at least 30 characters";

    if (!form.description || form.description.trim().length < 50)
      errors.description = "Description must be at least 50 characters";

    if (!form.price || Number(form.price) <= 0)
      errors.price = "Price must be greater than 0";

    if (!form.phone_number || !/^\d{10,11}$/.test(form.phone_number))
      errors.phone_number = "Enter valid phone number";

    if (!form.state) errors.state = "State required";
    if (!form.city) errors.city = "City required";

    if (imageFiles.length < 1)
      errors.images = "Minimum 1 image required";

    return errors;
  };

  /* ---------------- PREVIEW FLOW ---------------- */

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = validateForm();

    if (Object.keys(errors).length > 0) {
      alert(Object.values(errors)[0]);
      return;
    }

    setShowPreview(true);
  };

  const confirmPublish = async () => {
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

      const productData = { ...form, images: uploadedUrls };

      await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });

      alert("Product Published Successfully!");
      setShowPreview(false);
    } catch (err) {
      alert("Failed to publish");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- DYNAMIC OPTIONS ---------------- */

  const availableBrands = brands[form.category] || [];
  const availableModels =
    form.brand && models[form.category]
      ? models[form.category][form.brand] || []
      : [];

  const availableCities = locationsByState[form.state] || [];

  const sectionStyle = {
    border: "2px solid #007BFF",
    borderRadius: "14px",
    padding: "20px",
    marginBottom: "25px",
    background: "#EAF3FF",
  };

  /* ---------------- UI ---------------- */

  return (
    <div style={{ maxWidth: "800px", margin: "40px auto" }}>
      <form onSubmit={handleSubmit}>

        {/* PRODUCT DETAILS */}
        <div style={sectionStyle}>
          <h3>Product Details</h3>

          <input
            placeholder="Product Title"
            value={form.title}
            onChange={(e) => handleChange("title", e.target.value)}
            style={{ width: "100%", padding: 10, marginBottom: 15 }}
          />

          <select
            value={form.category}
            onChange={(e) => handleChange("category", e.target.value)}
            style={{ width: "100%", padding: 10, marginBottom: 15 }}
          >
            <option value="">Select Category</option>
            {Object.keys(categoryFields).map((cat) => (
              <option key={cat}>{cat}</option>
            ))}
          </select>

          <select
            value={form.brand}
            onChange={(e) => handleChange("brand", e.target.value)}
            style={{ width: "100%", padding: 10, marginBottom: 15 }}
          >
            <option value="">Select Brand</option>
            {availableBrands.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>

          <select
            value={form.model}
            onChange={(e) => handleChange("model", e.target.value)}
            style={{ width: "100%", padding: 10, marginBottom: 15 }}
          >
            <option value="">Select Model</option>
            {availableModels.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>

          <select
            value={form.condition}
            onChange={(e) => handleChange("condition", e.target.value)}
            style={{ width: "100%", padding: 10, marginBottom: 15 }}
          >
            <option value="">Condition</option>
            {conditions.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>

          <select
            value={form.ram}
            onChange={(e) => handleChange("ram", e.target.value)}
            style={{ width: "100%", padding: 10, marginBottom: 15 }}
          >
            <option value="">Select RAM</option>
            {ramOptions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>

          <select
            value={form.storage}
            onChange={(e) => handleChange("storage", e.target.value)}
            style={{ width: "100%", padding: 10, marginBottom: 15 }}
          >
            <option value="">Select Storage</option>
            {storageOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>

          <select
            value={form.sim}
            onChange={(e) => handleChange("sim", e.target.value)}
            style={{ width: "100%", padding: 10, marginBottom: 15 }}
          >
            <option value="">SIM Type</option>
            {sims.map((sim) => (
              <option key={sim}>{sim}</option>
            ))}
          </select>

          <select
            value={form.year}
            onChange={(e) => handleChange("year", e.target.value)}
            style={{ width: "100%", padding: 10, marginBottom: 15 }}
          >
            <option value="">Select Year</option>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* PUBLISH */}
        <div style={sectionStyle}>
          <button
            type="submit"
            style={{
              width: "100%",
              padding: 15,
              background: "black",
              color: "#fff",
              border: "none",
              borderRadius: 8,
            }}
          >
            Preview Product
          </button>
        </div>
      </form>

      {/* PREVIEW MODAL */}
      {showPreview && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        }}>
          <div style={{
            background: "#fff",
            padding: 25,
            width: "90%",
            maxWidth: 600,
            borderRadius: 12
          }}>
            <h2>{form.title}</h2>
            <p><strong>Price:</strong> {form.price}</p>
            <p>{form.description}</p>

            <button onClick={() => setShowPreview(false)}>
              Edit
            </button>

            <button onClick={confirmPublish}>
              Confirm Publish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}