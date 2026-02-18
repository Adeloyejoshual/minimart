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

  // --- FORM STATES ---
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

  // --- DYNAMIC OPTIONS ---
  const visibleFields = categoryFields[form.category] || [];
  const availableBrands = brands[form.category] || [];
  const availableModels = form.brand ? models[form.category]?.[form.brand] || [] : [];
  const categoryFeatures = featuresByCategory[form.category] || [];
  const availableSims = form.category === "Phones & Tablets" ? sims : [];
  const availableYears = years || [];
  const availableCities = locationsByState[form.state] || [];

  // --- HANDLE CHANGE ---
  const handleChange = (field, value) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };

      // Reset dependent fields when category changes
      if (field === "category") {
        updated.subcategory = "";
        updated.brand = "";
        updated.model = "";
        updated.ram = "";
        updated.storage = "";
        updated.color = "";
        updated.sim = [];
        updated.features = [];
        updated.condition = "";
        updated.used_detail = "";
        updated.exchange_possible = false;
        updated.negotiable = false;
      }

      // Reset model if brand changes
      if (field === "brand") updated.model = "";

      // Reset city if state changes
      if (field === "state") updated.city = "";

      return updated;
    });
  };

  // --- FULL-PAGE SELECTOR ---
  const openSelector = (field, options) => {
    setSelectorField(field);
    setSelectorOptions(options);
  };

  const selectOption = (value) => {
    handleChange(selectorField, value);
    setSelectorField(null);
  };

  // --- IMAGE HANDLING ---
  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 10) {
      alert("Maximum 10 images allowed");
      return;
    }
    setImageFiles(files);
    setImagePreviews(files.map(file => URL.createObjectURL(file)));
  };

  // --- DELIVERY HANDLING ---
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
      deliveryRegions: [...prev.deliveryRegions, { ...deliveryForm, isFreeDelivery }]
    }));

    // Reset delivery form
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

  // --- VALIDATION ---
  const validateForm = () => {
    const errors = {};
    if (!form.title || form.title.trim().length < 30) errors.title = "Title must be at least 30 characters";
    if (!form.description || form.description.trim().length < 50) errors.description = "Description must be at least 50 characters";
    if (!form.price || Number(form.price.replace(/,/g, "")) <= 0) errors.price = "Price must be greater than 0";
    if (!form.phone_number || !/^\d{10,11}$/.test(form.phone_number)) errors.phone_number = "Enter a valid phone number";
    if (!form.state) errors.state = "State required";
    if (!form.city) errors.city = "City required";
    if (imageFiles.length < 1) errors.images = "Minimum 1 image required";
    if (imageFiles.length > 10) errors.images = "Maximum 10 images allowed";
    return errors;
  };

  // --- PRICE FORMATTING ---
  const handlePriceInput = (value) => {
    // Remove non-digit and format with commas
    const num = value.replace(/\D/g, "");
    const formatted = num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    handleChange("price", formatted);
  };

  // --- SUBMIT ---
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
      setShowPreview(false);
      setForm(prev => ({
        ...prev,
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

  const sectionStyle = {
    border: "2px solid #007BFF",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "20px",
    background: "#E6F0FF"
  };

  return (
    <div style={{ maxWidth: "700px", margin: "40px auto" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px", color: "#007BFF" }}>Post Marketplace Ad</h2>

      <form onSubmit={handleSubmit}>
        {/* SECTION 1: Product Details */}
        <div style={sectionStyle}>
          <h3>Product Details</h3>
          <input type="text" placeholder="Product Name" value={form.title} onChange={e => handleChange("title", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />

          <button type="button" style={{ width: "100%", padding: "10px", marginBottom: "10px" }} onClick={() => openSelector("category", Object.keys(categoryFields))}>
            {form.category || "Select Category"}
          </button>

          {visibleFields.map(field => {
            // Only show SIM and Features for Phones & Tablets
            if ((field === "sim" || field === "features") && form.category !== "Phones & Tablets") return null;

            return (
              <div key={field} style={{ marginBottom: "10px" }}>
                {field === "features" ? (
                  categoryFeatures.map(feat => (
                    <label key={feat} style={{ display: "block", marginBottom: "5px" }}>
                      <input
                        type="checkbox"
                        checked={form.features?.includes(feat)}
                        onChange={e => {
                          const selected = form.features || [];
                          if (e.target.checked) handleChange("features", [...selected, feat]);
                          else handleChange("features", selected.filter(f => f !== feat));
                        }}
                      /> {feat}
                    </label>
                  ))
                ) : field === "sim" ? (
                  availableSims.map(sim => (
                    <label key={sim} style={{ display: "block", marginBottom: "5px" }}>
                      <input
                        type="checkbox"
                        checked={form.sim?.includes(sim)}
                        onChange={e => {
                          const selected = form.sim || [];
                          if (e.target.checked) handleChange("sim", [...selected, sim]);
                          else handleChange("sim", selected.filter(s => s !== sim));
                        }}
                      /> {sim}
                    </label>
                  ))
                ) : (
                  <button
                    type="button"
                    style={{ width: "100%", padding: "10px" }}
                    onClick={() => openSelector(field, getFieldOptions(field))}
                  >
                    {form[field] || `Select ${field.replace("_", " ")}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
    
         {/* SECTION 2: Pricing & Offers */}
        <div style={sectionStyle}>
          <h3>Pricing & Offers</h3>
          <input
            type="text"
            placeholder="Price"
            value={form.price}
            onChange={e => handlePriceInput(e.target.value)}
            style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
          />
          <input
            type="number"
            placeholder="Discount / Sale Price (Optional)"
            value={form.discount_price}
            onChange={e => handleChange("discount_price", e.target.value)}
            style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
          />

          <label style={{ display: "block", marginBottom: "10px" }}>
            <input
              type="checkbox"
              checked={form.flash_sale}
              onChange={e => handleChange("flash_sale", e.target.checked)}
            /> Flash Sale
          </label>

          <label style={{ display: "block", marginBottom: "10px" }}>
            <input
              type="checkbox"
              checked={form.negotiable}
              onChange={e => handleChange("negotiable", e.target.checked)}
            /> Price Negotiable
          </label>

          <label style={{ display: "block", marginBottom: "10px" }}>
            <input
              type="checkbox"
              checked={form.exchange_possible}
              onChange={e => handleChange("exchange_possible", e.target.checked)}
            /> Exchange Possible
          </label>
        </div>

        {/* SECTION 3: Product Description & Quantity */}
        <div style={sectionStyle}>
          <h3>Product Description & Details</h3>
          <textarea
            placeholder="Short Description"
            value={form.description}
            onChange={e => handleChange("description", e.target.value)}
            style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
          />
          <input
            type="number"
            placeholder="Quantity / Stock"
            value={form.quantity}
            onChange={e => handleChange("quantity", e.target.value)}
            style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
          />
        </div>

        {/* SECTION 4: Product Images / Video */}
        <div style={sectionStyle}>
          <h3>Product Images / Media</h3>
          <input
            type="file"
            accept="image/*"
            multiple
            ref={fileInputRef}
            onChange={handleImagesChange}
            style={{ marginBottom: "15px" }}
          />
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "15px" }}>
            {imagePreviews.map((src, i) => (
              <img key={i} src={src} alt="Preview" style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "5px" }} />
            ))}
          </div>
          <input
            type="text"
            placeholder="Optional Video / 360° Link"
            value={form.video_link}
            onChange={e => handleChange("video_link", e.target.value)}
            style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
          />
        </div>

        {/* SECTION 5: Delivery Options */}
        <div style={sectionStyle}>
          <h3>Delivery Options</h3>

          {/* Delivery Form */}
          <button
            type="button"
            style={{ width: "100%", padding: "10px", marginBottom: "10px", background: "#007BFF", color: "#fff", border: "none", borderRadius: "6px" }}
            onClick={() => setSelectorField("delivery")}
          >
            Add Delivery Region
          </button>

          {form.deliveryRegions.map((region, index) => (
            <div key={index} style={{ background: "#fff", padding: "10px", borderRadius: "8px", marginTop: "10px", border: "1px solid #ccc" }}>
              <strong>{region.state} - {region.city}</strong>
              <div>{region.method} • {region.from}-{region.to} days</div>
              {region.isFreeDelivery && <div style={{ color: "green" }}>FREE DELIVERY</div>}
              {region.expressAvailable && <div style={{ color: "#007BFF" }}>Express Available</div>}
              {region.warehouseAddress && <div>Warehouse: {region.warehouseAddress}</div>}
              <button
                type="button"
                onClick={() => removeDeliveryRegion(index)}
                style={{ marginTop: "5px", background: "red", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "5px" }}
              >
                Remove
              </button>
            </div>
          ))}

          {/* Full-page delivery selector */}
          {selectorField === "delivery" && (
            <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", zIndex: 9999 }}>
              <div style={{ background: "#fff", flex: 1, overflowY: "auto", padding: "20px" }}>
                <h3>Add Delivery Region</h3>

                <select
                  value={deliveryForm.state}
                  onChange={e => setDeliveryForm(prev => ({ ...prev, state: e.target.value, city: "" }))}
                  style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
                >
                  <option value="">Select State</option>
                  {Object.keys(locationsByState).map(st => <option key={st} value={st}>{st}</option>)}
                </select>

                <select
                  value={deliveryForm.city}
                  onChange={e => setDeliveryForm(prev => ({ ...prev, city: e.target.value }))}
                  style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
                >
                  <option value="">Select City</option>
                  {(locationsByState[deliveryForm.state] || []).map(ct => <option key={ct} value={ct}>{ct}</option>)}
                </select>

                <select
                  value={deliveryForm.method}
                  onChange={e => setDeliveryForm(prev => ({ ...prev, method: e.target.value }))}
                  style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
                >
                  <option value="Courier">Courier</option>
                  <option value="Pickup">Pickup</option>
                  <option value="Both">Both</option>
                </select>

                <input
                  type="number"
                  placeholder="From (days)"
                  value={deliveryForm.from}
                  onChange={e => setDeliveryForm(prev => ({ ...prev, from: e.target.value }))}
                  style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
                />
                <input
                  type="number"
                  placeholder="To (days)"
                  value={deliveryForm.to}
                  onChange={e => setDeliveryForm(prev => ({ ...prev, to: e.target.value }))}
                  style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
                />

                <label style={{ display: "block", marginBottom: "10px" }}>
                  <input
                    type="checkbox"
                    checked={deliveryForm.chargeFee}
                    onChange={e => setDeliveryForm(prev => ({ ...prev, chargeFee: e.target.checked }))}
                  /> Charge Delivery Fee
                </label>

                {deliveryForm.chargeFee && (
                  <input
                    type="number"
                    placeholder="Delivery Fee"
                    value={deliveryForm.fee}
                    onChange={e => setDeliveryForm(prev => ({ ...prev, fee: e.target.value }))}
                    style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
                  />
                )}

                <label style={{ display: "block", marginBottom: "10px" }}>
                  <input
                    type="checkbox"
                    checked={deliveryForm.expressAvailable}
                    onChange={e => setDeliveryForm(prev => ({ ...prev, expressAvailable: e.target.checked }))}
                  /> Express Delivery Available
                </label>

                <input
                  type="text"
                  placeholder="Warehouse Address (Optional)"
                  value={deliveryForm.warehouseAddress}
                  onChange={e => setDeliveryForm(prev => ({ ...prev, warehouseAddress: e.target.value }))}
                  style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
                />

                <button
                  type="button"
                  onClick={() => { addDeliveryRegion(); setSelectorField(null); }}
                  style={{ width: "100%", padding: "10px", background: "#007BFF", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}
                >
                  Add Delivery Region
                </button>

                <button
                  type="button"
                  onClick={() => setSelectorField(null)}
                  style={{ width: "100%", padding: "10px", marginTop: "10px", background: "#ccc", color: "#000", border: "none", borderRadius: "8px" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
    
         {/* SECTION 6: Contact & Seller Info */}
        <div style={sectionStyle}>
          <h3>Contact & Seller Info</h3>

          {/* Full-page selector for State */}
          <button
            type="button"
            style={{ width: "100%", padding: "10px", marginBottom: "10px", background: "#007BFF", color: "#fff", border: "none", borderRadius: "6px" }}
            onClick={() => openSelector("state", Object.keys(locationsByState))}
          >
            {form.state || "Select State"}
          </button>

          {/* City shows only if state selected */}
          {form.state && (
            <button
              type="button"
              style={{ width: "100%", padding: "10px", marginBottom: "10px", background: "#007BFF", color: "#fff", border: "none", borderRadius: "6px" }}
              onClick={() => openSelector("city", locationsByState[form.state])}
            >
              {form.city || "Select City"}
            </button>
          )}

          <input
            type="text"
            placeholder="Location / Address"
            value={form.location}
            onChange={(e) => handleChange("location", e.target.value)}
            style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
          />

          <input
            type="text"
            placeholder="Phone Number"
            value={form.phone_number}
            onChange={(e) => handleChange("phone_number", e.target.value)}
            style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
          />

          <input
            type="text"
            placeholder="Additional Phone / WhatsApp"
            value={form.additional_phone}
            onChange={(e) => handleChange("additional_phone", e.target.value)}
            style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
          />

          <input
            type="text"
            placeholder="Seller Name"
            value={form.poster_name}
            readOnly
            style={{ width: "100%", padding: "10px", marginBottom: "15px", background: "#f5f5f5" }}
          />
        </div>

        {/* SECTION 7: Preview & Publish */}
        <div style={sectionStyle}>
          <h3>Preview & Publish</h3>

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "12px", background: "#007BFF", color: "#fff", border: "none", cursor: "pointer", fontSize: "16px", marginBottom: "10px" }}
          >
            {loading ? "Posting..." : "Preview Product"}
          </button>

          <label style={{ display: "block", marginBottom: "15px" }}>
            <input type="checkbox" /> I agree to Terms & Conditions
          </label>
        </div>

        {/* FULL-PAGE SELECTOR MODAL */}
        {selectorField && selectorField !== "delivery" && (
          <div style={{
            position: "fixed",
            top: 0, left: 0, width: "100%", height: "100%",
            background: "rgba(0,0,0,0.6)",
            display: "flex", flexDirection: "column",
            zIndex: 9999
          }}>
            <div style={{ background: "#fff", flex: 1, overflowY: "auto", padding: "20px" }}>
              <h3>Select {selectorField.replace("_", " ")}</h3>
              {selectorOptions.map((opt) => (
                <div
                  key={opt}
                  style={{ padding: "15px", borderBottom: "1px solid #eee", cursor: "pointer" }}
                  onClick={() => selectOption(opt)}
                >
                  {opt}
                </div>
              ))}
              <button
                onClick={() => setSelectorField(null)}
                style={{ marginTop: "20px", padding: "10px", width: "100%", background: "#007BFF", color: "#fff", border: "none", borderRadius: "8px" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* PREVIEW MODAL */}
        {showPreview && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            display: "flex", justifyContent: "center", alignItems: "center",
            zIndex: 9999
          }}>
            <div style={{ background: "#fff", width: "90%", maxWidth: "600px", padding: "20px", borderRadius: "12px", maxHeight: "90vh", overflowY: "auto" }}>
              <h2>Product Preview</h2>

              <h3>{form.title}</h3>
              <p><strong>Price:</strong> {form.price}</p>
              {form.negotiable && <p>💬 Negotiable</p>}
              {form.exchange_possible && <p>🔄 Exchange Possible</p>}
              <p>{form.description}</p>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {imagePreviews.map((src, i) => (
                  <img key={i} src={src} style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "6px" }} />
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