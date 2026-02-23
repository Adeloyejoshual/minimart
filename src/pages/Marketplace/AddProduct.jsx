// src/pages/Marketplace/AddMarketplaceProduct.jsx
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { PaystackButton } from "react-paystack";
import { FaStar, FaRocket, FaGift, FaBullhorn, FaBolt } from "react-icons/fa";

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

// ===================== STYLES =====================
const STYLES = {
  container: { width: "95%", maxWidth: "800px", margin: "0 auto", padding: "20px", boxSizing: "border-box" },
  section: { border: "2px solid #007BFF", borderRadius: "12px", padding: "20px", marginBottom: "20px", background: "#E6F0FF", width: "100%", maxWidth: "800px", boxSizing: "border-box" },
  title: { textAlign: "center", color: "#007BFF", marginBottom: "30px", fontSize: "28px" },
  input: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "16px", marginBottom: "12px", boxSizing: "border-box" },
  textarea: { width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "16px", marginBottom: "12px", boxSizing: "border-box", resize: "vertical", minHeight: "100px" },
  errorInput: { borderColor: "#dc3545", boxShadow: "0 0 0 0.2rem rgba(220,53,69,.25)" },
  errorText: { color: "#dc3545", fontSize: "14px", display: "block" },
  selectorButton: (hasValue) => ({ width: "100%", padding: "12px", background: hasValue ? "#007BFF" : "#f8f9fa", color: hasValue ? "white" : "#333", border: hasValue ? "none" : "1px solid #ddd", borderRadius: "8px", marginBottom: "12px", cursor: "pointer", fontSize: "16px", textAlign: "left", boxSizing: "border-box" }),
  primaryButton: { width: "100%", padding: "12px", background: "#007BFF", color: "white", border: "none", borderRadius: "8px", fontSize: "16px", marginBottom: "15px", cursor: "pointer", boxSizing: "border-box" },
  submitButton: (disabled) => ({ width: "100%", padding: "16px", background: disabled ? "#6c757d" : "#28a745", color: "white", border: "none", borderRadius: "12px", fontSize: "18px", fontWeight: "bold", cursor: disabled ? "not-allowed" : "pointer", boxSizing: "border-box" }),
  planCard: (selected, isFree) => ({ border: selected ? "3px solid #007BFF" : "1px solid #e0e0e0", borderRadius: "12px", padding: "16px", cursor: "pointer", background: selected ? "linear-gradient(135deg, #E6F0FF 0%, #B3D9FF 100%)" : "#fff", boxShadow: selected ? "0 8px 25px rgba(0,123,255,0.3)" : "0 2px 8px rgba(0,0,0,0.1)", transition: "all 0.3s ease", ...(isFree && { borderColor: "#28a745" }), boxSizing: "border-box" }),
  freeBadge: { display: "inline-block", background: "#28a745", color: "white", padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "600", marginTop: "8px" },
  checkboxLabel: { display: "block", marginBottom: "8px", cursor: "pointer", fontSize: "14px" },
  deliveryRegion: { background: "#fff", padding: "15px", borderRadius: "8px", marginBottom: "10px", border: "1px solid #ddd", display: "flex", justifyContent: "space-between", alignItems: "center", boxSizing: "border-box" },
  dangerButton: { background: "#dc3545", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", boxSizing: "border-box" },
  imageUploadArea: (hasImages) => ({ border: hasImages ? "3px dashed #007BFF" : "2px dashed #ddd", borderRadius: "12px", padding: hasImages ? "20px" : "40px", background: hasImages ? "#E6F0FF" : "#f8f9fa", cursor: "pointer", transition: "all 0.3s ease", textAlign: "center", boxSizing: "border-box" }),
  imageGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: "15px", maxHeight: "300px", overflowY: "auto" },
  imagePreview: { width: "100%", height: "100%", objectFit: "cover", borderRadius: "8px", border: "2px solid #007BFF" },
  imageNumberOverlay: { position: "absolute", bottom: "8px", left: "8px", background: "rgba(0, 123, 255, 0.9)", color: "white", width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "bold" },
  removeImageButton: { position: "absolute", top: "-8px", right: "-8px", width: "24px", height: "24px", background: "#dc3545", color: "white", border: "none", borderRadius: "50%", fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 10000 },
  modalContent: { background: "#fff", width: "90%", maxWidth: "500px", maxHeight: "80vh", borderRadius: "12px", padding: "25px", overflowY: "auto", boxSizing: "border-box" },
  cancelButton: { width: "100%", padding: "14px", background: "#6c757d", color: "white", border: "none", borderRadius: "8px", fontSize: "16px", marginTop: "15px", cursor: "pointer", boxSizing: "border-box" }
};

// ===================== UTIL =====================
const getDiscountPercent = (price, discount) => (!price || price === 0 || !discount) ? 0 : Math.round((discount / price) * 100);

const initializeForm = (user) => ({
  title: "", description: "", price: "", discount_price: "", category: "", subcategory: "", brand: "", model: "", 
  condition: "", used_detail: "", ram: "", storage: "", color: "", sim: [], features: [], engine: "", mileage: "", 
  year: "", fuel_type: "", transmission: "", phone_number: user?.phone_number || "", additional_phone: "", 
  poster_name: user?.name || "", state: "", city: "", social_link: "", images: [], video_link: "", promoted: false, 
  promo_plan: "", flash_sale: false, exchange_possible: false, negotiable: false, deliveryRegions: []
});

const getFieldOptions = (field, computed) => {
  const optionsMap = { 
    subcategory: computed.visibleFields, 
    brand: computed.availableBrands, 
    model: computed.availableModels, 
    condition: conditions, 
    ram: ramOptions, 
    storage: storageOptions, 
    color: colors, 
    engine: engines, 
    fuel_type: fuelTypes, 
    year: years, 
    transmission: ["Manual", "Automatic", "CVT"] 
  };
  return optionsMap[field] || [];
};

// ===================== MAIN COMPONENT =====================
export default function AddMarketplaceProduct() {
  const { user, getAccessTokenSilently } = useAuth0();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState(() => initializeForm(user));
  const [images, setImages] = useState({ files: [], previews: [] });
  const [deliveryForm, setDeliveryForm] = useState({ state: "", city: "", method: "Courier", from: "", to: "", chargeFee: false, fee: "", expressAvailable: false, warehouseAddress: "" });
  const [ui, setUi] = useState({ loading: false, isSubmitting: false, showPreview: false, showPayment: false, selectorField: null, selectorOptions: [], errors: {} });

  const currentPlan = useMemo(() => promotionPlans.find(p => p.id === form.promo_plan), [form.promo_plan]);
  
  const computed = useMemo(() => {
    const baseFields = categoryFields[form.category] || [];
    const visibleFields = baseFields.filter(field => field !== "used_detail" || form.condition === "Used");
    
    return {
      visibleFields,
      availableBrands: brands[form.category] || [],
      availableModels: form.brand ? models[form.category]?.[form.brand] || [] : [],
      categoryFeatures: featuresByCategory[form.category] || [],
      availableCities: locationsByState[form.state] || [],
      currentPlan,
      paystackKey: import.meta.env.MODE === "production" ? import.meta.env.VITE_PAYSTACK_LIVE_KEY : import.meta.env.VITE_PAYSTACK_TEST_KEY,
      cleanPrice: Number(form.price.replace(/,/g, "")),
      imageCount: images.files.length,
      discountPercent: currentPlan ? getDiscountPercent(currentPlan.price, currentPlan.discount) : 0,
      apiUrl: import.meta.env.VITE_API_URL || '/api/marketplace'
    };
  }, [form.category, form.brand, form.state, form.condition, form.promo_plan, form.price, images.files.length, currentPlan]);

  // ======== FORM HANDLERS ========
  const handleChange = useCallback((field, value) => {
    setForm(prev => {
      let updated = { ...prev, [field]: value };
      if (field === "condition" && value !== "Used") updated.used_detail = "";
      if (field === "category") updated = { ...updated, subcategory: "", brand: "", model: "", ram: "", storage: "", color: "", sim: [], features: [], condition: "", used_detail: "" };
      if (field === "brand") updated.model = "";
      if (field === "state") updated.city = "";
      return updated;
    });
    setUi(prev => ({ ...prev, errors: { ...prev.errors, [field]: "" } }));
  }, []);

  const handlePriceInput = useCallback((value) => {
    const num = value.replace(/[^0-9]/g, "");
    handleChange("price", num ? Number(num).toLocaleString() : "");
  }, [handleChange]);

  const handleImagesAdd = useCallback((newFiles) => {
    setImages(prev => {
      if (prev.files.length + newFiles.length > 10) {
        alert(`Max 10 images. Current: ${prev.files.length}`);
        return prev;
      }
      const validFiles = newFiles.filter(f => f.size <= 10 * 1024 * 1024);
      const newPreviews = validFiles.map(URL.createObjectURL);
      return { files: [...prev.files, ...validFiles], previews: [...prev.previews, ...newPreviews] };
    });
  }, []);

  const removeImage = useCallback((index) => {
    if (images.previews[index]) URL.revokeObjectURL(images.previews[index]);
    setImages(prev => ({
      files: prev.files.filter((_, i) => i !== index),
      previews: prev.previews.filter((_, i) => i !== index)
    }));
  }, [images.previews]);

  const validateForm = useCallback(() => {
    const errors = {};
    if (!form.title?.trim() || form.title.length < 15) errors.title = "Title: 15+ chars required";
    if (!form.description?.trim() || form.description.length < 50) errors.description = "Description: 50+ chars required";
    if (!form.category) errors.category = "Select category";
    if (!computed.cleanPrice || computed.cleanPrice <= 0) errors.price = "Valid price required";
    if (!form.phone_number?.match(/^(\+234|0)?[789]\d{9}$/)) errors.phone_number = "Valid Nigerian phone required";
    if (!form.state) errors.state = "Select state";
    if (!form.city) errors.city = "Select city";
    if (computed.imageCount === 0) errors.images = "Add 1+ image";
    if (form.promoted && !form.promo_plan) errors.promo_plan = "Select plan";
    setUi(prev => ({ ...prev, errors })); 
    return Object.keys(errors).length === 0;
  }, [form, computed.cleanPrice, computed.imageCount]);

  // ======== IMAGE UPLOAD ========
  const uploadImages = useCallback(async () => {
    if (!images.files.length) return [];
    const uploadedImages = [];
    for (const file of images.files) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/upload`, { method: "POST", body: formData });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error.message);
        uploadedImages.push(data.secure_url);
      } catch (err) {
        console.error("Upload error:", err);
        alert(`Failed to upload ${file.name}`);
      }
    }
    return uploadedImages;
  }, [images.files]);

  // ======== SUBMIT & PUBLISH ========
  const handleSubmit = useCallback((e) => { e.preventDefault(); if (!validateForm()) return; setUi(prev => ({ ...prev, isSubmitting: true, showPreview: true })); }, [validateForm]);

  const confirmPublish = useCallback(async () => {
    setUi(prev => ({ ...prev, showPreview: false }));
    if (form.promoted && currentPlan?.price > 0) setUi(prev => ({ ...prev, showPayment: true }));
    else await finalPublish();
  }, [form.promoted, currentPlan]);

  const finalPublish = useCallback(async (paymentRef = null) => {
    setUi(prev => ({ ...prev, loading: true }));
    try {
      const token = await getAccessTokenSilently({ authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE, scope: "write:products" } });
      const imageUrls = await uploadImages();
      const productData = { ...form, images: imageUrls, phone_number: form.phone_number.replace(/\s/g, ''), createdBy: user?.sub, ...(form.promoted && currentPlan?.price === 0 && { promo_status: 'free' }), ...(paymentRef && { payment_reference: paymentRef }) };
      const response = await fetch(computed.apiUrl, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify(productData) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `Publish failed: ${response.status}`);
      alert("✅ Product published successfully!");
      resetForm();
    } catch (err) { console.error("Publish error:", err); alert("❌ " + err.message); } 
    finally { setUi(prev => ({ ...prev, loading: false, isSubmitting: false })); }
  }, [form, currentPlan, uploadImages, getAccessTokenSilently, computed.apiUrl, user?.sub]);

  const handlePaySuccess = useCallback(async (response) => { setUi(prev => ({ ...prev, showPayment: false })); await finalPublish(response.reference); }, [finalPublish]);

  const resetForm = useCallback(() => { setForm(initializeForm(user)); setImages({ files: [], previews: [] }); setDeliveryForm({ state: "", city: "", method: "Courier", from: "", to: "", chargeFee: false, fee: "", expressAvailable: false, warehouseAddress: "" }); setUi({ loading: false, isSubmitting: false, showPreview: false, showPayment: false, selectorField: null, selectorOptions: [], errors: {} }); if (fileInputRef.current) fileInputRef.current.value = ""; }, [user]);

  // ======== DELIVERY REGION ========
  const addDeliveryRegion = useCallback(() => {
    if (!deliveryForm.state || !deliveryForm.city || !deliveryForm.from || !deliveryForm.to) { alert("Complete all required delivery fields"); return; }
    setForm(prev => ({ ...prev, deliveryRegions: [...prev.deliveryRegions, deliveryForm] }));
    setDeliveryForm({ state: "", city: "", method: "Courier", from: "", to: "", chargeFee: false, fee: "", expressAvailable: false, warehouseAddress: "" });
  }, [deliveryForm]);

  const removeDeliveryRegion = useCallback((index) => { setForm(prev => ({ ...prev, deliveryRegions: prev.deliveryRegions.filter((_, i) => i !== index) })); }, []);

  // ======== RENDER ========
  return (
    <div style={STYLES.container}>
      <h1 style={STYLES.title}>🛒 Add Marketplace Product</h1>

      <form onSubmit={handleSubmit}>
        {/* TITLE & DESCRIPTION */}
        <div style={STYLES.section}>
          <input style={{...STYLES.input, ...(ui.errors.title && STYLES.errorInput)}} placeholder="Product Title" value={form.title} onChange={e => handleChange("title", e.target.value)} />
          {ui.errors.title && <span style={STYLES.errorText}>{ui.errors.title}</span>}

          <textarea style={{...STYLES.textarea, ...(ui.errors.description && STYLES.errorInput)}} placeholder="Product Description" value={form.description} onChange={e => handleChange("description", e.target.value)} />
          {ui.errors.description && <span style={STYLES.errorText}>{ui.errors.description}</span>}
        </div>

        {/* CATEGORY & SUBCATEGORY */}
        <div style={STYLES.section}>
          <button type="button" style={STYLES.selectorButton(!!form.category)} onClick={() => setUi(prev => ({ ...prev, selectorField: "category", selectorOptions: Object.keys(categoryFields) }))}>{form.category || "Select Category"}</button>
          {ui.errors.category && <span style={STYLES.errorText}>{ui.errors.category}</span>}

          {form.category && (
            <button type="button" style={STYLES.selectorButton(!!form.subcategory)} onClick={() => setUi(prev => ({ ...prev, selectorField: "subcategory", selectorOptions: computed.visibleFields }))}>{form.subcategory || "Select Subcategory"}</button>
          )}
        </div>

        {/* BRAND & MODEL */}
        {form.subcategory && (
          <div style={STYLES.section}>
            <button type="button" style={STYLES.selectorButton(!!form.brand)} onClick={() => setUi(prev => ({ ...prev, selectorField: "brand", selectorOptions: computed.availableBrands }))}>{form.brand || "Select Brand"}</button>
            {form.brand && <button type="button" style={STYLES.selectorButton(!!form.model)} onClick={() => setUi(prev => ({ ...prev, selectorField: "model", selectorOptions: computed.availableModels }))}>{form.model || "Select Model"}</button>}
          </div>
        )}

        {/* CONDITION */}
        {form.subcategory && (
          <div style={STYLES.section}>
            <button type="button" style={STYLES.selectorButton(!!form.condition)} onClick={() => setUi(prev => ({ ...prev, selectorField: "condition", selectorOptions: conditions }))}>{form.condition || "Select Condition"}</button>
            {form.condition === "Used" && <button type="button" style={STYLES.selectorButton(!!form.used_detail)} onClick={() => setUi(prev => ({ ...prev, selectorField: "used_detail", selectorOptions: usedDetails }))}>{form.used_detail || "Used Detail"}</button>}
          </div>
        )}

        {/* PRICE & PHONE */}
        <div style={STYLES.section}>
          <input style={{...STYLES.input, ...(ui.errors.price && STYLES.errorInput)}} placeholder="Price (₦)" value={form.price} onChange={e => handlePriceInput(e.target.value)} />
          {ui.errors.price && <span style={STYLES.errorText}>{ui.errors.price}</span>}

          <input style={{...STYLES.input, ...(ui.errors.phone_number && STYLES.errorInput)}} placeholder="Phone Number" value={form.phone_number} onChange={e => handleChange("phone_number", e.target.value)} />
          {ui.errors.phone_number && <span style={STYLES.errorText}>{ui.errors.phone_number}</span>}
        </div>

        {/* IMAGE UPLOAD */}
        <div style={STYLES.section}>
          <div style={STYLES.imageUploadArea(images.files.length)} onClick={() => fileInputRef.current?.click()}>
            {images.files.length === 0 ? "Click or Drag images (max 10)" : "Add More Images"}
            <input ref={fileInputRef} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={e => handleImagesAdd(Array.from(e.target.files))} />
          </div>
          {ui.errors.images && <span style={STYLES.errorText}>{ui.errors.images}</span>}

          <div style={STYLES.imageGrid}>
            {images.previews.map((src, i) => (
              <div key={i} style={{ position: "relative" }}>
                <img src={src} alt={`Preview ${i + 1}`} style={STYLES.imagePreview} />
                <div style={STYLES.imageNumberOverlay}>{i + 1}</div>
                <button type="button" style={STYLES.removeImageButton} onClick={() => removeImage(i)}>×</button>
              </div>
            ))}
          </div>
        </div>

        {/* PROMOTION PLAN */}
        <div style={STYLES.section}>
          <label style={STYLES.checkboxLabel}>
            <input type="checkbox" checked={form.promoted} onChange={e => handleChange("promoted", e.target.checked)} /> Promote Product
          </label>

          {form.promoted && (
            <div style={{ display: "flex", gap: "15px", overflowX: "auto" }}>
              {promotionPlans.map(plan => (
                <div key={plan.id} style={STYLES.planCard(plan.id === form.promo_plan, plan.price === 0)} onClick={() => handleChange("promo_plan", plan.id)}>
                  <div style={{ fontWeight: "bold", fontSize: "16px" }}>{plan.name}</div>
                  <div>₦{plan.price.toLocaleString()}</div>
                  {plan.price === 0 && <span style={STYLES.freeBadge}>FREE</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" style={STYLES.submitButton(ui.isSubmitting)} disabled={ui.isSubmitting}>{ui.isSubmitting ? "Processing..." : "Preview & Publish"}</button>
      </form>

      {/* PREVIEW MODAL */}
      {ui.showPreview && (
        <div style={STYLES.modalOverlay}>
          <div style={STYLES.modalContent}>
            <h3>📦 Preview Product</h3>
            <p><strong>Title:</strong> {form.title}</p>
            <p><strong>Description:</strong> {form.description}</p>
            <p><strong>Price:</strong> ₦{form.price}</p>
            <p><strong>Category:</strong> {form.category} / {form.subcategory}</p>
            {form.brand && <p><strong>Brand:</strong> {form.brand}</p>}
            {form.model && <p><strong>Model:</strong> {form.model}</p>}
            {images.previews.length > 0 && <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>{images.previews.map((src, i) => <img key={i} src={src} style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "6px" }} />)}</div>}
            <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
              <button style={STYLES.primaryButton} onClick={confirmPublish}>✅ Confirm & Publish</button>
              <button style={STYLES.cancelButton} onClick={() => setUi(prev => ({ ...prev, showPreview: false }))}>✖ Edit</button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {ui.showPayment && currentPlan && currentPlan.price > 0 && (
        <div style={STYLES.modalOverlay}>
          <div style={STYLES.modalContent}>
            <h3>💳 Pay for Promotion</h3>
            <p>Plan: <strong>{currentPlan.name}</strong></p>
            <p>Amount: ₦{(currentPlan.price - (currentPlan.discount || 0)).toLocaleString()}</p>
            <PaystackButton
              className="paystack-button"
              text={`Pay ₦${(currentPlan.price - (currentPlan.discount || 0)).toLocaleString()}`}
              amount={(currentPlan.price - (currentPlan.discount || 0)) * 100}
              email={user?.email}
              currency="NGN"
              publicKey={computed.paystackKey}
              onSuccess={handlePaySuccess}
              onClose={() => setUi(prev => ({ ...prev, showPayment: false }))}
            />
            <button style={STYLES.cancelButton} onClick={() => setUi(prev => ({ ...prev, showPayment: false }))}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
