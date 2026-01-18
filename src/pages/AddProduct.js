// src/pages/AddProduct.js
import { useEffect, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate, useSearchParams } from "react-router-dom";
import categories from "../config/categories";
import categoryRules from "../config/categoryRules";
import { locationsByState } from "../config/locationsByState";
import phoneModels from "../config/phoneModels";
import conditions from "../config/condition";
import { promotionPlans } from "../config/promotionPlans";
import "./AddProduct.css";

const DRAFT_KEY = "add_product_draft";
const CATEGORY_KEY = "selected_category";

export default function AddProduct() {
const navigate = useNavigate();
const [params] = useSearchParams();
const marketType = params.get("market") || "marketplace";

const [loading, setLoading] = useState(false);
const [showSuccess, setShowSuccess] = useState(false); // dynamic success message
const [form, setForm] = useState({
title: "",
mainCategory: "",
subCategory: "",
brand: "",
model: "",
condition: "",
usedDetail: "",
priceRaw: "",
price: "",
phone: "",
description: "",
state: "",
city: "",
images: [],
previews: [],
promotionPlan: promotionPlans[0].id,
});

const [selectionStep, setSelectionStep] = useState(null);
const [backStep, setBackStep] = useState(null);

const rules = categoryRules[form.mainCategory] || categoryRules.Default;

// -------------------- Load / Save Draft --------------------
useEffect(() => {
const saved = localStorage.getItem(DRAFT_KEY);
if (saved) setForm(JSON.parse(saved));
const savedCat = localStorage.getItem(CATEGORY_KEY);
if (savedCat) setForm(prev => ({ ...prev, mainCategory: savedCat }));
}, []);

useEffect(() => {
localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
if (form.mainCategory) localStorage.setItem(CATEGORY_KEY, form.mainCategory);
}, [form]);

// -------------------- Cleanup object URLs --------------------
useEffect(() => {
return () => form.previews.forEach(url => URL.revokeObjectURL(url));
}, [form.previews]);

// -------------------- Helpers --------------------
const update = (key, value, resetDeps = []) => {
setForm(prev => {
let updated = { ...prev, [key]: value };
resetDeps.forEach(dep => { updated[dep] = ""; });
return updated;
});
};

const handlePriceChange = e => {
const raw = e.target.value.replace(/,/g, "");
if (!isNaN(raw)) {
update("priceRaw", raw);
update("price", raw ? Number(raw).toLocaleString() : "");
}
};

const handleImages = files => {
const list = Array.from(files);
if (list.length + form.images.length > rules.maxImages) {
alert(Maximum ${rules.maxImages} images allowed);
return;
}
update("images", [...form.images, ...list]);
update("previews", [...form.previews, ...list.map(f => URL.createObjectURL(f))]);
};

const removeImage = index => {
update("images", form.images.filter((, i) => i !== index));
update("previews", form.previews.filter((, i) => i !== index));
};

const validate = () => {
if (!form.title || form.title.length < rules.minTitle)
return Title must be at least ${rules.minTitle} characters;
if (!form.mainCategory) return "Select category";
if (!form.priceRaw) return "Enter price";
if (!form.phone || form.phone.length < 10) return "Enter valid phone number";
if (form.images.length < rules.minImages) return Upload at least ${rules.minImages} image(s);
if ((form.mainCategory === "Smartphones" || form.mainCategory === "FeaturePhones") && form.model && !form.condition)
return "Select condition";
if (form.condition === "Used" && !form.usedDetail) return "Select used detail";
if (!form.state) return "Select state";
if (!form.city) return "Select city / LGA";
return null;
};

const handleSubmit = async () => {
const error = validate();
if (error) return alert(error);
if (!auth.currentUser) return alert("Login required");

try {    
  setLoading(true);    
  const uploaded = await Promise.all(form.images.map(img => uploadToCloudinary(img)));    
  await addDoc(collection(db, "products"), {    
    ...form,    
    price: Number(form.priceRaw),    
    images: uploaded,    
    coverImage: uploaded[0],    
    marketType,    
    ownerId: auth.currentUser.uid,    
    createdAt: serverTimestamp(),    
  });    
  localStorage.removeItem(DRAFT_KEY);    

  // Dynamic success    
  setShowSuccess(true);    
  setTimeout(() => setShowSuccess(false), 3000);    

  navigate(`/${marketType}`);    
} catch (err) {    
  alert(err.message);    
} finally {    
  setLoading(false);    
}

};

// -------------------- Full Page List --------------------
const FullPageList = ({ title, options, valueKey }) => {
const [customValue, setCustomValue] = useState("");

const handleCustomSubmit = () => {    
  if (customValue.trim()) {    
    update(valueKey, customValue.trim());    
    setCustomValue("");    
    setSelectionStep(null);    
  }    
};    

return (    
  <div className="fullpage-list">    
    {backStep && (    
      <button type="button" className="options-back" onClick={() => setSelectionStep(backStep)}>    
        ← Back    
      </button>    
    )}    
    <h3>{title}</h3>    
    <div className="options-scroll">    
      {options.map(opt => (    
        <button    
          type="button"    
          key={opt}    
          className={`option-item ${form[valueKey] === opt ? "active" : ""}`}    
          onClick={() => {    
            const depsMap = {    
              mainCategory: ["subCategory","brand","model","condition","usedDetail"],    
              subCategory: ["brand","model","condition","usedDetail"],    
              brand: ["model","condition","usedDetail"],    
              model: ["condition","usedDetail"],    
              condition: ["usedDetail"],    
              state: ["city"]    
            };    
            update(valueKey, opt, depsMap[valueKey] || []);    
            setSelectionStep(null);    
          }}    
        >    
          {opt}    
        </button>    
      ))}    

      {/* Manual input */}    
      <form onSubmit={e => { e.preventDefault(); handleCustomSubmit(); }}>    
        <div className="option-item" style={{ justifyContent: "center" }}>    
          <input    
            type="text"    
            placeholder={`Enter ${valueKey}...`}    
            value={customValue}    
            onChange={e => setCustomValue(e.target.value)}    
          />    
          <button type="submit" style={{ marginLeft: 6, cursor: "pointer", color: "#0D6EFD" }}>➔</button>    
        </div>    
      </form>    
    </div>    
  </div>    
);

};

// -------------------- Derived Options --------------------
const getSubcategories = () => categories.find(c => c.name === form.mainCategory)?.subcategories || [];
const getBrandOptions = () => form.mainCategory ? Object.keys(phoneModels[form.mainCategory] || {}) : [];
const getModelOptions = () => form.brand ? phoneModels[form.mainCategory][form.brand] || [] : [];
const getStateOptions = () => Object.keys(locationsByState);
const getCityOptions = () => form.state ? locationsByState[form.state] : [];
const getConditionOptions = () => conditions.main;
const getUsedDetailOptions = () => conditions.usedDetails;

// -------------------- Render Full Page Selection --------------------
if (selectionStep) {
const steps = {
subCategory: getSubcategories(),
brand: getBrandOptions(),
model: getModelOptions(),
state: getStateOptions(),
city: getCityOptions(),
condition: getConditionOptions(),
usedDetail: getUsedDetailOptions(),
};
return <FullPageList title={Select ${selectionStep}} options={steps[selectionStep]} valueKey={selectionStep} />;
}

// -------------------- Main Form --------------------
return (
<div className="add-product-container">
{showSuccess && (
<div className="success-toast">
<img src="/marketplace.png" alt="Marketplace" />
<span>Product posted successfully!</span>
</div>
)}

{/* Header */}    
  <div className="add-product-header">    
    <button type="button" className="back-btn" onClick={() => navigate(`/${marketType}`)}>←</button>    
    <span className="page-title">Add Product</span>    
  </div>    

  {/* All Fields */}    
  <Field label="Title">    
    <input value={form.title} onChange={e => update("title", e.target.value)} placeholder="e.g iPhone 11 Pro Max" />    
  </Field>    

  <Field label="Category">    
    <div className="category-scroll">    
      {categories.map(cat => (    
        <button    
          type="button"    
          key={cat.name}    
          className={`category-item ${form.mainCategory === cat.name ? "active" : ""}`}    
          onClick={() => update("mainCategory", cat.name, ["subCategory","brand","model","condition","usedDetail"])}    
        >    
          <span className="category-icon">{cat.icon}</span>    
          <span className="category-name">{cat.name}</span>    
        </button>    
      ))}    
    </div>    
  </Field>    

  {form.mainCategory && (    
    <Field label="Subcategory">    
      <button type="button" className="option-item clickable" onClick={() => { setBackStep(null); setSelectionStep("subCategory"); }}>    
        {form.subCategory || "Select Subcategory"}    
      </button>    
    </Field>    
  )}    

  {form.subCategory && (    
    <Field label="Brand">    
      <button type="button" className="option-item clickable" onClick={() => { setBackStep("subCategory"); setSelectionStep("brand"); }}>    
        {form.brand || "Select Brand"}    
      </button>    
    </Field>    
  )}    

  {form.brand && (    
    <Field label="Model / Type">    
      <button type="button" className="option-item clickable" onClick={() => { setBackStep("brand"); setSelectionStep("model"); }}>    
        {form.model || "Select Model"}    
      </button>    
    </Field>    
  )}    

  {(form.mainCategory === "Smartphones" || form.mainCategory === "FeaturePhones") && form.model && (    
    <Field label="Condition">    
      <button type="button" className="option-item clickable" onClick={() => { setBackStep("model"); setSelectionStep("condition"); }}>    
        {form.condition || "Select Condition"}    
      </button>    
      {form.condition === "Used" && (    
        <Field label="Used Details">    
          <button type="button" className="option-item clickable" onClick={() => { setBackStep("condition"); setSelectionStep("usedDetail"); }}>    
            {form.usedDetail || "Select Used Detail"}    
          </button>    
        </Field>    
      )}    
    </Field>    
  )}    

  <Field label="Price (₦)">    
    <input value={form.price} onChange={handlePriceChange} placeholder="₦ 0" />    
  </Field>    

  <Field label="Phone Number">    
    <input type="tel" value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="08012345678" />    
  </Field>    

  <Field label="Images">    
    <label className="image-upload">    
      <input type="file" multiple hidden onChange={e => handleImages(e.target.files)} />    
      <span>＋ Add Images</span>    
    </label>    
    <div className="images">    
      {form.previews.map((p, i) => (    
        <div key={i} className="img-wrap">    
          <img src={p} alt="" />    
          <button type="button" onClick={() => removeImage(i)}>×</button>    
        </div>    
      ))}    
    </div>    
  </Field>    

  <Field label="State">    
    <button type="button" className="option-item clickable" onClick={() => { setBackStep(null); setSelectionStep("state"); }}>    
      {form.state || "Select State"}    
    </button>    
  </Field>    

  {form.state && (    
    <Field label="City / LGA">    
      <button type="button" className="option-item clickable" onClick={() => { setBackStep("state"); setSelectionStep("city"); }}>    
        {form.city || "Select City / LGA"}    
      </button>    
    </Field>    
  )}    

  <Field label="Description">    
    <textarea rows={4} value={form.description} onChange={e => update("description", e.target.value)} />    
  </Field>    

  <Field label="Promotion Plan">    
    <div className="promotion-scroll">    
      {promotionPlans.map(plan => (    
        <button    
          type="button"    
          key={plan.id}    
          className={`promotion-item ${form.promotionPlan === plan.id ? "active" : ""}`}    
          onClick={() => update("promotionPlan", plan.id)}    
        >    
          {plan.isFree && <div className="promotion-free-badge">FREE</div>}    
          <span className="promotion-icon">{plan.icon}</span>    
          <span className="promotion-days">{plan.days} Days</span>    
          <span className="promotion-price">{plan.isFree ? "₦0" : `₦${plan.price}`}</span>    
          <span className="promotion-label">{plan.label}</span>    
        </button>    
      ))}    
    </div>    
  </Field>    

  <button className="btn" onClick={handleSubmit} disabled={loading}>    
    {loading ? "Uploading..." : "Publish"}    
  </button>    
</div>

);
}

// -------------------- Field Component --------------------
const Field = ({ label, children }) => (

  <div className="field">    
    <label>{label}</label>    
    {children}    
  </div>    
);    