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

  // -------------------- STATE --------------------
  const [loading, setLoading] = useState(false);
  const [selectionStep, setSelectionStep] = useState(null);
  const [backStep, setBackStep] = useState(null);
  const [toasts, setToasts] = useState([]);

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

  // -------------------- DRAFT --------------------
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) setForm(JSON.parse(saved));

    const savedCat = localStorage.getItem(CATEGORY_KEY);
    if (savedCat) {
      setForm(prev => ({ ...prev, mainCategory: savedCat }));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    if (form.mainCategory) {
      localStorage.setItem(CATEGORY_KEY, form.mainCategory);
    }
  }, [form]);

  // -------------------- TOAST --------------------
  const addToast = (msg, type = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => {
      setToasts(t => t.filter(x => x.id !== id));
    }, 3000);
  };

  // -------------------- HELPERS --------------------
  const update = (key, value, reset = []) => {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      reset.forEach(r => (next[r] = ""));
      return next;
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
    if (form.images.length + list.length > rules.maxImages) {
      return addToast(`Max ${rules.maxImages} images`, "error");
    }

    update("images", [...form.images, ...list]);
    update("previews", [
      ...form.previews,
      ...list.map(f => URL.createObjectURL(f)),
    ]);
  };

  const removeImage = i => {
    update("images", form.images.filter((_, x) => x !== i));
    update("previews", form.previews.filter((_, x) => x !== i));
  };

  // -------------------- VALIDATION --------------------
  const validate = () => {
    if (!form.title || form.title.length < rules.minTitle)
      return `Title must be ${rules.minTitle}+ chars`;

    if (!form.mainCategory) return "Select category";
    if (!form.subCategory) return "Select subcategory";
    if (!form.priceRaw) return "Enter price";
    if (!form.phone || form.phone.length < 10) return "Invalid phone";
    if (!form.state) return "Select state";
    if (!form.city) return "Select city";
    if (form.images.length < rules.minImages)
      return `Upload at least ${rules.minImages} image(s)`;

    if (
      (form.subCategory === "Smartphones" ||
        form.subCategory === "Feature Phones") &&
      !form.condition
    ) {
      return "Select condition";
    }

    if (form.condition === "Used" && !form.usedDetail) {
      return "Select used details";
    }

    return null;
  };

  // -------------------- SUBMIT --------------------
  const handleSubmit = async () => {
    const error = validate();
    if (error) return addToast(error, "error");
    if (!auth.currentUser) return addToast("Login required", "error");

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
      addToast("Product posted successfully");
      navigate(`/${marketType}`);
    } catch (e) {
      addToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // -------------------- OPTIONS --------------------
  const subcategories =
    categories.find(c => c.name === form.mainCategory)?.subcategories || [];

  // 🔥 FIX: phoneModels depend on SUBCATEGORY
  const brandOptions =
    phoneModels[form.subCategory]
      ? Object.keys(phoneModels[form.subCategory])
      : [];

  const modelOptions =
    phoneModels[form.subCategory]?.[form.brand] || [];

  const stateOptions = Object.keys(locationsByState);
  const cityOptions = form.state ? locationsByState[form.state] : [];

  // -------------------- FULL PAGE SELECT --------------------
  const FullPageList = ({ title, options, value }) => (
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
          <button
            key={opt}
            className={`option-item ${
              form[value] === opt ? "active" : ""
            }`}
            onClick={() => {
              const reset = {
                mainCategory: ["subCategory", "brand", "model"],
                subCategory: ["brand", "model", "condition", "usedDetail"],
                brand: ["model"],
                state: ["city"],
              };
              update(value, opt, reset[value] || []);
              setSelectionStep(null);
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  if (selectionStep) {
    const map = {
      subCategory: subcategories,
      brand: brandOptions,
      model: modelOptions,
      state: stateOptions,
      city: cityOptions,
      condition: conditions.main,
      usedDetail: conditions.usedDetails,
    };

    return (
      <FullPageList
        title={`Select ${selectionStep}`}
        options={map[selectionStep]}
        value={selectionStep}
      />
    );
  }

  // -------------------- UI --------------------
  return (
    <div className="add-product-container">
      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.msg}
          </div>
        ))}
      </div>

      {/* Header */}
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
          {categories.map(c => (
            <button
              key={c.name}
              className={`category-item ${
                form.mainCategory === c.name ? "active" : ""
              }`}
              onClick={() =>
                update("mainCategory", c.name, [
                  "subCategory",
                  "brand",
                  "model",
                ])
              }
            >
              <span>{c.icon}</span>
              {c.name}
            </button>
          ))}
        </div>
      </Field>

      {form.mainCategory && (
        <Field label="Subcategory">
          <button
            className="option-item clickable"
            onClick={() => setSelectionStep("subCategory")}
          >
            {form.subCategory || "Select"}
          </button>
        </Field>
      )}

      {form.subCategory && brandOptions.length > 0 && (
        <Field label="Brand">
          <button
            className="option-item clickable"
            onClick={() => {
              setBackStep("subCategory");
              setSelectionStep("brand");
            }}
          >
            {form.brand || "Select"}
          </button>
        </Field>
      )}

      {form.brand && (
        <Field label="Model">
          <button
            className="option-item clickable"
            onClick={() => {
              setBackStep("brand");
              setSelectionStep("model");
            }}
          >
            {form.model || "Select"}
          </button>
        </Field>
      )}

      <Field label="Price">
        <input value={form.price} onChange={handlePriceChange} />
      </Field>

      <Field label="Phone">
        <input
          value={form.phone}
          onChange={e => update("phone", e.target.value)}
        />
      </Field>

      <Field label="Images">
        <input type="file" multiple onChange={e => handleImages(e.target.files)} />
        <div className="images">
          {form.previews.map((p, i) => (
            <div key={i}>
              <img src={p} alt="" />
              <button onClick={() => removeImage(i)}>×</button>
            </div>
          ))}
        </div>
      </Field>

      <Field label="State">
        <button
          className="option-item clickable"
          onClick={() => setSelectionStep("state")}
        >
          {form.state || "Select"}
        </button>
      </Field>

      {form.state && (
        <Field label="City / LGA">
          <button
            className="option-item clickable"
            onClick={() => {
              setBackStep("state");
              setSelectionStep("city");
            }}
          >
            {form.city || "Select"}
          </button>
        </Field>
      )}

      <Field label="Description">
        <textarea
          value={form.description}
          onChange={e => update("description", e.target.value)}
        />
      </Field>

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