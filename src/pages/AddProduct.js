// src/pages/AddProduct.js
import { useEffect, useState, useRef } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate, useSearchParams } from "react-router-dom";
import categories from "../config/categories";
import categoryRules from "../config/categoryRules";
import { locationsByState } from "../config/locationsByState";
import productOptions from "../config/productOptions";
import Toast from "../components/Toast";
import "./AddProduct.css";

const DRAFT_KEY = "add_product_draft";
const CATEGORY_KEY = "selected_category";

export default function AddProduct() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const marketType = params.get("market") || "marketplace";

  const [loading, setLoading] = useState(false);
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
    simType: "",
    features: [],
    type: "",
    isPromoted: false,
  });

  const [selectionStep, setSelectionStep] = useState(null);
  const [backStep, setBackStep] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: "", icon: "⚡" });

  const scrollPos = useRef(0);
  const rules = categoryRules[form.mainCategory] || categoryRules.Default;

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

  useEffect(() => {
    return () => form.previews.forEach(url => URL.revokeObjectURL(url));
  }, [form.previews]);

  // ---------------- Toast ----------------
  const showToast = (message, icon = "⚡", duration = 3000) => {
    setToast({ visible: true, message, icon });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), duration);
  };

  // ---------------- Helpers ----------------
  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handlePriceChange = e => {
    const raw = e.target.value.replace(/,/g, "");
    if (!isNaN(raw) || raw === "") {
      update("price", raw.replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    }
  };

  const handleImages = files => {
    const list = Array.from(files);
    if (list.length + form.images.length > rules.maxImages) {
      return showToast(`Maximum ${rules.maxImages} images allowed`, "⚠️");
    }
    update("images", [...form.images, ...list]);
    update("previews", [...form.previews, ...list.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = index => {
    update("images", form.images.filter((_, i) => i !== index));
    update("previews", form.previews.filter((_, i) => i !== index));
  };

  const validate = () => {
    if (!form.title || form.title.length < rules.minTitle)
      return `Title must be at least ${rules.minTitle} characters`;
    if (!form.mainCategory) return "Select category";
    if (!form.price) return "Enter price";
    if (!form.phone || form.phone.length < 10) return "Enter valid phone number";
    if (form.images.length < rules.minImages) return `Upload at least ${rules.minImages} image(s)`;
    if (["Smartphones", "FeaturePhones"].includes(form.mainCategory) && form.model && !form.condition)
      return "Select condition";
    if (form.condition === "Used" && !form.usedDetail) return "Select used detail";
    if (!form.state) return "Select state";
    if (!form.city) return "Select city / LGA";
    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) return showToast(error, "⚠️");
    if (!auth.currentUser) return showToast("Login required", "🔒");

    try {
      setLoading(true);
      const uploaded = await Promise.all(form.images.map(img => uploadToCloudinary(img)));
      await addDoc(collection(db, "products"), {
        ...form,
        price: Number(String(form.price).replace(/,/g, "")),
        images: uploaded,
        coverImage: uploaded[0],
        marketType,
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });
      localStorage.removeItem(DRAFT_KEY);
      showToast("Product posted successfully!", "✅");
      navigate(`/${marketType}`);
    } catch (err) {
      showToast(err.message, "❌");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Full Page List ----------------
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

  // ---------------- Derived Options ----------------
  const getSubcategories = () => [...(categories.find(c => c.name === form.mainCategory)?.subcategories || [])];
  const getBrandOptions = () => form.mainCategory ? Object.keys(productOptions[form.mainCategory]?.subcategories[form.subCategory]?.brands || {}) : [];
  const getModelOptions = () => form.brand ? productOptions[form.mainCategory]?.subcategories[form.subCategory]?.brands?.[form.brand] || [] : [];
  const getStateOptions = () => Object.keys(locationsByState);
  const getCityOptions = () => form.state ? locationsByState[form.state] : [];

  const getExtraOptions = (field) => {
    if (!form.mainCategory || !form.subCategory) return [];
    const subcatOptions = productOptions[form.mainCategory]?.subcategories[form.subCategory] || {};
    return Array.isArray(subcatOptions[field]) && subcatOptions[field].length > 0 ? subcatOptions[field] : [];
  };

  // ---------------- Dynamic Fields ----------------
  const showConditionField = () => form.model && ["Smartphones", "FeaturePhones"].includes(form.mainCategory);
  const showUsedDetailField = () => form.condition === "Used";

  useEffect(() => { if (!form.model) { update("condition", ""); update("usedDetail", ""); } }, [form.model]);
  useEffect(() => { if (form.condition !== "Used") update("usedDetail", ""); }, [form.condition]);

  // ---------------- Render FullPage Selector ----------------
  if (selectionStep) {
    switch (selectionStep) {
      case "subCategory": return <FullPageList title="Select Subcategory" options={getSubcategories()} valueKey="subCategory" />;
      case "brand": return <FullPageList title="Select Brand" options={getBrandOptions()} valueKey="brand" />;
      case "model": return <FullPageList title="Select Model" options={getModelOptions()} valueKey="model" />;
      case "condition": return <FullPageList title="Select Condition" options={["New","Used"]} valueKey="condition" />;
      case "usedDetail": return <FullPageList title="Select Used Detail" options={["Like New","Good","Fair"]} valueKey="usedDetail" />;
      case "colors": return <FullPageList title="Select Color" options={getExtraOptions("colors")} valueKey="color" />;
      case "simTypes": return <FullPageList title="Select SIM Type" options={getExtraOptions("simTypes")} valueKey="simType" />;
      case "types": return <FullPageList title="Select Type" options={getExtraOptions("types")} valueKey="type" />;
      case "state": return <FullPageList title="Select State" options={getStateOptions()} valueKey="state" />;
      case "city": return <FullPageList title="Select City / LGA" options={getCityOptions()} valueKey="city" />;
      default: break;
    }
  }

  // ---------------- Main Form ----------------
  return (
    <div className="add-product-container">
      <div className="add-product-header">
        <button className="back-btn" onClick={() => navigate(`/${marketType}`)}>←</button>
        <span className="page-title">Add Product</span>
      </div>

      {/* Title */}
      <Field label="Title">
        <input value={form.title} onChange={e => update("title", e.target.value)} placeholder="e.g iPhone 11 Pro Max" />
      </Field>

      {/* Category */}
      <Field label="Category">
        <div className="category-scroll">
          {categories.map(cat => (
            <div
              key={cat.name}
              className={`category-item ${form.mainCategory === cat.name ? "active" : ""}`}
              onClick={() => update("mainCategory", cat.name)}
            >
              <span className="category-icon">{cat.icon}</span>
              <span className="category-name">{cat.name}</span>
            </div>
          ))}
        </div>
      </Field>

      {/* Subcategory */}
      {form.mainCategory && (
        <Field label="Subcategory">
          <div className="option-item clickable" onClick={() => { scrollPos.current = window.scrollY; setBackStep(null); setSelectionStep("subCategory"); }}>
            {form.subCategory || "Select Subcategory"}
          </div>
        </Field>
      )}

      {/* Brand */}
      {form.subCategory && getBrandOptions().length > 0 && (
        <Field label="Brand">
          <div className="option-item clickable" onClick={() => { scrollPos.current = window.scrollY; setBackStep("subCategory"); setSelectionStep("brand"); }}>
            {form.brand || "Select Brand"}
          </div>
        </Field>
      )}

      {/* Model */}
      {form.brand && getModelOptions().length > 0 && (
        <Field label="Model / Type">
          <div className="option-item clickable" onClick={() => { scrollPos.current = window.scrollY; setBackStep("brand"); setSelectionStep("model"); }}>
            {form.model || "Select Model"}
          </div>
        </Field>
      )}

      {/* Condition */}
      {showConditionField() && (
        <Field label="Condition">
          <div className="option-item clickable" onClick={() => { scrollPos.current = window.scrollY; setBackStep("model"); setSelectionStep("condition"); }}>
            {form.condition || "Select Condition"}
          </div>
        </Field>
      )}

      {/* Used Detail */}
      {showUsedDetailField() && (
        <Field label="Used Detail">
          <div className="option-item clickable" onClick={() => { scrollPos.current = window.scrollY; setBackStep("condition"); setSelectionStep("usedDetail"); }}>
            {form.usedDetail || "Select Used Detail"}
          </div>
        </Field>
      )}

      {/* Price */}
      <Field label="Price (₦)">
        <input value={form.price} onChange={handlePriceChange} placeholder="₦ 0" />
      </Field>

      {/* Phone */}
      <Field label="Phone Number">
        <input type="tel" value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="08012345678" />
      </Field>

      {/* Images */}
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

      {/* Extra Options */}
      {getExtraOptions("colors").length > 0 && (
        <Field label="Color">
          <div className="option-item clickable" onClick={() => { scrollPos.current = window.scrollY; setSelectionStep("colors"); }}>
            {form.color || "Select Color"}
          </div>
        </Field>
      )}

      {getExtraOptions("simTypes").length > 0 && (
        <Field label="SIM Type">
          <div className="option-item clickable" onClick={() => { scrollPos.current = window.scrollY; setSelectionStep("simTypes"); }}>
            {form.simType || "Select SIM Type"}
          </div>
        </Field>
      )}

      {getExtraOptions("features").length > 0 && (
        <Field label="Features">
          <div className="features-checkboxes">
            {getExtraOptions("features").map(f => (
              <label key={f} className="feature-label">
                <input
                  type="checkbox"
                  checked={form.features.includes(f)}
                  onChange={() => {
                    const updated = form.features.includes(f)
                      ? form.features.filter(x => x !== f)
                      : [...form.features, f];
                    update("features", updated);
                  }}
                />
                {f}
              </label>
            ))}
          </div>
        </Field>
      )}

      {getExtraOptions("types").length > 0 && (
        <Field label="Type">
          <div className="option-item clickable" onClick={() => { scrollPos.current = window.scrollY; setSelectionStep("types"); }}>
            {form.type || "Select Type"}
          </div>
        </Field>
      )}

      {/* State */}
      <Field label="State">
        <div className="option-item clickable" onClick={() => { scrollPos.current = window.scrollY; setBackStep(null); setSelectionStep("state"); }}>
          {form.state || "Select State"}
        </div>
      </Field>

      {/* City */}
      {form.state && (
        <Field label="City / LGA">
          <div className="option-item clickable" onClick={() => { scrollPos.current = window.scrollY; setBackStep("state"); setSelectionStep("city"); }}>
            {form.city || "Select City / LGA"}
          </div>
        </Field>
      )}

      {/* Description */}
      <Field label="Description">
        <textarea rows={4} value={form.description} onChange={e => update("description", e.target.value)} />
      </Field>

      {/* Promote */}
      <Field label="Promote Product">
        <label>
          <input type="checkbox" checked={form.isPromoted} onChange={() => update("isPromoted", !form.isPromoted)} />
          Promote this product (free)
        </label>
      </Field>

      {/* Submit */}
      <button className="btn" type="button" onClick={handleSubmit} disabled={loading}>
        {loading ? "Uploading..." : "Publish"}
      </button>

      {/* Toast */}
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