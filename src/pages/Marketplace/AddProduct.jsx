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

  // ---------------- FORM STATE ----------------
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
    sim: "",
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
    deliveryRegions: []
  });

  const [deliveryForm, setDeliveryForm] = useState({
    state: "",
    city: "",
    method: "Courier",
    from: "",
    to: "",
    chargeFee: false,
    fee: "",
    expressAvailable: false,
    warehouseAddress: ""
  });

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectorField, setSelectorField] = useState(null);
  const [selectorOptions, setSelectorOptions] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  const fileInputRef = useRef(null);

  // ---------------- FORM HANDLERS ----------------
  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "brand") setForm((prev) => ({ ...prev, model: "" }));
    if (field === "state") setForm((prev) => ({ ...prev, city: "" }));
  };

  const openSelector = (field, options) => {
    setSelectorField(field);
    setSelectorOptions(options);
  };

  const selectOption = (value) => {
    handleChange(selectorField, value);
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

  // ---------------- DELIVERY FUNCTIONS ----------------
  const addDeliveryRegion = () => {
    if (!deliveryForm.state || !deliveryForm.city) {
      alert("Select delivery state and city");
      return;
    }
    if (!deliveryForm.from || !deliveryForm.to) {
      alert("Set delivery time range");
      return;
    }
    if (Number(deliveryForm.from) > Number(deliveryForm.to)) {
      alert("From days cannot be greater than To days");
      return;
    }

    const isFreeDelivery = deliveryForm.chargeFee && Number(deliveryForm.fee) === 0;

    setForm(prev => ({
      ...prev,
      deliveryRegions: [
        ...prev.deliveryRegions,
        { ...deliveryForm, isFreeDelivery }
      ]
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
      warehouseAddress: ""
    });
  };

  const removeDeliveryRegion = (index) => {
    setForm(prev => ({
      ...prev,
      deliveryRegions: prev.deliveryRegions.filter((_, i) => i !== index)
    }));
  };

  // ---------------- VALIDATION ----------------
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
    if (imageFiles.length < 1) errors.images = "Minimum 1 image required";
    if (imageFiles.length > 10) errors.images = "Maximum 10 images allowed";
    return errors;
  };

  // ---------------- SUBMIT / PREVIEW ----------------
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
        formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/upload`,
          { method: "POST", body: formData }
        );
        const data = await res.json();
        uploadedUrls.push(data.secure_url);
      }

      const productData = { ...form, images: uploadedUrls };

      const response = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData)
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to add product");

      alert("✅ Product published successfully!");
      setShowPreview(false);
      // Optionally reset form here
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- OPTIONS ----------------
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
    background: "#E6F0FF"
  };

  // ---------------- JSX ----------------
  return (
    <div style={{ maxWidth: "700px", margin: "40px auto" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Post Marketplace Ad</h2>
      <form onSubmit={handleSubmit}>
        {/* ---------------- Product Details ---------------- */}
        <div style={sectionStyle}>
          <h3>Product Details</h3>
          <input type="text" placeholder="Product Name" value={form.title} onChange={(e) => handleChange("title", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
          <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
            <button type="button" style={{ flex: 1, padding: "10px" }} onClick={() => openSelector("category", Object.keys(categoryFields))}>
              {form.category || "Select Category"}
            </button>
            <button type="button" style={{ flex: 1, padding: "10px" }} onClick={() => openSelector("subcategory", [])}>
              {form.subcategory || "Select Subcategory"}
            </button>
          </div>
          {visibleFields.map((field) => (
            <div key={field} style={{ marginBottom: "10px" }}>
              <button type="button" style={{ width: "100%", padding: "10px" }} onClick={() => openSelector(field, getFieldOptions(field))}>
                {form[field] || `Select ${field.replace("_", " ")}`}
              </button>
            </div>
          ))}
        </div>

        {/* ---------------- Pricing & Offers ---------------- */}
        <div style={sectionStyle}>
          <h3>Pricing & Offers</h3>
          <input type="number" placeholder="Price" value={form.price} onChange={(e) => handleChange("price", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
          <input type="number" placeholder="Discount / Sale Price (Optional)" value={form.discount_price} onChange={(e) => handleChange("discount_price", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
          <label style={{ display: "block", marginBottom: "10px" }}>
            <input type="checkbox" checked={form.flash_sale} onChange={(e) => handleChange("flash_sale", e.target.checked)} /> Flash Sale
          </label>
          <label style={{ display: "block", marginBottom: "10px" }}>
            <input type="checkbox" checked={form.negotiable} onChange={(e) => handleChange("negotiable", e.target.checked)} /> Price Negotiable
          </label>
          <label style={{ display: "block", marginBottom: "10px" }}>
            <input type="checkbox" checked={form.exchange_possible} onChange={(e) => handleChange("exchange_possible", e.target.checked)} /> Exchange Possible
          </label>
        </div>

        {/* ---------------- Description & Quantity ---------------- */}
        <div style={sectionStyle}>
          <h3>Product Description & Details</h3>
          <textarea placeholder="Short Description" value={form.description} onChange={(e) => handleChange("description", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
          <input type="number" placeholder="Quantity / Stock" value={form.quantity} onChange={(e) => handleChange("quantity", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
        </div>

        {/* ---------------- Images / Media ---------------- */}
        <div style={sectionStyle}>
          <h3>Product Images / Media</h3>
          <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImagesChange} style={{ marginBottom: "15px" }} />
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "15px" }}>
            {imagePreviews.map((src, i) => (
              <img key={i} src={src} alt="Preview" style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "5px" }} />
            ))}
          </div>
          <input type="text" placeholder="Optional Video / 360° View Link" value={form.video_link} onChange={(e) => handleChange("video_link", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
        </div>

        {/* ---------------- Contact & Seller Info ---------------- */}
        <div style={sectionStyle}>
          <h3>Contact & Seller Info</h3>
          <input type="text" placeholder="Phone Number" value={form.phone_number} onChange={(e) => handleChange("phone_number", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
          <input type="text" placeholder="Additional Phone / WhatsApp" value={form.additional_phone} onChange={(e) => handleChange("additional_phone", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
          <input type="text" placeholder="Seller Name" value={form.poster_name} readOnly style={{ width: "100%", padding: "10px", marginBottom: "15px", background: "#f5f5f5" }} />
          <select value={form.state} onChange={(e) => handleChange("state", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>
            <option value="">Select State</option>
            {Object.keys(locationsByState).map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
          <select value={form.city} onChange={(e) => handleChange("city", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>
            <option value="">Select City</option>
            {availableCities.map((ct) => <option key={ct} value={ct}>{ct}</option>)}
          </select>
          <input type="text" placeholder="Location / Address" value={form.location} onChange={(e) => handleChange("location", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
          <input type="text" placeholder="Social Media / Store Link (Optional)" value={form.social_link} onChange={(e) => handleChange("social_link", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
        </div>

        {/* ---------------- Delivery ---------------- */}
        <div style={sectionStyle}>
          <h3>Delivery Options</h3>

          <select
            value={deliveryForm.state}
            onChange={(e) => setDeliveryForm(prev => ({ ...prev, state: e.target.value, city: "" }))}
            style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
          >
            <option value="">Select State</option>
            {Object.keys(locationsByState).map((st) => <option key={st} value={st}>{st}</option>)}
          </select>

          <select
            value={deliveryForm.city}
            onChange={(e) => setDeliveryForm(prev => ({ ...prev, city: e.target.value }))}
            style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
          >
            <option value="">Select City</option>
            {(locationsByState[deliveryForm.state] || []).map((ct) => <option key={ct} value={ct}>{ct}</option>)}
          </select>

          <select
            value={deliveryForm.method}
            onChange={(e) => setDeliveryForm(prev => ({ ...prev, method: e.target.value }))}
            style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
          >
            <option value="Courier">Courier</option>
            <option value="Pickup">Pickup</option>
            <option value="Both">Both</option>
          </select>

          <input type="number" placeholder="From (days)" value={deliveryForm.from} onChange={(e) => setDeliveryForm(prev => ({ ...prev, from: e.target.value }))} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />
          <input type="number" placeholder="To (days)" value={deliveryForm.to} onChange={(e) => setDeliveryForm(prev => ({ ...prev, to: e.target.value }))} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />

          <label style={{ display: "block", marginBottom: "10px" }}>
            <input type="checkbox" checked={deliveryForm.chargeFee} onChange={(e) => setDeliveryForm(prev => ({ ...prev, chargeFee: e.target.checked }))} /> Charge Delivery Fee
          </label>
          {deliveryForm.chargeFee && <input type="number" placeholder="Delivery Fee" value={deliveryForm.fee} onChange={(e) => setDeliveryForm(prev => ({ ...prev, fee: e.target.value }))} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />}
          <label style={{ display: "block", marginBottom: "10px" }}>
            <input
              type="checkbox"
              checked={deliveryForm.expressAvailable}
              onChange={(e) =>
                setDeliveryForm((prev) => ({
                  ...prev,
                  expressAvailable: e.target.checked
                }))
              }
            /> Express Delivery Available
          </label>

          <input
            type="text"
            placeholder="Warehouse Address (Optional)"
            value={deliveryForm.warehouseAddress}
            onChange={(e) =>
              setDeliveryForm((prev) => ({
                ...prev,
                warehouseAddress: e.target.value
              }))
            }
            style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
          />

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
              cursor: "pointer"
            }}
          >
            Add Delivery Region
          </button>

          {/* Show Added Regions */}
          {form.deliveryRegions.map((region, index) => (
            <div
              key={index}
              style={{
                background: "#fff",
                padding: "10px",
                borderRadius: "8px",
                marginTop: "10px",
                border: "1px solid #ccc"
              }}
            >
              <strong>{region.state} - {region.city}</strong>
              <div>{region.method} • {region.from}-{region.to} days</div>
              {region.isFreeDelivery && <div style={{ color: "green" }}>FREE DELIVERY</div>}
              {region.expressAvailable && <div style={{ color: "#007BFF" }}>Express Available</div>}
              {region.warehouseAddress && <div>Warehouse: {region.warehouseAddress}</div>}
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
                  cursor: "pointer"
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <button
          type="submit"
          style={{
            width: "100%",
            padding: "15px",
            background: "#000",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "16px"
          }}
        >
          Preview & Publish
        </button>
      </form>

      {/* ---------------- PREVIEW MODAL ---------------- */}
      {showPreview && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999
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
              overflowY: "auto"
            }}
          >
            <h2>Product Preview</h2>

            <h3>{form.title}</h3>
            <p><strong>Price:</strong> {form.price}</p>
            {form.negotiable && <p>💬 Negotiable</p>}
            {form.exchange_possible && <p>🔄 Exchange Possible</p>}
            <p>{form.description}</p>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
              {imagePreviews.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt="Preview"
                  style={{
                    width: "80px",
                    height: "80px",
                    objectFit: "cover",
                    borderRadius: "6px"
                  }}
                />
              ))}
            </div>

            {form.deliveryRegions.length > 0 && (
              <>
                <h4>Delivery Regions</h4>
                {form.deliveryRegions.map((d, i) => (
                  <div key={i} style={{ marginBottom: "5px" }}>
                    <strong>{d.state} - {d.city}</strong> • {d.method} • {d.from}-{d.to} days
                    {d.isFreeDelivery && <span style={{ color: "green" }}> • FREE DELIVERY</span>}
                    {d.expressAvailable && <span style={{ color: "#007BFF" }}> • Express Available</span>}
                    {d.warehouseAddress && <span> • Warehouse: {d.warehouseAddress}</span>}
                  </div>
                ))}
              </>
            )}

            <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
              <button
                onClick={() => setShowPreview(false)}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#ccc",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                Edit
              </button>
              <button
                onClick={confirmPublish}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#000",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                {loading ? "Publishing..." : "Confirm & Publish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- SELECTOR MODAL ---------------- */}
      {selectorField && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999
          }}
        >
          <div
            style={{
              background: "#fff",
              width: "80%",
              maxHeight: "70vh",
              overflowY: "auto",
              borderRadius: "12px",
              padding: "20px"
            }}
          >
            <h3>Select {selectorField.replace("_", " ")}</h3>
            {selectorOptions.length === 0 && <p>No options available</p>}
            {selectorOptions.map((opt, i) => (
              <div
                key={i}
                onClick={() => selectOption(opt)}
                style={{
                  padding: "10px",
                  borderBottom: "1px solid #ccc",
                  cursor: "pointer"
                }}
              >
                {opt}
              </div>
            ))}
            <button
              onClick={() => setSelectorField(null)}
              style={{ marginTop: "10px", padding: "10px", width: "100%", background: "#ccc", border: "none", borderRadius: "6px", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}