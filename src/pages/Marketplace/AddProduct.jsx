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

export default function AddMarketplaceProduct() {
  const { user } = useAuth0();

  // ======== FORM STATE =========
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
    features: [],
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

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const fileInputRef = useRef(null);

  // ======== MODALS / SELECTORS =========
  const [selectorField, setSelectorField] = useState(null);
  const [selectorOptions, setSelectorOptions] = useState([]);

  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
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

  // ======== DRAFT PERSISTENCE =========
  useEffect(() => {
    const draft = localStorage.getItem("marketplace_draft");
    if (draft) setForm(JSON.parse(draft));
  }, []);

  useEffect(() => {
    localStorage.setItem("marketplace_draft", JSON.stringify(form));
  }, [form]);

  // ======== HANDLERS =========
  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === "brand") setForm(prev => ({ ...prev, model: "" }));
    if (field === "state") setForm(prev => ({ ...prev, city: "" }));
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
    if (files.length + imageFiles.length > 10) {
      alert("You can upload maximum 10 images");
      return;
    }
    setImageFiles(prev => [...prev, ...files]);
    setImagePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = (index) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handlePriceChange = (field, value) => {
    const numericValue = value.replace(/[^0-9.]/g, "");
    setForm(prev => ({ ...prev, [field]: numericValue }));
  };

  const addDeliveryRegion = () => {
    if (!deliveryForm.state || !deliveryForm.city) return alert("Select delivery state and city");
    if (!deliveryForm.from || !deliveryForm.to) return alert("Set delivery time range");
    if (Number(deliveryForm.from) > Number(deliveryForm.to)) return alert("From days cannot be greater than To days");

    const isFreeDelivery = deliveryForm.chargeFee && Number(deliveryForm.fee) === 0;
    setForm(prev => ({
      ...prev,
      deliveryRegions: [...prev.deliveryRegions, { ...deliveryForm, isFreeDelivery }]
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
    setShowDeliveryForm(false);
  };

  const removeDeliveryRegion = (index) => {
    setForm(prev => ({
      ...prev,
      deliveryRegions: prev.deliveryRegions.filter((_, i) => i !== index)
    }));
  };

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
        body: JSON.stringify(productData)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to add product");
      alert("✅ Product published successfully!");
      localStorage.removeItem("marketplace_draft");
      setShowPreview(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ======== SELECTOR OPTIONS =========
  const visibleFields = categoryFields[form.category] || [];
  const availableBrands = brands[form.category] || [];
  const availableModels = form.brand ? models[form.category]?.[form.brand] || [] : [];
  const categoryFeatures = featuresByCategory[form.category] || [];
  const availableYears = years || [];
  const availableCities = locationsByState[form.state] || [];

  const getFieldOptions = (field) => {
    switch (field) {
      case "brand": return availableBrands;
      case "model": return availableModels;
      case "ram": return ramOptions;
      case "storage": return storageOptions;
      case "color": return colors;
      case "features": return categoryFeatures;
      case "year": return availableYears;
      case "condition": return conditions;
      case "used_detail": return usedDetails;
      case "sim": return sims;
      default: return [];
    }
  };

  const sectionStyle = { border: "2px solid #007BFF", borderRadius: "12px", padding: "20px", marginBottom: "20px", background: "#E6F0FF" };

  // ======== RENDER =========
  return (
    <div style={{ maxWidth: "700px", margin: "40px auto" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px", color: "#007BFF" }}>Post Marketplace Ad</h2>

      <form onSubmit={handleSubmit}>
        {/* SECTION: Product Details */}
        <div style={sectionStyle}>
          <h3>Product Details</h3>
          <input type="text" placeholder="Product Name" value={form.title} onChange={e => handleChange("title", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />

          <button type="button" style={{ width: "100%", padding: "10px", marginBottom: "15px" }} onClick={() => openSelector("category", Object.keys(categoryFields))}>
            {form.category || "Select Category"}
          </button>

          {visibleFields.map(field => {
            if (field === "features") {
              return (
                <div key={field} style={{ marginBottom: "10px" }}>
                  <p>Select Features</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                    {getFieldOptions(field).map(opt => (
                      <label key={opt} style={{ display: "flex", alignItems: "center", gap: "5px", background: "#E6F0FF", padding: "5px 10px", borderRadius: "5px", cursor: "pointer" }}>
                        <input type="checkbox" checked={form.features.includes(opt)} onChange={e => {
                          if (e.target.checked) setForm(prev => ({ ...prev, features: [...prev.features, opt] }));
                          else setForm(prev => ({ ...prev, features: prev.features.filter(f => f !== opt) }));
                        }} />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              );
            }
            if (field === "sim") {
              return (
                <div key={field} style={{ marginBottom: "10px" }}>
                  <p>Select SIM</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                    {getFieldOptions(field).map(opt => (
                      <label key={opt} style={{ display: "flex", alignItems: "center", gap: "5px", background: "#E6F0FF", padding: "5px 10px", borderRadius: "5px", cursor: "pointer" }}>
                        <input type="checkbox" checked={form.sim.includes(opt)} onChange={e => {
                          if (e.target.checked) setForm(prev => ({ ...prev, sim: [...prev.sim, opt] }));
                          else setForm(prev => ({ ...prev, sim: prev.sim.filter(s => s !== opt) }));
                        }} />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              );
            }
            return (
              <button key={field} type="button" style={{ width: "100%", padding: "10px", marginBottom: "10px" }} onClick={() => openSelector(field, getFieldOptions(field))}>
                {form[field] || `Select ${field.replace("_", " ")}`}
              </button>
            );
          })}
        </div>

        {/* SECTION: Pricing */}
        <div style={sectionStyle}>
          <h3>Pricing & Offers</h3>
          <input type="text" placeholder="Price" value={Number(form.price).toLocaleString()} onChange={e => handlePriceChange("price", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
          <input type="number" placeholder="Discount Price (Optional)" value={form.discount_price} onChange={e => handleChange("discount_price", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
          <label style={{ display: "block", marginBottom: "10px" }}>
            <input type="checkbox" checked={form.negotiable} onChange={e => handleChange("negotiable", e.target.checked)} /> Price Negotiable
          </label>
          <label style={{ display: "block", marginBottom: "10px" }}>
            <input type="checkbox" checked={form.exchange_possible} onChange={e => handleChange("exchange_possible", e.target.checked)} /> Exchange Possible
          </label>
          <label style={{ display: "block", marginBottom: "15px" }}>
            <input type="checkbox" checked={form.flash_sale} onChange={e => handleChange("flash_sale", e.target.checked)} /> Flash Sale
          </label>
        </div>

        {/* SECTION: Description */}
        <div style={sectionStyle}>
          <h3>Product Description</h3>
          <textarea placeholder="Short Description" value={form.description} onChange={e => handleChange("description", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
          <input type="number" placeholder="Quantity / Stock" value={form.quantity} onChange={e => handleChange("quantity", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
        </div>

        {/* SECTION: Images */}
        <div style={sectionStyle}>
          <h3>Product Images / Media</h3>
          <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImagesChange} style={{ marginBottom: "15px" }} />
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "15px" }}>
            {imagePreviews.map((src, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img src={src} alt="Preview" style={{ width: "100px", height: "100px", objectFit: "cover", borderRadius: "5px" }} />
                <button type="button" onClick={() => removeImage(i)} style={{ position: "absolute", top: 0, right: 0, background: "red", color: "#fff", border: "none", borderRadius: "50%", width: "20px", height: "20px", cursor: "pointer" }}>×</button>
              </div>
            ))}
          </div>
          <input type="text" placeholder="Optional Video / 360° Link" value={form.video_link} onChange={e => handleChange("video_link", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
        </div>

        {/* SECTION: Delivery (collapsible) */}
        <div style={sectionStyle}>
          <h3>Delivery Options</h3>
          {showDeliveryForm ? (
            <div>
              <select value={deliveryForm.state} onChange={e => setDeliveryForm(prev => ({ ...prev, state: e.target.value, city: "" }))} style={{ width: "100%", padding: "10px", marginBottom: "10px" }}>
                <option value="">Select State</option>
                {Object.keys(locationsByState).map(st => <option key={st} value={st}>{st}</option>)}
              </select>
              <select value={deliveryForm.city} onChange={e => setDeliveryForm(prev => ({ ...prev, city: e.target.value }))} style={{ width: "100%", padding: "10px", marginBottom: "10px" }}>
                <option value="">Select City</option>
                {(locationsByState[deliveryForm.state] || []).map(ct => <option key={ct} value={ct}>{ct}</option>)}
              </select>
              <select value={deliveryForm.method} onChange={e => setDeliveryForm(prev => ({ ...prev, method: e.target.value }))} style={{ width: "100%", padding: "10px", marginBottom: "10px" }}>
                <option value="Courier">Courier</option>
                <option value="Pickup">Pickup</option>
                <option value="Both">Both</option>
              </select>
              <input type="number" placeholder="From (days)" value={deliveryForm.from} onChange={e => setDeliveryForm(prev => ({ ...prev, from: e.target.value }))} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />
              <input type="number" placeholder="To (days)" value={deliveryForm.to} onChange={e => setDeliveryForm(prev => ({ ...prev, to: e.target.value }))} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />

              <label style={{ display: "block", marginBottom: "10px" }}>
                <input
                  type="checkbox"
                  checked={deliveryForm.chargeFee}
                  onChange={(e) =>
                    setDeliveryForm((prev) => ({
                      ...prev,
                      chargeFee: e.target.checked,
                    }))
                  }
                />{" "}
                Charge Delivery Fee
              </label>

              {deliveryForm.chargeFee && (
                <input
                  type="number"
                  placeholder="Delivery Fee"
                  value={deliveryForm.fee}
                  onChange={(e) =>
                    setDeliveryForm((prev) => ({
                      ...prev,
                      fee: e.target.value,
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "10px",
                    marginBottom: "10px",
                  }}
                />
              )}

              <label style={{ display: "block", marginBottom: "10px" }}>
                <input
                  type="checkbox"
                  checked={deliveryForm.expressAvailable}
                  onChange={(e) =>
                    setDeliveryForm((prev) => ({
                      ...prev,
                      expressAvailable: e.target.checked,
                    }))
                  }
                />{" "}
                Express Delivery Available
              </label>

              <input
                type="text"
                placeholder="Warehouse Address (Optional)"
                value={deliveryForm.warehouseAddress}
                onChange={(e) =>
                  setDeliveryForm((prev) => ({
                    ...prev,
                    warehouseAddress: e.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "10px",
                  marginBottom: "10px",
                }}
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
                  cursor: "pointer",
                  marginBottom: "10px",
                }}
              >
                Add Delivery Region
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowDeliveryForm(true)}
              style={{
                width: "100%",
                padding: "10px",
                background: "#007BFF",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                marginBottom: "10px",
              }}
            >
              + Add Delivery Region
            </button>
          )}

          {/* Show Added Delivery Regions */}
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
              <strong>
                {region.state} - {region.city}
              </strong>
              <div>
                {region.method} • {region.from}-{region.to} days
              </div>
              {region.isFreeDelivery && (
                <div style={{ color: "green" }}>FREE DELIVERY</div>
              )}
              {region.expressAvailable && (
                <div style={{ color: "#007BFF" }}>Express Available</div>
              )}
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
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {/* Submit */}
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "15px",
            background: "#007BFF",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            fontSize: "16px",
            cursor: "pointer",
            marginBottom: "20px",
          }}
        >
          Preview & Post
        </button>
      </form>

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
            <p>
              <strong>Price:</strong> {Number(form.price).toLocaleString()}
            </p>

            {form.negotiable && <p>💬 Negotiable</p>}
            {form.exchange_possible && <p>🔄 Exchange Possible</p>}

            <p>{form.description}</p>

            {form.features.length > 0 && (
              <p>
                <strong>Features:</strong> {form.features.join(", ")}
              </p>
            )}

            {form.sim.length > 0 && (
              <p>
                <strong>SIM:</strong> {form.sim.join(", ")}
              </p>
            )}

            <div
              style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}
            >
              {imagePreviews.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  style={{
                    width: "80px",
                    height: "80px",
                    objectFit: "cover",
                    borderRadius: "6px",
                  }}
                />
              ))}
            </div>

            {form.deliveryRegions.length > 0 && (
              <>
                <h4>Delivery</h4>
                {form.deliveryRegions.map((d, i) => (
                  <div key={i}>
                    {d.state} - {d.city} • {d.from}-{d.to} days{" "}
                    {d.isFreeDelivery && <span style={{ color: "green" }}>FREE</span>}{" "}
                    {d.expressAvailable && <span style={{ color: "#007BFF" }}>Express</span>}
                  </div>
                ))}
              </>
            )}

            <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
              <button
                onClick={() => setShowPreview(false)}
                style={{ flex: 1, padding: "10px", background: "#ccc", border: "none", borderRadius: "6px" }}
              >
                Edit
              </button>
              <button
                onClick={confirmPublish}
                disabled={loading}
                style={{ flex: 1, padding: "10px", background: "#007BFF", color: "#fff", border: "none", borderRadius: "6px" }}
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