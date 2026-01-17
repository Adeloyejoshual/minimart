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

  // Load draft & saved category
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

  const handlePriceChange = e => {
    const raw = e.target.value.replace(/,/g, "");
    if (!isNaN(raw)) update("price", Number(raw).toLocaleString());
  };

  const handleImages = files => {
    const list = Array.from(files);
    if (list.length + form.images.length > rules.maxImages) {
      alert(`Maximum ${rules.maxImages} images allowed`);
      return;
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
    if (form.images.length < rules.minImages)
      return `Upload at least ${rules.minImages} image(s)`;
    if (form.mainCategory === "Mobile Phones & Tablets" && form.model && !form.condition)
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
      const uploaded = await Promise.all(form.images.map(img => uploadToCloudinary(img)));
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

  // Helper to render options as vertical cards
  const OptionCards = ({ options, valueKey }) => (
    <div className="options-scroll" style={{ flexDirection: "column", gap: "6px", maxHeight: "180px", overflowY: "auto" }}>
      {options.map(opt => (
        <div
          key={opt}
          className={`option-item ${form[valueKey] === opt ? "active" : ""}`}
          onClick={() => update(valueKey, opt)}
        >
          {opt}
        </div>
      ))}
    </div>
  );

  return (
    <div className="add-product-container">
      {/* Header */}
      <div className="add-product-header">
        <button className="back-btn" onClick={() => navigate(`/${marketType}`)}>←</button>
        <span className="page-title">Add Product</span>
      </div>

      {/* Title */}
      <Field label="Title">
        <input value={form.title} onChange={e => update("title", e.target.value)} placeholder="e.g iPhone 11 Pro Max" />
      </Field>

      {/* Category Horizontal */}
      <Field label="Category">
        <div className="category-scroll">
          {categories.map(cat => (
            <div
              key={cat.name}
              className={`category-item ${form.mainCategory === cat.name ? "active" : ""}`}
              onClick={() => {
                update("mainCategory", cat.name);
                update("subCategory", "");
                update("brand", "");
                update("model", "");
                update("condition", "");
                update("usedDetail", "");
              }}
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
          <OptionCards options={categories.find(c => c.name === form.mainCategory).subcategories} valueKey="subCategory" />
        </Field>
      )}

      {/* Brand */}
      {form.subCategory && phoneModels[form.subCategory] && (
        <Field label="Brand">
          <OptionCards options={Object.keys(phoneModels[form.subCategory])} valueKey="brand" />
        </Field>
      )}

      {/* Model */}
      {form.brand && phoneModels[form.subCategory] && (
        <Field label="Model">
          <OptionCards options={phoneModels[form.subCategory][form.brand]} valueKey="model" />
        </Field>
      )}

      {/* Condition */}
      {form.model && (
        <Field label="Condition">
          <OptionCards options={conditions.main} valueKey="condition" />
        </Field>
      )}

      {/* Used Detail */}
      {form.condition === "Used" && (
        <Field label="Used Details">
          <OptionCards options={conditions.usedDetails} valueKey="usedDetail" />
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
              <button onClick={() => removeImage(i)}>×</button>
            </div>
          ))}
        </div>
      </Field>

      {/* State */}
      <Field label="State">
        <OptionCards options={Object.keys(locationsByState)} valueKey="state" />
      </Field>

      {/* City / LGA */}
      {form.state && (
        <Field label="City / LGA">
          <OptionCards options={locationsByState[form.state]} valueKey="city" />
        </Field>
      )}

      {/* Description */}
      <Field label="Description">
        <textarea rows={4} value={form.description} onChange={e => update("description", e.target.value)} />
      </Field>

      {/* Submit */}
      <button className="btn" onClick={handleSubmit} disabled={loading}>
        {loading ? "Uploading..." : "Publish"}
      </button>
    </div>
  );
}

// Field Component
const Field = ({ label, children }) => (
  <div className="field">
    <label>{label}</label>
    {children}
  </div>
);