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
import "./AddProduct.css";

const DRAFT_KEY = "add_product_draft";
const CATEGORY_KEY = "selected_category";

export default function AddProduct() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const marketType = params.get("market") || "marketplace";

  const [loading, setLoading] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

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
    isPromoted: false,
  });

  const rules = categoryRules[form.mainCategory] || categoryRules.Default;

  /* -------------------- DRAFT (AUTO SAVE) -------------------- */
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

  const update = (key, value) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handlePriceChange = (e) => {
    const raw = e.target.value.replace(/,/g, "");
    if (!isNaN(raw)) {
      update("price", Number(raw).toLocaleString());
    }
  };

  const handleImages = (files) => {
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

  const removeImage = (index) => {
    update("images", form.images.filter((_, i) => i !== index));
    update("previews", form.previews.filter((_, i) => i !== index));
  };

  const validate = () => {
    if (!form.title || form.title.length < rules.minTitle)
      return `Title must be at least ${rules.minTitle} characters`;
    if (!form.mainCategory) return "Select category";
    if (!form.price) return "Enter price";
    if (!form.phone || form.phone.length < 10) return "Enter valid phone number";
    if (form.images.length < rules.minImages)
      return `Upload at least ${rules.minImages} image(s)`;
    if (
      form.mainCategory === "Mobile Phones & Tablets" &&
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
        price: Number(form.price.replace(/,/g, "")),
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

  /* -------------------- UI -------------------- */
  return (
    <div className="add-product-container">
      <h2 className="title">Post Product</h2>

      {/* TITLE */}
      <Field label="Title">
        <input
          value={form.title}
          onChange={e => update("title", e.target.value)}
          placeholder="e.g iPhone 11 Pro Max"
        />
      </Field>

      {/* CATEGORY PICKER */}
      <Field label="Category">
        {!showCategoryPicker ? (
          <div className="select-wrapper">
            <input
              readOnly
              value={form.mainCategory || "Select Category"}
              onClick={() => setShowCategoryPicker(true)}
            />
          </div>
        ) : (
          <div className="category-picker">
            <div className="category-header">
              <button className="back-btn" onClick={() => navigate(`/${marketType}`)}>← Back</button>
              <span>Select Category</span>
            </div>
            <div className="category-scroll">
              {categories.map(cat => (
                <div
                  key={cat.name}
                  className={`category-card ${form.mainCategory === cat.name ? "active" : ""}`}
                  onClick={() => {
                    update("mainCategory", cat.name);
                    update("subCategory", "");
                    update("brand", "");
                    update("model", "");
                    update("condition", "");
                    update("usedDetail", "");
                    setShowCategoryPicker(false);
                  }}
                >
                  <span className="icon">{cat.icon}</span>
                  <span className="name">{cat.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Field>

      {/* SUBCATEGORY */}
      {form.mainCategory && (
        <Field label="Subcategory">
          <Select value={form.subCategory} onChange={e => update("subCategory", e.target.value)}>
            <option value="">Optional</option>
            {categories.find(c => c.name === form.mainCategory)?.subcategories.map(sub => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </Select>
        </Field>
      )}

      {/* PHONE, BRAND, MODEL, CONDITION, etc. ... */}
      {/* Keep the same as previous code */}

      {/* STATE */}
      <Field label="State">
        <Select value={form.state} onChange={e => { update("state", e.target.value); update("city", ""); }}>
          <option value="">Select State</option>
          {Object.keys(locationsByState).map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
      </Field>

      {/* CITY / LGA */}
      {form.state && (
        <Field label="City / LGA">
          <Select value={form.city} onChange={e => update("city", e.target.value)}>
            <option value="">Select City / LGA</option>
            {locationsByState[form.state].map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
      )}

      {/* PRICE, PHONE, IMAGES, DESCRIPTION, PROMOTE, SUBMIT */}
      {/* Keep the same as previous code */}
    </div>
  );
}

/* -------------------- Components -------------------- */
const Field = ({ label, children }) => (
  <div className="field">
    <label>{label}</label>
    {children}
  </div>
);

const Select = ({ children, ...props }) => (
  <div className="select-wrapper">
    <select {...props}>{children}</select>
  </div>
);