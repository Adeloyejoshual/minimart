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
    title: "",
    price: "",
    images: [],
    previews: [],
    mainCategory: "",
    subCategory: "",
    condition: "",
    description: "",
    state: "",
    city: "",
    isPromoted: false
  });

  const rules = categoryRules[form.mainCategory] || categoryRules.Default;

  /* -------------------- HELPERS -------------------- */

  const update = (key, value) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleImages = (files) => {
    const list = Array.from(files);
    if (list.length + form.images.length > rules.maxImages) {
      alert(`Max ${rules.maxImages} images allowed`);
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
    if (!form.title || form.title.length < rules.minTitle) return "Title too short";
    if (!form.price || Number(form.price) <= 0) return "Invalid price";
    if (form.images.length < rules.minImages) return "Upload more images";
    if (rules.requireCondition && !form.condition) return "Select condition";
    if (rules.requireLocation && (!form.state || !form.city)) return "Location required";
    return null;
  };

  /* -------------------- SUBMIT -------------------- */

  const handleSubmit = async () => {
    const error = validate();
    if (error) return alert(error);

    try {
      setLoading(true);

      const uploaded = await Promise.all(
        form.images.map(img => uploadToCloudinary(img))
      );

      const product = {
        title: form.title.trim(),
        price: Number(form.price),
        images: uploaded,
        coverImage: uploaded[0],
        mainCategory: form.mainCategory,
        subCategory: form.subCategory || null,
        condition: form.condition || null,
        description: form.description || "",
        state: form.state,
        city: form.city,
        marketType,
        ownerId: auth.currentUser.uid,
        isPromoted: form.isPromoted,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, "products"), product);

      alert("Product posted successfully");
      navigate("/marketplace");

    } catch (e) {
      console.error(e);
      alert("Failed to post product");
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
          {Object.keys(categories).map(c => <option key={c}>{c}</option>)}
        </select>
      </Field>

      {form.mainCategory && (
        <Field label="Subcategory">
          <select value={form.subCategory} onChange={e => update("subCategory", e.target.value)}>
            <option value="">Optional</option>
            {categories[form.mainCategory]?.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
      )}

      <Field label="Title">
        <input value={form.title} onChange={e => update("title", e.target.value)} />
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
        <textarea rows="4" value={form.description} onChange={e => update("description", e.target.value)} />
      </Field>

      <Field label="Images">
        <input type="file" multiple accept="image/*" onChange={e => handleImages(e.target.files)} />
        <div style={styles.images}>
          {form.previews.map((p, i) => (
            <div key={i} style={styles.imgWrap}>
              <img src={p} alt="" />
              <button onClick={() => removeImage(i)}>×</button>
            </div>
          ))}
        </div>
      </Field>

      <button style={styles.btn} disabled={loading} onClick={handleSubmit}>
        {loading ? "Uploading..." : "Publish"}
      </button>
    </div>
  );
}

/* -------------------- SMALL COMPONENTS -------------------- */

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