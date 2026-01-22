// src/pages/AddProduct.js
import { useEffect, useState, useRef, useCallback } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate, useSearchParams } from "react-router-dom";
import categoriesData from "../config/categories";
import categoryRules from "../config/categoryRules";
import { locationsByState } from "../config/locationsByState";
import productOptions from "../config/productOptions";
import phoneModels from "../config/phoneModels";
import { promotionPlans } from "../config/promotionPlans";
import conditionConfig from "../config/conditions";
import AddProductCategory from "../components/AddProductCategory";
import AddProductPromotion from "../components/AddProductPromotion";
import AddProductCondition from "../components/AddProductCondition";
import AddProductLocation from "../components/AddProductLocation";
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
  const [backStep, setBackStep] = useState(null);

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

  // ---------------- Helpers ----------------
  const updateForm = useCallback((key, value) => setForm(prev => ({ ...prev, [key]: value })), []);

  // ---------------- Category / Location / Price ----------------
  const handleCategoryChange = cat => {
    updateForm("mainCategory", cat);
    updateForm("subCategory", "");
    updateForm("brand", "");
    updateForm("model", "");
    updateForm("condition", "");
    updateForm("usedDetail", "");
    updateForm("features", []);
    updateForm("type", "");
    updateForm("color", "");
    updateForm("storage", "");
    updateForm("simType", "");
  };

  const handleSubCategoryChange = subCat => {
    updateForm("subCategory", subCat);
    updateForm("brand", "");
    updateForm("model", "");
    updateForm("condition", "");
    updateForm("usedDetail", "");
    updateForm("features", []);
    updateForm("type", "");
    updateForm("color", "");
    updateForm("storage", "");
    updateForm("simType", "");
  };

  const handleStateChange = state => {
    updateForm("state", state);
    updateForm("city", "");
  };

  const handlePriceChange = e => {
    const raw = e.target.value.replace(/,/g, "");
    if (!isNaN(raw) || raw === "") {
      updateForm("price", raw.replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    }
  };

  const handleImages = files => {
    const list = Array.from(files);
    if (list.length + form.images.length > rules.maxImages) {
      return showToast(`Maximum ${rules.maxImages} images allowed`, "⚠️");
    }
    updateForm("images", [...form.images, ...list]);
    updateForm("previews", [...form.previews, ...list.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = index => {
    updateForm("images", form.images.filter((_, i) => i !== index));
    updateForm("previews", form.previews.filter((_, i) => i !== index));
  };

  // ---------------- Validation ----------------
  const validateForm = () => {
    if (!form.title || form.title.length < rules.minTitle) return `Title must be at least ${rules.minTitle} characters`;
    if (!form.mainCategory) return "Select category";
    if (!form.price) return "Enter price";
    if (!form.phone || form.phone.length < 10) return "Enter valid phone number";
    if (form.images.length < rules.minImages) return `Upload at least ${rules.minImages} image(s)`;
    if (["Smartphones", "Feature Phones"].includes(form.subCategory)) {
      if (!form.brand) return "Select brand";
      if (!form.model) return "Select model";
      if (!form.condition) return "Select condition";
      if (form.condition === "Used" && !form.usedDetail) return "Select used detail";
      if (!form.color) return "Select color";
      if (!form.storage) return "Select storage";
      if (!form.simType) return "Select SIM type";
    }
    if (!form.description || form.description.length < 10) return "Enter description (min 10 chars)";
    if (!form.state) return "Select state";
    if (!form.city) return "Select city / LGA";
    return null;
  };

  // ---------------- Paystack Payment ----------------
  const payWithPaystack = plan => {
    return new Promise((resolve, reject) => {
      if (!window.PaystackPop) {
        const script = document.createElement("script");
        script.src = "https://js.paystack.co/v1/inline.js";
        script.onload = () => payWithPaystack(plan).then(resolve).catch(reject);
        document.body.appendChild(script);
        return showToast("Payment system loading…", "⏳");
      }

      const handler = window.PaystackPop.setup({
        key: process.env.REACT_APP_PAYSTACK_KEY,
        email: auth.currentUser.email,
        amount: (plan.discountPrice ?? plan.price) * 100,
        currency: "NGN",
        ref: `promo_${Date.now()}`,
        metadata: { promotionPlanId: plan.id },
        callback: () => resolve(),
        onClose: () => reject(new Error("Payment cancelled")),
      });

      handler.openIframe();
    });
  };

  // ---------------- Promotion Plan Click ----------------
  const handlePromotionClick = plan => {
    if (!plan) return;
    if (form.promotionPlan?.id === plan.id) return showToast("Already selected ✅", "⚡");

    updateForm("promotionPlan", { ...plan, paid: plan.type === "free" });
    if (plan.type === "free") {
      updateForm("isPromoted", true);
      updateForm("paymentSuccess", true);
      showToast(`${plan.label} selected`, "⚡");
    } else {
      updateForm("isPromoted", false);
      updateForm("paymentSuccess", false);
      showToast(`${plan.label} selected (pay on publish)`, "⚡");
    }
  };

  // ---------------- Submit ----------------
  const handleSubmit = async () => {
    const error = validateForm();
    if (error) return showToast(error, "⚠️");
    if (!auth.currentUser) return showToast("Login required", "🔒");

    try {
      setLoading(true);

      if (form.promotionPlan?.type === "paid" && !form.paymentSuccess) {
        try {
          await payWithPaystack(form.promotionPlan);
          updateForm("paymentSuccess", true);
          updateForm("isPromoted", true);
          showToast("Payment successful ✅", "⚡");
        } catch (err) {
          showToast(err.message, "❌");
          setLoading(false);
          return;
        }
      }

      const uploaded = await Promise.all(form.images.map(img => uploadToCloudinary(img)));
      const promotionEndAt = form.promotionPlan ? new Date(Date.now() + form.promotionPlan.days * 86400000) : null;

      await addDoc(collection(db, "products"), {
        ...form,
        price: Number(String(form.price).replace(/,/g, "")),
        images: uploaded,
        coverImage: uploaded[0],
        marketType,
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        promotion: form.isPromoted
          ? {
              id: form.promotionPlan.id,
              label: form.promotionPlan.label,
              price: form.promotionPlan.price,
              days: form.promotionPlan.days,
              startAt: serverTimestamp(),
              endAt: promotionEndAt,
            }
          : null,
      });

      localStorage.removeItem(DRAFT_KEY);
      showToast("Product posted successfully 🎉", "✅");
      navigate(`/${marketType}`);
    } catch (err) {
      showToast(err.message, "❌");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Derived Options ----------------
  const getSubcategories = () => categoriesData[form.mainCategory]?.subcategories || [];
  const getBrandOptions = () => form.subCategory ? Object.keys(phoneModels[form.subCategory] || {}) : [];
  const getModelOptions = () => form.subCategory && form.brand ? phoneModels[form.subCategory][form.brand] || [] : [];
  const getStateOptions = () => Object.keys(locationsByState);
  const getCityOptions = () => form.state ? locationsByState[form.state] : [];
  const getExtraOptions = field => {
    if (!form.mainCategory || !form.subCategory) return [];
    const subcatOptions = productOptions[form.mainCategory]?.subcategories?.[form.subCategory] || {};
    return Array.isArray(subcatOptions[field]) ? subcatOptions[field] : [];
  };

  // ---------------- FullPage Selectors ----------------
  if (selectionStep) {
    switch (selectionStep) {
      case "subCategory": return <FullPageList title="Select Subcategory" options={getSubcategories()} valueKey="subCategory" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
      case "brand": return <FullPageList title="Select Brand" options={getBrandOptions()} valueKey="brand" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
      case "model": return <FullPageList title="Select Model" options={getModelOptions()} valueKey="model" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
      case "condition": return <FullPageList title="Select Condition" options={conditionConfig[form.mainCategory]?.main || ["New", "Used"]} valueKey="condition" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
      case "usedDetail": return <FullPageList title="Select Used Detail" options={conditionConfig[form.mainCategory]?.usedDetails || ["No defects"]} valueKey="usedDetail" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
      case "colors": return <FullPageList title="Select Color" options={getExtraOptions("colors")} valueKey="color" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
      case "storage": return <FullPageList title="Select Storage" options={getExtraOptions("storage")} valueKey="storage" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
      case "simTypes": return <FullPageList title="Select SIM Type" options={getExtraOptions("simTypes")} valueKey="simType" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
      case "types": return <FullPageList title="Select Type" options={getExtraOptions("types")} valueKey="type" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
      case "features": return <FullPageMultiSelect title="Select Features" options={getExtraOptions("features")} valueKey="features" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
      case "state": return <FullPageList title="Select State" options={getStateOptions()} valueKey="state" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
      case "city": return <FullPageList title="Select City / LGA" options={getCityOptions()} valueKey="city" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
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

      <Field label="Title">
        <input value={form.title} onChange={e => updateForm("title", e.target.value)} placeholder="e.g iPhone 11 Pro Max" />
      </Field>

      <AddProductCategory
        form={form}
        handleCategoryChange={handleCategoryChange}
        openSubCategorySelector={() => { scrollPos.current = window.scrollY; setBackStep(null); setSelectionStep("subCategory"); }}
      />

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

      <AddProductCondition
        form={form}
        openConditionSelector={() => { scrollPos.current = window.scrollY; setBackStep("model"); setSelectionStep("condition"); }}
        openUsedDetailSelector={() => { scrollPos.current = window.scrollY; setBackStep("condition"); setSelectionStep("usedDetail"); }}
      />

      {getExtraOptions("colors").length > 0 && (
        <Field label="Color">
          <div className="option-item clickable" onClick={() => { scrollPos.current = window.scrollY; setBackStep(null); setSelectionStep("colors"); }}>
            {form.color || "Select Color"}
          </div>
        </Field>
      )}

      {getExtraOptions("storage").length > 0 && (
        <Field label="Storage">
          <div className="option-item clickable" onClick={() => { scrollPos.current = window.scrollY; setBackStep(null); setSelectionStep("storage"); }}>
            {form.storage || "Select Storage"}
          </div>
        </Field>
      )}

      {getExtraOptions("simTypes").length > 0 && (
        <Field label="SIM Type">
          <div className="option-item clickable" onClick={() => { scrollPos.current = window.scrollY; setBackStep(null); setSelectionStep("simTypes"); }}>
            {form.simType || "Select SIM Type"}
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

      <Field label="Description">
        <textarea value={form.description} onChange={e => updateForm("description", e.target.value)} placeholder="Write a detailed description of your product..." />
      </Field>

      <AddProductLocation
        form={form}
        openStateSelector={() => { scrollPos.current = window.scrollY; setBackStep(null); setSelectionStep("state"); }}
        openCitySelector={() => { scrollPos.current = window.scrollY; setBackStep("state"); setSelectionStep("city"); }}
      />

      <Field label="Price (₦)">
        <input value={form.price} onChange={handlePriceChange} placeholder="₦ 0" />
      </Field>

      <Field label="Phone Number">
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

      <AddProductPromotion
        form={form}
        onSelectPlan={handlePromotionClick}
        onTogglePromote={checked => updateForm("isPromoted", checked)}
      />

      <button
        className="btn"
        type="button"
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? "Uploading..." : "Publish"}
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

// ---------------- FullPageList ----------------
export const FullPageList = ({ title, options, valueKey, form, updateForm, setSelectionStep, scrollPos }) => {
  const [search, setSearch] = useState("");
  const [customValue, setCustomValue] = useState("");

  const filtered = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  const handleSelect = val => {
    updateForm(valueKey, val);
    setSelectionStep(null);
    window.scrollTo(0, scrollPos.current || 0);
  };

  const handleCustomSubmit = () => {
    if (customValue.trim()) {
      handleSelect(customValue.trim());
      setCustomValue("");
    }
  };

  return (
    <div className="fullpage-list">
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
            onClick={() => handleSelect(opt)}
          >
            {opt}
          </div>
        ))}

        {/* Custom input */}
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

// ---------------- FullPageMultiSelect ----------------
export const FullPageMultiSelect = ({ title, options, valueKey, form, updateForm, setSelectionStep, scrollPos }) => {
  const [search, setSearch] = useState("");

  const filtered = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  const toggleOption = opt => {
    const current = form[valueKey] || [];
    if (current.includes(opt)) {
      updateForm(valueKey, current.filter(item => item !== opt));
    } else {
      updateForm(valueKey, [...current, opt]);
    }
  };

  const handleDone = () => {
    setSelectionStep(null);
    window.scrollTo(0, scrollPos.current || 0);
  };

  return (
    <div className="fullpage-list">
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
            className={`option-item ${form[valueKey]?.includes(opt) ? "active" : ""}`}
            onClick={() => toggleOption(opt)}
          >
            {opt} {form[valueKey]?.includes(opt) && "✓"}
          </div>
        ))}
      </div>
      <button className="btn" onClick={handleDone}>Done</button>
    </div>
  );
};