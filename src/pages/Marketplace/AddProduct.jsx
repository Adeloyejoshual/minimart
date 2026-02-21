// src/pages/Marketplace/AddMarketplaceProduct.jsx
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { PaystackButton } from "react-paystack";
import { FaStar, FaRocket, FaGift, FaBullhorn, FaBolt } from "react-icons/fa";

// ✅ YOUR EXACT PROJECT STRUCTURE - 17 INDIVIDUAL IMPORTS
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

// 🟢 PRODUCTION STYLES (outside component - no re-renders)
const STYLES = {
  container: { maxWidth: "800px", margin: "0 auto", padding: "20px" },
  title: { textAlign: "center", color: "#007BFF", marginBottom: "30px", fontSize: "28px" },
  section: { 
    border: "2px solid #007BFF", borderRadius: "12px", 
    padding: "20px", marginBottom: "20px", background: "#E6F0FF" 
  },
  input: { 
    width: "100%", padding: "12px", borderRadius: "8px", 
    border: "1px solid #ddd", fontSize: "16px", marginBottom: "12px", boxSizing: "border-box"
  },
  textarea: { 
    width: "100%", padding: "12px", borderRadius: "8px", 
    border: "1px solid #ddd", fontSize: "16px", marginBottom: "12px", boxSizing: "border-box",
    resize: "vertical", minHeight: "100px"
  },
  errorInput: { borderColor: "#dc3545", boxShadow: "0 0 0 0.2rem rgba(220,53,69,.25)" },
  errorText: { color: "#dc3545", fontSize: "14px", display: "block" },
  selectorButton: (hasValue) => ({
    width: "100%", padding: "12px", 
    background: hasValue ? "#007BFF" : "#f8f9fa",
    color: hasValue ? "white" : "#333",
    border: hasValue ? "none" : "1px solid #ddd",
    borderRadius: "8px", marginBottom: "12px", cursor: "pointer",
    fontSize: "16px", textAlign: "left"
  }),
  primaryButton: {
    width: "100%", padding: "12px", background: "#007BFF",
    color: "white", border: "none", borderRadius: "8px",
    fontSize: "16px", marginBottom: "15px", cursor: "pointer"
  },
  submitButton: (disabled) => ({
    width: "100%", padding: "16px", 
    background: disabled ? "#6c757d" : "#28a745",
    color: "white", border: "none", borderRadius: "12px",
    fontSize: "18px", fontWeight: "bold", cursor: disabled ? "not-allowed" : "pointer"
  }),
  planCard: (selected, isFree) => ({
    border: selected ? "3px solid #007BFF" : "1px solid #e0e0e0",
    borderRadius: "12px", padding: "16px", cursor: "pointer",
    background: selected ? "linear-gradient(135deg, #E6F0FF 0%, #B3D9FF 100%)" : "#fff",
    boxShadow: selected ? "0 8px 25px rgba(0,123,255,0.3)" : "0 2px 8px rgba(0,0,0,0.1)",
    transition: "all 0.3s ease",
    ...(isFree && { borderColor: "#28a745" })
  }),
  freeBadge: {
    display: "inline-block", background: "#28a745", color: "white",
    padding: "4px 12px", borderRadius: "20px", fontSize: "12px",
    fontWeight: "600", marginTop: "8px"
  },
  checkboxLabel: { display: "block", marginBottom: "8px", cursor: "pointer", fontSize: "14px" },
  deliveryRegion: {
    background: "#fff", padding: "15px", borderRadius: "8px",
    marginBottom: "10px", border: "1px solid #ddd",
    display: "flex", justifyContent: "space-between", alignItems: "center"
  },
  dangerButton: {
    background: "#dc3545", color: "white", border: "none",
    padding: "6px 12px", borderRadius: "6px", fontSize: "12px", cursor: "pointer"
  },
  imageUploadArea: (hasImages) => ({
    border: hasImages ? "3px dashed #007BFF" : "2px dashed #ddd",
    borderRadius: "12px", padding: hasImages ? "20px" : "40px",
    background: hasImages ? "#E6F0FF" : "#f8f9fa", cursor: "pointer",
    transition: "all 0.3s ease", textAlign: "center"
  }),
  imageGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
    gap: "15px", maxHeight: "300px", overflowY: "auto"
  },
  imagePreview: {
    width: "100%", height: "100%", objectFit: "cover",
    borderRadius: "8px", border: "2px solid #007BFF"
  },
  imageNumberOverlay: {
    position: "absolute", bottom: "8px", left: "8px",
    background: "rgba(0, 123, 255, 0.9)", color: "white",
    width: "24px", height: "24px", borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "12px", fontWeight: "bold"
  },
  removeImageButton: {
    position: "absolute", top: "-8px", right: "-8px",
    width: "24px", height: "24px", background: "#dc3545",
    color: "white", border: "none", borderRadius: "50%",
    fontSize: "14px", cursor: "pointer", display: "flex",
    alignItems: "center", justifyContent: "center"
  },
  modalOverlay: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.7)", display: "flex",
    justifyContent: "center", alignItems: "center", zIndex: 10000
  },
  modalContent: {
    background: "#fff", width: "90%", maxWidth: "500px",
    maxHeight: "80vh", borderRadius: "12px", padding: "25px", overflowY: "auto"
  },
  cancelButton: {
    width: "100%", padding: "14px", background: "#6c757d",
    color: "white", border: "none", borderRadius: "8px",
    fontSize: "16px", marginTop: "15px", cursor: "pointer"
  }
};

// 🟢 UTILITY FUNCTIONS
const getDiscountPercent = (price, discount) => {
  if (!price || price === 0 || !discount) return 0;
  return Math.round((discount / price) * 100);
};

const initializeForm = (user) => ({
  title: "", description: "", price: "", discount_price: "",
  quantity: "", category: "", subcategory: "", brand: "", model: "",
  condition: "", used_detail: "", ram: "", storage: "", color: "",
  sim: [], features: [], engine: "", mileage: "", year: "",
  fuel_type: "", transmission: "", phone_number: user?.phone_number || "",
  additional_phone: "", poster_name: user?.name || "", state: "", city: "",
  location: "", social_link: "", images: [], video_link: "",
  promoted: false, promo_plan: "", flash_sale: false, 
  exchange_possible: false, negotiable: false, deliveryRegions: []
});

function getFieldOptions(field, computed) {
  const optionsMap = {
    subcategory: computed.visibleFields,
    brand: computed.availableBrands,
    model: computed.availableModels,
    condition: conditions,
    used_detail: usedDetails,
    ram: ramOptions,
    storage: storageOptions,
    color: colors,
    engine: engines,
    fuel_type: fuelTypes,
    year: years,
    transmission: ["Manual", "Automatic", "CVT"]
  };
  return optionsMap[field] || [];
}

export default function AddMarketplaceProduct() {
  const { user } = useAuth0();
  const fileInputRef = useRef(null);

  // 🟢 STATE PARTITIONING
  const [form, setForm] = useState(() => initializeForm(user));
  const [images, setImages] = useState({ files: [], previews: [] });
  const [deliveryForm, setDeliveryForm] = useState({
    state: "", city: "", method: "Courier", from: "", to: "",
    chargeFee: false, fee: "", expressAvailable: false, warehouseAddress: ""
  });
  const [ui, setUi] = useState({
    loading: false, isSubmitting: false, showPreview: false,
    showPayment: false, selectorField: null, selectorOptions: [], errors: {}
  });

  // 🟢 PRE-COMPUTE (fixes self-reference)
  const currentPlan = useMemo(() => 
    promotionPlans.find(p => p.id === form.promo_plan), 
    [form.promo_plan]
  );

  // 🟢 COMPUTED VALUES (perfect dependencies)
  const computed = useMemo(() => ({
    visibleFields: categoryFields[form.category] || [],
    availableBrands: brands[form.category] || [],
    availableModels: form.brand ? models[form.category]?.[form.brand] || [] : [],
    categoryFeatures: featuresByCategory[form.category] || [],
    availableCities: locationsByState[form.state] || [],
    currentPlan,
    paystackKey: import.meta.env.MODE === "production"
      ? import.meta.env.VITE_PAYSTACK_LIVE_KEY
      : import.meta.env.VITE_PAYSTACK_TEST_KEY,
    cleanPrice: Number(form.price.replace(/,/g, "")),
    imageCount: images.files.length,
    discountPercent: currentPlan ? getDiscountPercent(currentPlan.price, currentPlan.discount) : 0
  }), [
    form.category, form.brand, form.state, form.promo_plan, 
    form.price, images.files.length, currentPlan
  ]);

  // 🟢 EVENT HANDLERS (all callback stable)
  const handleChange = useCallback((field, value) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      switch (field) {
        case "category":
          return {
            ...updated,
            subcategory: "", brand: "", model: "", ram: "", storage: "", color: "",
            sim: [], features: [], condition: "", used_detail: ""
          };
        case "brand": return { ...updated, model: "" };
        case "state": return { ...updated, city: "" };
        default: return updated;
      }
    });
    setUi(prev => ({ ...prev, errors: { ...prev.errors, [field]: "" } }));
  }, []);

  const handlePriceInput = useCallback((value) => {
    const num = value.replace(/[^0-9]/g, "");
    if (!num) {
      handleChange("price", "");
      return;
    }
    handleChange("price", Number(num).toLocaleString());
  }, [handleChange]);

  const handleImagesAdd = useCallback((newFiles) => {
    setImages(prev => {
      if (prev.files.length + newFiles.length > 10) {
        alert(`Max 10 images. Current: ${prev.files.length}`);
        return prev;
      }
      const validFiles = newFiles.filter(f => f.size <= 10 * 1024 * 1024);
      if (!validFiles.length) return prev;
      const newPreviews = validFiles.map(URL.createObjectURL);
      return {
        files: [...prev.files, ...validFiles],
        previews: [...prev.previews, ...newPreviews]
      };
    });
  }, []);

  const removeImage = useCallback((index) => {
    if (images.previews[index]) URL.revokeObjectURL(images.previews[index]);
    setImages(prev => ({
      files: prev.files.filter((_, i) => i !== index),
      previews: prev.previews.filter((_, i) => i !== index)
    }));
  }, [images.previews]);

  const uploadImages = useCallback(async () => {
    try {
      const uploadPromises = images.files.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/upload`,
          { method: "POST", body: formData }
        );
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const data = await res.json();
        if (!data.secure_url) throw new Error("Invalid upload response");
        return data.secure_url;
      });
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Image upload failed. Please try again.");
      throw error;
    }
  }, [images.files]);

  // 🟢 ALL REMAINING FUNCTIONS (validation, submit, etc.)
  const validateForm = useCallback(() => {
    const errors = {};
    if (!form.title?.trim() || form.title.length < 30)
      errors.title = "Title: 30+ chars required";
    if (!form.description?.trim() || form.description.length < 50)
      errors.description = "Description: 50+ chars required";
    if (!form.category) errors.category = "Select category";
    if (!computed.cleanPrice || computed.cleanPrice <= 0)
      errors.price = "Valid price required";
    if (!form.phone_number?.match(/^(?:\+234|0)[789]\d{9}$/))
      errors.phone_number = "Valid Nigerian phone required";
    if (!form.state) errors.state = "Select state";
    if (!form.city) errors.city = "Select city";
    if (computed.imageCount === 0) errors.images = "Add 1+ image";
    if (form.promoted && !form.promo_plan) errors.promo_plan = "Select plan";
    
    setUi(prev => ({ ...prev, errors }));
    return Object.keys(errors).length === 0;
  }, [form, computed.cleanPrice, computed.imageCount]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (ui.isSubmitting || !validateForm()) return;
    setUi(prev => ({ ...prev, isSubmitting: true }));
    
    if (form.promoted && computed.currentPlan?.price > 0) {
      setUi(prev => ({ ...prev, showPayment: true }));
    } else {
      setUi(prev => ({ ...prev, showPreview: true }));
    }
  }, [ui.isSubmitting, validateForm, form.promoted, computed.currentPlan]);

  const confirmPublish = useCallback(async () => {
    setUi(prev => ({ ...prev, loading: true, isSubmitting: false }));
    try {
      const imageUrls = await uploadImages();
      const productData = { 
        ...form, images: imageUrls,
        ...(form.promoted && computed.currentPlan?.price === 0 && { promo_status: 'free' })
      };
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });
      if (!res.ok) throw new Error("Publish failed");
      alert("✅ Product published successfully!");
      resetForm();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setUi(prev => ({ ...prev, loading: false }));
    }
  }, [form, uploadImages, computed.currentPlan]);

    const handlePaySuccess = useCallback(async (response) => {
    setUi(prev => ({ ...prev, showPayment: false, loading: true, isSubmitting: false }));
    try {
      const imageUrls = await uploadImages();
      const productData = { 
        ...form, 
        images: imageUrls, 
        payment_reference: response.reference 
      };

      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });

      if (!res.ok) throw new Error("Publish failed");
      alert("✅ Product published with promotion!");
      resetForm();
    } catch (err) {
      alert("Publish failed: " + err.message);
    } finally {
      setUi(prev => ({ ...prev, loading: false }));
    }
  }, [form, uploadImages]);

  const resetForm = useCallback(() => {
    setForm(initializeForm(user));
    setImages({ files: [], previews: [] });
    setDeliveryForm({ 
      state: "", city: "", method: "Courier", from: "", to: "",
      chargeFee: false, fee: "", expressAvailable: false, warehouseAddress: ""
    });
    setUi({ 
      loading: false, isSubmitting: false, showPreview: false, showPayment: false, 
      selectorField: null, selectorOptions: [], errors: {} 
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [user]);

  // 🟢 CLEANUP (component unmount only)
  useEffect(() => {
    return () => {
      images.previews.forEach(url => {
        if (url && typeof url === 'string') URL.revokeObjectURL(url);
      });
    };
  }, []);

  const addDeliveryRegion = useCallback(() => {
    if (!deliveryForm.state || !deliveryForm.city || !deliveryForm.from || !deliveryForm.to) {
      alert("Complete all required delivery fields");
      return;
    }
    if (Number(deliveryForm.from) > Number(deliveryForm.to)) {
      alert("From days cannot exceed To days");
      return;
    }
    const isFreeDelivery = deliveryForm.chargeFee && Number(deliveryForm.fee) === 0;
    setForm(prev => ({
      ...prev,
      deliveryRegions: [...prev.deliveryRegions, { ...deliveryForm, isFreeDelivery }]
    }));
    setDeliveryForm({
      state: "", city: "", method: "Courier", from: "", to: "",
      chargeFee: false, fee: "", expressAvailable: false, warehouseAddress: ""
    });
  }, [deliveryForm]);

  const removeDeliveryRegion = useCallback((index) => {
    setForm(prev => ({
      ...prev,
      deliveryRegions: prev.deliveryRegions.filter((_, i) => i !== index)
    }));
  }, []);

  const openSelector = useCallback((field, options) => {
    setUi(prev => ({ ...prev, selectorField: field, selectorOptions: options }));
  }, []);

  const selectOption = useCallback((value) => {
    if (ui.selectorField) handleChange(ui.selectorField, value);
    setUi(prev => ({ ...prev, selectorField: null }));
  }, [ui.selectorField, handleChange]);

  const cancelPreview = () => setUi(prev => ({ ...prev, showPreview: false, isSubmitting: false }));
  const cancelPayment = () => setUi(prev => ({ ...prev, showPayment: false, isSubmitting: false }));

  // 🟢 COMPLETE JSX RENDER
  return (
    <div style={STYLES.container}>
      <h1 style={STYLES.title}>🚀 Post New Marketplace Product</h1>

      <form onSubmit={handleSubmit}>
        {/* 🟢 PRODUCT DETAILS SECTION */}
        <div style={STYLES.section}>
          <h3 style={{ marginTop: 0, color: "#333" }}>📦 Product Details</h3>
          
          <input 
            placeholder="Product Title (min 30 chars)" 
            value={form.title}
            onChange={e => handleChange("title", e.target.value)}
            style={{ ...STYLES.input, ...(ui.errors.title && STYLES.errorInput) }}
          />
          {ui.errors.title && <small style={STYLES.errorText}>{ui.errors.title}</small>}

          <button 
            type="button"
            onClick={() => openSelector("category", Object.keys(categoryFields))}
            style={STYLES.selectorButton(!!form.category)}
          >
            {form.category || "🎯 Select Category"}
          </button>
          {ui.errors.category && <small style={STYLES.errorText}>{ui.errors.category}</small>}

          {/* 🟢 DYNAMIC FIELDS BY CATEGORY */}
          {computed.visibleFields.map(field => (
            <div key={field} style={{ marginBottom: "12px" }}>
              {field === "features" ? (
                <div>
                  <label style={{ display: "block", fontWeight: "500", marginBottom: "8px" }}>
                    Features
                  </label>
                  {computed.categoryFeatures.map(feat => (
                    <label key={feat} style={STYLES.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={form.features?.includes(feat)}
                        onChange={e => {
                          const selected = form.features || [];
                          handleChange("features", 
                            e.target.checked 
                              ? [...selected, feat]
                              : selected.filter(f => f !== feat)
                          );
                        }}
                      /> {feat}
                    </label>
                  ))}
                </div>
              ) : field === "sim" ? (
                <div>
                  <label style={{ display: "block", fontWeight: "500", marginBottom: "8px" }}>
                    SIM Support
                  </label>
                  {sims.map(sim => (
                    <label key={sim} style={STYLES.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={form.sim?.includes(sim)}
                        onChange={e => {
                          const selected = form.sim || [];
                          handleChange("sim", 
                            e.target.checked 
                              ? [...selected, sim]
                              : selected.filter(s => s !== sim)
                          );
                        }}
                      /> {sim}
                    </label>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openSelector(field, getFieldOptions(field, computed))}
                  style={STYLES.selectorButton(!!form[field])}
                >
                  {form[field] || `🎯 Select ${field.replace("_", " ").toUpperCase()}`}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* 🟢 PRICING & PROMOTIONS */}
        <div style={STYLES.section}>
          <h3 style={{ marginTop: 0, color: "#333" }}>💰 Pricing & Boost</h3>
          
          <input
            placeholder="Price (e.g. 50000)"
            value={form.price}
            onChange={e => handlePriceInput(e.target.value)}
            style={{ ...STYLES.input, ...(ui.errors.price && STYLES.errorInput) }}
          />
          {ui.errors.price && <small style={STYLES.errorText}>{ui.errors.price}</small>}

          <input
            placeholder="Discount Price (optional)"
            value={form.discount_price}
            onChange={e => handleChange("discount_price", e.target.value.replace(/[^0-9]/g, ""))}
            style={STYLES.input}
          />

          <label style={{ display: "block", margin: "15px 0", fontWeight: "500" }}>
            <input
              type="checkbox"
              checked={form.promoted}
              onChange={e => {
                handleChange("promoted", e.target.checked);
                if (!e.target.checked) handleChange("promo_plan", "");
              }}
            /> 
            <span style={{ marginLeft: "8px" }}>🚀 Boost Listing (Recommended)</span>
          </label>

          {form.promoted && promotionPlans.length > 0 && (
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
              gap: "12px" 
            }}>
              {promotionPlans.map(plan => {
                const finalPrice = plan.price - (plan.discount || 0);
                const PlanIcon = { 
                  basic: FaStar, 
                  standard: FaRocket, 
                  premium: FaBullhorn, 
                  flash: FaBolt, 
                  gift: FaGift 
                }[plan.id] || FaStar;
                
                return (
                  <div 
                    key={plan.id}
                    style={STYLES.planCard(form.promo_plan === plan.id, plan.price === 0)}
                    onClick={() => handleChange("promo_plan", plan.id)}
                  >
                    <PlanIcon style={{ fontSize: "24px", marginBottom: "8px" }} />
                    <h4 style={{ margin: "0 0 4px 0", fontSize: "14px" }}>{plan.name}</h4>
                    <p style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
                      {plan.duration}
                    </p>
                    <div style={{ fontSize: "16px", fontWeight: "bold", color: "#28a745" }}>
                      {computed.discountPercent > 0 && (
                        <span style={{ 
                          textDecoration: "line-through", 
                          fontSize: "14px", 
                          color: "#999", 
                          marginRight: "5px" 
                        }}>
                          ₦{plan.price.toLocaleString()}
                        </span>
                      )}
                      ₦{finalPrice.toLocaleString()}
                    </div>
                    {plan.price === 0 && <span style={STYLES.freeBadge}>FREE</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 🟢 DESCRIPTION & MEDIA */}
        <div style={STYLES.section}>
          <h3 style={{ marginTop: 0, color: "#333" }}>📝 Description & Media</h3>
          
          <textarea
            placeholder="Product description (min 50 chars)"
            value={form.description}
            onChange={e => handleChange("description", e.target.value)}
            style={{ ...STYLES.textarea, ...(ui.errors.description && STYLES.errorInput) }}
          />
          {ui.errors.description && <small style={STYLES.errorText}>{ui.errors.description}</small>}

          {/* 🟢 IMAGE UPLOAD */}
          <div style={{ margin: "20px 0" }}>
            <div 
              style={STYLES.imageUploadArea(images.files.length > 0)}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                handleImagesAdd(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')));
              }}
            >
              {images.files.length === 0 ? (
                <>
                  <div style={{ fontSize: "48px", color: "#007BFF", marginBottom: "10px" }}>➕</div>
                  <p style={{ fontSize: "18px", fontWeight: "500", color: "#333", margin: "0 0 5px 0" }}>
                    Click to add images or drag & drop
                  </p>
                  <p style={{ fontSize: "14px", color: "#666", margin: 0 }}>Max 10 images (10MB each)</p>
                </>
              ) : (
                <div style={STYLES.imageGrid}>
                  {images.previews.map((src, i) => (
                    <div key={i} style={{ position: "relative", aspectRatio: "1" }}>
                      <img src={src} alt={`Preview ${i + 1}`} style={STYLES.imagePreview} />
                      <div style={STYLES.imageNumberOverlay}>{i + 1}</div>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); removeImage(i); }}
                        style={STYLES.removeImageButton}
                        aria-label={`Remove image ${i + 1}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {images.files.length < 10 && (
                    <div style={{ 
                      display: "flex", 
                      flexDirection: "column", 
                      alignItems: "center", 
                      justifyContent: "center", 
                      border: "2px dashed #007BFF", 
                      borderRadius: "8px", 
                      cursor: "pointer", 
                      aspectRatio: "1" 
                    }} 
                    onClick={() => fileInputRef.current?.click()}
                    >
                      <div style={{ fontSize: "24px", color: "#007BFF" }}>➕</div>
                      <span style={{ 
                        fontSize: "14px", 
                        color: "#007BFF", 
                        fontWeight: "500", 
                        marginTop: "5px" 
                      }}>
                        Add more ({images.files.length}/10)
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              ref={fileInputRef}
              onChange={e => handleImagesAdd(Array.from(e.target.files))}
              style={{ display: "none" }}
            />
          </div>
          {ui.errors.images && <small style={STYLES.errorText}>{ui.errors.images}</small>}

          <input
            type="url"
            placeholder="YouTube/Video Link (optional)"
            value={form.video_link}
            onChange={e => handleChange("video_link", e.target.value)}
            style={STYLES.input}
          />
        </div>

               {/* 🟢 DELIVERY & CONTACT (CONTINUED) */}
        <div style={STYLES.section}>
          <h3 style={{ marginTop: 0, color: "#333" }}>🚚 Delivery & Contact</h3>
          
          {/* Delivery Region Button */}
          <button 
            type="button" 
            onClick={() => setUi(prev => ({ ...prev, selectorField: "delivery" }))}
            style={STYLES.primaryButton}
          >
            + Add Delivery Region
          </button>

          {/* Delivery Regions List */}
          {form.deliveryRegions.map((region, index) => (
            <div key={index} style={STYLES.deliveryRegion}>
              <div>
                <strong>{region.state} - {region.city}</strong>
                <div>{region.method} ({region.from}-{region.to} days)</div>
                {region.isFreeDelivery && (
                  <div style={{ color: "#28a745", fontSize: "14px" }}>✨ FREE DELIVERY</div>
                )}
                {region.fee && !region.isFreeDelivery && (
                  <div>Fee: ₦{Number(region.fee).toLocaleString()}</div>
                )}
              </div>
              <button 
                type="button" 
                onClick={() => removeDeliveryRegion(index)} 
                style={STYLES.dangerButton}
              >
                Remove
              </button>
            </div>
          ))}

          {/* Location Selectors */}
          <div style={{ marginTop: "20px" }}>
            <button
              type="button"
              onClick={() => openSelector("state", Object.keys(locationsByState))}
              style={STYLES.selectorButton(!!form.state)}
            >
              {form.state || "🏠 Select State"}
            </button>
            
            {form.state && (
              <button
                type="button"
                onClick={() => openSelector("city", computed.availableCities)}
                style={STYLES.selectorButton(!!form.city)}
              >
                {form.city || "🏙️ Select City"}
              </button>
            )}
            
            {ui.errors.state && <small style={STYLES.errorText}>{ui.errors.state}</small>}
            {ui.errors.city && <small style={STYLES.errorText}>{ui.errors.city}</small>}

            <input
              type="tel"
              placeholder="Primary Phone Number (080, 070, 090)"
              value={form.phone_number}
              onChange={e => handleChange("phone_number", e.target.value)}
              style={{ ...STYLES.input, ...(ui.errors.phone_number && STYLES.errorInput) }}
            />
            {ui.errors.phone_number && <small style={STYLES.errorText}>{ui.errors.phone_number}</small>}

            <input
              type="text"
              placeholder="Additional Phone (optional)"
              value={form.additional_phone}
              onChange={e => handleChange("additional_phone", e.target.value)}
              style={STYLES.input}
            />

            <input
              type="text"
              placeholder="Your Name"
              value={form.poster_name}
              onChange={e => handleChange("poster_name", e.target.value)}
              style={STYLES.input}
            />
          </div>
        </div>

        {/* 🟢 ADDITIONAL OPTIONS */}
        <div style={STYLES.section}>
          <h3 style={{ marginTop: 0, color: "#333" }}>⚙️ Additional Options</h3>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px" }}>
            <label style={STYLES.checkboxLabel}>
              <input
                type="checkbox"
                checked={form.negotiable}
                onChange={e => handleChange("negotiable", e.target.checked)}
              />
              💰 Price Negotiable
            </label>
            
            <label style={STYLES.checkboxLabel}>
              <input
                type="checkbox"
                checked={form.exchange_possible}
                onChange={e => handleChange("exchange_possible", e.target.checked)}
              />
              🔄 Exchange Possible
            </label>
            
            <label style={STYLES.checkboxLabel}>
              <input
                type="checkbox"
                checked={form.flash_sale}
                onChange={e => handleChange("flash_sale", e.target.checked)}
              />
              ⚡ Flash Sale
            </label>
          </div>

          <input
            type="url"
            placeholder="Social Media/WhatsApp Link (optional)"
            value={form.social_link}
            onChange={e => handleChange("social_link", e.target.value)}
            style={STYLES.input}
          />
        </div>

        {/* 🟢 FINAL SUBMIT SECTION */}
        <div style={STYLES.section}>
          <button
            type="submit"
            disabled={ui.loading || ui.isSubmitting || computed.imageCount === 0}
            style={STYLES.submitButton(ui.loading || ui.isSubmitting || computed.imageCount === 0)}
          >
            {ui.loading ? "⏳ Publishing..." : 
             `🚀 Preview & Publish (${computed.imageCount}/10 images)`}
          </button>
          
          <div style={{ 
            textAlign: "center", 
            color: "#666", 
            fontSize: "14px", 
            marginTop: "10px" 
          }}>
            {computed.imageCount === 0 && "⚠️ Add at least 1 image to continue"}
            {form.promoted && computed.currentPlan && (
              <div>
                Plan: <strong>{computed.currentPlan.name}</strong> 
                - ₦{(computed.currentPlan.price - (computed.currentPlan.discount || 0)).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </form>

      {/* 🟢 MODALS SYSTEM */}

      {/* 1. SELECTOR MODAL */}
      {ui.selectorField && ui.selectorField !== "delivery" && (
        <div style={STYLES.modalOverlay}>
          <div style={STYLES.modalContent}>
            <h3 style={{ marginTop: 0 }}>
              Select {ui.selectorField.replace("_", " ").toUpperCase()}
            </h3>
            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
              {ui.selectorOptions.map((option, index) => (
                <div
                  key={index}
                  style={{
                    padding: "16px",
                    borderBottom: "1px solid #eee",
                    cursor: "pointer",
                    fontSize: "16px",
                    transition: "background 0.2s",
                    background: "white"
                  }}
                  onClick={() => selectOption(option)}
                  onMouseOver={e => e.target.style.background = "#f8f9fa"}
                  onMouseOut={e => e.target.style.background = "white"}
                >
                  {option}
                </div>
              ))}
            </div>
            <button 
              style={STYLES.cancelButton} 
              onClick={() => setUi(prev => ({ ...prev, selectorField: null }))}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 2. DELIVERY MODAL */}
      {ui.selectorField === "delivery" && (
        <div style={STYLES.modalOverlay}>
          <div style={{ ...STYLES.modalContent, maxWidth: "450px" }}>
            <h3 style={{ marginTop: 0 }}>Add Delivery Region</h3>
            
            <select 
              value={deliveryForm.state} 
              onChange={e => setDeliveryForm(prev => ({ ...prev, state: e.target.value }))}
              style={STYLES.input}
            >
              <option value="">Select State</option>
              {Object.keys(locationsByState).map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>

            {deliveryForm.state && (
              <select 
                value={deliveryForm.city} 
                onChange={e => setDeliveryForm(prev => ({ ...prev, city: e.target.value }))}
                style={STYLES.input}
              >
                <option value="">Select City</option>
                {locationsByState[deliveryForm.state]?.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            )}

            <select 
              value={deliveryForm.method} 
              onChange={e => setDeliveryForm(prev => ({ ...prev, method: e.target.value }))}
              style={STYLES.input}
            >
              <option value="Courier">📦 Courier</option>
              <option value="Pickup">🚗 Pickup</option>
              <option value="Express">⚡ Express</option>
            </select>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <input 
                placeholder="From (days)" 
                value={deliveryForm.from}
                onChange={e => setDeliveryForm(prev => ({ ...prev, from: e.target.value.replace(/[^0-9]/g, "") }))}
                style={STYLES.input}
              />
              <input 
                placeholder="To (days)" 
                value={deliveryForm.to}
                onChange={e => setDeliveryForm(prev => ({ ...prev, to: e.target.value.replace(/[^0-9]/g, "") }))}
                style={STYLES.input}
              />
            </div>

            <label style={STYLES.checkboxLabel}>
              <input 
                type="checkbox" 
                checked={deliveryForm.chargeFee} 
                onChange={e => setDeliveryForm(prev => ({ ...prev, chargeFee: e.target.checked }))}
              />
              💰 Charge delivery fee
            </label>

            {deliveryForm.chargeFee && (
              <input 
                placeholder="Fee amount (₦)" 
                value={deliveryForm.fee}
                onChange={e => setDeliveryForm(prev => ({ ...prev, fee: e.target.value.replace(/[^0-9]/g, "") }))}
                style={STYLES.input}
              />
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={addDeliveryRegion} style={STYLES.primaryButton}>
                ✅ Add Region
              </button>
              <button 
                onClick={() => setUi(prev => ({ ...prev, selectorField: null }))} 
                style={STYLES.cancelButton}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. PREVIEW MODAL */}
      {ui.showPreview && (
        <div style={STYLES.modalOverlay}>
          <div style={{ ...STYLES.modalContent, maxWidth: "650px" }}>
            <h3 style={{ marginTop: 0 }}>👀 Product Preview</h3>
            
            <div style={{ 
              background: "#f8f9fa", 
              padding: "20px", 
              borderRadius: "8px", 
              marginBottom: "20px" 
            }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#333" }}>{form.title}</h4>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "#28a745", marginBottom: "10px" }}>
                ₦{computed.cleanPrice.toLocaleString()}
              </div>
              <p style={{ margin: "0 0 15px 0", color: "#666" }}>
                {form.description.substring(0, 150)}...
              </p>
              {computed.currentPlan && (
                <div style={{ 
                  background: "#E6F0FF", 
                  padding: "10px", 
                  borderRadius: "6px", 
                  fontSize: "14px" 
                }}>
                  🚀 Boost Plan: <strong>{computed.currentPlan.name}</strong>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              {images.previews.slice(0, 4).map((src, i) => (
                <img 
                  key={i} 
                  src={src} 
                  style={{ 
                    width: "80px", 
                    height: "80px", 
                    objectFit: "cover", 
                    borderRadius: "8px",
                    border: "3px solid #007BFF"
                  }} 
                />
              ))}
            </div>

            <div style={{ 
              display: "flex", 
              gap: "15px", 
              marginTop: "25px",
              flexWrap: "wrap"
            }}>
              <button 
                onClick={confirmPublish} 
                disabled={ui.loading} 
                style={STYLES.submitButton(ui.loading)}
              >
                {ui.loading ? "⏳ Publishing..." : "✅ Publish Now"}
              </button>
              <button 
                onClick={cancelPreview} 
                style={{ 
                  ...STYLES.cancelButton, 
                  flex: "1", 
                  background: "#007BFF" 
                }}
              >
                ✏️ Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. PAYMENT MODAL */}
      {ui.showPayment && computed.currentPlan && computed.paystackKey && (
        <div style={STYLES.modalOverlay}>
          <div style={STYLES.modalContent}>
            <h3 style={{ marginTop: 0 }}>💳 Complete Payment</h3>
            <div style={{ 
              background: "#E6F0FF", 
              padding: "20px", 
              borderRadius: "12px", 
              marginBottom: "20px",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "28px", marginBottom: "10px" }}>
                {computed.currentPlan.name}
              </div>
              <div style={{ 
                fontSize: "32px", 
                fontWeight: "bold", 
                color: "#28a745",
                marginBottom: "10px"
              }}>
                ₦{(computed.currentPlan.price - (computed.currentPlan.discount || 0)).toLocaleString()}
              </div>
              <div style={{ color: "#666", fontSize: "14px" }}>
                {computed.currentPlan.duration}
              </div>
            </div>

            <PaystackButton
              publicKey={computed.paystackKey}
              email={user?.email || "user@example.com"}
              amount={(computed.currentPlan.price - (computed.currentPlan.discount || 0)) * 100}
              currency="NGN"
              channels={['card', 'bank_transfer', 'ussd']}
              text={`💳 Pay ₦${(computed.currentPlan.price - (computed.currentPlan.discount || 0)).toLocaleString()}`}
              onSuccess={handlePaySuccess}
              onClose={cancelPayment}
              style={{
                width: "100%",
                padding: "16px",
                background: "#007BFF",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "18px",
                fontWeight: "bold",
                cursor: "pointer",
                marginBottom: "15px"
              }}
            />
            
            <button 
              onClick={cancelPayment} 
              style={STYLES.cancelButton}
            >
              Cancel Payment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { getDiscountPercent, initializeForm, getFieldOptions };
