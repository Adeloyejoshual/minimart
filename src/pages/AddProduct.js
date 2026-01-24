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
import SingleSelectList from "../components/SingleSelectList";
import MultiSelectList from "../components/MultiSelectList";
import Toast from "../components/Toast";

import "./AddProduct.css";

const DRAFT_KEY = "add_product_draft";
const CATEGORY_KEY = "selected_category";

export default function AddProduct() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const marketType = params.get("market") || "marketplace";

  const scrollPos = useRef(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "", icon: "⚡" });
  const [selectionStep, setSelectionStep] = useState(null);

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

  useEffect(() => {
    return () => form.previews.forEach(url => URL.revokeObjectURL(url));
  }, [form.previews]);

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

  const removeImage = index => {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
      previews: prev.previews.filter((_, i) => i !== index),
    }));
  };

  // ---------------- Validation ----------------
  const validateForm = () => {
    if (!form.title || form.title.length < rules.minTitle) return `Title must be at least ${rules.minTitle} characters`;
    if (!form.mainCategory) return "Select category";
    if (!form.price) return "Enter price";
    if (!form.phone || form.phone.length < 10) return "Enter valid phone number";
    if (form.images.length < rules.minImages) return `Upload at least ${rules.minImages} image(s)`;

    const options = productOptions[form.mainCategory]?.subcategories?.[form.subCategory];

    if (options) {
      if (options.brands?.length > 0 && !form.brand) return "Select brand";
      if (options.types?.length > 0 && !form.model) return "Select model/type";
      if (options.storageOptions?.length > 0 && !form.storage) return "Select storage";
      if (options.colors?.length > 0 && !form.color) return "Select color";
      if (options.simTypes?.length > 0 && !form.simType) return "Select SIM type";
      if (form.features.length === 0 && options.features?.length > 0) return "Select features";
    }

    if (!form.description || form.description.length < 10) return "Enter description (min 10 chars)";
    if (!form.state) return "Select state";
    if (!form.city) return "Select city / LGA";
    return null;
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
    const multiSelectFields = ["features"];
    const fieldMap = {
      subCategory: getSubcategories(),
      brand: getBrandOptions(),
      model: getModelOptions(),
      colors: getExtraOptions("colors"),
      storage: getExtraOptions("storageOptions"),
      simTypes: getExtraOptions("simTypes"),
      features: getExtraOptions("features"),
      state: getStateOptions(),
      city: getCityOptions(),
    };

    const options = fieldMap[selectionStep] || [];
    return multiSelectFields.includes(selectionStep)
      ? <MultiSelectList title={`Select ${selectionStep}`} options={options} valueKey={selectionStep} {...fullPageProps} />
      : <SingleSelectList title={`Select ${selectionStep}`} options={options} valueKey={selectionStep} {...fullPageProps} />;
  }

  // ---------------- Promotion ----------------
  const handlePromotionClick = plan => updateForm("promotionPlan", plan);

  // ---------------- Submit Handler ----------------
  const handleSubmit = async () => {
    const error = validateForm();
    if (error) return showToast(error, "⚠️");

    try {
      setLoading(true);

      const uploadedImages = await Promise.all(form.images.map(img => uploadToCloudinary(img)));

      await addDoc(collection(db, "products"), {
        ...form,
        images: uploadedImages,
        timestamp: serverTimestamp(),
        userId: auth.currentUser?.uid || null,
      });

      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(CATEGORY_KEY);
      setForm({
        title: "", mainCategory: "", subCategory: "", brand: "", model: "",
        condition: "", usedDetail: "", price: "", phone: "", description: "",
        state: "", city: "", images: [], previews: [], color: "", storage: "",
        simType: "", features: [], type: "", isPromoted: false, promotionPlan: null,
        paymentSuccess: false,
      });

      showToast("Product successfully uploaded!", "✅");
      navigate(`/`);
    } catch (err) {
      console.error(err);
      showToast("Failed to upload product.", "❌");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Main Form ----------------
  return (
    <div className="add-product-container">
      {/* HEADER */}
      <div className="add-product-header">
        <button className="back-btn" onClick={() => navigate(`/`)}>←</button>
        <span className="page-title">Add Product</span>
      </div>

      {/* TITLE */}
      <Field label="Title">
        <input value={form.title} onChange={e => updateForm("title", e.target.value)} placeholder="e.g iPhone 11 Pro Max" />
      </Field>

      {/* CATEGORY */}
      <AddProductCategory
        form={form}
        handleCategoryChange={handleCategoryChange}
        openSubCategorySelector={() => { scrollPos.current = window.scrollY; setSelectionStep("subCategory"); }}
      />

      {/* BRAND, MODEL, COLOR, STORAGE, SIM, FEATURES */}
      {["brand","model","colors","storage","simTypes","features"].map(field => {
        const options = field === "brand" ? getBrandOptions()
                      : field === "model" ? getModelOptions()
                      : getExtraOptions(field === "colors" ? "colors" : field === "storage" ? "storageOptions" : field);
        if (!options.length) return null;
        const label = field.charAt(0).toUpperCase() + field.slice(0, -1);
        const value = form[field === "colors" ? "color" : field === "storage" ? "storage" : field];
        const isDisabled = !form.brand && ["model","colors","storage","simTypes","features"].includes(field);
        return (
          <Field key={field} label={label}>
            <div className={`option-item clickable ${isDisabled ? "blurred" : ""}`}
                 onClick={() => !isDisabled && (scrollPos.current = window.scrollY) && setSelectionStep(field)}>
              {Array.isArray(value) ? value.join(", ") : value || `Select ${label}`}
            </div>
          </Field>
        );
      })}

      {/* DESCRIPTION */}
      <Field label="Description">
        <textarea value={form.description} onChange={e => updateForm("description", e.target.value)} placeholder="Write a detailed description of your product..." />
      </Field>

      {/* LOCATION */}
      <AddProductLocation
        form={form}
        openStateSelector={() => setSelectionStep("state")}
        openCitySelector={() => setSelectionStep("city")}
      />

      {/* PRICE */}
      <Field label="Price (₦)">
        <input value={form.price} onChange={handlePriceChange} placeholder="₦ 0" />
      </Field>

      {/* PHONE */}
      <Field label="Phone Number">
        <input type="tel" value={form.phone} onChange={e => updateForm("phone", e.target.value)} placeholder="08012345678" />
      </Field>

      {/* IMAGES */}
      <Field label="Images">
        <label className="image-upload">
          <input type="file" multiple hidden onChange={e => handleImages(e.target.files)} />
          <span>＋ Add Images</span>
        </label>
        <div className="images">
          {form.previews.map((p, i) => (
            <div key={i} className="img-wrap">
              <img src={p} alt={`preview-${i}`} />
              <button type="button" onClick={() => removeImage(i)}>×</button>
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

      {/* SUBMIT */}
      <button className="btn" type="button" onClick={handleSubmit} disabled={loading}>
        {loading ? "Uploading..." : "Publish"}
      </button>

      {/* TOAST */}
      <Toast message={toast.message} icon={toast.icon} visible={toast.visible} />
    </div>
  );
}

// ---------------- Field Component ----------------
const Field = ({ label, children }) => (
  <div className="field">
    <label>{label}</label>
    {children}
  </div>
);