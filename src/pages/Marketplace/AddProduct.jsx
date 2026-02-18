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
import { promotionPlans, getDiscountPercent } from "../../config/promotion";
import { locationsByState } from "../../config/locationsByState";
import { brands } from "../../config/brands";
import { models } from "../../config/models";
import { sims } from "../../config/sim";
import { years } from "../../config/years";

export default function AddMarketplaceProduct() {
  const { user } = useAuth0();

  // Main form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    discount_price: "",
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
    promo_plan: null,
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
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef(null);

  // Full-page selector
  const [selectorField, setSelectorField] = useState(null);
  const [selectorOptions, setSelectorOptions] = useState([]);

  // Handle form changes
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
    if (files.length > 10) return alert("Maximum 10 images allowed");
    setImageFiles(files);
    setImagePreviews(files.map(f => URL.createObjectURL(f)));
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
    if (!form.price || Number(form.price.replace(/,/g, '')) <= 0) errors.price = "Price must be greater than 0";
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
      const response = await fetch("/api/marketplace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(productData) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Failed to add product");

      alert("✅ Product published successfully!");
      setShowPreview(false);
      setForm(prev => ({ ...prev, title: "", description: "", price: "", discount_price: "", quantity: "", category: "", brand: "", model: "", condition: "", used_detail: "", ram: "", storage: "", color: "", sim: [], features: [], engine: "", mileage: "", year: "", fuel_type: "", transmission: "", state: "", city: "", location: "", social_link: "", images: [], video_link: "", promoted: false, promo_plan: null, flash_sale: false, exchange_possible: false, negotiable: false, deliveryRegions: [] }));
      setImageFiles([]);
      setImagePreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = null;
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Derived options
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

  const sectionStyle = { border: "2px solid #007BFF", borderRadius: "12px", padding: "20px", marginBottom: "20px", background: "#E6F0FF" };

  return (
    <div style={{ maxWidth: "700px", margin: "40px auto" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px", color: "#007BFF" }}>Post Marketplace Ad</h2>
      <form onSubmit={handleSubmit}>
        {/* Product Details */}
        <div style={sectionStyle}>
          <h3>Product Details</h3>
          <input type="text" placeholder="Product Name" value={form.title} onChange={(e) => handleChange("title", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
          <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
            <button type="button" style={{ flex: 1, padding: "10px" }} onClick={() => openSelector("category", Object.keys(categoryFields))}>{form.category || "Select Category"}</button>
          </div>
          {visibleFields.map((field) => (
            <div key={field} style={{ marginBottom: "10px" }}>
              {["sim", "features"].includes(field) ? (
                <div>
                  <div>{`Select ${field.replace("_", " ")}`}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "5px" }}>
                    {getFieldOptions(field).map(opt => (
                      <label key={opt} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 8px", border: "1px solid #007BFF", borderRadius: "8px", background: form[field].includes(opt) ? "#E6F0FF" : "#fff", cursor: "pointer" }}>
                        <input type="checkbox" checked={form[field].includes(opt)} onChange={(e) => {
                          const checked = e.target.checked;
                          setForm(prev => ({ ...prev, [field]: checked ? [...prev[field], opt] : prev[field].filter(f => f !== opt) }));
                        }} />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <button type="button" style={{ width: "100%", padding: "10px" }} onClick={() => openSelector(field, getFieldOptions(field))}>{form[field] || `Select ${field.replace("_", " ")}`}</button>
              )}
            </div>
          ))}
        </div>

        {/* Pricing & Offers */}
        <div style={sectionStyle}>
          <h3>Pricing & Offers</h3>
          <input type="text" placeholder="Price" value={form.price} onChange={(e) => {
            const val = e.target.value.replace(/,/g, '');
            if (!isNaN(val)) handleChange("price", Number(val).toLocaleString());
          }} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
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

        {/* Promotions */}
        <div style={sectionStyle}>
          <h3>Promotion Plans</h3>
          <div style={{ display: "flex", overflowX: "auto", gap: "10px", paddingBottom: "10px" }}>
            {promotionPlans.map(plan => {
              const DiscountIcon = plan.icon;
              const isSelected = form.promo_plan?.id === plan.id;
              return (
                <div
                  key={plan.id}
                  onClick={() => handleChange("promo_plan", plan)}
                  style={{
                    minWidth: "150px",
                    border: isSelected ? "2px solid #007BFF" : "1px solid #ccc",
                    borderRadius: "12px",
                    padding: "10px",
                    background: isSelected ? "#E6F0FF" : "#fff",
                    cursor: "pointer",
                    flexShrink: 0
                  }}
                >
                  <DiscountIcon style={{ fontSize: "20px", color: "#007BFF" }} />
                  <h4 style={{ margin: "5px 0" }}>{plan.name}</h4>
                  <p style={{ fontSize: "12px", margin: "2px 0" }}>{plan.duration}</p>
                  <p style={{ fontSize: "12px", margin: "2px 0" }}>
                    NGN {plan.price.toLocaleString()} 
                    {plan.discount > 0 && (
                      <span style={{ color: "green", marginLeft: "5px" }}>-{getDiscountPercent(plan.price, plan.discount)}%</span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Delivery Options */}
        <div style={sectionStyle}>
          <h3>Delivery Options</h3>

          <button type="button" style={{ padding: "10px", width: "100%", marginBottom: "10px" }} onClick={() => setSelectorField("delivery")}>Add Delivery Region</button>

          {selectorField === "delivery" && (
            <div style={{ padding: "10px", background: "#fff", borderRadius: "10px", border: "1px solid #ccc" }}>
              <button type="button" onClick={() => setSelectorField(null)} style={{ marginBottom: "10px" }}>Close</button>

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
                <input type="checkbox" checked={deliveryForm.chargeFee} onChange={e => setDeliveryForm(prev => ({ ...prev, chargeFee: e.target.checked }))} /> Charge Delivery Fee
              </label>

              {deliveryForm.chargeFee && (
                <input type="number" placeholder="Delivery Fee" value={deliveryForm.fee} onChange={e => setDeliveryForm(prev => ({ ...prev, fee: e.target.value }))} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />
              )}

              <label style={{ display: "block", marginBottom: "10px" }}>
                <input type="checkbox" checked={deliveryForm.expressAvailable} onChange={e => setDeliveryForm(prev => ({ ...prev, expressAvailable: e.target.checked }))} /> Express Delivery Available
              </label>

              <input type="text" placeholder="Warehouse Address (Optional)" value={deliveryForm.warehouseAddress} onChange={e => setDeliveryForm(prev => ({ ...prev, warehouseAddress: e.target.value }))} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />

              <button type="button" onClick={() => { addDeliveryRegion(); setSelectorField(null); }} style={{ width: "100%", padding: "10px", background: "#007BFF", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>Add Delivery Region</button>
            </div>
          )}

          {form.deliveryRegions.map((region, i) => (
            <div key={i} style={{ background: "#fff", padding: "10px", borderRadius: "8px", marginTop: "10px", border: "1px solid #ccc" }}>
              <strong>{region.state} - {region.city}</strong>
              <div>{region.method} • {region.from}-{region.to} days</div>
              {region.isFreeDelivery && <div style={{ color: "green" }}>FREE DELIVERY</div>}
              {region.expressAvailable && <div style={{ color: "#007BFF" }}>Express Available</div>}
              <button type="button" onClick={() => removeDeliveryRegion(i)} style={{ marginTop: "5px", background: "red", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "5px" }}>Remove</button>
            </div>
          ))}
        </div>

        {/* Contact & Media */}
        <div style={sectionStyle}>
          <h3>Contact & Media</h3>
          <input type="text" placeholder="Phone Number" value={form.phone_number} onChange={e => handleChange("phone_number", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />
          <input type="text" placeholder="Additional Phone (Optional)" value={form.additional_phone} onChange={e => handleChange("additional_phone", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />
          <input type="text" placeholder="Video / 360° Link (Optional)" value={form.video_link} onChange={e => handleChange("video_link", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />
          <input type="file" multiple ref={fileInputRef} onChange={handleImagesChange} style={{ marginBottom: "10px" }} />
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {imagePreviews.map((src, i) => <img key={i} src={src} style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "6px" }} />)}
          </div>
        </div>

        <button type="submit" style={{ width: "100%", padding: "15px", background: "#007BFF", color: "#fff", border: "none", borderRadius: "10px", cursor: "pointer", fontSize: "16px" }}>Preview & Publish</button>
      </form>

      {/* Preview Modal */}
      {showPreview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 }}>
          <div style={{ background: "#fff", width: "90%", maxWidth: "600px", padding: "20px", borderRadius: "12px", maxHeight: "90vh", overflowY: "auto" }}>
            <h2>Product Preview</h2>
            <h3>{form.title}</h3>
            <p><strong>Price:</strong> {form.price}</p>
            {form.discount_price && <p><strong>Discount Price:</strong> {form.discount_price}</p>}
            {form.negotiable && <p>💬 Negotiable</p>}
            {form.exchange_possible && <p>🔄 Exchange Possible</p>}
            <p>{form.description}</p>

            {form.promo_plan && <p>Promotion: {form.promo_plan.name} ({form.promo_plan.duration})</p>}

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
              {imagePreviews.map((src, i) => <img key={i} src={src} style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "6px" }} />)}
            </div>

            {form.deliveryRegions.length > 0 && (
              <>
                <h4>Delivery Regions</h4>
                {form.deliveryRegions.map((d, i) => (
                  <div key={i}>{d.state} - {d.city} • {d.from}-{d.to} days {d.isFreeDelivery && "(Free Delivery)"} {d.expressAvailable && "(Express)"}</div>
                ))}
              </>
            )}

            <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
              <button onClick={() => setShowPreview(false)} style={{ flex: 1, padding: "10px", background: "#ccc", border: "none" }}>Edit</button>
              <button onClick={confirmPublish} disabled={loading} style={{ flex: 1, padding: "10px", background: "black", color: "#fff", border: "none" }}>{loading ? "Publishing..." : "Confirm & Publish"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Full-page Selector */}
      {selectorField && selectorField !== "delivery" && (
        <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 9999, overflowY: "auto", padding: "20px" }}>
          <button onClick={() => setSelectorField(null)} style={{ marginBottom: "15px" }}>Close</button>
          {selectorOptions.map(opt => (
            <div key={opt} style={{ padding: "12px", borderBottom: "1px solid #ccc", cursor: "pointer" }} onClick={() => selectOption(opt)}>
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}