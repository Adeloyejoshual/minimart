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
  const [showSuccess, setShowSuccess] = useState(false);

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
    promotionPlan: promotionPlans[0].id,
  });

  const rules = categoryRules[form.mainCategory] || categoryRules.Default;

  /* -------------------- SAFE UPDATE -------------------- */
  const update = (key, value, reset = []) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      reset.forEach(k => (next[k] = ""));
      return next;
    });
  };

  /* -------------------- LOAD DRAFT -------------------- */
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      setForm(prev => ({
        ...prev,
        ...parsed,
        state: "",
        city: "",
      }));
    }

    const savedCat = localStorage.getItem(CATEGORY_KEY);
    if (savedCat) {
      setForm(prev => ({ ...prev, mainCategory: savedCat }));
    }
  }, []);

  /* -------------------- SAVE DRAFT -------------------- */
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    if (form.mainCategory) {
      localStorage.setItem(CATEGORY_KEY, form.mainCategory);
    }
  }, [form]);

  /* -------------------- CLEANUP IMAGES -------------------- */
  useEffect(() => {
    return () => {
      form.previews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [form.previews]);

  /* -------------------- PRICE -------------------- */
  const handlePriceChange = e => {
    const raw = e.target.value.replace(/,/g, "");
    if (!isNaN(raw)) {
      update("priceRaw", raw);
      update("price", raw ? Number(raw).toLocaleString() : "");
    }
  };

  /* -------------------- IMAGES -------------------- */
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

  /* -------------------- VALIDATION -------------------- */
  const validate = () => {
    if (!form.title || form.title.length < rules.minTitle)
      return `Title must be at least ${rules.minTitle} characters`;
    if (!form.mainCategory) return "Select category";
    if (!form.priceRaw) return "Enter price";
    if (!form.phone || form.phone.length < 10) return "Enter valid phone number";
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

  /* -------------------- SUBMIT -------------------- */
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
        ownerId: auth.currentUser.uid,
        marketType,
        createdAt: serverTimestamp(),
      });

      localStorage.removeItem(DRAFT_KEY);
      setShowSuccess(true);

      setTimeout(() => {
        navigate(`/${marketType}`);
      }, 1500);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* -------------------- FULL PAGE LIST -------------------- */
  const FullPageList = ({ title, options, valueKey }) => {
    const [custom, setCustom] = useState("");

    const deps = {
      mainCategory: ["subCategory", "brand", "model", "condition", "usedDetail"],
      subCategory: ["brand", "model", "condition", "usedDetail"],
      brand: ["model", "condition", "usedDetail"],
      model: ["condition", "usedDetail"],
      condition: ["usedDetail"],
      state: ["city"],
    };

    return (
      <div className="fullpage-list">
        {backStep && (
          <button
            type="button"
            className="options-back"
            onClick={() => setSelectionStep(backStep)}
          >
            ← Back
          </button>
        )}

        <h3>{title}</h3>

        <div className="options-scroll">
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              className={`option-item ${
                form[valueKey] === opt ? "active" : ""
              }`}
              onClick={() => {
                update(valueKey, opt, deps[valueKey] || []);
                setSelectionStep(null);
              }}
            >
              {opt}
            </button>
          ))}

          <form
            onSubmit={e => {
              e.preventDefault();
              if (!custom.trim()) return;
              update(valueKey, custom.trim(), deps[valueKey] || []);
              setCustom("");
              setSelectionStep(null);
            }}
          >
            <div className="option-item">
              <input
                placeholder={`Enter ${valueKey}`}
                value={custom}
                onChange={e => setCustom(e.target.value)}
              />
              <button type="submit">Add</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  /* -------------------- OPTIONS -------------------- */
  const getSubcategories =
    categories.find(c => c.name === form.mainCategory)?.subcategories || [];
  const getBrands = Object.keys(phoneModels[form.mainCategory] || {});
  const getModels =
    form.brand && phoneModels[form.mainCategory]
      ? phoneModels[form.mainCategory][form.brand] || []
      : [];

  /* -------------------- FULL SCREEN RENDER -------------------- */
  if (selectionStep) {
    const map = {
      subCategory: getSubcategories,
      brand: getBrands,
      model: getModels,
      state: () => Object.keys(locationsByState),
      city: () => locationsByState[form.state] || [],
      condition: () => conditions.main,
      usedDetail: () => conditions.usedDetails,
    };

    return (
      <FullPageList
        title={`Select ${selectionStep}`}
        options={map[selectionStep]()}
        valueKey={selectionStep}
      />
    );
  }

  /* -------------------- MAIN FORM -------------------- */
  return (
    <div className="add-product-container">
      {showSuccess && (
        <div className="success-toast">
          <span>🎉 Product posted successfully</span>
        </div>
      )}

      <header className="add-product-header">
        <button onClick={() => navigate(`/${marketType}`)}>←</button>
        <span>Add Product</span>
      </header>

      <Field label="Title">
        <input
          value={form.title}
          onChange={e => update("title", e.target.value)}
        />
      </Field>

      <Field label="Category">
        <div className="category-scroll">
          {categories.map(cat => (
            <button
              key={cat.name}
              type="button"
              className={form.mainCategory === cat.name ? "active" : ""}
              onClick={() =>
                update("mainCategory", cat.name, [
                  "subCategory",
                  "brand",
                  "model",
                  "condition",
                  "usedDetail",
                ])
              }
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </Field>

      {form.mainCategory && (
        <Select label="Subcategory" value={form.subCategory} onClick={() => {
          setBackStep(null);
          setSelectionStep("subCategory");
        }} />
      )}

      {form.subCategory && (
        <Select label="Brand" value={form.brand} onClick={() => {
          setBackStep("subCategory");
          setSelectionStep("brand");
        }} />
      )}

      {form.brand && (
        <Select label="Model" value={form.model} onClick={() => {
          setBackStep("brand");
          setSelectionStep("model");
        }} />
      )}

      <Field label="Price">
        <input value={form.price} onChange={handlePriceChange} />
      </Field>

      <Field label="State">
        <button
          onClick={() => {
            update("state", "", ["city"]);
            setBackStep(null);
            setSelectionStep("state");
          }}
        >
          {form.state || "Select State"}
        </button>
      </Field>

      {form.state && (
        <Field label="City">
          <button
            onClick={() => {
              setBackStep("state");
              setSelectionStep("city");
            }}
          >
            {form.city || "Select City"}
          </button>
        </Field>
      )}

      <button className="btn" onClick={handleSubmit} disabled={loading}>
        {loading ? "Uploading..." : "Publish"}
      </button>
    </div>
  );
}

/* -------------------- UI HELPERS -------------------- */
const Field = ({ label, children }) => (
  <div className="field">
    <label>{label}</label>
    {children}
  </div>
);

const Select = ({ label, value, onClick }) => (
  <Field label={label}>
    <button onClick={onClick}>{value || `Select ${label}`}</button>
  </Field>
);