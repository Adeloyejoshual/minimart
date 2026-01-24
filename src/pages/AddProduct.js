// src/pages/AddProduct.js
import { useState, useEffect, useRef, useCallback } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate, useSearchParams } from "react-router-dom";

import productOptions from "../config/productOptions";
import { locationsByState } from "../config/locationsByState";
import { promotionPlans } from "../config/promotionPlans";
import conditionConfig from "../config/conditions";

import SingleSelectList from "../components/SingleSelectList";
import MultiSelectList from "../components/MultiSelectList";
import Toast from "../components/Toast";

import "./AddProduct.css";

const DRAFT_KEY = "add_product_draft";

export default function AddProduct() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const scrollPos = useRef(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "", icon: "⚡" });
  const [selectionStep, setSelectionStep] = useState(null);

  const [form, setForm] = useState({
    title: "", mainCategory: "", subCategory: "", brand: "", model: "",
    condition: "", usedDetail: "", price: "", phone: "", description: "",
    state: "", city: "", images: [], previews: [], color: "", storage: "",
    simType: "", features: [], type: "", isPromoted: false, promotionPlan: null,
    paymentSuccess: false
  });

  // ---------------- Draft Load/Save ----------------
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setForm(prev => ({ ...prev, ...parsed, previews: parsed.images?.map(img => URL.createObjectURL(img)) || [] }));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
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
  const resetFields = keys => keys.forEach(k => updateForm(k, ""));

  // ---------------- Derived Options ----------------
  const mainCatData = productOptions[form.mainCategory];
  const subCatData = form.subCategory && mainCatData?.subcategories?.[form.subCategory];

  const getOptions = key => {
    switch (key) {
      case "mainCategory": return Object.keys(productOptions);
      case "subCategory": return mainCatData ? Object.keys(mainCatData.subcategories) : [];
      case "brand": return subCatData?.brands || [];
      case "model": return subCatData?.models || [];
      case "condition": return conditionConfig[form.mainCategory]?.main || ["New","Used"];
      case "usedDetail": return conditionConfig[form.mainCategory]?.usedDetails || ["No defects"];
      case "color": return subCatData?.colors || [];
      case "storage": return subCatData?.storageOptions || [];
      case "simType": return subCatData?.simTypes || [];
      case "features": return subCatData?.features || [];
      case "state": return Object.keys(locationsByState);
      case "city": return form.state ? locationsByState[form.state] : [];
      default: return [];
    }
  };

  const isDependentDisabled = key => {
    if (["brand","model","condition","usedDetail","color","storage","simType","features"].includes(key)) {
      return !form.subCategory || (["model","condition","usedDetail","color","storage","simType","features"].includes(key) && !form.brand);
    }
    return false;
  };

  // ---------------- FullPage Selectors ----------------
  if (selectionStep) {
    const props = { form, updateForm, setSelectionStep, scrollPos };
    const multi = selectionStep === "features";
    const options = getOptions(selectionStep);
    const valueKey = selectionStep;

    return multi
      ? <MultiSelectList title={`Select ${valueKey}`} options={options} valueKey={valueKey} {...props} />
      : <SingleSelectList title={`Select ${valueKey}`} options={options} valueKey={valueKey} {...props} />;
  }

  // ---------------- Images ----------------
  const handleImages = files => {
    const list = Array.from(files);
    const total = form.images.length + list.length;
    if (total > 12) return showToast("Maximum 12 images allowed", "⚠️");

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

  // ---------------- Price ----------------
  const handlePriceChange = e => {
    const raw = e.target.value.replace(/,/g,"");
    if (!isNaN(raw) || raw === "") updateForm("price", raw.replace(/\B(?=(\d{3})+(?!\d))/g,","));
  };

  // ---------------- Validation ----------------
  const validateForm = () => {
    if (!form.title) return "Enter title";
    if (!form.mainCategory) return "Select category";
    if (!form.subCategory) return "Select subcategory";
    if (!form.brand) return "Select brand";
    if (!form.price) return "Enter price";
    if (!form.phone) return "Enter valid phone number";
    if (!form.images.length) return "Upload at least one image";
    if (!form.description) return "Enter description";
    if (!form.state) return "Select state";
    if (!form.city) return "Select city";
    if (form.isPromoted && !form.promotionPlan) return "Select a promotion plan";
    return null;
  };

  // ---------------- Payment Simulation ----------------
  const handlePayment = async () => {
    // Here you can integrate Paystack/Flutterwave
    // Simulated payment:
    return new Promise(resolve => setTimeout(() => resolve(true), 1000));
  };

  // ---------------- Submit ----------------
  const handleSubmit = async () => {
    const error = validateForm();
    if (error) return showToast(error, "⚠️");

    try {
      setLoading(true);

      // Payment if promoted
      if (form.isPromoted && form.promotionPlan) {
        const success = await handlePayment();
        if (!success) return showToast("Payment failed. Try again.", "❌");
        updateForm("paymentSuccess", true);
      }

      const uploadedImages = await Promise.all(form.images.map(img => uploadToCloudinary(img)));

      await addDoc(collection(db, "products"), {
        ...form,
        images: uploadedImages,
        timestamp: serverTimestamp(),
        userId: auth.currentUser?.uid || null
      });

      localStorage.removeItem(DRAFT_KEY);
      setForm({
        title: "", mainCategory: "", subCategory: "", brand: "", model: "",
        condition: "", usedDetail: "", price: "", phone: "", description: "",
        state: "", city: "", images: [], previews: [], color: "", storage: "",
        simType: "", features: [], type: "", isPromoted: false, promotionPlan: null,
        paymentSuccess: false
      });

      showToast("Product successfully uploaded!", "✅");
      navigate("/");
    } catch (err) {
      console.error(err);
      showToast("Failed to upload product.", "❌");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Render ----------------
  const fields = [
    "mainCategory","subCategory","brand","model",
    "condition","usedDetail","color","storage","simType","features",
    "state","city"
  ];

  return (
    <div className="add-product-container">
      <h2>Add Product</h2>

      <Field label="Title">
        <input value={form.title} onChange={e => updateForm("title", e.target.value)} placeholder="Product title" />
      </Field>

      {fields.map(f => {
        if (!getOptions(f).length) return null;
        const display = form[f] && f !== "features" ? form[f] : f === "features" && form[f].length ? form[f].join(", ") : `Select ${f}`;
        return (
          <Field key={f} label={f.charAt(0).toUpperCase() + f.slice(1)}>
            <div className={`option-item clickable ${isDependentDisabled(f) ? "blurred" : ""}`}
                 onClick={() => !isDependentDisabled(f) && (scrollPos.current = window.scrollY) && setSelectionStep(f)}>
              {display}
            </div>
          </Field>
        );
      })}

      <Field label="Description">
        <textarea value={form.description} onChange={e => updateForm("description", e.target.value)} placeholder="Product description..." />
      </Field>

      <Field label="Price (₦)">
        <input value={form.price} onChange={handlePriceChange} placeholder="₦ 0" />
      </Field>

      <Field label="Phone">
        <input type="tel" value={form.phone} onChange={e => updateForm("phone", e.target.value)} placeholder="08012345678" />
      </Field>

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

      {/* ---------------- Promotion Plans ---------------- */}
      <Field label="Promote Product?">
        <label>
          <input type="checkbox" checked={form.isPromoted} onChange={e => updateForm("isPromoted", e.target.checked)} />
          Yes, I want to promote
        </label>
      </Field>

      {form.isPromoted && (
        <Field label="Select Promotion Plan">
          <div className="promotion-plans">
            {promotionPlans.map(plan => (
              <div key={plan.id}
                   className={`option-item clickable ${form.promotionPlan === plan.id ? "active" : ""}`}
                   onClick={() => updateForm("promotionPlan", plan.id)}>
                {plan.name} - ₦{plan.price.toLocaleString()}
              </div>
            ))}
          </div>
        </Field>
      )}

      <button className="btn" onClick={handleSubmit} disabled={loading}>
        {loading ? "Processing..." : "Publish"}
      </button>

      <Toast message={toast.message} icon={toast.icon} visible={toast.visible} />
    </div>
  );
}

// ---------------- Field Wrapper ----------------
const Field = ({ label, children }) => (
  <div className="field">
    <label>{label}</label>
    {children}
  </div>
);