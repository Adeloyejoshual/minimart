// src/pages/Marketplace/AddMarketplaceProduct.jsx

import { useState, useRef, useEffect, useMemo } from "react";
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
import { PaystackButton } from "react-paystack";

export default function AddMarketplaceProduct() {
  const { user } = useAuth0();
  const fileInputRef = useRef(null);

  /* =========================
     INITIAL FORM STATE
  ========================== */
  const initialFormState = {
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
    used_detail: "",
    ram: "",
    storage: "",
    color: "",
    sim: [],
    engine: "",
    mileage: "",
    year: "",
    fuel_type: "",
    transmission: "",
    phone_number: user?.phone_number || "",
    additional_phone: "",
    poster_name: user?.name || "",
    state: "",
    city: "",
    location: "",
    social_link: "",
    video_link: "",
    promoted: false,
    promo_plan: "",
    flash_sale: false,
    exchange_possible: false,
    negotiable: false,
    deliveryRegions: [],
    features: [],
    images: [],
  };

  const [form, setForm] = useState(initialFormState);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectorField, setSelectorField] = useState(null);
  const [selectorOptions, setSelectorOptions] = useState([]);

  /* =========================
     DRAFT AUTO SAVE
  ========================== */
  useEffect(() => {
    const draft = localStorage.getItem("marketplace_draft");
    if (draft) {
      setForm(JSON.parse(draft));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("marketplace_draft", JSON.stringify(form));
  }, [form]);

  /* =========================
     CLEAN IMAGE MEMORY
  ========================== */
  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imagePreviews]);

  /* =========================
     HANDLERS
  ========================== */

  const handleChange = (field, value) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };

      if (field === "category") {
        updated.subcategory = "";
        updated.brand = "";
        updated.model = "";
        updated.features = [];
      }

      if (field === "brand") {
        updated.model = "";
      }

      if (field === "state") {
        updated.city = "";
      }

      return updated;
    });
  };

  const handleMultiSelect = (field, value) => {
    setForm((prev) => {
      const current = prev[field];
      return {
        ...prev,
        [field]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });
  };

  const handlePriceChange = (e) => {
    const raw = e.target.value.replace(/,/g, "");
    if (!isNaN(raw)) {
      handleChange("price", raw);
    }
  };

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);

    if (files.length > 10) {
      alert("Maximum 10 images allowed");
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    for (let file of files) {
      if (file.size > maxSize) {
        alert("Each image must be less than 5MB");
        return;
      }
    }

    setImageFiles(files);
    setImagePreviews(files.map((file) => URL.createObjectURL(file)));
  };

  const openSelector = (field, options) => {
    setSelectorField(field);
    setSelectorOptions(options);
  };

  const selectOption = (value) => {
    handleChange(selectorField, value);
    setSelectorField(null);
  };

  /* =========================
     VALIDATION
  ========================== */

  const validateForm = () => {
    if (!form.title || form.title.length < 30)
      return "Title must be at least 30 characters";

    if (!form.description || form.description.length < 50)
      return "Description must be at least 50 characters";

    if (!form.price || Number(form.price) <= 0)
      return "Enter valid price";

    if (!/^\d{10,11}$/.test(form.phone_number))
      return "Enter valid phone number";

    if (!form.state || !form.city)
      return "Select state and city";

    if (imageFiles.length === 0)
      return "At least one image required";

    return null;
  };

  /* =========================
     SUBMIT
  ========================== */

  const handleSubmit = (e) => {
    e.preventDefault();
    const error = validateForm();
    if (error) {
      alert(error);
      return;
    }
    setShowPreview(true);
  };

  const confirmPublish = async () => {
    try {
      setLoading(true);

      const uploadedUrls = [];

      for (let file of imageFiles) {
        const data = new FormData();
        data.append("file", file);
        data.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/upload`,
          { method: "POST", body: data }
        );

        const result = await response.json();
        uploadedUrls.push(result.secure_url);
      }

      const selectedPlan = promotionPlans.find(
        (p) => p.name === form.promo_plan
      );

      const productData = {
        ...form,
        images: uploadedUrls,
        promo_price: selectedPlan?.price || 0,
      };

      const response = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });

      if (!response.ok) {
        throw new Error("Failed to publish product");
      }

      alert("✅ Product Published Successfully");

      localStorage.removeItem("marketplace_draft");
      setForm(initialFormState);
      setImageFiles([]);
      setImagePreviews([]);
      setShowPreview(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = null;
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     MEMOIZED OPTIONS
  ========================== */

  const visibleFields = useMemo(
    () => categoryFields[form.category] || [],
    [form.category]
  );

  const availableBrands = useMemo(
    () => brands[form.category] || [],
    [form.category]
  );

  const availableModels = useMemo(
    () =>
      form.brand
        ? models[form.category]?.[form.brand] || []
        : [],
    [form.category, form.brand]
  );

  const availableCities = useMemo(
    () => locationsByState[form.state] || [],
    [form.state]
  );

  /* =========================
     UI
  ========================== */

  return (
    <div style={{ maxWidth: 700, margin: "40px auto" }}>
      <h2 style={{ textAlign: "center" }}>
        Post Marketplace Ad
      </h2>

      <form onSubmit={handleSubmit}>

        {/* TITLE */}
        <input
          type="text"
          placeholder="Product Title"
          value={form.title}
          onChange={(e) =>
            handleChange("title", e.target.value)
          }
          style={{ width: "100%", marginBottom: 15 }}
        />

        {/* CATEGORY */}
        <button
          type="button"
          onClick={() =>
            openSelector(
              "category",
              Object.keys(categoryFields)
            )
          }
          style={{ width: "100%", marginBottom: 15 }}
        >
          {form.category || "Select Category"}
        </button>

        {/* BRAND */}
        {availableBrands.length > 0 && (
          <button
            type="button"
            onClick={() =>
              openSelector("brand", availableBrands)
            }
            style={{ width: "100%", marginBottom: 15 }}
          >
            {form.brand || "Select Brand"}
          </button>
        )}

        {/* MODEL */}
        {availableModels.length > 0 && (
          <button
            type="button"
            onClick={() =>
              openSelector("model", availableModels)
            }
            style={{ width: "100%", marginBottom: 15 }}
          >
            {form.model || "Select Model"}
          </button>
        )}

        {/* PRICE */}
        <input
          type="text"
          placeholder="Price"
          value={
            form.price
              ? Number(form.price).toLocaleString()
              : ""
          }
          onChange={handlePriceChange}
          style={{ width: "100%", marginBottom: 15 }}
        />

        {/* DESCRIPTION */}
        <textarea
          placeholder="Product Description"
          value={form.description}
          onChange={(e) =>
            handleChange("description", e.target.value)
          }
          style={{ width: "100%", marginBottom: 15 }}
        />

        {/* IMAGES */}
        <input
          type="file"
          multiple
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImagesChange}
          style={{ marginBottom: 15 }}
        />

        {/* SUBMIT */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 12,
            background: "#007BFF",
            color: "#fff",
            border: "none",
            borderRadius: 8,
          }}
        >
          Preview & Publish
        </button>
      </form>

      {/* SELECTOR MODAL */}
      {selectorField && (
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
            width: 350,
            maxHeight: "70vh",
            overflowY: "auto",
            borderRadius: 10
          }}>
            {selectorOptions.map((opt) => (
              <div
                key={opt}
                onClick={() => selectOption(opt)}
                style={{
                  padding: 15,
                  borderBottom: "1px solid #eee",
                  cursor: "pointer"
                }}
              >
                {opt}
              </div>
            ))}
          </div>
        </div>
      )}

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
            width: 500,
            padding: 20,
            borderRadius: 10
          }}>
            <h3>Preview Product</h3>
            <p><strong>{form.title}</strong></p>
            <p>₦{Number(form.price).toLocaleString()}</p>
            <p>{form.description}</p>

            <button
              onClick={confirmPublish}
              disabled={loading}
              style={{
                width: "100%",
                padding: 12,
                background: "#28a745",
                color: "#fff",
                border: "none",
                borderRadius: 8
              }}
            >
              {loading ? "Publishing..." : "Confirm Publish"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}