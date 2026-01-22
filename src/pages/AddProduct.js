// src/pages/AddProduct.js import { useEffect, useState, useRef, useCallback } from "react"; import { addDoc, collection, serverTimestamp } from "firebase/firestore"; import { db, auth } from "../firebase"; import { uploadToCloudinary } from "../cloudinary"; import { useNavigate, useSearchParams } from "react-router-dom"; import categoriesData from "../config/categoriesData"; import categoryRules from "../config/categoryRules"; import { locationsByState } from "../config/locationsByState"; import { promotionPlans } from "../config/promotionPlans"; import conditionConfig from "../config/conditions"; import phoneModels from "../config/phoneModels"; import AddProductCategory from "../components/AddProductCategory"; import AddProductPromotion from "../components/AddProductPromotion"; import AddProductCondition from "../components/AddProductCondition"; import AddProductLocation from "../components/AddProductLocation"; import Toast from "../components/Toast"; import "./AddProduct.css";

const DRAFT_KEY = "add_product_draft"; const CATEGORY_KEY = "selected_category";

export default function AddProduct() { const navigate = useNavigate(); const [params] = useSearchParams(); const marketType = params.get("market") || "marketplace";

const scrollPos = useRef(0); const [loading, setLoading] = useState(false); const [toast, setToast] = useState({ visible: false, message: "", icon: "⚡" }); const [selectionStep, setSelectionStep] = useState(null); const [backStep, setBackStep] = useState(null); const [draftBanner, setDraftBanner] = useState(false); const [offlineQueue, setOfflineQueue] = useState([]);

const [form, setForm] = useState({ title: "", mainCategory: "", subCategory: "", brand: "", model: "", condition: "", usedDetail: "", price: "", phone: "", description: "", state: "", city: "", images: [], previews: [], color: "", storage: "", simType: "", features: [], type: "", isPromoted: false, promotionPlan: null, paymentSuccess: false, negotiation: "", });

const rules = categoryRules[form.mainCategory] || categoryRules.Default;

// ---------------- Draft Load/Save ---------------- useEffect(() => { const saved = localStorage.getItem(DRAFT_KEY); if (saved) { const parsed = JSON.parse(saved); setForm(prev => ({ ...prev, ...parsed, previews: parsed.images?.map(img => URL.createObjectURL(img)) || [], })); if (parsed.title || parsed.mainCategory) setDraftBanner(true); } const savedCat = localStorage.getItem(CATEGORY_KEY); if (savedCat) setForm(prev => ({ ...prev, mainCategory: savedCat })); }, []);

useEffect(() => { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); if (form.mainCategory) localStorage.setItem(CATEGORY_KEY, form.mainCategory); }, [form]);

useEffect(() => { return () => form.previews.forEach(url => URL.revokeObjectURL(url)); }, [form.previews]);

// ---------------- Toast ---------------- const showToast = useCallback((message, icon = "⚡", duration = 3000) => { setToast({ visible: true, message, icon }); setTimeout(() => setToast(prev => ({ ...prev, visible: false })), duration); }, []);

// ---------------- Helpers ---------------- const updateForm = useCallback((key, value) => setForm(prev => ({ ...prev, [key]: value })), []); const resetDependentFields = keys => keys.forEach(k => updateForm(k, ""));

const handleCategoryFlowClick = (field, nextStep) => { scrollPos.current = window.scrollY; setBackStep(field); setSelectionStep(nextStep); };

// ---------------- Category / Location / Price ---------------- const handleSubCategoryChange = subCat => { updateForm("subCategory", subCat); resetDependentFields(["brand","model","condition","usedDetail","color","storage","simType","features"]); };

const handleStateChange = state => { updateForm("state", state); updateForm("city", ""); };

const handlePriceChange = e => { const raw = e.target.value.replace(/,/g, ""); if (!isNaN(raw) || raw === "") { updateForm("price", raw.replace(/\B(?=(\d{3})+(?!\d))/g, ",")); } };

const handleImages = files => { const list = Array.from(files); if (list.length + form.images.length > rules.maxImages) return showToast(Maximum ${rules.maxImages} images allowed, "⚠️"); updateForm("images", [...form.images, ...list]); updateForm("previews", [...form.previews, ...list.map(f => URL.createObjectURL(f))]); };

const removeImage = index => { updateForm("images", form.images.filter((, i) => i !== index)); updateForm("previews", form.previews.filter((, i) => i !== index)); };

// ---------------- Validation ---------------- const validateForm = () => { if (!form.title || form.title.length < rules.minTitle) return Title must be at least ${rules.minTitle} characters; if (!form.mainCategory) return "Select category"; if (!form.price) return "Enter price"; if (!form.phone || form.phone.length < 10) return "Enter valid phone number"; if (form.images.length < rules.minImages) return Upload at least ${rules.minImages} image(s);

const catData = categoriesData[form.mainCategory];
if (catData) {
  if (catData.brands?.[form.subCategory]?.length > 0 && !form.brand) return "Select brand";
  if (form.subCategory === "Mobile Phones" && form.brand && !form.model) return "Select model";
  if (conditionConfig[form.mainCategory]?.main?.length > 0 && !form.condition) return "Select condition";
  if (form.condition === "Used" && conditionConfig[form.mainCategory]?.usedDetails?.length > 0 && !form.usedDetail) return "Select used detail";
  if (catData.options?.colors?.length > 0 && !form.color) return "Select color";
  if (catData.options?.storage?.length > 0 && !form.storage) return "Select storage";
  if (catData.options?.simTypes?.length > 0 && !form.simType) return "Select SIM type";
}

if (!form.description || form.description.length < 10) return "Enter description (min 10 chars)";
if (!form.state) return "Select state";
if (!form.city) return "Select city / LGA";
if (!form.negotiation) return "Select negotiation option";

return null;

};

// ---------------- Derived Options ---------------- const getSubcategories = () => categoriesData[form.mainCategory]?.subcategories || []; const getBrandOptions = () => form.subCategory ? categoriesData[form.mainCategory]?.brands?.[form.subCategory] || [] : []; const getModelOptions = () => { if (form.subCategory === "Mobile Phones" && form.brand) return phoneModels.Smartphones[form.brand] || []; return categoriesData[form.mainCategory]?.models?.[form.brand] || []; }; const getConditionOptions = () => conditionConfig[form.mainCategory]?.main || ["New","Used"]; const getUsedDetailOptions = () => conditionConfig[form.mainCategory]?.usedDetails || ["No defects"]; const getExtraOptions = field => categoriesData[form.mainCategory]?.options?.[field] || []; const getStateOptions = () => Object.keys(locationsByState); const getCityOptions = () => form.state ? locationsByState[form.state] : [];

// ---------------- FullPage Selectors & Flow ---------------- if (selectionStep) { switch(selectionStep){ case "subCategory": return <FullPageList title="Select Subcategory" options={getSubcategories()} valueKey="subCategory" form={form} updateForm={updateForm} setSelectionStep={setSelectionStep} scrollPos={scrollPos} />; case "brand": return <FullPageList title="Select Brand" options={getBrandOptions()} valueKey="brand" form={form} updateForm={updateForm} setSelectionStep={setSelectionStep} scrollPos={scrollPos} />; case "model": return <FullPageList title="Select Model" options={getModelOptions()} valueKey="model" form={form} updateForm={updateForm} setSelectionStep={setSelectionStep} scrollPos={scrollPos} />; case "condition": return <FullPageList title="Select Condition" options={getConditionOptions()} valueKey="condition" form={form} updateForm={updateForm} setSelectionStep={setSelectionStep} scrollPos={scrollPos} />; case "usedDetail": return <FullPageList title="Select Used Detail" options={getUsedDetailOptions()} valueKey="usedDetail" form={form} updateForm={updateForm} setSelectionStep={setSelectionStep} scrollPos={scrollPos} />; case "colors": return <FullPageList title="Select Color" options={getExtraOptions("colors")} valueKey="color" form={form} updateForm={updateForm} setSelectionStep={setSelectionStep} scrollPos={scrollPos} />; case "storage": return <FullPageList title="Select Storage" options={getExtraOptions("storage")} valueKey="storage" form={form} updateForm={updateForm} setSelectionStep={setSelectionStep} scrollPos={scrollPos} />; case "simTypes": return <FullPageList title="Select SIM Type" options={getExtraOptions("simTypes")} valueKey="simType" form={form} updateForm={updateForm} setSelectionStep={setSelectionStep} scrollPos={scrollPos} />; case "features": return <FullPageMultiSelect title="Select Features" options={getExtraOptions("features")} valueKey="features" form={form} updateForm={updateForm} setSelectionStep={setSelectionStep} scrollPos={scrollPos} />; case "state": return <FullPageList title="Select State" options={getStateOptions()} valueKey="state" form={form} updateForm={updateForm} setSelectionStep={setSelectionStep} scrollPos={scrollPos} />; case "city": return <FullPageList title="Select City / LGA" options={getCityOptions()} valueKey="city" form={form} updateForm={updateForm} setSelectionStep={setSelectionStep} scrollPos={scrollPos} />; default: break; } }

// ---------------- Main Form ---------------- return ( <div className="add-product-container">

{draftBanner && <div className="draft-banner">Restored draft. Continue editing.</div>}

  <div className="add-product-header">
    <button className="back-btn" onClick={() => navigate(`/${marketType}`)}>←</button>
    <span className="page-title">Add Product</span>
  </div>

  <Field label="Title">
    <input value={form.title} onChange={e => updateForm("title", e.target.value)} placeholder="e.g iPhone 11 Pro Max" />
  </Field>

  {/* Subcategory */}
  <AddProductCategory
    form={form}
    handleCategoryChange={handleSubCategoryChange}
    openSubCategorySelector={() => handleCategoryFlowClick("mainCategory", "subCategory")}
  />

  {/* Brand */}
  {form.subCategory && getBrandOptions().length > 0 && (
    <Field label="Brand">
      <div className="option-item clickable" onClick={() => handleCategoryFlowClick("subCategory","brand")}>{form.brand || "Select Brand"}</div>
    </Field>
  )}

  {/* Model */}
  {form.brand && getModelOptions().length > 0 && (
    <Field label="Model / Type">
      <div className="option-item clickable" onClick={() => handleCategoryFlowClick("brand","model")}>{form.model || "Select Model"}</div>
    </Field>
  )}

  {/* Condition & Used Detail */}
  {form.brand && (
    <AddProductCondition
      form={form}
      openConditionSelector={() => handleCategoryFlowClick("model","condition")}
      openUsedDetailSelector={() => handleCategoryFlowClick("condition","usedDetail")}
    />
  )}

  {/* Extra options */}
  {form.condition && getExtraOptions("colors").length > 0 && (
    <Field label="Color">
      <div className="option-item clickable" onClick={() => handleCategoryFlowClick("usedDetail","colors")}>{form.color || "Select Color"}</div>
    </Field>
  )}

  {form.color && getExtraOptions("storage").length > 0 && (
    <Field label="Storage">
      <div className="option-item clickable" onClick={() => handleCategoryFlowClick("colors","storage")}>{form.storage || "Select Storage"}</div>
    </Field>
  )}

  {form.storage && getExtraOptions("simTypes").length > 0 && (
    <Field label="SIM Type">
      <div className="option-item clickable" onClick={() => handleCategoryFlowClick("storage","simTypes")}>{form.simType || "Select SIM Type"}</div>
    </Field>
  )}

  {form.simType && getExtraOptions("features").length > 0 && (
    <Field label="Features">
      <div className="option-item clickable" onClick={() => handleCategoryFlowClick("simTypes","features")}>{form.features.length > 0 ? form.features.join(", ") : "Select Features"}</div>
    </Field>
  )}

  {/* Description */}
  <Field label="Description">
    <textarea value={form.description} onChange={e => updateForm("description", e.target.value)} placeholder="Write a detailed description..." />
  </Field>

  {/* Negotiation */}
  <Field label="Are you open to negotiation?">
    <div className="option-group">
      {['Yes','No','Not sure'].map(opt => (
        <div key={opt} className={`option-item ${form.negotiation === opt ? 'active':''}`} onClick={() => updateForm('negotiation',opt)}>{opt}</div>
      ))}
    </div>
  </Field>

  {/* Location */}
  <AddProductLocation
    form={form}
    openStateSelector={() => handleCategoryFlowClick(null,'state')}
    openCitySelector={() => handleCategoryFlowClick('state','city')}
    handleStateChange={handleStateChange}
  />

  {/* Price & Phone */}
  <Field label="Price (₦)"><input value={form.price} onChange={handlePriceChange} placeholder="₦ 0" /></Field>
  <Field label="Phone Number"><input type="tel" value={form.phone} onChange={e => updateForm("phone", e.target.value)} placeholder="08012345678" /></Field>

  {/* Images & Promotions */}
  <Field label="Images">
    <label className="image-upload">
      <input type="file" multiple hidden onChange={e => handleImages(e.target.files)} />
      <span>＋ Add Images</span>
    </label>
    <div className="images">{form.previews.map((p,i) => <div key={i} className="img-wrap"><img src={p} alt={`preview-${i}`} /><button onClick={()=>removeImage(i)}>×</button></div>)}</div>
  </Field>

  <AddProductPromotion form={form} onSelectPlan={plan => {/* handle */}} onTogglePromote={checked=>updateForm('isPromoted',checked)} />

  <button className="btn" onClick={() => {/* handle submit */}} disabled={loading}>{loading?'Uploading...':'Publish'}</button>

  <Toast message={toast.message} icon={toast.icon} visible={toast.visible} />
</div>

); }

// ---------------- Field Component ---------------- const Field = ({ label, children }) => <div className="field"><label>{label}</label>{children}</div>;
