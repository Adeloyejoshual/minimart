// src/pages/AddProduct.jsx
import { useState, useEffect, useRef } from "react";
import { uploadToCloudinary } from "../cloudinary";
import "./../styles/AddProduct.css";

export default function AddProduct() {
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [subcategories, setSubcategories] = useState([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    phone: "",
    categoryId: "",
    subcategoryId: "",
    dynamicFields: {},
    images: [],
    previews: [],
    isPromoted: false,
  });

  const scrollPos = useRef(0);

  // ---------------- Fetch categories ----------------
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch("/api/marketplace/categories");
        const data = await res.json();
        setCategories(data);
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  // ---------------- Helpers ----------------
  const updateField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleCategoryChange = catId => {
    updateField("categoryId", catId);
    updateField("subcategoryId", "");
    const selected = categories.find(c => c.id === catId);
    setSubcategories(selected?.subcategories || []);
  };

  const handleImageChange = files => {
    const list = Array.from(files);
    updateField("images", [...form.images, ...list]);
    updateField("previews", [...form.previews, ...list.map(f => URL.createObjectURL(f))]);
  };

  const removeImage = index => {
    updateField("images", form.images.filter((_, i) => i !== index));
    updateField("previews", form.previews.filter((_, i) => i !== index));
  };

  // ---------------- Submit ----------------
  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.categoryId) {
      return alert("Title, price, and category are required");
    }

    try {
      // Upload images to Cloudinary
      const uploadedUrls = [];
      for (const file of form.images) {
        const url = await uploadToCloudinary(file);
        uploadedUrls.push(url);
      }

      const payload = {
        ...form,
        images: uploadedUrls,
      };

      const res = await fetch("/api/marketplace/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to submit product");

      alert("Product published successfully!");
      // Reset form
      setForm({
        title: "",
        description: "",
        price: "",
        phone: "",
        categoryId: "",
        subcategoryId: "",
        dynamicFields: {},
        images: [],
        previews: [],
        isPromoted: false,
      });
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  if (loadingCategories) return <div>Loading categories...</div>;

  return (
    <div className="add-product-container">
      <h2>Add Product</h2>

      <div className="field">
        <label>Title</label>
        <input value={form.title} onChange={e => updateField("title", e.target.value)} placeholder="Product title" />
      </div>

      <div className="field">
        <label>Category</label>
        <select value={form.categoryId} onChange={e => handleCategoryChange(e.target.value)}>
          <option value="">Select Category</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {subcategories.length > 0 && (
        <div className="field">
          <label>Subcategory</label>
          <select value={form.subcategoryId} onChange={e => updateField("subcategoryId", e.target.value)}>
            <option value="">Select Subcategory</option>
            {subcategories.map(sub => (
              <option key={sub.id} value={sub.id}>{sub.name}</option>
            ))}
          </select>
        </div>
      )}

      {form.categoryId && (
        <>
          {categories
            .find(c => c.id === form.categoryId)
            ?.fields?.map(field => (
              <div className="field" key={field}>
                <label>{field}</label>
                <input
                  value={form.dynamicFields[field] || ""}
                  onChange={e => updateField("dynamicFields", { ...form.dynamicFields, [field]: e.target.value })}
                  placeholder={field}
                />
              </div>
            ))}
        </>
      )}

      <div className="field">
        <label>Price</label>
        <input value={form.price} onChange={e => updateField("price", e.target.value)} placeholder="₦ 0" />
      </div>

      <div className="field">
        <label>Phone</label>
        <input value={form.phone} onChange={e => updateField("phone", e.target.value)} placeholder="08012345678" />
      </div>

      <div className="field">
        <label>Images</label>
        <input type="file" multiple onChange={e => handleImageChange(e.target.files)} />
        <div className="previews">
          {form.previews.map((p, i) => (
            <div key={i} className="preview">
              <img src={p} alt={`preview-${i}`} />
              <button type="button" onClick={() => removeImage(i)}>×</button>
            </div>
          ))}
        </div>
      </div>

      <div className="field">
        <label>
          <input type="checkbox" checked={form.isPromoted} onChange={e => updateField("isPromoted", e.target.checked)} /> Promote Product
        </label>
      </div>

      <button onClick={handleSubmit}>Publish</button>
    </div>
  );
}