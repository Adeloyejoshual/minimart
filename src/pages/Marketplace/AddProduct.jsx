// src/pages/Marketplace/AddMarketplaceProduct.jsx
import { useState, useRef, useEffect, useCallback } from "react";
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

const getDiscountPercent = (price, discount) => {
  if (!price || price === 0 || !discount) return 0;
  return Math.round((discount / price) * 100);
};

export default function AddMarketplaceProduct() {
  const { user } = useAuth0();
  const fileInputRef = useRef(null);

  // Core form state
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
    deliveryRegions: [],
  });

  // UI states
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
    expressAvailable: false,
    warehouseAddress: ""
  });
  const [loading, setLoading] = useState(false);
  const [selectorField, setSelectorField] = useState(null);
  const [selectorOptions, setSelectorOptions] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [errors, setErrors] = useState({});

  // Dynamic options
  const visibleFields = categoryFields[form.category] || [];
  const availableBrands = brands[form.category] || [];
  const availableModels = form.brand ? models[form.category]?.[form.brand] || [] : [];
  const categoryFeatures = featuresByCategory[form.category] || [];
  const availableCities = locationsByState[form.state] || [];
  const paystackKey = import.meta.env.MODE === 'production' 
    ? import.meta.env.VITE_PAYSTACK_PUBLIC_KEY 
    : `pk_test_${import.meta.env.VITE_PAYSTACK_PUBLIC_KEY?.split('_')[1]}`;

  // Style constants
  const sectionStyle = {
    border: "2px solid #007BFF",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "20px",
    background: "#E6F0FF"
  };

  // Field options helper
  const getFieldOptions = (field) => {
    const optionsMap = {
      subcategory: visibleFields,
      brand: availableBrands,
      model: availableModels,
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
  };

  // Form change handler
  const handleChange = useCallback((field, value) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === "category") {
        updated.subcategory = updated.brand = updated.model = updated.ram = 
        updated.storage = updated.color = updated.sim = [], 
        updated.features = [], updated.condition = updated.used_detail = "";
      }
      if (field === "brand") updated.model = "";
      if (field === "state") updated.city = "";
      return updated;
    });
    setErrors(prev => ({ ...prev, [field]: "" }));
  }, []);

  // Price formatter - FIXED regex
  const handlePriceInput = (value) => {
    const num = value.replace(/[^0-9]/g, "");
    const formatted = num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    handleChange("price", formatted);
  };

  // Enhanced image handlers - NO FILENAMES
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
    handleImagesAdd(files);
  }, []);

  const handleImagesAdd = useCallback((newFiles) => {
    const totalFiles = imageFiles.length + newFiles.length;
    if (totalFiles > 10) {
      alert(`Maximum 10 images allowed. You have ${imageFiles.length}`);
      return;
    }

    const validFiles = newFiles.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        alert(`Image too large (max 10MB)`);
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      imagePreviews.forEach(URL.revokeObjectURL);
      setImageFiles(prev => [...prev, ...validFiles]);
      setImagePreviews(prev => [...prev, ...validFiles.map(file => URL.createObjectURL(file))]);
    }
  }, [imageFiles.length, imagePreviews]);

  const removeImage = useCallback((index) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  }, [imagePreviews]);

  const handleImagesChange = useCallback((e) => {
    const files = Array.from(e.target.files);
    handleImagesAdd(files);
    if (fileInputRef.current) fileInputRef.current.value = null;
  }, [handleImagesAdd]);

  useEffect(() => {
    return () => {
      imagePreviews.forEach(URL.revokeObjectURL);
    };
  }, [imagePreviews]);

  // Delivery handlers
  const addDeliveryRegion = () => {
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
  };

  const removeDeliveryRegion = (index) => {
    setForm(prev => ({
      ...prev,
      deliveryRegions: prev.deliveryRegions.filter((_, i) => i !== index)
    }));
  };

  // Selector handlers
  const openSelector = (field, options) => {
    setSelectorField(field);
    setSelectorOptions(options);
  };

  const selectOption = (value) => {
    handleChange(selectorField, value);
    setSelectorField(null);
  };

  // Enhanced validation - FIXED phone regex
  const validateForm = useCallback(() => {
    const errors = {};
    const cleanPrice = form.price.replace(/,/g, "");
    
    if (!form.title?.trim() || form.title.trim().length < 30)
      errors.title = "Title must be at least 30 characters";
    if (!form.description?.trim() || form.description.trim().length < 50)
      errors.description = "Description must be at least 50 characters";
    if (!form.price || Number(cleanPrice) <= 0)
      errors.price = "Valid price required";
    if (!form.phone_number?.match(/^(0|\+234)[0-9]{10}$/))
      errors.phone_number = "Valid Nigerian phone number required";
    if (!form.state) errors.state = "State required";
    if (!form.city) errors.city = "City required";
    if (imageFiles.length === 0) errors.images = "At least 1 image required";
    if (form.promoted && !form.promo_plan) errors.promo_plan = "Select promotion plan";
    
    setErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, imageFiles]);

  // Payment success handler
  const handlePaymentSuccess = async (response) => {
    setShowPaymentModal(false);
    setLoading(true);
    
    try {
      const uploadedUrls = await uploadImages();
      const productData = { ...form, images: uploadedUrls, payment_reference: response.reference };
      
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });
      
      if (res.ok) {
        alert("✅ Product published successfully with promotion!");
        resetForm();
      } else {
        throw new Error("Publish failed");
      }
    } catch (err) {
      alert("Publish failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Image upload helper
  const uploadImages = async () => {
    const uploadedUrls = [];
    for (let file of imageFiles) {
      if (file.size > 10 * 1024 * 1024) {
        alert("Image too large (max 10MB)");
        continue;
      }
      
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
    return uploadedUrls;
  };

  // Form reset
  const resetForm = () => {
    setForm({
      title: "", description: "", price: "", discount_price: "", quantity: "",
      category: "", subcategory: "", brand: "", model: "", condition: "",
      used_detail: "", ram: "", storage: "", color: "", sim: [], features: [],
      engine: "", mileage: "", year: "", fuel_type: "", transmission: "",
      phone_number: user?.phone_number || "", additional_phone: "", poster_name: user?.name || "",
      state: "", city: "", location: "", social_link: "", images: [], video_link: "",
      promoted: false, promo_plan: "", flash_sale: false, exchange_possible: false,
      negotiable: false, deliveryRegions: []
    });
    setImageFiles([]);
    setImagePreviews([]);
    setSelectedPlan(null);
    setErrors({});
    if (fileInputRef.current) fileInputRef.current.value = null;
    setShowPreview(false);
  };

  // Submit handler
  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      if (form.promoted && selectedPlan?.price > 0) {
        setShowPaymentModal(true);
      } else {
        setShowPreview(true);
      }
    }
  };

  const confirmPublish = async () => {
    setLoading(true);
    try {
      const uploadedUrls = await uploadImages();
      const productData = { 
        ...form, 
        images: uploadedUrls,
        ...(form.promoted && selectedPlan?.price === 0 && { promo_status: 'free' })
      };

      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });

      if (res.ok) {
        alert("✅ Product published successfully!");
        resetForm();
      } else {
        throw new Error("Failed to publish");
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Plan icon mapping
  const planIcons = {
    basic: FaStar,
    standard: FaRocket,
    premium: FaBullhorn,
    flash: FaBolt,
    gift: FaGift
  };

  const currentPlan = promotionPlans.find(p => p.id === form.promo_plan);

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <h1 style={{ textAlign: "center", color: "#007BFF", marginBottom: "30px" }}>
        🚀 Post New Marketplace Product
      </h1>

      <form onSubmit={handleSubmit}>
        {/* Product Details */}
        <div style={sectionStyle}>
          <h3>📦 Product Details</h3>
          <input 
            type="text" 
            placeholder="Product Title (min 30 chars)" 
            value={form.title}
            onChange={e => handleChange("title", e.target.value)}
            style={{ ...inputStyle, ...(errors.title && errorStyle) }}
          />
          {errors.title && <small style={errorText}>{errors.title}</small>}

          <button 
            type="button"
            onClick={() => openSelector("category", Object.keys(categoryFields))}
            style={selectorButtonStyle(form.category)}
          >
            {form.category || "Select Category"}
          </button>

          {visibleFields.map(field => (
            <div key={field} style={{ marginBottom: "12px" }}>
              {field === "features" ? (
                categoryFeatures.map(feat => (
                  <label key={feat} style={checkboxLabelStyle}>
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
                ))
              ) : field === "sim" ? (
                sims.map(sim => (
                  <label key={sim} style={checkboxLabelStyle}>
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
                ))
              ) : (
                <button
                  type="button"
                  onClick={() => openSelector(field, getFieldOptions(field))}
                  style={selectorButtonStyle(form[field])}
                >
                  {form[field] || `Select ${field.replace("_", " ")}`}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Pricing & Promotions */}
        <div style={sectionStyle}>
          <h3>💰 Pricing & Boost</h3>
          <input
            type="text"
            placeholder="Price (e.g. 50000)"
            value={form.price}
            onChange={e => handlePriceInput(e.target.value)}
            style={{ ...inputStyle, ...(errors.price && errorStyle), marginBottom: "12px" }}
          />
          {errors.price && <small style={errorText}>{errors.price}</small>}

          <input
            type="text"
            placeholder="Discount Price (optional)"
            value={form.discount_price}
            onChange={e => handleChange("discount_price", e.target.value.replace(/[^0-9]/g, ""))}
            style={inputStyle}
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

          {form.promoted && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
              {promotionPlans.map(plan => {
                const discountPercent = getDiscountPercent(plan.price, plan.discount);
                const finalPrice = plan.price - (plan.discount || 0);
                const PlanIcon = planIcons[plan.id] || FaStar;
                return (
                  <div 
                    key={plan.id}
                    style={planCardStyle(form.promo_plan === plan.id, plan.price === 0)}
                    onClick={() => {
                      handleChange("promo_plan", plan.id);
                      setSelectedPlan(plan);
                    }}
                  >
                    <PlanIcon style={{ fontSize: "24px", marginBottom: "8px" }} />
                    <h4 style={{ margin: "0 0 4px 0", fontSize: "14px" }}>{plan.name}</h4>
                    <p style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
                      {plan.duration}
                    </p>
                    <div style={{ fontSize: "16px", fontWeight: "bold", color: "#28a745" }}>
                      {discountPercent > 0 && (
                        <span style={{ textDecoration: "line-through", fontSize: "14px", color: "#999", marginRight: "5px" }}>
                          ₦{plan.price.toLocaleString()}
                        </span>
                      )}
                      ₦{finalPrice.toLocaleString()}
                    </div>
                    {plan.price === 0 && (
                      <span style={freeBadgeStyle}>FREE</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Description & Media - ENHANCED WITH + BUTTON, NO FILENAMES */}
        <div style={sectionStyle}>
          <h3>📝 Description & Media</h3>
          <textarea
            placeholder="Product description (min 50 chars)"
            value={form.description}
            onChange={e => handleChange("description", e.target.value)}
            rows="4"
            style={{ ...inputStyle, ...(errors.description && errorStyle), minHeight: "100px" }}
          />
          {errors.description && <small style={errorText}>{errors.description}</small>}

          <div style={imageUploadContainerStyle}>
            <div 
              style={imageUploadAreaStyle(imageFiles.length > 0)}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
            >
              {imageFiles.length === 0 ? (
                <>
                  <div style={plusIconStyle}>➕</div>
                  <p style={uploadTextStyle}>Click to add images or drag & drop</p>
                  <p style={uploadSubtextStyle}>Max 10 images (10MB each)</p>
                </>
              ) : (
                <div style={imageGridStyle}>
                  {imagePreviews.map((src, i) => (
                    <div key={i} style={imagePreviewContainerStyle}>
                      <img 
                        src={src} 
                        alt={`Image ${i + 1}`}
                        style={imagePreviewStyle}
                      />
                      <div style={imageNumberOverlay}>
                        {i + 1}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(i);
                        }}
                        style={removeImageButtonStyle}
                        aria-label={`Remove image ${i + 1}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {imageFiles.length < 10 && (
                    <div style={addMoreImageStyle} onClick={() => fileInputRef.current?.click()}>
                      <div style={plusIconStyle}>➕</div>
                      <span style={addMoreTextStyle}>Add more ({imageFiles.length}/10)</span>
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
              onChange={handleImagesChange}
              style={{ display: "none" }}
            />
          </div>
          {errors.images && <small style={errorText}>{errors.images}</small>}

          <input
            type="url"
            placeholder="YouTube/Video Link (optional)"
            value={form.video_link}
            onChange={e => handleChange("video_link", e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Delivery & Contact */}
        <div style={sectionStyle}>
          <h3>🚚 Delivery & Contact</h3>
          
          <button
            type="button"
            onClick={() => setSelectorField("delivery")}
            style={primaryButtonStyle}
          >
            + Add Delivery Region
          </button>

          {form.deliveryRegions.map((region, index) => (
            <div key={index} style={deliveryRegionStyle}>
              <strong>{region.state} - {region.city}</strong>
              <div>{region.method} ({region.from}-{region.to} days)</div>
              {region.isFreeDelivery && <div style={{ color: "#28a745" }}>✨ FREE DELIVERY</div>}
              <button
                type="button"
                onClick={() => removeDeliveryRegion(index)}
                style={dangerButtonStyle}
              >
                Remove
              </button>
            </div>
          ))}

          <div style={{ marginTop: "20px" }}>
            <button
              type="button"
              onClick={() => openSelector("state", Object.keys(locationsByState))}
              style={selectorButtonStyle(form.state)}
            >
              {form.state || "Select State"}
            </button>
            {form.state && (
              <button
                type="button"
                onClick={() => openSelector("city", availableCities)}
                style={selectorButtonStyle(form.city)}
              >
                {form.city || "Select City"}
              </button>
            )}
            
            {errors.state && <small style={errorText}>{errors.state}</small>}
            {errors.city && <small style={errorText}>{errors.city}</small>}

            <input
              type="tel"
              placeholder="Primary Phone Number"
              value={form.phone_number}
              onChange={e => handleChange("phone_number", e.target.value)}
              style={{ ...inputStyle, ...(errors.phone_number && errorStyle), marginTop: "12px" }}
            />
            {errors.phone_number && <small style={errorText}>{errors.phone_number}</small>}
          </div>
        </div>

        {/* Submit */}
        <div style={sectionStyle}>
          <button
            type="submit"
            disabled={loading || imageFiles.length === 0}
            style={submitButtonStyle(loading || imageFiles.length === 0)}
          >
            {loading ? "⏳ Publishing..." : `🚀 Preview & Publish (${imageFiles.length}/10 images)`}
          </button>
        </div>
      </form>

      {/* ALL MODALS - FULLY IMPLEMENTED */}
      {selectorField && selectorField !== "delivery" && (
        <SelectorModal
          field={selectorField}
          options={selectorOptions}
          onSelect={selectOption}
          onClose={() => setSelectorField(null)}
        />
      )}

      {selectorField === "delivery" && (
        <DeliveryModal
          deliveryForm={deliveryForm}
          setDeliveryForm={setDeliveryForm}
          onAdd={addDeliveryRegion}
          onClose={() => setSelectorField(null)}
        />
      )}

      {showPaymentModal && selectedPlan && (
        <PaymentModal
          plan={selectedPlan}
          paystackKey={paystackKey}
          userEmail={user?.email}
          onSuccess={handlePaymentSuccess}
          onClose={() => setShowPaymentModal(false)}
        />
      )}

      {showPreview && (
        <PreviewModal
          form={form}
          imagePreviews={imagePreviews}
          currentPlan={currentPlan}
          onEdit={() => setShowPreview(false)}
          onPublish={confirmPublish}
          loading={loading}
        />
      )}
    </div>
  );
}

// ALL STYLE COMPONENTS
const inputStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  fontSize: "16px",
  marginBottom: "12px"
};

const errorStyle = { borderColor: "#dc3545", boxShadow: "0 0 0 0.2rem rgba(220,53,69,.25)" };
const errorText = { color: "#dc3545", fontSize: "14px", display: "block" };

const selectorButtonStyle = (hasValue) => ({
  width: "100%",
  padding: "12px",
  background: hasValue ? "#007BFF" : "#f8f9fa",
  color: hasValue ? "white" : "#333",
  border: hasValue ? "none" : "1px solid #ddd",
  borderRadius: "8px",
  marginBottom: "12px",
  cursor: "pointer"
});

const primaryButtonStyle = {
  width: "100%",
  padding: "12px",
  background: "#007BFF",
  color: "white",
  border: "none",
  borderRadius: "8px",
  fontSize: "16px",
  marginBottom: "15px",
  cursor: "pointer"
};

const submitButtonStyle = (disabled) => ({
  width: "100%",
  padding: "16px",
  background: disabled ? "#6c757d" : "#28a745",
  color: "white",
  border: "none",
  borderRadius: "12px",
  fontSize: "18px",
  fontWeight: "bold",
  cursor: disabled ? "not-allowed" : "pointer"
});

const planCardStyle = (selected, isFree) => ({
  border: selected ? "3px solid #007BFF" : "1px solid #e0e0e0",
  borderRadius: "12px",
  padding: "16px",
  cursor: "pointer",
  background: selected ? "linear-gradient(135deg, #E6F0FF 0%, #B3D9FF 100%)" : "#fff",
  boxShadow: selected ? "0 8px 25px rgba(0,123,255,0.3)" : "0 2px 8px rgba(0,0,0,0.1)",
  transition: "all 0.3s ease",
  ...(isFree && { borderColor: "#28a745" })
});

const freeBadgeStyle = {
  display: "inline-block",
  background: "#28a745",
  color: "white",
  padding: "4px 12px",
  borderRadius: "20px",
  fontSize: "12px",
  fontWeight: "600",
  marginTop: "8px"
};

const checkboxLabelStyle = {
  display: "block",
  marginBottom: "8px",
  cursor: "pointer",
  fontSize: "14px"
};

const deliveryRegionStyle = {
  background: "#fff",
  padding: "15px",
  borderRadius: "8px",
  marginBottom: "10px",
  border: "1px solid #ddd",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
};

const dangerButtonStyle = {
  background: "#dc3545",
  color: "white",
  border: "none",
  padding: "6px 12px",
  borderRadius: "6px",
  fontSize: "12px",
  cursor: "pointer"
};

// IMAGE UPLOAD STYLES
const imageUploadContainerStyle = { margin: "15px 0" };
const imageUploadAreaStyle = (hasImages) => ({
  border: hasImages ? "3px dashed #007BFF" : "2px dashed #ddd",
  borderRadius: "12px",
  padding: hasImages ? "20px" : "40px",
  background: hasImages ? "#E6F0FF" : "#f8f9fa",
  cursor: "pointer",
  transition: "all 0.3s ease",
  textAlign: "center",
  position: "relative"
});
const plusIconStyle = {
  fontSize: "48px",
  color: "#007BFF",
  marginBottom: "10px",
  cursor: "pointer"
};
const uploadTextStyle = {
  fontSize: "18px",
  fontWeight: "500",
  color: "#333",
  margin: "0 0 5px 0"
};
const uploadSubtextStyle = {
  fontSize: "14px",
  color: "#666",
  margin: 0
};
const imageGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
  gap: "15px",
  maxHeight: "300px",
  overflowY: "auto"
};
const imagePreviewContainerStyle = {
  position: "relative",
  aspectRatio: "1"
};
const imagePreviewStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  borderRadius: "8px",
  border: "2px solid #007BFF"
};
const imageNumberOverlay = {
  position: "absolute",
  bottom: "8px",
  left: "8px",
  background: "rgba(0, 123, 255, 0.9)",
  color: "white",
  width: "24px",
  height: "24px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "12px",
  fontWeight: "bold"
};
const removeImageButtonStyle = {
  position: "absolute",
  top: "-8px",
  right: "-8px",
  width: "24px",
  height: "24px",
  background: "#dc3545",
  color: "white",
  border: "none",
  borderRadius: "50%",
  fontSize: "14px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};
const addMoreImageStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  border: "2px dashed #007BFF",
  borderRadius: "8px",
  cursor: "pointer",
  aspectRatio: "1",
  transition: "all 0.2s ease"
};
const addMoreTextStyle = {
  fontSize: "14px",
  color: "#007BFF",
  marginTop: "5px",
  fontWeight: "500"
};

// MODAL STYLES
const modalOverlayStyle = {
  position: "fixed",
  top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 10000
};
const modalContentStyle = {
  background: "#fff",
  width: "90%", maxWidth: "500px",
  maxHeight: "80vh",
  borderRadius: "12px",
  padding: "25px",
  overflowY: "auto"
};
const selectorOptionStyle = {
  padding: "16px",
  borderBottom: "1px solid #eee",
  cursor: "pointer",
  fontSize: "16px",
  transition: "background 0.2s"
};
const cancelButtonStyle = {
  width: "100%",
  padding: "14px",
  background: "#6c757d",
  color: "white",
  border: "none",
  borderRadius: "8px",
  fontSize: "16px",
  marginTop: "15px",
  cursor: "pointer"
};

// ALL MODAL COMPONENTS - FULLY IMPLEMENTED
const SelectorModal = ({ field, options, onSelect, onClose }) => (
  <div style={modalOverlayStyle}>
    <div style={modalContentStyle}>
      <h3>Select {field.replace("_", " ").toUpperCase()}</h3>
      <div style={{ maxHeight: "400px", overflowY: "auto" }}>
        {options.map(opt => (
          <div
            key={opt}
            style={selectorOptionStyle}
            onClick={() => onSelect(opt)}
          >
            {opt}
          </div>
        ))}
      </div>
      <button style={cancelButtonStyle} onClick={onClose}>Cancel</button>
    </div>
  </div>
);

const DeliveryModal = ({ deliveryForm, setDeliveryForm, onAdd, onClose }) => {
  const handleDeliveryChange = (field, value) => {
    setDeliveryForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h3>Add Delivery Region</h3>
        <select 
          value={deliveryForm.state} 
          onChange={e => handleDeliveryChange('state', e.target.value)}
          style={inputStyle}
        >
          <option value="">Select State</option>
          {Object.keys(locationsByState).map(state => (
            <option key={state} value={state}>{state}</option>
          ))}
        </select>
        
        {deliveryForm.state && (
          <>
            <select 
              value={deliveryForm.city} 
              onChange={e => handleDeliveryChange('city', e.target.value)}
              style={inputStyle}
            >
              <option value="">Select City</option>
              {locationsByState[deliveryForm.state]?.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </>
        )}
        
        <input 
          placeholder="Delivery days (From)" 
          value={deliveryForm.from}
          onChange={e => handleDeliveryChange('from', e.target.value)}
          style={inputStyle}
        />
        <input 
          placeholder="Delivery days (To)" 
          value={deliveryForm.to}
          onChange={e => handleDeliveryChange('to', e.target.value)}
          style={inputStyle}
        />
        
        <button onClick={onAdd} style={primaryButtonStyle}>Add Region</button>
        <button onClick={onClose} style={cancelButtonStyle}>Cancel</button>
      </div>
    </div>
  );
};

const PaymentModal = ({ plan, paystackKey, userEmail, onSuccess, onClose }) => (
  <div style={modalOverlayStyle}>
    <div style={modalContentStyle}>
      <h3>🚀 Complete Payment for {plan.name}</h3>
      <p>Amount: ₦{(plan.price - (plan.discount || 0)).toLocaleString()}</p>
      
      <PaystackButton
        publicKey={paystackKey}
        email={userEmail}
        amount={(plan.price - (plan.discount || 0)) * 100}
        currency="NGN"
        channels={['card', 'bank_transfer', 'ussd']}
        text={`Pay ₦${(plan.price - (plan.discount || 0)).toLocaleString()}`}
        onSuccess={onSuccess}
        onClose={onClose}
      />
      <button onClick={onClose} style={cancelButtonStyle}>Cancel</button>
    </div>
  </div>
);

const PreviewModal = ({ form, imagePreviews, currentPlan, onEdit, onPublish, loading }) => (
  <div style={modalOverlayStyle}>
    <div style={{...modalContentStyle, maxWidth: "600px"}}>
      <h3>Product Preview</h3>
      <div><strong>{form.title}</strong></div>
      <div>₦{form.price.toLocaleString()}</div>
      <div>{form.description.substring(0, 100)}...</div>
      <div style={{display: 'flex', gap: '10px', margin: '10px 0'}}>
        {imagePreviews.slice(0, 3).map((src, i) => (
          <img key={i} src={src} style={{width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px'}} />
        ))}
      </div>
      {currentPlan && <div>Plan: {currentPlan.name}</div>}
      
      <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
        <button onClick={onPublish} disabled={loading} style={submitButtonStyle(loading)}>
          {loading ? 'Publishing...' : 'Publish Now'}
        </button>
        <button onClick={onEdit} style={cancelButtonStyle}>Edit</button>
      </div>
    </div>
  </div>
);

export { getDiscountPercent };
