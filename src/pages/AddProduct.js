// src/pages/AddProduct.js
import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate, useSearchParams } from "react-router-dom";
import categories from "../config/categories";
import categoryRules from "../config/categoryRules";

export default function AddProduct() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const marketType = params.get("market") || "marketplace";

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    mainCategory: "",
    subCategory: "",
    title: "",
    price: "",
    condition: "",
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
    if (!form.mainCategory) return "Select main category";
    if (!form.title || form.title.length < rules.minTitle) return `Title must be at least ${rules.minTitle} characters`;
    if (form.title.length > rules.maxTitle) return `Title cannot exceed ${rules.maxTitle} characters`;
    if (!form.price || Number(form.price) <= 0) return "Enter a valid price";
    if (form.images.length < rules.minImages) return `Upload at least ${rules.minImages} image(s)`;
    if (rules.requireCondition && !form.condition) return "Select condition";
    if (rules.requireLocation && (!form.state || !form.city)) return "Provide state and city";
    if (form.description.length > rules.maxDescription) return `Description cannot exceed ${rules.maxDescription} characters`;
    return null;
  };

  /* -------------------- SUBMIT -------------------- */
  const handleSubmit = async () => {
    const error = validate();
    if (error) return alert(error);

    if (!auth.currentUser) {
      return alert("You must be logged in to post a product");
    }

    try {
      setLoading(true);

      // Upload images to Cloudinary
      const uploaded = await Promise.all(
        form.images.map(img => uploadToCloudinary(img))
      );

      // Ensure no undefined fields
      const product = {
        mainCategory: form.mainCategory,
        subCategory: form.subCategory || null,
        title: form.title.trim(),
        price: Number(form.price),
        condition: form.condition || null,
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

      // Add product to Firestore
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
    <div style={styles.container}>
      <h2 style={styles.title}>Post Product</h2>

      <Field label="Category">
        <select value={form.mainCategory} onChange={e => update("mainCategory", e.target.value)}>
          <option value="">Select Category</option>
          {Object.keys(categories).map(cat => <option key={cat}>{cat}</option>)}
        </select>
      </Field>

      {form.mainCategory && (
        <Field label="Subcategory">
          <select value={form.subCategory} onChange={e => update("subCategory", e.target.value)}>
            <option value="">Optional</option>
            {categories[form.mainCategory]?.map(sub => <option key={sub}>{sub}</option>)}
          </select>
        </Field>
      )}

      <Field label="Title">
        <input value={form.title} onChange={e => update("title", e.target.value)} maxLength={rules.maxTitle} />
      </Field>

      <Field label="Price (₦)">
        <input type="number" value={form.price} onChange={e => update("price", e.target.value)} />
      </Field>

      {rules.requireCondition && (
        <Field label="Condition">
          <select value={form.condition} onChange={e => update("condition", e.target.value)}>
            <option value="">Select</option>
            <option>New</option>
            <option>Used</option>
          </select>
        </Field>
      )}

      <Field label="State">
        <input value={form.state} onChange={e => update("state", e.target.value)} />
      </Field>

      <Field label="City">
        <input value={form.city} onChange={e => update("city", e.target.value)} />
      </Field>

      <Field label="Description">
        <textarea value={form.description} onChange={e => update("description", e.target.value)} maxLength={rules.maxDescription} rows={4} />
      </Field>

      <Field label="Images">
        <input type="file" multiple accept="image/*" onChange={e => handleImages(e.target.files)} />
        <div style={styles.images}>
          {form.previews.map((p, i) => (
            <div key={i} style={styles.imgWrap}>
              <img src={p} alt="" />
              <button type="button" onClick={() => removeImage(i)}>×</button>
            </div>
          ))}
        </div>
      </Field>

      <Field label="Promote">
        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input type="checkbox" checked={form.isPromoted} onChange={e => update("isPromoted", e.target.checked)} />
          Promote this product
        </label>
      </Field>

      <button style={styles.btn} onClick={handleSubmit} disabled={loading}>
        {loading ? "Uploading..." : "Publish"}
      </button>
    </div>
  );
}

/* -------------------- SMALL COMPONENT -------------------- */
const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ fontSize: 13, fontWeight: 600 }}>{label}</label>
    {children}
  </div>
);

/* -------------------- STYLES -------------------- */
const styles = {
  container: {
    maxWidth: 520,
    margin: "30px auto",
    background: "#fff",
    padding: 24,
    borderRadius: 12,
    boxShadow: "0 8px 30px rgba(0,0,0,.08)"
  },
  title: {
    textAlign: "center",
    marginBottom: 20,
    color: "#0D6EFD"
  },
  images: {
    display: "flex",
    gap: 10,
    marginTop: 10,
    flexWrap: "wrap"
  },
  imgWrap: {
    position: "relative"
  },
  btn: {
    width: "100%",
    background: "#0D6EFD",
    color: "#fff",
    padding: 12,
    borderRadius: 8,
    border: "none",
    fontWeight: 600,
    cursor: "pointer"
  }
};