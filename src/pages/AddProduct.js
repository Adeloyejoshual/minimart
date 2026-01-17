// src/pages/AddProduct.js
import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate, useSearchParams } from "react-router-dom";
import categories from "../config/categories";
import categoryRules from "../config/categoryRules";
import { locationsByState } from "../config/locationsByState";
import phoneModels from "../config/phoneModels";
import conditions from "../config/condition";
import "./AddProduct.css"; // professional CSS

export default function AddProduct() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const marketType = params.get("market") || "marketplace";

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    mainCategory: "",
    subCategory: "",
    brand: "",
    model: "",
    title: "",
    price: "",
    condition: "",
    usedDetail: "",
    description: "",
    state: "",
    city: "",
    images: [],
    previews: [],
    isPromoted: false,
  });

  const rules = categoryRules[form.mainCategory] || categoryRules.Default;

  /* -------------------- HELPERS -------------------- */
  const update = (key, value) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleImages = (files) => {
    const list = Array.from(files);
    if (list.length + form.images.length > rules.maxImages) {
      alert(`Maximum ${rules.maxImages} images allowed`);
      return;
    }
    update("images", [...form.images, ...list]);
    update("previews", [...form.previews, ...list.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = (index) => {
    update("images", form.images.filter((_, i) => i !== index));
    update("previews", form.previews.filter((_, i) => i !== index));
  };

  /* -------------------- VALIDATION -------------------- */
  const validate = () => {
    if (!form.mainCategory) return "Select main category";
    if (!form.title || form.title.length < rules.minTitle)
      return `Title must be at least ${rules.minTitle} characters`;
    if (form.title.length > rules.maxTitle)
      return `Title cannot exceed ${rules.maxTitle} characters`;
    if (!form.price || Number(form.price) <= 0) return "Enter a valid price";
    if (form.images.length < rules.minImages)
      return `Upload at least ${rules.minImages} image(s)`;
    if (rules.requireCondition &&
        form.mainCategory === "Mobile Phones & Tablets" &&
        !form.condition)
      return "Select condition";
    if (form.condition === "Used" && !form.usedDetail)
      return "Select used product detail";
    if (rules.requireLocation && (!form.state || !form.city))
      return "Provide state and city";
    return null;
  };

  /* -------------------- SUBMIT -------------------- */
  const handleSubmit = async () => {
    const error = validate();
    if (error) return alert(error);
    if (!auth.currentUser) return alert("You must be logged in to post a product");

    try {
      setLoading(true);
      const uploaded = await Promise.all(
        form.images.map(img => uploadToCloudinary(img))
      );

      const product = {
        mainCategory: form.mainCategory,
        subCategory: form.subCategory || null,
        brand: form.brand || null,
        model: form.model || null,
        title: form.title.trim(),
        price: Number(form.price),
        condition: form.mainCategory === "Mobile Phones & Tablets" ? form.condition : null,
        usedDetail: form.condition === "Used" ? form.usedDetail : null,
        description: form.description || "",
        state: form.state,
        city: form.city,
        images: uploaded,
        coverImage: uploaded[0],
        marketType,
        ownerId: auth.currentUser.uid,
        isPromoted: form.isPromoted,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "products"), product);

      alert("Product posted successfully!");
      navigate("/marketplace");

    } catch (err) {
      console.error(err);
      alert("Failed to post product: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  /* -------------------- UI -------------------- */
  return (
    <div className="add-product-container">
      <h2 className="title">Post Product</h2>

      {/* Category */}
      <Field label="Category">
        <div className="select-wrapper">
          <select value={form.mainCategory} onChange={e => {
            update("mainCategory", e.target.value);
            update("subCategory", "");
            update("brand", "");
            update("model", "");
            update("condition", "");
            update("usedDetail", "");
          }}>
            <option value="">Select Category</option>
            {Object.keys(categories).map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
      </Field>

      {/* Subcategory */}
      {form.mainCategory && (
        <Field label="Subcategory">
          <div className="select-wrapper">
            <select value={form.subCategory} onChange={e => {
              update("subCategory", e.target.value);
              update("brand", "");
              update("model", "");
              update("condition", "");
              update("usedDetail", "");
            }}>
              <option value="">Optional</option>
              {categories[form.mainCategory]?.map(sub => <option key={sub} value={sub}>{sub}</option>)}
            </select>
          </div>
        </Field>
      )}

      {/* Brand */}
      {form.subCategory && phoneModels[form.subCategory] && (
        <Field label="Brand">
          <div className="select-wrapper">
            <select value={form.brand} onChange={e => {
              update("brand", e.target.value);
              update("model", "");
              update("condition", "");
              update("usedDetail", "");
            }}>
              <option value="">Select Brand</option>
              {Object.keys(phoneModels[form.subCategory]).map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>
        </Field>
      )}

      {/* Model */}
      {form.brand && phoneModels[form.subCategory]?.[form.brand] && (
        <Field label="Model">
          <div className="select-wrapper">
            <select value={form.model} onChange={e => {
              update("model", e.target.value);
              update("condition", "");
              update("usedDetail", "");
            }}>
              <option value="">Select Model</option>
              {phoneModels[form.subCategory][form.brand].map(model => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>
        </Field>
      )}

      {/* Condition */}
      {form.mainCategory === "Mobile Phones & Tablets" && form.model && (
        <Field label="Condition">
          <div className="select-wrapper">
            <select value={form.condition} onChange={e => {
              update("condition", e.target.value);
              if (e.target.value !== "Used") update("usedDetail", "");
            }}>
              <option value="">Select</option>
              {conditions.main.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </Field>
      )}

      {/* Used Details */}
      {form.condition === "Used" && (
        <Field label="Used Details">
          <div className="select-wrapper">
            <select value={form.usedDetail || ""} onChange={e => update("usedDetail", e.target.value)}>
              <option value="">Select Detail</option>
              {conditions.usedDetails.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </Field>
      )}

      {/* Title */}
      <Field label="Title">
        <input value={form.title} onChange={e => update("title", e.target.value)} maxLength={rules.maxTitle} />
      </Field>

      {/* Price */}
      <Field label="Price (₦)">
        <input type="number" value={form.price} onChange={e => update("price", e.target.value)} />
      </Field>

      {/* State */}
      <Field label="State">
        <div className="select-wrapper">
          <select value={form.state} onChange={e => {
            update("state", e.target.value);
            update("city", "");
          }}>
            <option value="">Select State</option>
            {Object.keys(locationsByState).map(state => <option key={state} value={state}>{state}</option>)}
          </select>
        </div>
      </Field>

      {/* City */}
      {form.state && (
        <Field label="City / LGA">
          <div className="select-wrapper">
            <select value={form.city} onChange={e => update("city", e.target.value)}>
              <option value="">Select City / LGA</option>
              {locationsByState[form.state].map(lga => <option key={lga} value={lga}>{lga}</option>)}
            </select>
          </div>
        </Field>
      )}

      {/* Description */}
      <Field label="Description">
        <textarea value={form.description} onChange={e => update("description", e.target.value)} maxLength={rules.maxDescription} rows={4} />
      </Field>

      {/* Images */}
      <Field label="Images">
        <input type="file" multiple accept="image/*" onChange={e => handleImages(e.target.files)} />
        <div className="images">
          {form.previews.map((p, i) => (
            <div key={i} className="img-wrap">
              <img src={p} alt="" />
              <button type="button" onClick={() => removeImage(i)}>×</button>
            </div>
          ))}
        </div>
      </Field>

      {/* Promote */}
      <Field label="Promote">
        <label className="promote-label">
          <input type="checkbox" checked={form.isPromoted} onChange={e => update("isPromoted", e.target.checked)} />
          Promote this product
        </label>
      </Field>

      <button className="btn" onClick={handleSubmit} disabled={loading}>
        {loading ? "Uploading..." : "Publish"}
      </button>
    </div>
  );
}

/* -------------------- Field Component -------------------- */
const Field = ({ label, children }) => (
  <div className="field">
    <label>{label}</label>
    {children}
  </div>
);