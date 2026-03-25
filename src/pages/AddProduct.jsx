// src/pages/AddProductPage.jsx
import { useEffect, useState } from "react";
import { brands } from "../config/brands.js";
import { colors } from "../config/colors.js";
import { categoryFields } from "../config/categoryFields.js";
import { conditions, usedDetails } from "../config/conditions.js";
import { featuresByCategory } from "../config/featuresByCategory.js";
import { models } from "../config/models.js";
import { ramOptions } from "../config/ramOptions.js";
import { sims } from "../config/sims.js";
import { storageOptions } from "../config/storageOptions.js";
import { years } from "../config/years.js";
import { engines } from "../config/engines.js";
import { fuelTypes } from "../config/fuelTypes.js";
import { locationsByState } from "../config/locationsByState.js";
import {
  promotionPlans,
  getActivePrice,
  getDiscountPercent,
} from "../config/promotions.js";
import "./AddProduct.css";

export default function AddProductPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  const [form, setForm] = useState({
    title: "", description: "", price: "",
    mainCategory: "", subCategory: "", dynamic: {},
    promotionId: ""
  });

  const states = Object.keys(locationsByState);
  const cities = selectedState ? locationsByState[selectedState] : [];

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories");
        const data = await res.json();
        setCategories(data || []);
      } catch (err) {
        console.error(err);
      }
    }
    fetchCategories();
  }, []);

  const selectedCategory = categories.find(c => c.id === form.mainCategory);
  const subcategories = selectedCategory?.subcategories || [];
  const dynamicFields = selectedCategory?.dynamicOptions?.fields || categoryFields[form.mainCategory] || [];
  const options = selectedCategory?.dynamicOptions || {};

  const optionsMap = {
    brand: options.brands?.length ? options.brands : brands,
    model: options.models?.[form.dynamic.brand] || models[form.dynamic.brand] || [],
    color: options.colors?.length ? options.colors : colors,
    condition: options.conditions?.length ? options.conditions : conditions,
    used_detail: options.usedDetails?.length ? options.usedDetails : usedDetails,
    ram: options.ram?.length ? options.ram : ramOptions,
    storage: options.storage?.length ? options.storage : storageOptions,
    sim: options.sims?.length ? options.sims : sims,
    features: options.features?.length ? options.features : featuresByCategory[form.mainCategory] || [],
    year: options.years?.length ? options.years : years,
    engine: options.engine?.length ? options.engine : engines,
    fuel_type: options.fuel_type?.length ? options.fuel_type : fuelTypes
  };

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const updateDynamic = (key, value) => setForm(prev => ({ ...prev, dynamic: { ...prev.dynamic, [key]: value } }));

  useEffect(() => {
    const initial = Object.fromEntries(dynamicFields.map(f => [f, f === "features" ? [] : ""]));
    setForm(prev => ({ ...prev, dynamic: initial, subCategory: "" }));
  }, [selectedCategory]);

  useEffect(() => { updateDynamic("model", ""); }, [form.dynamic.brand]);

  const handleImages = files => {
    const arr = Array.from(files);
    setImages(arr);
    setPreviewUrls(arr.map(f => URL.createObjectURL(f)));
  };

  const handleStateChange = state => {
    setSelectedState(state);
    setSelectedCity("");
    updateDynamic("location", "");
  };
  const handleCityChange = city => {
    setSelectedCity(city);
    updateDynamic("location", city);
  };
  const handlePriceChange = value => {
    const numeric = value.replace(/[^0-9.]/g, "");
    update("price", numeric);
  };
  const formatPrice = price => {
    if (!price) return "";
    const [int, dec] = price.toString().split(".");
    return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (dec ? "."+dec : "");
  };

  // ---------------- SUBMIT ----------------
  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.mainCategory) return alert("Title, price, and category required");
    if (!images.length) return alert("Upload at least one image");

    const cleanedDynamic = Object.fromEntries(
      Object.entries(form.dynamic).filter(([_, v]) => v !== "" && v !== null && !(Array.isArray(v) && v.length===0))
    );

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("description", form.description);
      formData.append("price", form.price);
      formData.append("category_id", form.mainCategory);
      if (form.subCategory) formData.append("subcategory_id", form.subCategory);
      formData.append("dynamicFields", JSON.stringify(cleanedDynamic));
      formData.append("promotion_id", form.promotionId || "");
      if (selectedCity) formData.append("location", selectedCity);
      images.forEach(img => formData.append("images", img));

      const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/products/initiate", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      if (form.promotionId) {
        // ------------------- PROMOTION -------------------
        window.location.href = data.payment.authorization_url;
      } else {
        alert("Product added successfully!");
        setForm({ title:"", description:"", price:"", mainCategory:"", subCategory:"", dynamic:{}, promotionId:"" });
        setImages([]); setPreviewUrls([]);
        setSelectedState(""); setSelectedCity("");
      }
    } catch (err) {
      console.error(err);
      alert(err.message || "Submission failed");
    } finally { setLoading(false); }
  };

  // ---------------- AUTO VERIFY PAYMENT ----------------
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference");
    if (!reference) return;

    async function verifyPayment() {
      try {
        setLoading(true);
        const res = await fetch("https://minimart-ivrm.onrender.com/api/promote/verify", {
          method: "POST",
          headers: { "Content-Type":"application/json", Authorization:`Bearer ${localStorage.getItem("token")}` },
          body: JSON.stringify({ reference })
        });
        const data = await res.json();
        if (res.ok) {
          alert("Payment verified and product saved successfully!");
          window.history.replaceState(null, "", window.location.pathname); // clean URL
        } else {
          alert("Payment verification failed: " + data.message);
        }
      } catch (err) {
        console.error(err);
        alert("Payment verification error");
      } finally { setLoading(false); }
    }

    verifyPayment();
  }, []);

  // ---------------- UI ----------------
  return (
    <div className="add-product-container">
      <button onClick={()=>window.history.back()}>← Back</button>
      <h2>Add Product</h2>

      <input placeholder="Title" value={form.title} onChange={e=>update("title", e.target.value)} />
      <textarea placeholder="Description" value={form.description} onChange={e=>update("description", e.target.value)} />

      <select value={form.mainCategory} onChange={e=>update("mainCategory", e.target.value)}>
        <option value="">Category</option>
        {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {subcategories.length>0 && (
        <select value={form.subCategory} onChange={e=>update("subCategory", e.target.value)}>
          <option value="">Subcategory</option>
          {subcategories.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}

      {dynamicFields.map(field=>{
        const value = form.dynamic[field]; const isArray = field==="features";
        if (field==="used_detail" && form.dynamic.condition!=="Used") return null;
        return (
          <div key={field}>
            <label>{field.replace(/_/g," ").toUpperCase()}</label>
            {!optionsMap[field]?.length ? <input value={value||""} onChange={e=>updateDynamic(field,e.target.value)} />
            : isArray ? optionsMap[field].map(opt=>(
              <label key={opt}>
                <input type="checkbox" checked={value?.includes(opt)} onChange={()=>
                  updateDynamic(field, value?.includes(opt)? value.filter(v=>v!==opt) : [...(value||[]),opt])
                } />
                {opt}
              </label>
            ))
            : <select value={value||""} onChange={e=>updateDynamic(field,e.target.value)}>
                <option value="">Select</option>
                {optionsMap[field].map(opt=><option key={opt}>{opt}</option>)}
              </select>}
          </div>
        )
      })}

      <select value={selectedState} onChange={e=>handleStateChange(e.target.value)}>
        <option value="">Select state</option>
        {states.map(s=><option key={s}>{s}</option>)}
      </select>
      {selectedState && <select value={selectedCity} onChange={e=>handleCityChange(e.target.value)}>
        <option value="">Select city</option>
        {cities.map(c=><option key={c}>{c}</option>)}
      </select>}

      <input placeholder="Price" value={formatPrice(form.price)} onChange={e=>handlePriceChange(e.target.value)} />

      <select value={form.promotionId||""} onChange={e=>update("promotionId", e.target.value)}>
        <option value="">Promotion</option>
        {promotionPlans.map(plan=>{
          const discountPercent = getDiscountPercent(plan.originalPrice, plan.discount);
          const activePrice = getActivePrice(plan.price, plan.discount);
          return <option key={plan.id} value={plan.id}>{plan.name} - ₦{activePrice.toLocaleString()} ({discountPercent}% off)</option>
        })}
      </select>

      <input type="file" multiple onChange={e=>handleImages(e.target.files)} />
      <div className="image-preview">{previewUrls.map((url,i)=><img key={i} src={url} alt="preview" />)}</div>

      <button onClick={handleSubmit} disabled={loading}>{loading?"Saving...":"Add Product"}</button>
    </div>
  )
}