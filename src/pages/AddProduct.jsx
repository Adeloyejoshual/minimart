// src/pages/AddProduct.jsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import categories from "../config/categories"; // categories with id + name
import { categoryFields } from "../config/categoryFields";
import { locationsByState } from "../config/locationsByState";
import productOptions from "../config/productOptions";
import Toast from "../components/Toast";
import "./AddProduct.css";

const DRAFT_KEY = "add_product_draft";
const CATEGORY_KEY = "selected_category";

export default function AddProduct() {
  const navigate = useNavigate();
  const scrollPos = useRef(0);

  const [toast, setToast] = useState({ visible: false, message: "", icon: "⚡" });
  const [selectionStep, setSelectionStep] = useState(null);
  const [backStep, setBackStep] = useState(null);

  const [form, setForm] = useState({
    title: "",
    mainCategory: null, // will store category id
    subCategory: "",
    brand: "",
    model: "",
    condition: "",
    usedDetail: "",
    price: "",
    state: "",
    city: "",
    color: "",
    simType: "",
    features: [],
  });

  // ---------------- Draft Load/Save ----------------
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

  // ---------------- Toast ----------------
  const showToast = (message, icon = "⚡", duration = 3000) => {
    setToast({ visible: true, message, icon });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), duration);
  };

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handlePriceChange = e => {
    const raw = e.target.value.replace(/,/g, "");
    if (!isNaN(raw) || raw === "") {
      update("price", raw.replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    }
  };

  // ---------------- Derived Options ----------------
  const selectedCategory = categories.find(c => c.id === form.mainCategory);
  const getSubcategories = () => [...(productOptions[selectedCategory?.name]?.subcategories || [])];
  const getBrandOptions = () => (form.subCategory ? Object.keys(productOptions[selectedCategory?.name]?.subcategories[form.subCategory] || {}) : []);
  const getModelOptions = () => (form.subCategory && form.brand ? productOptions[selectedCategory?.name]?.subcategories[form.subCategory][form.brand] || [] : []);
  const getStateOptions = () => Object.keys(locationsByState);
  const getCityOptions = () => (form.state ? locationsByState[form.state] : []);
  const getExtraOptions = (field) => {
    if (!selectedCategory || !form.subCategory) return [];
    const subcatOptions = productOptions[selectedCategory.name]?.subcategories[form.subCategory] || {};
    return Array.isArray(subcatOptions[field]) ? subcatOptions[field] : [];
  };

  // ---------------- Reset Dependent Fields ----------------
  const handleCategoryChange = (catId) => {
    setForm(prev => ({
      ...prev,
      mainCategory: catId,
      subCategory: "",
      brand: "",
      model: "",
      condition: "",
      usedDetail: "",
      color: "",
      simType: "",
      features: [],
    }));
    setSelectionStep(null);
  };

  const handleSubcategoryChange = (sub) => {
    setForm(prev => ({
      ...prev,
      subCategory: sub,
      brand: "",
      model: "",
      condition: "",
      usedDetail: "",
      color: "",
      simType: "",
      features: [],
    }));
    setSelectionStep(null);
  };

  const handleBrandChange = (brand) => {
    setForm(prev => ({
      ...prev,
      brand,
      model: "",
      condition: "",
      usedDetail: "",
    }));
    setSelectionStep(null);
  };

  // ---------------- FullPage Selectors ----------------
  const FullPageList = ({ title, options, valueKey }) => {
    const [search, setSearch] = useState("");
    const [customValue, setCustomValue] = useState("");
    const filtered = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

    const handleCustomSubmit = () => {
      if (customValue.trim() !== "") {
        update(valueKey, customValue.trim());
        setCustomValue("");
        setSelectionStep(null);
        window.scrollTo(0, scrollPos.current);
      }
    };

    return (
      <div className="fullpage-list">
        {backStep && <div className="options-back" onClick={() => setSelectionStep(backStep)}>← Back</div>}
        <h3>{title}</h3>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="fullpage-search"
        />
        <div className="options-scroll">
          {filtered.map(opt => (
            <div
              key={opt}
              className={`option-item ${form[valueKey] === opt ? "active" : ""}`}
              onClick={() => { update(valueKey, opt); setSelectionStep(null); window.scrollTo(0, scrollPos.current); }}
            >
              {opt}
            </div>
          ))}
          <div className="option-item custom-input">
            <input
              type="text"
              placeholder={`Enter ${valueKey}...`}
              value={customValue}
              onChange={e => setCustomValue(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCustomSubmit()}
            />
          </div>
        </div>
      </div>
    );
  };

  const FullPageMultiSelect = ({ title, options, valueKey }) => {
    const [search, setSearch] = useState("");
    const filtered = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

    const toggleOption = (opt) => {
      if (form[valueKey].includes(opt)) {
        update(valueKey, form[valueKey].filter(f => f !== opt));
      } else {
        update(valueKey, [...form[valueKey], opt]);
      }
    };

    const handleDone = () => {
      setSelectionStep(null);
      window.scrollTo(0, scrollPos.current);
    };

    return (
      <div className="fullpage-list">
        {backStep && <div className="options-back" onClick={() => setSelectionStep(backStep)}>← Back</div>}
        <h3>{title}</h3>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="fullpage-search"
        />
        <div className="options-scroll">
          {filtered.map(opt => (
            <div
              key={opt}
              className={`option-item ${form[valueKey].includes(opt) ? "active" : ""}`}
              onClick={() => toggleOption(opt)}
            >
              {opt} {form[valueKey].includes(opt) && "✓"}
            </div>
          ))}
        </div>
        <button className="btn" onClick={handleDone}>Done</button>
      </div>
    );
  };

  // ---------------- Render FullPage Selector ----------------
  if (selectionStep) {
    switch (selectionStep) {
      case "mainCategory":
        return (
          <FullPageList
            title="Select Category"
            options={categories.map(c => c.name)}
            valueKey="mainCategory"
          />
        );
      case "subCategory":
        return <FullPageList title="Select Subcategory" options={getSubcategories()} valueKey="subCategory" />;
      case "brand":
        return <FullPageList title="Select Brand" options={getBrandOptions()} valueKey="brand" />;
      case "model":
        return <FullPageList title="Select Model" options={getModelOptions()} valueKey="model" />;
      case "state":
        return <FullPageList title="Select State" options={getStateOptions()} valueKey="state" />;
      case "city":
        return <FullPageList title="Select City / LGA" options={getCityOptions()} valueKey="city" />;
      case "features":
        return <FullPageMultiSelect title="Select Features" options={getExtraOptions("features")} valueKey="features" />;
      default: break;
    }
  }

  // ---------------- Main Form ----------------
  return (
    <div className="add-product-container">
      <div className="add-product-header">
        <button className="back-btn" onClick={() => navigate("/")}>←</button>
        <span className="page-title">Add Product</span>
      </div>

      <Field label="Title">
        <input value={form.title} onChange={e => update("title", e.target.value)} placeholder="e.g iPhone 11 Pro Max" />
      </Field>

      <Field label="Category">
        <div className="category-scroll">
          {categories.map(cat => (
            <div
              key={cat.id}
              className={`category-item ${form.mainCategory === cat.id ? "active" : ""}`}
              onClick={() => {
                scrollPos.current = window.scrollY;
                setBackStep(null);
                setSelectionStep("mainCategory");
              }}
            >
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

      {getExtraOptions("features").length > 0 && (
        <Field label="Features">
          <div className="option-item clickable" onClick={() => { scrollPos.current = window.scrollY; setBackStep(null); setSelectionStep("features"); }}>
            {form.features.length > 0 ? form.features.join(", ") : "Select Features"}
          </div>
        </Field>
      )}

      <Field label="Price (₦)">
        <input value={form.price} onChange={handlePriceChange} placeholder="₦ 0" />
      </Field>

      <button className="btn" type="button" onClick={() => showToast("Form submitted!")}>
        Submit
      </button>

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