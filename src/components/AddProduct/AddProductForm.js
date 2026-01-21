// src/components/AddProduct/AddProductForm.js
import { useState } from "react";
import categories from "../../config/categories";
import categoryRules from "../../config/categoryRules";
import { locationsByState } from "../../config/locationsByState";
import phoneModels from "../../config/phoneModels";
import productOptions from "../../config/productOptions";

import Field from "./Field";
import FullPageList from "./FullPageList";
import FullPageMultiSelect from "./FullPageMultiSelect";

export default function AddProductForm({ form, update, scrollPos, loading, showToast, handleSubmit, promotionPlans }) {
  const [selectionStep, setSelectionStep] = useState(null);
  const [backStep, setBackStep] = useState(null);

  const rules = categoryRules[form.mainCategory] || categoryRules.Default;

  const handleImages = (files) => {
    const list = Array.from(files);
    if (list.length + form.images.length > rules.maxImages) {
      return showToast(`Maximum ${rules.maxImages} images allowed`, "⚠️");
    }
    update("images", [...form.images, ...list]);
    update("previews", [...form.previews, ...list.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = (index) => {
    update("images", form.images.filter((_, i) => i !== index));
    update("previews", form.previews.filter((_, i) => i !== index));
  };

  const showConditionField = () => form.model && ["Smartphones", "Feature Phones"].includes(form.subCategory);
  const showUsedDetailField = () => form.condition === "Used";

  // ---------------- Derived Options ----------------
  const getSubcategories = () => [...(categories.find(c => c.name === form.mainCategory)?.subcategories || [])];
  const getBrandOptions = () => (form.subCategory ? Object.keys(phoneModels[form.subCategory] || {}) : []);
  const getModelOptions = () => (form.subCategory && form.brand ? phoneModels[form.subCategory][form.brand] || [] : []);
  const getStateOptions = () => Object.keys(locationsByState);
  const getCityOptions = () => (form.state ? locationsByState[form.state] : []);
  const getExtraOptions = (field) => {
    if (!form.mainCategory || !form.subCategory) return [];
    const subcatOptions = productOptions[form.mainCategory]?.subcategories[form.subCategory] || {};
    return Array.isArray(subcatOptions[field]) ? subcatOptions[field] : [];
  };

  // ---------------- Reset Dependent Fields ----------------
  const handleCategoryChange = (category) => {
    update("mainCategory", category);
    update("subCategory", "");
    update("brand", "");
    update("model", "");
    update("condition", "");
    update("usedDetail", "");
    update("color", "");
    update("simType", "");
    update("type", "");
  };

  const handleSubcategoryChange = (sub) => {
    update("subCategory", sub);
    update("brand", "");
    update("model", "");
    update("condition", "");
    update("usedDetail", "");
    update("color", "");
    update("simType", "");
    update("type", "");
  };

  const handleBrandChange = (brand) => {
    update("brand", brand);
    update("model", "");
    update("condition", "");
    update("usedDetail", "");
  };

  // ---------------- Render FullPage Selector ----------------
  if (selectionStep) {
    switch (selectionStep) {
      case "subCategory": return <FullPageList title="Select Subcategory" options={getSubcategories()} valueKey="subCategory" setSelectionStep={setSelectionStep} backStep={backStep} update={update} scrollPos={scrollPos} />;
      case "brand": return <FullPageList title="Select Brand" options={getBrandOptions()} valueKey="brand" setSelectionStep={setSelectionStep} backStep={backStep} update={update} scrollPos={scrollPos} />;
      case "model": return <FullPageList title="Select Model" options={getModelOptions()} valueKey="model" setSelectionStep={setSelectionStep} backStep={backStep} update={update} scrollPos={scrollPos} />;
      case "condition": return <FullPageList title="Select Condition" options={["New","Used"]} valueKey="condition" setSelectionStep={setSelectionStep} backStep={backStep} update={update} scrollPos={scrollPos} />;
      case "usedDetail": return <FullPageList title="Select Used Detail" options={["Like New","Good","Fair"]} valueKey="usedDetail" setSelectionStep={setSelectionStep} backStep={backStep} update={update} scrollPos={scrollPos} />;
      case "colors": return <FullPageList title="Select Color" options={getExtraOptions("colors")} valueKey="color" setSelectionStep={setSelectionStep} backStep={backStep} update={update} scrollPos={scrollPos} />;
      case "simTypes": return <FullPageList title="Select SIM Type" options={getExtraOptions("simTypes")} valueKey="simType" setSelectionStep={setSelectionStep} backStep={backStep} update={update} scrollPos={scrollPos} />;
      case "types": return <FullPageList title="Select Type" options={getExtraOptions("types")} valueKey="type" setSelectionStep={setSelectionStep} backStep={backStep} update={update} scrollPos={scrollPos} />;
      case "state": return <FullPageList title="Select State" options={getStateOptions()} valueKey="state" setSelectionStep={setSelectionStep} backStep={backStep} update={update} scrollPos={scrollPos} />;
      case "city": return <FullPageList title="Select City / LGA" options={getCityOptions()} valueKey="city" setSelectionStep={setSelectionStep} backStep={backStep} update={update} scrollPos={scrollPos} />;
      case "features": return <FullPageMultiSelect title="Select Features" options={getExtraOptions("features")} valueKey="features" setSelectionStep={setSelectionStep} backStep={backStep} update={update} scrollPos={scrollPos} />;
      default: break;
    }
  }

  return (
    <div className="add-product-container">
      <h2>Add Product</h2>

      <Field label="Title">
        <input value={form.title} onChange={e => update("title", e.target.value)} placeholder="e.g iPhone 13 Pro Max" />
      </Field>

      <Field label="Category">
        <div className="category-scroll">
          {categories.map(cat => (
            <div key={cat.name} className={`category-item ${form.mainCategory === cat.name ? "active" : ""}`} onClick={() => handleCategoryChange(cat.name)}>
              <span className="category-icon">{cat.icon}</span>
              <span className="category-name">{cat.name}</span>
            </div>
          ))}
        </div>
      </Field>

      {form.mainCategory && (
        <Field label="Subcategory">
          <div className="option-item clickable" onClick={() => { scrollPos.current = window.scrollY; setBackStep(null); setSelectionStep("subCategory"); }}>
            {form.subCategory || "Select Subcategory"}
          </div>
        </Field>
      )}

      {form.subCategory && getBrandOptions().length > 0 && (
        <Field label="Brand">
          <div className="option-item clickable" onClick={() => { scrollPos.current = window.scrollY; setBackStep("subCategory"); setSelectionStep("brand"); }}>
            {form.brand || "Select Brand"}
          </div>
        </Field>
      )}

      {form.brand && getModelOptions().length > 0 && (
        <Field label="Model / Type">
          <div className="option-item clickable" onClick={() => { scrollPos.current = window.scrollY; setBackStep("brand"); setSelectionStep("model"); }}>
            {form.model || "Select Model"}
          </div>
        </Field>
      )}

      {showConditionField() && (
        <Field label="Condition">
          <div className="option-item clickable" onClick={() => { scrollPos.current = window.scrollY; setBackStep("model"); setSelectionStep("condition"); }}>
            {form.condition || "Select Condition"}
          </div>
        </Field>
      )}

      {showUsedDetailField() && (
        <Field label="Used Detail">
          <div className="option-item clickable" onClick={() => { scrollPos.current = window.scrollY; setBackStep("condition"); setSelectionStep("usedDetail"); }}>
            {form.usedDetail || "Select Used Detail"}
          </div>
        </Field>
      )}

      {getExtraOptions("features").length > 0 && (
        <Field label="Features">
          <div className="option-item clickable" onClick={() => { scrollPos.current = window.scrollY; setBackStep(null); setSelectionStep("features"); }}>
            {form.features.length > 0 ? form.features.join(", ") : "Select Features"}
          </div>
        </Field>
      )}

      <Field label="State">
        <div className="option-item clickable" onClick={() => { scrollPos.current = window.scrollY; setBackStep(null); setSelectionStep("state"); }}>
          {form.state || "Select State"}
        </div>
      </Field>

      {form.state && (
        <Field label="City / LGA">
          <div className="option-item clickable" onClick={() => { scrollPos.current = window.scrollY; setBackStep("state"); setSelectionStep("city"); }}>
            {form.city || "Select City / LGA"}
          </div>
        </Field>
      )}

      <Field label="Price (₦)">
        <input 
          value={form.price} 
          onChange={e => update("price", e.target.value.replace(/\B(?=(\d{3})+(?!\d))/g, ","))} 
          placeholder="₦ 0" 
        />
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
              <img src={p} alt={`preview-${i}`} />
              <button type="button" onClick={() => removeImage(i)}>×</button>
            </div>
          ))}
        </div>
      </Field>

      <Field label="Promotion Plan">
        <div className="promotion-scroll">
          {promotionPlans.map(plan => (
            <div key={plan.id} className={`promotion-item ${form.promotionPlan?.id === plan.id ? "active" : ""}`} onClick={() => {
              if (form.promotionPlan?.id === plan.id && form.paymentSuccess) return showToast("Already paid ✅", "⚡");
              update("promotionPlan", plan);
            }}>
              <span>{plan.label}</span>
              <span>{plan.days} days</span>
              <span>{plan.price > 0 ? `₦${plan.price}` : "Free"}</span>
            </div>
          ))}
        </div>
      </Field>

      <button className="btn" disabled={loading} onClick={handleSubmit}>
        {loading ? "Uploading..." : "Publish"}
      </button>
    </div>
  );
}