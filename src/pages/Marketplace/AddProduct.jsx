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

  // ===== Form State =====
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
    images: [],
    video_link: "",
    promoted: false,
    promo_plan: "",
    flash_sale: false,
    exchange_possible: false,
    negotiable: false,
    deliveryRegions: [],
    features: [],
  });

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);

  // ===== Delivery Form State =====
  const [deliveryForm, setDeliveryForm] = useState({
    state: "",
    city: "",
    method: "Courier",
    from: "",
    to: "",
    chargeFee: false,
    fee: "",
    expressAvailable: false,
    warehouseAddress: "",
  });
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);

  // ===== Preview Modal =====
  const [showPreview, setShowPreview] = useState(false);

  // ===== Full-page Selector State =====
  const [selectorField, setSelectorField] = useState(null);
  const [selectorOptions, setSelectorOptions] = useState([]);

  // ===== Load Draft on Refresh =====
  useEffect(() => {
    const draft = localStorage.getItem("marketplace_draft");
    if (draft) setForm(JSON.parse(draft));
  }, []);

  useEffect(() => {
    localStorage.setItem("marketplace_draft", JSON.stringify(form));
  }, [form]);

  // ===== Handlers =====
  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "brand") setForm((prev) => ({ ...prev, model: "" }));
    if (field === "state") setForm((prev) => ({ ...prev, city: "" }));
  };

  const handleMultiSelect = (field, value) => {
    setForm((prev) => {
      const arr = prev[field];
      if (arr.includes(value)) return { ...prev, [field]: arr.filter((v) => v !== value) };
      return { ...prev, [field]: [...arr, value] };
    });
  };

  const openSelector = (field, options) => {
    setSelectorField(field);
    setSelectorOptions(options);
  };

  const selectOption = (value) => {
    if (selectorField === "deliveryState") setDeliveryForm(prev => ({ ...prev, state: value, city: "" }));
    else if (selectorField === "deliveryCity") setDeliveryForm(prev => ({ ...prev, city: value }));
    else handleChange(selectorField, value);
    setSelectorField(null);
  };

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 10) {
      alert("You can upload maximum 10 images");
      return;
    }
    setImageFiles(files);
    setImagePreviews(files.map((file) => URL.createObjectURL(file)));
  };

  const handlePriceChange = (e) => {
    const raw = e.target.value.replace(/,/g, "");
    if (!isNaN(raw)) {
      setForm((prev) => ({ ...prev, price: raw }));
    }
  };

  // ===== Delivery Handlers =====
  const addDeliveryRegion = () => {
    if (!deliveryForm.state || !deliveryForm.city) return alert("Select delivery state and city");
    if (!deliveryForm.from || !deliveryForm.to) return alert("Set delivery time range");
    if (Number(deliveryForm.from) > Number(deliveryForm.to)) return alert("From days cannot exceed To days");
    const isFreeDelivery = deliveryForm.chargeFee && Number(deliveryForm.fee) === 0;
    setForm((prev) => ({
      ...prev,
      deliveryRegions: [...prev.deliveryRegions, { ...deliveryForm, isFreeDelivery }],
    }));
    setDeliveryForm({
      state: "",
      city: "",
      method: "Courier",
      from: "",
      to: "",
      chargeFee: false,
      fee: "",
      expressAvailable: false,
      warehouseAddress: "",
    });
    setShowDeliveryForm(false);
  };

  const removeDeliveryRegion = (index) => {
    setForm((prev) => ({
      ...prev,
      deliveryRegions: prev.deliveryRegions.filter((_, i) => i !== index),
    }));
  };

  // ===== Validation =====
  const validateForm = () => {
    const errors = {};
    if (!form.title || form.title.trim().length < 30) errors.title = "Title must be at least 30 characters";
    if (!form.description || form.description.trim().length < 50) errors.description = "Description must be at least 50 characters";
    if (!form.price || Number(form.price) <= 0) errors.price = "Price must be greater than 0";
    if (!form.phone_number || !/^\d{10,11}$/.test(form.phone_number)) errors.phone_number = "Enter valid phone number";
    if (!form.state) errors.state = "State required";
    if (!form.city) errors.city = "City required";
    if (imageFiles.length < 1) errors.images = "Minimum 1 image required";
    if (imageFiles.length > 10) errors.images = "Maximum 10 images allowed";
    return errors;
  };

  // ===== Submit =====
  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) return alert(Object.values(errors)[0]);
    setShowPreview(true);
  };

  const confirmPublish = async () => {
    try {
      setLoading(true);
      const uploadedUrls = [];
      for (let file of imageFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/upload`, { method: "POST", body: formData });
        const data = await res.json();
        uploadedUrls.push(data.secure_url);
      }
      const productData = { ...form, images: uploadedUrls };
      const response = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to add product");
      alert("✅ Product published successfully!");
      localStorage.removeItem("marketplace_draft");
      setShowPreview(false);
      // Reset form
      setForm({
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
        images: [],
        video_link: "",
        promoted: false,
        promo_plan: "",
        flash_sale: false,
        exchange_possible: false,
        negotiable: false,
        deliveryRegions: [],
        features: [],
      });
      setImageFiles([]);
      setImagePreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = null;
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ===== Options =====
  const visibleFields = categoryFields[form.category] || [];
  const availableBrands = brands[form.category] || [];
  const availableModels = form.brand ? models[form.category]?.[form.brand] || [] : [];
  const categoryFeatures = featuresByCategory[form.category] || [];
  const availableSims = sims || [];
  const availableYears = years || [];
  const availableCities = locationsByState[form.state] || [];

  const getFieldOptions = (field) => {
    switch (field) {
      case "brand": return availableBrands;
      case "model": return availableModels;
      case "ram": return ramOptions;
      case "storage": return storageOptions;
      case "color": return colors;
      case "sim": return availableSims;
      case "features": return categoryFeatures;
      case "year": return availableYears;
      case "condition": return conditions;
      case "used_detail": return usedDetails;
      default: return [];
    }
  };

  const sectionStyle = {
    border: "2px solid #007BFF",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "20px",
    background: "#E6F0FF",
  };

  return (
    <div style={{ maxWidth: "700px", margin: "40px auto" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px", color: "#007BFF" }}>Post Marketplace Ad</h2>

      {/* === FORM JSX START === */}
      <form onSubmit={handleSubmit}>
        {/* Product Details */}
        <div style={sectionStyle}>
          <h3>Product Details</h3>
          <input type="text" placeholder="Product Name" value={form.title} onChange={(e) => handleChange("title", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />

          {/* Category */}
          <button type="button" style={{ width: "100%", padding: "10px", marginBottom: "10px" }} onClick={() => openSelector("category", Object.keys(categoryFields))}>
            {form.category || "Select Category"}
          </button>

          {/* Dynamic Fields */}
          {visibleFields.map((field) =>
            field === "features" || field === "sim" ? (
              <div key={field} style={{ marginBottom: "10px" }}>
                <p style={{ marginBottom: "5px" }}>{field.replace("_", " ")}</p>
                {getFieldOptions(field).map((opt) => (
                  <label key={opt} style={{ display: "block", marginBottom: "5px" }}>
                    <input type="checkbox" checked={form[field].includes(opt)} onChange={() => handleMultiSelect(field, opt)} /> {opt}
                  </label>
                ))}
              </div>
            ) : (
              <button key={field} type="button" style={{ width: "100%", padding: "10px", marginBottom: "10px" }} onClick={() => openSelector(field, getFieldOptions(field))}>
                {form[field] || `Select ${field.replace("_", " ")}`}
              </button>
            )
          )}

          {/* Brand & Model */}
          {availableBrands.length > 0 && (
            <button type="button" style={{ width: "100%", padding: "10px", marginBottom: "10px" }} onClick={() => openSelector("brand", availableBrands)}>
              {form.brand || "Select Brand"}
            </button>
          )}
          {availableModels.length > 0 && (
            <button type="button" style={{ width: "100%", padding: "10px", marginBottom: "10px" }} onClick={() => openSelector("model", availableModels)}>
              {form.model || "Select Model"}
            </button>
          )}

          {/* Promotion Plan */}
          <label style={{ display: "block", marginBottom: "10px" }}>
            <input type="checkbox" checked={form.promoted} onChange={(e) => handleChange("promoted", e.target.checked)} /> Promote this Product
          </label>
          {form.promoted && (
            <button type="button" style={{ width: "100%", padding: "10px", marginBottom: "10px" }} onClick={() => openSelector("promo_plan", promotionPlans.map(p => p.name))}>
              {form.promo_plan || "Select Promotion Plan"}
            </button>
          )}
        </div>

        {/* PRICE */}
        <div style={sectionStyle}>
          <h3>Pricing & Offers</h3>
          <input type="text" placeholder="Price" value={Number(form.price).toLocaleString()} onChange={handlePriceChange} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
          <input type="number" placeholder="Discount Price (Optional)" value={form.discount_price} onChange={(e) => handleChange("discount_price", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
          <label style={{ display: "block", marginBottom: "10px" }}>
            <input type="checkbox" checked={form.negotiable} onChange={(e) => handleChange("negotiable", e.target.checked)} /> Price Negotiable
          </label>
        </div>

        {/* DESCRIPTION */}
        <div style={sectionStyle}>
          <h3>Description</h3>
          <textarea placeholder="Short Description" value={form.description} onChange={(e) => handleChange("description", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
          <input type="number" placeholder="Quantity" value={form.quantity} onChange={(e) => handleChange("quantity", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
        </div>

        {/* IMAGES */}
        <div style={sectionStyle}>
          <h3>Images / Media</h3>
          <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImagesChange} style={{ marginBottom: "15px" }} />
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "15px" }}>
            {imagePreviews.map((src, i) => (
              <img key={i} src={src} alt="Preview" style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "6px" }} />
            ))}
          </div>
          <input type="text" placeholder="Video / 360° Link (Optional)" value={form.video_link} onChange={(e) => handleChange("video_link", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
        </div>

        {/* SUBMIT */}
        <button type="submit" style={{ width: "100%", padding: "12px", background: "#007BFF", color: "#fff", fontSize: "16px", border: "none", borderRadius: "8px", cursor: "pointer" }}>
          Preview & Post
        </button>
      </form>

      {/* FULL-PAGE SELECTOR MODAL */}
      {selectorField && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: "#fff", width: "90%", maxWidth: "400px", borderRadius: "12px", overflowY: "auto", maxHeight: "70vh" }}>
            {selectorOptions.map((opt) => (
              <div
                key={opt}
                onClick={() => selectOption(opt)}
                style={{
                  padding: "15px",
                  borderBottom: "1px solid #eee",
                  cursor: "pointer",
                  background: form[selectorField] === opt ? "#007BFF" : "#fff",
                  color: form[selectorField] === opt ? "#fff" : "#000",
                }}
              >
                {opt}
              </div>
            ))}
            <button onClick={() => setSelectorField(null)} style={{ width: "100%", padding: "12px", background: "#ccc", border: "none", borderRadius: "0 0 12px 12px" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {showPreview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: "#fff", width: "90%", maxWidth: "600px", padding: "20px", borderRadius: "12px", maxHeight: "90vh", overflowY: "auto" }}>
            <h2>Preview Product</h2>
            <p><strong>Title:</strong> {form.title}</p>
            <p><strong>Description:</strong> {form.description}</p>
            <p><strong>Price:</strong> ₦{Number(form.price).toLocaleString()}</p>
            {form.discount_price && <p><strong>Discount Price:</strong> ₦{Number(form.discount_price).toLocaleString()}</p>}
            <p><strong>Category:</strong> {form.category} / {form.subcategory}</p>
            {form.brand && <p><strong>Brand:</strong> {form.brand}</p>}
            {form.model && <p><strong>Model:</strong> {form.model}</p>}
            <p><strong>Condition:</strong> {form.condition} {form.used_detail && `(${form.used_detail})`}</p>
            <p><strong>Promoted:</strong> {form.promoted ? `Yes (${form.promo_plan})` : "No"}</p>
            <p><strong>Quantity:</strong> {form.quantity}</p>
            <p><strong>Negotiable:</strong> {form.negotiable ? "Yes" : "No"}</p>
            <p><strong>Delivery Regions:</strong> {form.deliveryRegions.length > 0 ? form.deliveryRegions.map((d, i) => (
              <span key={i}>{d.state} - {d.city} ({d.method}, {d.from}-{d.to} days){d.chargeFee ? `, Fee: ₦${d.fee}` : ", Free"}; </span>
            )) : "None"}</p>
            <p><strong>Images:</strong></p>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {imagePreviews.map((src, i) => (
                <img key={i} src={src} alt="Preview" style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "6px" }} />
              ))}
            </div>

            {/* Action Buttons */}
            <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
              <button onClick={() => setShowPreview(false)} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: "#ccc" }}>Edit</button>
              {form.promoted && form.promo_plan ? (
                <PaystackButton
                  text="Pay & Publish"
                  className="paystack-button"
                  callback={confirmPublish}
                  close={() => {}}
                  disabled={loading}
                  embed={true}
                  reference={new Date().getTime()}
                  email={user?.email}
                  amount={promotionPlans.find(p => p.name === form.promo_plan)?.price * 100}
                  publicKey={import.meta.env.VITE_PAYSTACK_PUBLIC_KEY}
                />
              ) : (
                <button onClick={confirmPublish} disabled={loading} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: "#007BFF", color: "#fff" }}>
                  {loading ? "Publishing..." : "Publish"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}