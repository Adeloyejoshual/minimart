// src/pages/AddProductPage.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans, getActivePrice, getDiscountPercent } from "../config/promotions.js";
import "./AddProduct.css";

export default function AddProductPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    mainCategory: "",
    subCategory: "",
    dynamic: {},
    promotionId: "",
  });

  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  const states = Object.keys(locationsByState || {});
  const cities = selectedState ? locationsByState[selectedState] : [];

  // ---------------- FETCH CATEGORIES ----------------
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch(
          "https://minimart-ivrm.onrender.com/api/marketplace/categories"
        );
        const data = await res.json();
        setCategories(data || []);
      } catch (err) {
        console.error("Failed to load categories", err);
      }
    }
    fetchCategories();
  }, []);

  const selectedCategory = categories.find(c => c.id === form.mainCategory);
  const subcategories = selectedCategory?.subcategories || [];
  const dynamicFields = selectedCategory?.dynamicOptions?.fields || [];
  const options = selectedCategory?.dynamicOptions || {};

  const optionsMap = {
    brand: options.brands || [],
    model: options.models?.[form.dynamic.brand] || [],
    color: options.colors || [],
    condition: options.conditions || [],
    used_detail: options.usedDetails || [],
    ram: options.ram || [],
    storage: options.storage || [],
    sim: options.sims || [],
    features: options.features || [],
    year: options.years || [],
    engine: options.engine || [],
    fuel_type: options.fuel_type || [],
  };

  const update = (key, value) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const updateDynamic = (key, value) =>
    setForm(prev => ({ ...prev, dynamic: { ...prev.dynamic, [key]: value } }));

  // ---------------- RESET DYNAMIC FIELDS ON CATEGORY CHANGE ----------------
  useEffect(() => {
    if (!selectedCategory) return;
    const initialDynamic = Object.fromEntries(
      dynamicFields.map(f => [f, f === "features" ? [] : ""])
    );
    setForm(prev => ({ ...prev, dynamic: initialDynamic, subCategory: "" }));
  }, [selectedCategory]);

  // ---------------- HANDLE IMAGES ----------------
  const handleImages = files => {
    const arr = Array.from(files);
    setImages(arr);
    setPreviewUrls(arr.map(f => URL.createObjectURL(f)));
  };

  // ---------------- HANDLE STATE & CITY ----------------
  const handleStateChange = state => {
    setSelectedState(state);
    setSelectedCity("");
    updateDynamic("location", "");
  };

  const handleCityChange = city => {
    setSelectedCity(city);
    updateDynamic("location", city);
  };

  // ---------------- HANDLE PRICE INPUT ----------------
  const handlePriceChange = value => {
    const numeric = value.replace(/[^0-9.]/g, "");
    update("price", numeric);
  };

  const formatPrice = price => {
    if (!price) return "";
    const [integer, decimal] = price.toString().split(".");
    return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (decimal ? "." + decimal : "");
  };

  // ---------------- SUBMIT WITH PAYSTACK ----------------
  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.mainCategory) {
      return alert("Title, price, and category are required");
    }
    if (images.length === 0) {
      return alert("Please upload at least one image");
    }

    const cleanedDynamic = Object.fromEntries(
      Object.entries(form.dynamic).filter(
        ([_, v]) => v !== "" && v !== null && !(Array.isArray(v) && v.length === 0)
      )
    );

    try {
      setLoading(true);

      // Prepare metadata for Paystack
      const metadata = {
        title: form.title,
        description: form.description,
        price: parseFloat(form.price),
        category_id: form.mainCategory,
        subcategory_id: form.subCategory || null,
        dynamicFields: cleanedDynamic,
        promotion_id: form.promotionId || null,
        images: await Promise.all(images.map(file => fileToBase64(file))),
      };

      // If a promotion is selected, initialize Paystack
      if (form.promotionId) {
        const selectedPlan = promotionPlans.find(p => p.id === form.promotionId);
        if (!selectedPlan) throw new Error("Invalid promotion plan");

        const activePrice = getActivePrice(parseFloat(form.price), selectedPlan.discount);

        const res = await fetch(
          "https://minimart-ivrm.onrender.com/api/promote/initiate",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: "user@example.com", // replace with logged-in user email
              amount: activePrice,
              metadata,
            }),
          }
        );

        const data = await res.json();
        if (!data.success) throw new Error(data.message || "Payment initialization failed");

        // Redirect to Paystack payment page
        window.location.href = data.payment.data.authorization_url;
        return; // stop further execution
      }

      // No promotion selected → normal product creation
      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("description", form.description);
      formData.append("price", form.price);
      formData.append("category_id", form.mainCategory);
      if (form.subCategory) formData.append("subcategory_id", form.subCategory);
      formData.append("dynamicFields", JSON.stringify(cleanedDynamic));
      images.forEach(img => formData.append("images", img));

      const normalRes = await fetch(
        "https://minimart-ivrm.onrender.com/api/marketplace/products",
        { method: "POST", body: formData }
      );

      const normalData = await normalRes.json();
      if (!normalRes.ok) throw new Error(normalData.message || "Upload failed");

      alert("Product added successfully!");
      resetForm();

    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- HELPER: FILE → BASE64 ----------------
  const fileToBase64 = file =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = err => reject(err);
    });

  // ---------------- RESET FORM ----------------
  const resetForm = () => {
    setForm({ title: "", description: "", price: "", mainCategory: "", subCategory: "", dynamic: {}, promotionId: "" });
    setImages([]);
    setPreviewUrls([]);
    setSelectedState("");
    setSelectedCity("");
  };

  return (
    <div className="add-product-container">
      {/* BACK ARROW */}
      <div className="back-arrow" onClick={() => navigate(-1)}>&larr; Back</div>

      <h2>Add Product</h2>

      {/* TITLE */}
      <div className="field">
        <label>Title</label>
        <input value={form.title} onChange={e => update("title", e.target.value)} placeholder="e.g iPhone 13" />
      </div>

      {/* DESCRIPTION */}
      <div className="field">
        <label>Description</label>
        <textarea value={form.description} onChange={e => update("description", e.target.value)} placeholder="Write product details here..." />
      </div>

      {/* CATEGORY */}
      <div className="field">
        <label>Category</label>
        <select value={form.mainCategory} onChange={e => update("mainCategory", e.target.value)}>
          <option value="">Select category</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* SUBCATEGORY */}
      {subcategories.length > 0 && (
        <div className="field">
          <label>Subcategory</label>
          <select value={form.subCategory} onChange={e => update("subCategory", e.target.value)}>
            <option value="">Select subcategory</option>
            {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {/* DYNAMIC FIELDS */}
      {dynamicFields.map(field => {
        const value = form.dynamic[field];
        if (field === "used_detail" && form.dynamic.condition !== "Used") return null;
        const isArray = field === "features";

        return (
          <div className="field" key={field}>
            <label>{field.replace(/_/g, " ").toUpperCase()}</label>
            {!optionsMap[field] || optionsMap[field].length === 0 ? (
              <input value={value || ""} onChange={e => updateDynamic(field, e.target.value)} />
            ) : isArray ? (
              <div className="multi-select">
                {optionsMap[field].map(opt => {
                  const current = Array.isArray(value) ? value : [];
                  return (
                    <label key={opt}>
                      <input type="checkbox" checked={current.includes(opt)}
                        onChange={() =>
                          updateDynamic(field, current.includes(opt) ? current.filter(v => v !== opt) : [...current, opt])
                        }
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>
            ) : (
              <select value={value || ""} onChange={e => updateDynamic(field, e.target.value)}>
                <option value="">Select</option>
                {optionsMap[field].map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            )}
          </div>
        );
      })}

      {/* STATE & CITY */}
      <div className="field">
        <label>State</label>
        <select value={selectedState} onChange={e => handleStateChange(e.target.value)}>
          <option value="">Select state</option>
          {states.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      {selectedState && (
        <div className="field">
          <label>City</label>
          <select value={selectedCity} onChange={e => handleCityChange(e.target.value)}>
            <option value="">Select city</option>
            {cities.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      )}

      {/* PRICE */}
      <div className="field">
        <label>Price (₦)</label>
        <input type="text" value={formatPrice(form.price)} onChange={e => handlePriceChange(e.target.value)} />
      </div>

      {/* PROMOTION */}
      <div className="field">
        <label>Promotion</label>
        <select value={form.promotionId || ""} onChange={e => update("promotionId", e.target.value)}>
          <option value="">Select promotion</option>
          {promotionPlans.map(plan => {
            const discountPercent = getDiscountPercent(plan.originalPrice, plan.discount);
            const activePrice = getActivePrice(plan.price, plan.discount);
            return (
              <option key={plan.id} value={plan.id}>
                {plan.name} - ₦{activePrice.toLocaleString()} ({discountPercent}% off)
              </option>
            );
          })}
        </select>
      </div>

      {/* IMAGES */}
      <div className="field">
        <label>Images</label>
        <input type="file" multiple onChange={e => handleImages(e.target.files)} />
        <div className="image-preview">
          {previewUrls.map((url, i) => <img key={i} src={url} alt={`preview ${i}`} />)}
        </div>
      </div>

      {/* SUBMIT */}
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Processing..." : "Add Product"}
      </button>
    </div>
  );
}