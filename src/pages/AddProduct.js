// src/pages/AddProduct.js
import { useEffect, useState, useRef, useCallback } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate, useSearchParams } from "react-router-dom";
import categories from "../config/categories";
import categoryRules from "../config/categoryRules";
import { locationsByState } from "../config/locationsByState";
import productOptions from "../config/productOptions";
import phoneModels from "../config/phoneModels";
import { promotionPlans } from "../config/promotionPlans";
import conditions from "../config/conditions";
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

  // ---------------- Category / State Selection Fix ----------------
  const handleCategoryChange = cat => {
    updateForm("mainCategory", cat);
    updateForm("subCategory", "");
    updateForm("brand", "");
    updateForm("model", "");
    updateForm("condition", "");
    updateForm("usedDetail", "");
    updateForm("features", []);
    updateForm("type", "");
  };

  const handleStateChange = state => {
    updateForm("state", state);
    updateForm("city", "");
  };

  // ---------------- Validation ----------------
  const validateForm = () => {
    if (!form.title || form.title.length < rules.minTitle) return `Title must be at least ${rules.minTitle} characters`;
    if (!form.mainCategory) return "Select category";
    if (!form.price) return "Enter price";
    if (!form.phone || form.phone.length < 10) return "Enter valid phone number";
    if (form.images.length < rules.minImages) return `Upload at least ${rules.minImages} image(s)`;
    if (["Smartphones", "Feature Phones"].includes(form.subCategory) && form.model && !form.condition) return "Select condition";
    if (form.condition && form.condition !== "New" && !form.usedDetail) return "Select used detail";
    if (!form.state) return "Select state";
    if (!form.city) return "Select city / LGA";
    return null;
  };

  // ---------------- Paystack Payment ----------------
  const payWithPaystack = async plan => {
    if (!plan || plan.price <= 0) return;
    if (!auth.currentUser) return showToast("Login required", "🔒");

    if (!window.PaystackPop) {
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.onload = () => payWithPaystack(plan);
      document.body.appendChild(script);
      return showToast("Payment system loading…", "⏳");
    }

    const handler = window.PaystackPop.setup({
      key: process.env.REACT_APP_PAYSTACK_KEY,
      email: auth.currentUser.email,
      amount: plan.price * 100,
      currency: "NGN",
      ref: `promo_${Date.now()}`,
      metadata: { promotionPlanId: plan.id },
      callback: () => {
        const updated = {
          ...form,
          promotionPlan: { ...plan, paid: true },
          isPromoted: true,
          paymentSuccess: true,
        };
        setForm(updated);
        localStorage.setItem(DRAFT_KEY, JSON.stringify(updated));
        showToast("Payment successful ✅", "⚡");
      },
      onClose: () => {
        const updated = {
          ...form,
          promotionPlan: { ...plan, paid: false },
          isPromoted: false,
          paymentSuccess: false,
        };
        setForm(updated);
        showToast("Payment cancelled", "❌");
      },
    });

    handler.openIframe();
  };

  const handlePromotionClick = plan => {
    if (!plan) return;

    // Reset previous payment if plan changes
    if (form.promotionPlan?.id !== plan.id) {
      updateForm("promotionPlan", { ...plan, paid: false });
      updateForm("isPromoted", false);
      updateForm("paymentSuccess", false);
    }

    if (plan.type === "paid") {
      payWithPaystack(plan);
    } else {
      const updated = {
        ...form,
        promotionPlan: { ...plan, paid: true },
        isPromoted: true,
        paymentSuccess: true,
      };
      setForm(updated);
      localStorage.setItem(DRAFT_KEY, JSON.stringify(updated));
      showToast(`${plan.label} selected`, "⚡");
    }
  };

  // ---------------- Submit ----------------
  const handleSubmit = async () => {
    const error = validateForm();
    if (error) return showToast(error, "⚠️");
    if (!auth.currentUser) return showToast("Login required", "🔒");
    if (form.promotionPlan?.type === "paid" && !form.paymentSuccess) return showToast("Please complete payment first", "⚠️");

    try {
      setLoading(true);

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
  const getSubcategories = () => categories.find(c => c.name === form.mainCategory)?.subcategories || [];
  const getBrandOptions = () => form.subCategory ? Object.keys(phoneModels[form.subCategory] || {}) : [];
  const getModelOptions = () => form.subCategory && form.brand ? phoneModels[form.subCategory][form.brand] || [] : [];
  const getStateOptions = () => Object.keys(locationsByState);
  const getCityOptions = () => form.state ? locationsByState[form.state] : [];
  const getExtraOptions = field => {
    if (!form.mainCategory || !form.subCategory) return [];
    const subcatOptions = productOptions[form.mainCategory]?.subcategories[form.subCategory] || {};
    return Array.isArray(subcatOptions[field]) ? subcatOptions[field] : [];
  };

  const showConditionField = () => {
    if (!form.subCategory) return false;
    const cat = conditions[form.mainCategory];
    return cat?.main?.length > 0;
  };
  const showUsedDetailField = () => {
    if (!form.condition || form.condition === "New") return false;
    const cat = conditions[form.mainCategory];
    return cat?.usedDetails?.length > 0;
  };

  // ---------------- Render ----------------
  if (selectionStep) {
    switch (selectionStep) {
      case "subCategory": return <FullPageList title="Select Subcategory" options={getSubcategories()} valueKey="subCategory" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
      case "brand": return <FullPageList title="Select Brand" options={getBrandOptions()} valueKey="brand" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
      case "model": return <FullPageList title="Select Model" options={getModelOptions()} valueKey="model" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
      case "condition": return <FullPageList title="Select Condition" options={conditions[form.mainCategory]?.main || ["New", "Used"]} valueKey="condition" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
      case "usedDetail": return <FullPageList title="Select Used Detail" options={conditions[form.mainCategory]?.usedDetails || ["Like New", "Good", "Fair"]} valueKey="usedDetail" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
      case "colors": return <FullPageList title="Select Color" options={getExtraOptions("colors")} valueKey="color" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
      case "simTypes": return <FullPageList title="Select SIM Type" options={getExtraOptions("simTypes")} valueKey="simType" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
      case "types": return <FullPageList title="Select Type" options={getExtraOptions("types")} valueKey="type" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
      case "state": return <FullPageList title="Select State" options={getStateOptions()} valueKey="state" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
      case "city": return <FullPageList title="Select City / LGA" options={getCityOptions()} valueKey="city" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
      case "features": return <FullPageMultiSelect title="Select Features" options={getExtraOptions("features")} valueKey="features" setSelectionStep={setSelectionStep} updateForm={updateForm} form={form} scrollPos={scrollPos} />;
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

      <Field label="Description">
        <textarea value={form.description} onChange={e => updateForm("description", e.target.value)} placeholder="Describe your product..." />
      </Field>

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

      <Field label="Promotion Plan">
        <div className="promotion-scroll">
          {promotionPlans.map(plan => (
            <div
              key={plan.id}
              className={`promotion-item ${form.promotionPlan?.id === plan.id ? "active" : ""}`}
              onClick={() => handlePromotionClick(plan)}
            >
              <span className="promotion-icon">{plan.icon}</span>
              <span>{plan.label}</span>
              <span className="promotion-days">{plan.days} days</span>
              <span className="promotion-price">{plan.price > 0 ? `₦${plan.price}` : "Free"}</span>
            </div>
          ))}
        </div>
        <div className="promotion-toggle">
          <label>
            <input
              type="checkbox"
              checked={form.isPromoted}
              onChange={e => updateForm("isPromoted", e.target.checked)}
            />{" "}
            Promote this product
          </label>
        </div>
      </Field>

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

  const handleSelect = (val) => {
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

  const toggleOption = (opt) => {
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