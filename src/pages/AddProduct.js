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
    priceRaw: "",
    price: "",
    phone: "",
    description: "",
    state: "",
    city: "",
    images: [],
    previews: [],
    isPromoted: false,
    promotionPlan: promotionPlans[0].id,
  });

  const rules = categoryRules[form.mainCategory] || categoryRules.Default;

  // Load draft
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) setForm(JSON.parse(saved));

    const savedCat = localStorage.getItem(CATEGORY_KEY);
    if (savedCat) setForm(prev => ({ ...prev, mainCategory: savedCat }));
  }, []);

  // Save draft
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    if (form.mainCategory) {
      localStorage.setItem(CATEGORY_KEY, form.mainCategory);
    }
  }, [form]);

  // Cleanup previews
  useEffect(() => {
    return () => form.previews.forEach(url => URL.revokeObjectURL(url));
  }, [form.previews]);

  const update = (key, value) =>
    setForm(prev => ({ ...prev, [key]: value }));

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
      alert(`Maximum ${rules.maxImages} images allowed`);
      return;
    }

    update("images", [...form.images, ...list]);
    update(
      "previews",
      [...form.previews, ...list.map(f => URL.createObjectURL(f))]
    );
  };

  const removeImage = index => {
    update("images", form.images.filter((_, i) => i !== index));
    update("previews", form.previews.filter((_, i) => i !== index));
  };

  const validate = () => {
    if (!form.title || form.title.length < rules.minTitle)
      return `Title must be at least ${rules.minTitle} characters`;
    if (!form.mainCategory) return "Select category";
    if (!form.priceRaw) return "Enter price";
    if (!form.phone || form.phone.length < 10)
      return "Enter valid phone number";
    if (form.images.length < rules.minImages)
      return `Upload at least ${rules.minImages} image(s)`;
    if (
      (form.mainCategory === "Smartphones" ||
        form.mainCategory === "FeaturePhones") &&
      form.model &&
      !form.condition
    )
      return "Select condition";
    if (form.condition === "Used" && !form.usedDetail)
      return "Select used detail";
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
      const uploaded = await Promise.all(
        form.images.map(img => uploadToCloudinary(img))
      );

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
      alert("Product posted successfully");
      navigate(`/${marketType}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Full Page Selector ----------
  const FullPageList = ({ title, options, valueKey }) => {
    const [customValue, setCustomValue] = useState("");

    const submitCustom = () => {
      if (!customValue.trim()) return;
      update(valueKey, customValue.trim());
      setCustomValue("");
      setSelectionStep(null);
    };

    return (
      <div className="fullpage-list">
        {backStep && (
          <button
            className="options-back"
            onClick={() => setSelectionStep(backStep)}
          >
            ← Back
          </button>
        )}

        <h3>{title}</h3>

        <div className="options-scroll">
          {options.map(opt => (
            <div
              key={opt}
              className={`option-item ${
                form[valueKey] === opt ? "active" : ""
              }`}
              onClick={() => {
                update(valueKey, opt);
                if (valueKey === "state") update("city", "");
                if (valueKey === "mainCategory") {
                  update("subCategory", "");
                  update("brand", "");
                  update("model", "");
                  update("condition", "");
                  update("usedDetail", "");
                }
                if (valueKey === "subCategory") {
                  update("brand", "");
                  update("model", "");
                  update("condition", "");
                  update("usedDetail", "");
                }
                if (valueKey === "brand") {
                  update("model", "");
                  update("condition", "");
                  update("usedDetail", "");
                }
                if (valueKey === "condition") update("usedDetail", "");
                setSelectionStep(null);
              }}
            >
              {opt}
            </div>
          ))}

          <form
            onSubmit={e => {
              e.preventDefault();
              submitCustom();
            }}
          >
            <div className="option-item">
              <input
                value={customValue}
                onChange={e => setCustomValue(e.target.value)}
                placeholder={`Enter ${valueKey}`}
              />
              <button type="submit">Add</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // ---------- Derived Options ----------
  const getSubcategories = () =>
    categories.find(c => c.name === form.mainCategory)?.subcategories || [];
  const getBrandOptions = () =>
    Object.keys(phoneModels[form.mainCategory] || {});
  const getModelOptions = () =>
    phoneModels[form.mainCategory]?.[form.brand] || [];
  const getStateOptions = () => Object.keys(locationsByState);
  const getCityOptions = () =>
    form.state ? locationsByState[form.state] : [];

  // ---------- Selection Screens ----------
  if (selectionStep) {
    const map = {
      subCategory: getSubcategories(),
      brand: getBrandOptions(),
      model: getModelOptions(),
      state: getStateOptions(),
      city: getCityOptions(),
      condition: conditions.main,
      usedDetail: conditions.usedDetails,
    };

    return (
      <FullPageList
        title={`Select ${selectionStep}`}
        options={map[selectionStep]}
        valueKey={selectionStep}
      />
    );
  }

  // ---------- Main Form ----------
  return (
    <div className="add-product-container">
      <div className="add-product-header">
        <button onClick={() => navigate(`/${marketType}`)}>←</button>
        <span>Add Product</span>
      </div>

      <Field label="Title">
        <input
          value={form.title}
          onChange={e => update("title", e.target.value)}
        />
      </Field>

      <Field label="Category">
        <div className="category-scroll">
          {categories.map(cat => (
            <div
              key={cat.name}
              className={`category-item ${
                form.mainCategory === cat.name ? "active" : ""
              }`}
              onClick={() => update("mainCategory", cat.name)}
            >
              {cat.icon} {cat.name}
            </div>
          ))}
        </div>
      </Field>

      {form.mainCategory && (
        <Field label="Subcategory">
          <div
            className="option-item clickable"
            onClick={() => setSelectionStep("subCategory")}
          >
            {form.subCategory || "Select subcategory"}
          </div>
        </Field>
      )}

      <button className="btn" onClick={handleSubmit} disabled={loading}>
        {loading ? "Uploading..." : "Publish"}
      </button>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div className="field">
    <label>{label}</label>
    {children}
  </div>
);