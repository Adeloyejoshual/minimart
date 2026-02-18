// src/pages/Marketplace/AddMarketplaceProduct.jsx
import { useState, useRef, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { categoryFields } from "../../config/categoryFields";
import { conditions, usedDetails } from "../../config/conditions";
import { ramOptions } from "../../config/ram";
import { storageOptions } from "../../config/storage";
import { colors } from "../../config/color";
import { featuresByCategory } from "../../config/features";
import { promotionPlans } from "../../config/promotion";
import { locationsByState } from "../../config/locationsByState";
import { brands } from "../../config/brands";
import { models } from "../../config/models";
import { sims } from "../../config/sim";
import { years } from "../../config/years";

export default function AddMarketplaceProduct() {
  const { user } = useAuth0();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    discount_price: "",
    discount_percent: 0,
    quantity: "",
    category: "",
    brand: "",
    model: "",
    condition: "",
    used_detail: "",
    ram: "",
    storage: "",
    color: "",
    sim: [],
    features: [],
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
    negotiable: false,
    deliveryRegions: [],
  });

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);

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

  const [showPreview, setShowPreview] = useState(false);
  const [selectorField, setSelectorField] = useState(null);
  const [selectorOptions, setSelectorOptions] = useState([]);

  // Load draft
  useEffect(() => {
    const draft = localStorage.getItem("marketplace_draft");
    if (draft) setForm(JSON.parse(draft));
  }, []);

  useEffect(() => {
    localStorage.setItem("marketplace_draft", JSON.stringify(form));
  }, [form]);

  // Handle field change
  const handleChange = (field, value) => {
    setForm(prev => {
      let updated = { ...prev, [field]: value };

      // Reset dependent fields
      if (field === "category") {
        updated.brand = "";
        updated.model = "";
        updated.condition = "";
        updated.used_detail = "";
        updated.ram = "";
        updated.storage = "";
        updated.color = "";
        updated.sim = [];
        updated.features = [];
      }
      if (field === "brand") updated.model = "";
      if (field === "state") updated.city = "";

      return updated;
    });
  };

  const handleMultiSelect = (field, value) => {
    setForm(prev => {
      const arr = prev[field];
      if (arr.includes(value)) return { ...prev, [field]: arr.filter(v => v !== value) };
      return { ...prev, [field]: [...arr, value] };
    });
  };

  const openSelector = (field, options) => {
    setSelectorField(field);
    setSelectorOptions(options);
  };

  const selectOption = (value) => {
    if (selectorField === "sim" || selectorField === "features") {
      handleMultiSelect(selectorField, value);
    } else if (selectorField === "state") {
      handleChange("state", value);
    } else if (selectorField === "city") {
      handleChange("city", value);
    } else {
      handleChange(selectorField, value);
    }
    setSelectorField(null);
  };

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 10) { alert("Maximum 10 images"); return; }
    setImageFiles(files);
    setImagePreviews(files.map(f => URL.createObjectURL(f)));
  };

  // Price auto-format
  const formatNumberWithCommas = (value) => {
    const num = value.replace(/,/g, "");
    if (isNaN(num)) return "";
    return Number(num).toLocaleString();
  };

  const handlePriceChange = (field, value) => {
    const raw = value.replace(/,/g, "");
    if (!isNaN(raw)) {
      handleChange(field, raw);

      // Auto calculate discount %
      if (field === "discount_price" && form.price) {
        const percent = raw > 0 ? Math.round(((Number(form.price) - Number(raw)) / Number(form.price)) * 100) : 0;
        setForm(prev => ({ ...prev, discount_percent: percent }));
      }
    }
  };

  // Delivery
  const addDeliveryRegion = () => {
    if (!deliveryForm.state || !deliveryForm.city) return alert("Select state & city");
    if (!deliveryForm.from || !deliveryForm.to) return alert("Set delivery range");
    if (Number(deliveryForm.from) > Number(deliveryForm.to)) return alert("From days cannot exceed To days");

    const isFreeDelivery = deliveryForm.chargeFee && Number(deliveryForm.fee) === 0;
    setForm(prev => ({ ...prev, deliveryRegions: [...prev.deliveryRegions, { ...deliveryForm, isFreeDelivery }] }));

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
    setForm(prev => ({ ...prev, deliveryRegions: prev.deliveryRegions.filter((_, i) => i !== index) }));
  };

  // Validation
  const validateForm = () => {
    const errors = {};
    if (!form.title || form.title.trim().length < 30) errors.title = "Title min 30 chars";
    if (!form.description || form.description.trim().length < 50) errors.description = "Description min 50 chars";
    if (!form.price || Number(form.price) <= 0) errors.price = "Price > 0 required";
    if (!form.phone_number || !/^\d{10,11}$/.test(form.phone_number)) errors.phone_number = "Invalid phone";
    if (!form.state) errors.state = "State required";
    if (!form.city) errors.city = "City required";
    if (imageFiles.length < 1) errors.images = "At least 1 image required";
    return errors;
  };

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
      const response = await fetch("/api/marketplace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(productData) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed");

      alert("✅ Product published!");
      localStorage.removeItem("marketplace_draft");
      setShowPreview(false);

      // Reset
      setForm({
        title: "", description: "", price: "", discount_price: "", discount_percent: 0,
        quantity: "", category: "", brand: "", model: "", condition: "", used_detail: "",
        ram: "", storage: "", color: "", sim: [], features: [], phone_number: user?.phone_number || "",
        additional_phone: "", poster_name: user?.name || "", state: "", city: "", location: "",
        social_link: "", images: [], video_link: "", promoted: false, promo_plan: "",
        flash_sale: false, negotiable: false, deliveryRegions: []
      });
      setImageFiles([]);
      setImagePreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = null;
    } catch (err) {
      alert(err.message);
    } finally { setLoading(false); }
  };

  // Options
  const visibleFields = categoryFields[form.category] || [];
  const availableBrands = brands[form.category] || [];
  const availableModels = form.brand ? models[form.category]?.[form.brand] || [] : [];
  const categoryFeatures = featuresByCategory[form.category] || [];
  const availableSims = sims || [];
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
      case "condition": return conditions;
      case "used_detail": return usedDetails;
      case "year": return years;
      default: return [];
    }
  };

  const sectionStyle = { border: "2px solid #007BFF", borderRadius: "12px", padding: "20px", marginBottom: "20px", background: "#E6F0FF" };

  return (
    <div style={{ maxWidth: "700px", margin: "40px auto" }}>
      <h2 style={{ textAlign: "center", color: "#007BFF", marginBottom: "20px" }}>Post Marketplace Ad</h2>
      <form onSubmit={handleSubmit}>
        {/* Product Details */}
        <div style={sectionStyle}>
          <input type="text" placeholder="Product Name" value={form.title} onChange={(e) => handleChange("title", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
          <button type="button" style={{ width: "100%", padding: "10px", marginBottom: "10px" }} onClick={() => openSelector("category", Object.keys(categoryFields))}>{form.category || "Select Category"}</button>

          {visibleFields.map((field) => field === "sim" || field === "features" ? (
            <div key={field} style={{ marginBottom: "10px" }}>
              <p>{field.replace("_", " ")}</p>
              {getFieldOptions(field).map((opt) => (
                <label key={opt} style={{ display: "block", marginBottom: "5px" }}>
                  <input type="checkbox" checked={form[field].includes(opt)} onChange={() => handleMultiSelect(field, opt)} /> {opt}
                </label>
              ))}
            </div>
          ) : (
            <button key={field} type="button" style={{ width: "100%", padding: "10px", marginBottom: "10px" }} onClick={() => openSelector(field, getFieldOptions(field))}>{form[field] || `Select ${field.replace("_", " ")}`}</button>
          ))}

          {availableBrands.length > 0 && <button type="button" style={{ width: "100%", padding: "10px", marginBottom: "10px" }} onClick={() => openSelector("brand", availableBrands)}>{form.brand || "Select Brand"}</button>}
          {availableModels.length > 0 && <button type="button" style={{ width: "100%", padding: "10px", marginBottom: "10px" }} onClick={() => openSelector("model", availableModels)}>{form.model || "Select Model"}</button>}
        </div>

        {/* Pricing & Offers */}
        <div style={sectionStyle}>
          <input type="text" placeholder="Price" value={formatNumberWithCommas(form.price)} onChange={(e) => handlePriceChange("price", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
          <input type="text" placeholder="Discount Price" value={formatNumberWithCommas(form.discount_price)} onChange={(e) => handlePriceChange("discount_price", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "5px" }} />
          {form.discount_percent > 0 && <div style={{ color: "green", marginBottom: "10px" }}>{form.discount_percent}% OFF</div>}
          <label><input type="checkbox" checked={form.negotiable} onChange={(e) => handleChange("negotiable", e.target.checked)} /> Price Negotiable</label>
          <label><input type="checkbox" checked={form.flash_sale} onChange={(e) => handleChange("flash_sale", e.target.checked)} /> Flash Sale</label>
        </div>

                {/* DESCRIPTION */}
        <div style={sectionStyle}>
          <h3>Product Description & Details</h3>
          <textarea placeholder="Short Description" value={form.description} onChange={(e) => handleChange("description", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
          <input type="number" placeholder="Quantity / Stock" value={form.quantity} onChange={(e) => handleChange("quantity", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
        </div>

        {/* IMAGES */}
        <div style={sectionStyle}>
          <h3>Product Images / Media</h3>
          <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImagesChange} style={{ marginBottom: "15px" }} />
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "15px" }}>
            {imagePreviews.map((src, i) => <img key={i} src={src} alt="Preview" style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "5px" }} />)}
          </div>
          <input type="text" placeholder="Optional Video / 360° View Link" value={form.video_link} onChange={(e) => handleChange("video_link", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
        </div>

        {/* CONTACT & SELLER */}
        <div style={sectionStyle}>
          <h3>Contact & Seller Info</h3>
          {/* STATE & CITY full-page selectors */}
          <button type="button" style={{ width: "100%", padding: "10px", marginBottom: "10px" }} onClick={() => openSelector("state", Object.keys(locationsByState))}>
            {form.state || "Select State"}
          </button>

          <button type="button" style={{ width: "100%", padding: "10px", marginBottom: "10px" }} onClick={() => form.state ? openSelector("city", locationsByState[form.state]) : alert("Select a state first")}>
            {form.city || "Select City"}
          </button>

          <input type="text" placeholder="Location / Address" value={form.location} onChange={(e) => handleChange("location", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
          <input type="text" placeholder="Phone Number" value={form.phone_number} onChange={(e) => handleChange("phone_number", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
          <input type="text" placeholder="Additional Phone / WhatsApp" value={form.additional_phone} onChange={(e) => handleChange("additional_phone", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
          <input type="text" placeholder="Seller Name" value={form.poster_name} readOnly style={{ width: "100%", padding: "10px", marginBottom: "15px", background: "#f5f5f5" }} />
          <input type="text" placeholder="Social Media / Store Link (Optional)" value={form.social_link} onChange={(e) => handleChange("social_link", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
        </div>

        {/* DELIVERY OPTIONS */}
        <div style={sectionStyle}>
          <h3>Delivery Options</h3>

          <button
            type="button"
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "10px",
              background: "#007BFF",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
            }}
            onClick={() => setShowDeliveryForm(!showDeliveryForm)}
          >
            {showDeliveryForm ? "Close Delivery Form" : "Add Delivery Region"}
          </button>

          {showDeliveryForm && (
            <div style={{ marginTop: "15px", background: "#E6F0FF", padding: "15px", borderRadius: "8px" }}>
              {/* State Selector */}
              <button
                type="button"
                style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
                onClick={() => openSelector("deliveryState", Object.keys(locationsByState))}
              >
                {deliveryForm.state || "Select State"}
              </button>

              {/* City Selector */}
              <button
                type="button"
                style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
                onClick={() =>
                  deliveryForm.state
                    ? openSelector("deliveryCity", locationsByState[deliveryForm.state])
                    : alert("Select a state first")
                }
              >
                {deliveryForm.city || "Select City"}
              </button>

              {/* Delivery Method */}
              <select
                value={deliveryForm.method}
                onChange={(e) => setDeliveryForm(prev => ({ ...prev, method: e.target.value }))}
                style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
              >
                <option value="Courier">Courier</option>
                <option value="Pickup">Pickup</option>
                <option value="Both">Both</option>
              </select>

              {/* Delivery Time */}
              <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                <input
                  type="number"
                  placeholder="From (days)"
                  value={deliveryForm.from}
                  onChange={(e) => setDeliveryForm(prev => ({ ...prev, from: e.target.value }))}
                  style={{ flex: 1, padding: "10px" }}
                />
                <input
                  type="number"
                  placeholder="To (days)"
                  value={deliveryForm.to}
                  onChange={(e) => setDeliveryForm(prev => ({ ...prev, to: e.target.value }))}
                  style={{ flex: 1, padding: "10px" }}
                />
              </div>

              {/* Charge Fee */}
              <label style={{ display: "block", marginBottom: "10px" }}>
                <input
                  type="checkbox"
                  checked={deliveryForm.chargeFee}
                  onChange={(e) => setDeliveryForm(prev => ({ ...prev, chargeFee: e.target.checked }))}
                />{" "}
                Charge Delivery Fee
              </label>

              {deliveryForm.chargeFee && (
                <input
                  type="number"
                  placeholder="Delivery Fee"
                  value={deliveryForm.fee}
                  onChange={(e) => setDeliveryForm(prev => ({ ...prev, fee: e.target.value }))}
                  style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
                />
              )}

              {/* Express Available */}
              <label style={{ display: "block", marginBottom: "10px" }}>
                <input
                  type="checkbox"
                  checked={deliveryForm.expressAvailable}
                  onChange={(e) => setDeliveryForm(prev => ({ ...prev, expressAvailable: e.target.checked }))}
                />{" "}
                Express Delivery Available
              </label>

              {/* Warehouse Address */}
              <input
                type="text"
                placeholder="Warehouse Address (Optional)"
                value={deliveryForm.warehouseAddress}
                onChange={(e) => setDeliveryForm(prev => ({ ...prev, warehouseAddress: e.target.value }))}
                style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
              />

              {/* Add Delivery Region Button */}
              <button
                type="button"
                onClick={addDeliveryRegion}
                style={{
                  width: "100%",
                  padding: "10px",
                  background: "#007BFF",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                Add Region
              </button>
            </div>
          )}

          {/* Display Added Regions */}
          {form.deliveryRegions.map((region, index) => (
            <div
              key={index}
              style={{
                background: "#fff",
                padding: "10px",
                borderRadius: "8px",
                marginTop: "10px",
                border: "1px solid #ccc",
              }}
            >
              <strong>{region.state} - {region.city}</strong>
              <div>{region.method} • {region.from}-{region.to} days</div>
              {region.isFreeDelivery && <div style={{ color: "green" }}>FREE DELIVERY</div>}
              {region.expressAvailable && <div style={{ color: "#007BFF" }}>Express Available</div>}
              <button
                type="button"
                onClick={() => removeDeliveryRegion(index)}
                style={{
                  marginTop: "5px",
                  background: "red",
                  color: "#fff",
                  border: "none",
                  padding: "5px 10px",
                  borderRadius: "5px",
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {/* SUBMIT */}
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "12px",
            background: "#007BFF",
            color: "#fff",
            fontSize: "16px",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Preview & Post Marketplace Ad
        </button>
      </form>

      {/* FULL-PAGE SELECTOR MODAL */}
      {selectorField && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#fff",
              width: "90%",
              maxWidth: "400px",
              borderRadius: "12px",
              overflowY: "auto",
              maxHeight: "70vh",
            }}
          >
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
            <button
              onClick={() => setSelectorField(null)}
              style={{
                width: "100%",
                padding: "12px",
                background: "#ccc",
                border: "none",
                borderRadius: "0 0 12px 12px",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {showPreview && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#fff",
              width: "90%",
              maxWidth: "600px",
              padding: "20px",
              borderRadius: "12px",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h2>Product Preview</h2>
            <h3>{form.title}</h3>
            <p><strong>Price:</strong> ₦{Number(form.price).toLocaleString()}</p>
            {form.negotiable && <p>💬 Negotiable</p>}
            {form.exchange_possible && <p>🔄 Exchange Possible</p>}
            <p>{form.description}</p>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {imagePreviews.map((src, i) => (
                <img key={i} src={src} alt="Preview" style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "6px" }} />
              ))}
            </div>

            {form.deliveryRegions.length > 0 && (
              <>
                <h4>Delivery</h4>
                {form.deliveryRegions.map((d, i) => (
                  <div key={i}>
                    {d.state} - {d.city} • {d.from}-{d.to} days
                  </div>
                ))}
              </>
            )}

            <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
              <button
                onClick={() => setShowPreview(false)}
                style={{ flex: 1, padding: "10px", background: "#ccc", border: "none" }}
              >
                Edit
              </button>
              <button
                onClick={confirmPublish}
                disabled={loading}
                style={{ flex: 1, padding: "10px", background: "#007BFF", color: "#fff", border: "none" }}
              >
                {loading ? "Publishing..." : "Confirm & Publish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}