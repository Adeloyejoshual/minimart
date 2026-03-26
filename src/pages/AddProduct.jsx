// src/pages/AddProductPage.jsx
import { useEffect, useState } from "react";
import DropdownModal from "../components/DropdownModal.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans, getActivePrice, getDiscountPercent } from "../config/promotions.js";
import "./AddProduct.css";

export default function AddProductPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedPromotion, setSelectedPromotion] = useState(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    mainCategory: "",
    subCategory: "",
    dynamic: {},
  });

  const states = Object.keys(locationsByState || {});
  const cities = selectedState ? locationsByState[selectedState] : [];

  // ---------------- FETCH CATEGORIES ----------------
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch("/api/marketplace/categories");
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

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const updateDynamic = (key, value) =>
    setForm(prev => ({ ...prev, dynamic: { ...prev.dynamic, [key]: value } }));

  // ---------------- RESET DYNAMIC FIELDS ON CATEGORY ----------------
  useEffect(() => {
    if (!selectedCategory) return;

    const currentDynamic = { ...form.dynamic };
    dynamicFields.forEach(f => {
      if (!(f in currentDynamic)) currentDynamic[f] = f === "features" ? [] : "";
    });

    currentDynamic.location = {
      state: selectedState || currentDynamic.location?.state || "",
      city: selectedCity || currentDynamic.location?.city || "",
    };

    setForm(prev => ({ ...prev, dynamic: currentDynamic, subCategory: "" }));
  }, [selectedCategory]);

  // ---------------- IMAGE PREVIEWS ----------------
  const handleImages = files => {
    const arr = [...images, ...Array.from(files)].slice(0, 8);
    setImages(arr);
    setPreviewUrls(arr.map(f => URL.createObjectURL(f)));
  };
  const removeImage = index => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  // ---------------- STATE & CITY ----------------
  const handleStateChange = state => {
    setSelectedState(state);
    setSelectedCity("");
    updateDynamic("location", { ...form.dynamic.location, state, city: "" });
  };
  const handleCityChange = city => {
    setSelectedCity(city);
    updateDynamic("location", { ...form.dynamic.location, city });
  };

  // ---------------- PRICE ----------------
  const handlePriceChange = value => {
    const numeric = value.replace(/[^0-9.]/g, "");
    update("price", numeric);
  };
  const formatPrice = price => {
    if (!price) return "";
    const [integer, decimal] = price.toString().split(".");
    return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (decimal ? "." + decimal : "");
  };

  // ---------------- PAYSTACK PAYMENT ----------------
  const handlePaystackPayment = async payload => {
    const email = prompt("Enter your email for payment");
    if (!email) return alert("Email is required for payment");

    try {
      const res = await fetch("/api/paystack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          amount: promotionPlans.find(p => p.id === selectedPromotion)?.price,
          productPayload: payload,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment initialization failed");

      window.open(data.data.authorization_url, "_blank");
      alert("Complete payment in the new window. After success, verify in admin panel.");
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  // ---------------- SUBMIT ----------------
  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.mainCategory)
      return alert("Title, price, and category are required");
    if (!images.length) return alert("Please upload at least one image");

    const cleanedDynamic = Object.fromEntries(
      Object.entries(form.dynamic).filter(
        ([_, v]) => v !== "" && v !== null && !(Array.isArray(v) && !v.length)
      )
    );

    const payload = {
      title: form.title,
      description: form.description,
      price: parseFloat(form.price),
      category_id: form.mainCategory,
      subcategory_id: form.subCategory || null,
      dynamicFields: cleanedDynamic,
      images: await Promise.all(images.map(f => f.arrayBuffer().then(buf => Buffer.from(buf).toString("base64")))),
      promotion_id: selectedPromotion || null,
    };

    try {
      setLoading(true);

      // PAYSTACK FOR PAID PROMOTION
      const promoPlan = promotionPlans.find(p => p.id === selectedPromotion);
      if (promoPlan && promoPlan.price > 0) {
        await handlePaystackPayment(payload);
        return;
      }

      // OTHERWISE SAVE DIRECTLY
      const res = await fetch("/api/marketplace/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add product");

      alert("Product added successfully!");
      setForm({ title: "", description: "", price: "", mainCategory: "", subCategory: "", dynamic: {} });
      setImages([]);
      setPreviewUrls([]);
      setSelectedState("");
      setSelectedCity("");
      setSelectedPromotion(null);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-product-container">
      <h2>Add Product</h2>

      {/* TITLE */}
      <div className="field">
        <label>Title</label>
        <input value={form.title} onChange={e => update("title", e.target.value)} placeholder="e.g iPhone 13" />
      </div>

      {/* DESCRIPTION */}
      <div className="field">
        <label>Description</label>
        <textarea value={form.description} onChange={e => update("description", e.target.value)} placeholder="Write product details..." />
      </div>

      {/* CATEGORY */}
      <DropdownModal label="Category" value={form.mainCategory} onChange={val => update("mainCategory", val)} options={categories.map(c => ({ id: c.id, name: c.name }))} />
      {subcategories.length > 0 && <DropdownModal label="Subcategory" value={form.subCategory} onChange={val => update("subCategory", val)} options={subcategories.map(s => ({ id: s.id, name: s.name }))} />}

      {/* DYNAMIC FIELDS */}
      {dynamicFields.map(field => {
        const value = form.dynamic[field];
        if (field === "used_detail" && form.dynamic.condition !== "Used") return null;
        if (field === "features") {
          const current = Array.isArray(value) ? value : [];
          return (
            <div key={field} className="multi-select">
              <label>{field.replace(/_/g, " ").toUpperCase()}</label>
              {optionsMap[field].map(opt => (
                <label key={opt}>
                  <input type="checkbox" checked={current.includes(opt)} onChange={() =>
                    updateDynamic(field, current.includes(opt) ? current.filter(v => v !== opt) : [...current, opt])
                  } />
                  {opt}
                </label>
              ))}
            </div>
          );
        }
        return <DropdownModal key={field} label={field.replace(/_/g, " ").toUpperCase()} value={value || ""} onChange={val => updateDynamic(field, val)} options={optionsMap[field]} />;
      })}

      {/* STATE & CITY */}
      <DropdownModal label="State" value={selectedState} onChange={handleStateChange} options={states} />
      {selectedState && <DropdownModal label="City" value={selectedCity} onChange={handleCityChange} options={cities} />}

      {/* PRICE */}
      <div className="field">
        <label>Price (₦)</label>
        <input type="text" value={formatPrice(form.price)} onChange={e => handlePriceChange(e.target.value)} />
      </div>

      {/* PROMOTION PLANS */}
      <div className="promotion-section">
        <h3>Select Promotion Plan</h3>
        <div className="promotion-list">
          {promotionPlans.map(plan => (
            <div key={plan.id} className={`promotion-card ${selectedPromotion === plan.id ? "selected" : ""}`} onClick={() => setSelectedPromotion(plan.id)}>
              <plan.icon size={20} />
              <strong>{plan.name}</strong>
              <p>{plan.description}</p>
              <p>Price: ₦{getActivePrice(plan.price, plan.discount).toLocaleString()}</p>
              {plan.discount > 0 && <small>Save {getDiscountPercent(plan.price, plan.discount)}%</small>}
            </div>
          ))}
        </div>
      </div>

      {/* IMAGES */}
      <div className="field">
        <label>Images (max 8)</label>
        <div className="image-input-wrapper">
          <input type="file" accept="image/*" multiple onChange={e => handleImages(e.target.files)} />
          {images.length < 8 && <button type="button" onClick={() => document.querySelector('input[type="file"]').click()}>+</button>}
        </div>
        <div className="image-preview">
          {previewUrls.map((url, i) => (
            <div key={i} className="preview-wrapper">
              <img src={url} alt={`preview ${i}`} />
              <button type="button" onClick={() => removeImage(i)}>Remove</button>
            </div>
          ))}
        </div>
      </div>

      {/* SUBMIT */}
      <button onClick={handleSubmit} disabled={loading}>{loading ? "Saving..." : "Add Product"}</button>
    </div>
  );
}