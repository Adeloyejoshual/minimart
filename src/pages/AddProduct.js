// src/pages/AddProduct.js
import { useEffect, useState, useRef, useCallback } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate, useSearchParams } from "react-router-dom";

import categoriesData from "../config/categoriesData";
import productOptions from "../config/productOptions";
import categoryRules from "../config/categoryRules";
import { locationsByState } from "../config/locationsByState";

import AddProductCategory from "../components/AddProductCategory";
import AddProductPromotion from "../components/AddProductPromotion";
import AddProductLocation from "../components/AddProductLocation";
import Toast from "../components/Toast";

import SingleSelectList from "../components/SingleSelectList";
import MultiSelectList from "../components/MultiSelectList";

import "./AddProduct.css";

const DRAFT_KEY = "add_product_draft";
const CATEGORY_KEY = "selected_category";

// Human-friendly labels
const fieldLabels = {
  colors: "Color",
  simTypes: "SIM Type",
  storageOptions: "Storage",
  features: "Features",
};

export default function AddProduct() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const marketType = params.get("market") || "marketplace";

  const scrollPos = useRef(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "", icon: "⚡" });
  const [selectionStep, setSelectionStep] = useState(null);
  const [errorFields, setErrorFields] = useState({}); // Track fields with errors

  const [form, setForm] = useState({
    title: "",
    mainCategory: "",
    subCategory: "",
    brand: "",
    model: "",
    condition: "",
    usedDetail: "",
    price: "",
    phone: "",
    description: "",
    state: "",
    city: "",
    images: [],
    previews: [],
    color: "",
    storage: "",
    simType: "",
    features: [],
    type: "",
    isPromoted: false,
    promotionPlan: null,
    paymentSuccess: false,
  });

  const rules = categoryRules[form.mainCategory] || categoryRules.Default;

  // ---------------- Draft Load/Save ----------------
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setForm(prev => ({
        ...prev,
        ...parsed,
        previews: parsed.images?.map(img => URL.createObjectURL(img)) || [],
      }));
    }
    const savedCat = localStorage.getItem(CATEGORY_KEY);
    if (savedCat) setForm(prev => ({ ...prev, mainCategory: savedCat }));
  }, []);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    if (form.mainCategory) localStorage.setItem(CATEGORY_KEY, form.mainCategory);
  }, [form]);

  // ---------------- Toast ----------------
  const showToast = useCallback((message, icon = "⚡", duration = 3000) => {
    setToast({ visible: true, message, icon });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), duration);
  }, []);

  // ---------------- Form Helpers ----------------
  const updateForm = useCallback((key, value) => setForm(prev => ({ ...prev, [key]: value })), []);
  const resetDependentFields = keys => keys.forEach(k => updateForm(k, ""));

  const handleCategoryChange = cat => {
    updateForm("mainCategory", cat);
    resetDependentFields([
      "subCategory","brand","model","condition","usedDetail",
      "features","type","color","storage","simType"
    ]);
  };

  const handleSubCategoryChange = subCat => {
    updateForm("subCategory", subCat);
    resetDependentFields([
      "brand","model","condition","usedDetail",
      "features","type","color","storage","simType"
    ]);
  };

  const handleStateChange = state => {
    updateForm("state", state);
    updateForm("city", "");
  };

  // ---------------- Price & Images ----------------
  const handlePriceChange = e => {
    const raw = e.target.value.replace(/,/g, "");
    if (!isNaN(raw) || raw === "") {
      updateForm("price", raw.replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    }
  };

  const handleImages = files => {
    const list = Array.from(files);
    const total = form.images.length + list.length;
    if (total > rules.maxImages) return showToast(`Maximum ${rules.maxImages} images allowed`, "⚠️");

    const newPreviews = list.map(f => URL.createObjectURL(f));
    setForm(prev => ({
      ...prev,
      images: [...prev.images, ...list],
      previews: [...prev.previews, ...newPreviews],
    }));
  };

  // **Revoke object URL when removing image**
  const removeImage = index => {
    URL.revokeObjectURL(form.previews[index]);
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
      previews: prev.previews.filter((_, i) => i !== index),
    }));
  };

  // ---------------- Validation ----------------
  const validateForm = () => {
    const errors = {};
    if (!form.title || form.title.length < rules.minTitle) errors.title = true;
    if (!form.mainCategory) errors.mainCategory = true;
    if (!form.price) errors.price = true;
    if (!form.phone || form.phone.length < 10) errors.phone = true;
    if (form.images.length < rules.minImages) errors.images = true;

    const options = productOptions[form.mainCategory]?.subcategories?.[form.subCategory];
    if (options) {
      if (options.brands?.length > 0 && !form.brand) errors.brand = true;
      if (options.types?.length > 0 && !form.model) errors.model = true;
      if (options.storageOptions?.length > 0 && !form.storage) errors.storage = true;
      if (options.colors?.length > 0 && !form.color) errors.color = true;
      if (options.simTypes?.length > 0 && !form.simType) errors.simType = true;
      if (form.features.length === 0 && options.features?.length > 0) errors.features = true;
    }

    if (!form.description || form.description.length < 10) errors.description = true;
    if (!form.state) errors.state = true;
    if (!form.city) errors.city = true;

    setErrorFields(errors);
    const firstError = Object.keys(errors)[0];
    if (firstError) showToast(`Please fill ${firstError}`, "⚠️");

    return Object.keys(errors).length === 0;
  };

  // ---------------- Derived Options ----------------
  const getSubcategories = () => categoriesData[form.mainCategory]?.subcategories || [];
  const getBrandOptions = () => form.subCategory ? productOptions[form.mainCategory]?.subcategories?.[form.subCategory]?.brands || [] : [];
  const getModelOptions = () => form.subCategory ? productOptions[form.mainCategory]?.subcategories?.[form.subCategory]?.types || [] : [];
  const getExtraOptions = field => form.subCategory ? productOptions[form.mainCategory]?.subcategories?.[form.subCategory]?.[field] || [] : [];
  const getStateOptions = () => Object.keys(locationsByState);
  const getCityOptions = () => form.state ? locationsByState[form.state] : [];

  // ---------------- FullPage Selectors ----------------
  if (selectionStep) {
    const fullPageProps = { form, updateForm, setSelectionStep, scrollPos };
    switch (selectionStep) {
      case "subCategory":
        return <SingleSelectList title="Select Subcategory" options={getSubcategories()} valueKey="subCategory" {...fullPageProps} />;
      case "brand":
        return <SingleSelectList title="Select Brand" options={getBrandOptions()} valueKey="brand" {...fullPageProps} />;
      case "model":
        return <SingleSelectList title="Select Model / Type" options={getModelOptions()} valueKey="model" {...fullPageProps} />;
      case "colors":
        return <SingleSelectList title="Select Color" options={getExtraOptions("colors")} valueKey="color" {...fullPageProps} />;
      case "storage":
        return <SingleSelectList title="Select Storage" options={getExtraOptions("storageOptions")} valueKey="storage" {...fullPageProps} />;
      case "simTypes":
        return <SingleSelectList title="Select SIM Type" options={getExtraOptions("simTypes")} valueKey="simType" {...fullPageProps} />;
      case "features":
        return <MultiSelectList title="Select Features" options={getExtraOptions("features")} valueKey="features" {...fullPageProps} />;
      case "state":
        return <SingleSelectList title="Select State" options={getStateOptions()} valueKey="state" {...fullPageProps} />;
      case "city":
        return <SingleSelectList title="Select City / LGA" options={getCityOptions()} valueKey="city" {...fullPageProps} />;
      default: break;
    }
  }

  // ---------------- Promotion Handler ----------------
  const handlePromotionClick = plan => updateForm("promotionPlan", plan);

  // ---------------- Submit Handler ----------------
  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      const uploadedImages = await Promise.all(form.images.map(img => uploadToCloudinary(img)));

      const normalizedPhone = form.phone.startsWith("0") ? "+234" + form.phone.slice(1) : form.phone;

      const productData = {
        ...form,
        images: uploadedImages,
        phone: normalizedPhone,
        timestamp: serverTimestamp(),
        userId: auth.currentUser?.uid || null,
      };

      await addDoc(collection(db, "products"), productData);

      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(CATEGORY_KEY);
      setForm({
        title: "", mainCategory: "", subCategory: "", brand: "", model: "", condition: "", usedDetail: "",
        price: "", phone: "", description: "", state: "", city: "", images: [], previews: [],
        color: "", storage: "", simType: "", features: [], type: "", isPromoted: false, promotionPlan: null, paymentSuccess: false,
      });

      showToast("Product successfully uploaded!", "✅");
      navigate(`/`);
    } catch (err) {
      console.error(err);
      showToast("Failed to upload product.", "❌");
    } finally { setLoading(false); }
  };

  const isDependentDisabled = !form.brand || !form.model;

  // ---------------- Main Form ----------------
  return (
    <div className="add-product-container">
      {/* HEADER */}
      <div className="add-product-header">
        <button className="back-btn" onClick={() => navigate(`/`)} aria-label="Go Back">←</button>
        <h1 className="page-title">Add Product</h1>
      </div>

      {/* TITLE */}
      <Field label="Title" hasError={errorFields.title}>
        <input
          value={form.title}
          onChange={e => updateForm("title", e.target.value)}
          placeholder="e.g iPhone 11 Pro Max"
        />
      </Field>

      {/* CATEGORY */}
      <AddProductCategory
        form={form}
        handleCategoryChange={handleCategoryChange}
        openSubCategorySelector={() => { scrollPos.current = window.scrollY; setSelectionStep("subCategory"); }}
      />

      {/* BRAND */}
      {form.subCategory && getBrandOptions().length > 0 && (
        <Field label="Brand" hasError={errorFields.brand}>
          <div
            className={`option-item ${errorFields.brand ? "error" : ""}`}
            role="button"
            aria-label={`Select brand: ${form.brand || "None"}`}
            tabIndex={0}
            onClick={() => { scrollPos.current = window.scrollY; setSelectionStep("brand"); }}
          >
            {form.brand || "Select Brand"}
          </div>
        </Field>
      )}

      {/* MODEL */}
      {form.brand && getModelOptions().length > 0 && (
        <Field label="Model / Type" hasError={errorFields.model}>
          <div
            className={`option-item ${errorFields.model ? "error" : ""}`}
            role="button"
            aria-label={`Select model: ${form.model || "None"}`}
            tabIndex={0}
            onClick={() => { scrollPos.current = window.scrollY; setSelectionStep("model"); }}
          >
            {form.model || "Select Model / Type"}
          </div>
        </Field>
      )}

      {/* DYNAMIC FIELDS: Color, Storage, SIM, Features */}
      {["colors","storageOptions","simTypes","features"].map(f => {
        const options = getExtraOptions(f);
        if (!options.length) return null;
        const value = form[f === "features" ? "features" : f.slice(0, -1)];
        return (
          <Field key={f} label={fieldLabels[f]} hasError={errorFields[f]}>
            <div
              className={`option-item ${errorFields[f] ? "error" : ""} ${isDependentDisabled ? "blurred" : ""}`}
              role="button"
              aria-label={`Select ${fieldLabels[f]}: ${Array.isArray(value) ? value.join(", ") : value || "None"}`}
              tabIndex={0}
              onClick={() => !isDependentDisabled && setSelectionStep(f)}
            >
              {Array.isArray(value) ? (value.length ? value.join(", ") : `Select ${fieldLabels[f]}`) : value || `Select ${fieldLabels[f]}`}
            </div>
          </Field>
        );
      })}

      {/* DESCRIPTION */}
      <Field label="Description" hasError={errorFields.description}>
        <textarea
          value={form.description}
          onChange={e => updateForm("description", e.target.value)}
          placeholder="Write a detailed description of your product..."
        />
      </Field>

      {/* LOCATION */}
      <AddProductLocation
        form={form}
        openStateSelector={() => setSelectionStep("state")}
        openCitySelector={() => setSelectionStep("city")}
      />

      {/* PRICE */}
      <Field label="Price (₦)" hasError={errorFields.price}>
        <input value={form.price} onChange={handlePriceChange} placeholder="₦ 0" />
      </Field>

      {/* PHONE */}
      <Field label="Phone Number" hasError={errorFields.phone}>
        <input
          type="tel"
          value={form.phone}
          pattern="\d*"
          onChange={e => updateForm("phone", e.target.value.replace(/\D/g, ""))}
          placeholder="08012345678"
        />
      </Field>

      {/* IMAGES */}
      <Field label="Images" hasError={errorFields.images}>
        <label className="image-upload" aria-label="Add Images">
          <input type="file" multiple hidden onChange={e => handleImages(e.target.files)} />
          <span>＋ Add Images</span>
        </label>
        <div className="images">
          {form.previews.map((p, i) => (
            <div key={i} className="img-wrap">
              <img src={p} alt={`Preview ${i+1}`} loading="lazy"/>
              <button type="button" aria-label="Remove image" onClick={() => removeImage(i)}>×</button>
            </div>
          ))}
        </div>
      </Field>

      {/* PROMOTION */}
      <AddProductPromotion
        form={form}
        onSelectPlan={handlePromotionClick}
        onTogglePromote={checked => updateForm("isPromoted", checked)}
      />

      {/* SUBMIT BUTTON */}
      <button className="btn" type="button" onClick={handleSubmit} disabled={loading}>
        {loading ? "Uploading..." : "Publish"}
      </button>

      {/* TOAST */}
      <Toast message={toast.message} icon={toast.icon} visible={toast.visible} />
    </div>
  );
}

// ---------------- Field Component ----------------
const Field = ({ label, children, hasError }) => (
  <div className={`field ${hasError ? "error" : ""}`}>
    <label>{label}</label>
    {children}
  </div>
);