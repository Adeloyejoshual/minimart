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
    isPromoted: false,
  });

  const rules = categoryRules[form.mainCategory] || categoryRules.Default;

  /* -------------------- DRAFT (AUTO SAVE) -------------------- */
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) setForm(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  }, [form]);

  /* -------------------- HELPERS -------------------- */
  const update = (key, value) =>
    setForm(prev => ({ ...prev, [key]: value }));

  /* Price formatting with commas */
  const handlePriceChange = (e) => {
    const raw = e.target.value.replace(/,/g, "");
    if (!isNaN(raw)) {
      update("price", Number(raw).toLocaleString());
    }
  };

  /* Images (+ icon upload) */
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

  /* -------------------- VALIDATION -------------------- */
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
        price: Number(form.price.replace(/,/g, "")),
        images: uploaded,
        coverImage: uploaded[0],
        marketType,
        ownerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
      });

      localStorage.removeItem(DRAFT_KEY);
      alert("Product posted successfully");
      navigate("/marketplace");

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

      {/* TITLE FIRST */}
      <Field label="Title">
        <input
          value={form.title}
          onChange={e => update("title", e.target.value)}
          placeholder="e.g iPhone 11 Pro Max"
        />
      </Field>

      {/* CATEGORY */}
      <Field label="Category">
        <Select value={form.mainCategory} onChange={e => update("mainCategory", e.target.value)}>
          <option value="">Select Category</option>
          {Object.keys(categories).map(cat => (
            <option key={cat}>{cat}</option>
          ))}
        </Select>
      </Field>

      {/* SUBCATEGORY */}
      {form.mainCategory && (
        <Field label="Subcategory">
          <Select value={form.subCategory} onChange={e => update("subCategory", e.target.value)}>
            <option value="">Optional</option>
            {categories[form.mainCategory].map(sub => (
              <option key={sub}>{sub}</option>
            ))}
          </Select>
        </Field>
      )}

      {/* PHONE FLOW */}
      {phoneModels[form.subCategory] && (
        <>
          <Field label="Brand">
            <Select value={form.brand} onChange={e => update("brand", e.target.value)}>
              <option value="">Select Brand</option>
              {Object.keys(phoneModels[form.subCategory]).map(b => (
                <option key={b}>{b}</option>
              ))}
            </Select>
          </Field>

          {form.brand && (
            <Field label="Model">
              <Select value={form.model} onChange={e => update("model", e.target.value)}>
                <option value="">Select Model</option>
                {phoneModels[form.subCategory][form.brand].map(m => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
          )}
        </>
      )}

      {/* CONDITION */}
      {form.model && (
        <Field label="Condition">
          <Select value={form.condition} onChange={e => update("condition", e.target.value)}>
            <option value="">Select</option>
            {conditions.main.map(c => <option key={c}>{c}</option>)}
          </Select>
        </Field>
      )}

      {form.condition === "Used" && (
        <Field label="Used Details">
          <Select value={form.usedDetail} onChange={e => update("usedDetail", e.target.value)}>
            <option value="">Select Detail</option>
            {conditions.usedDetails.map(d => <option key={d}>{d}</option>)}
          </Select>
        </Field>
      )}

      {/* PRICE */}
      <Field label="Price (₦)">
        <input value={form.price} onChange={handlePriceChange} placeholder="₦ 0" />
      </Field>

      {/* PHONE */}
      <Field label="Phone Number">
        <input
          type="tel"
          value={form.phone}
          onChange={e => update("phone", e.target.value)}
          placeholder="08012345678"
        />
      </Field>

      {/* IMAGES (+ ICON) */}
      <Field label="Images">
        <label className="image-upload">
          <input type="file" multiple hidden onChange={e => handleImages(e.target.files)} />
          <span>＋ Add Images</span>
        </label>

        <div className="images">
          {form.previews.map((p, i) => (
            <div key={i} className="img-wrap">
              <img src={p} alt="" />
              <button onClick={() => removeImage(i)}>×</button>
            </div>
          ))}
        </div>
      </Field>

      {/* DESCRIPTION */}
      <Field label="Description">
        <textarea
          rows={4}
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

/* -------------------- SMALL COMPONENTS -------------------- */
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