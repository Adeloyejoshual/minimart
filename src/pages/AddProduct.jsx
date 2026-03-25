// src/pages/AddProductPage.jsx
import { useEffect, useState } from "react";

// ✅ LOCAL CONFIG (fallback)
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

  const selectedCategory = categories.find(
    (c) => c.id === form.mainCategory
  );

  const subcategories = selectedCategory?.subcategories || [];

  // ✅ Dynamic fields fallback
  const dynamicFields =
    selectedCategory?.dynamicOptions?.fields ||
    categoryFields[form.mainCategory] ||
    [];

  const options = selectedCategory?.dynamicOptions || {};

  // ✅ Hybrid options
  const optionsMap = {
    brand: options.brands?.length ? options.brands : brands,

    model: options.models?.[form.dynamic.brand]?.length
      ? options.models[form.dynamic.brand]
      : models[form.dynamic.brand] || [],

    color: options.colors?.length ? options.colors : colors,

    condition: options.conditions?.length
      ? options.conditions
      : conditions,

    used_detail: options.usedDetails?.length
      ? options.usedDetails
      : usedDetails,

    ram: options.ram?.length ? options.ram : ramOptions,
    storage: options.storage?.length
      ? options.storage
      : storageOptions,

    sim: options.sims?.length ? options.sims : sims,

    features: options.features?.length
      ? options.features
      : featuresByCategory[form.mainCategory] || [],

    year: options.years?.length ? options.years : years,
    engine: options.engine?.length ? options.engine : engines,
    fuel_type: options.fuel_type?.length
      ? options.fuel_type
      : fuelTypes,
  };

  // ---------------- UPDATE ----------------
  const update = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const updateDynamic = (key, value) =>
    setForm((prev) => ({
      ...prev,
      dynamic: { ...prev.dynamic, [key]: value },
    }));

  // ---------------- RESET DYNAMIC ----------------
  useEffect(() => {
    if (!dynamicFields.length) return;

    const initial = Object.fromEntries(
      dynamicFields.map((f) => [f, f === "features" ? [] : ""])
    );

    setForm((prev) => ({
      ...prev,
      dynamic: initial,
      subCategory: "",
    }));
  }, [selectedCategory]);

  // ✅ Reset model when brand changes
  useEffect(() => {
    updateDynamic("model", "");
  }, [form.dynamic.brand]);

  // ---------------- IMAGES ----------------
  const handleImages = (files) => {
    const arr = Array.from(files);
    setImages(arr);
    setPreviewUrls(arr.map((f) => URL.createObjectURL(f)));
  };

  // ---------------- LOCATION ----------------
  const handleStateChange = (state) => {
    setSelectedState(state);
    setSelectedCity("");
    updateDynamic("location", "");
  };

  const handleCityChange = (city) => {
    setSelectedCity(city);
    updateDynamic("location", city);
  };

  // ---------------- PRICE ----------------
  const handlePriceChange = (value) => {
    const numeric = value.replace(/[^0-9.]/g, "");
    update("price", numeric);
  };

  const formatPrice = (price) => {
    if (!price) return "";
    const [int, dec] = price.toString().split(".");
    return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (dec ? "." + dec : "");
  };

  // ---------------- SUBMIT ----------------
  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.mainCategory) {
      return alert("Title, price, and category are required");
    }

    if (!images.length) {
      return alert("Upload at least one image");
    }

    const cleanedDynamic = Object.fromEntries(
      Object.entries(form.dynamic).filter(
        ([_, v]) =>
          v !== "" &&
          v !== null &&
          !(Array.isArray(v) && v.length === 0)
      )
    );

    try {
      setLoading(true);

      // ---------- PROMOTION ----------
      if (form.promotionId) {
        const plan = promotionPlans.find(
          (p) => p.id == form.promotionId
        );

        if (!plan) return alert("Invalid promotion plan");

        // ✅ FIXED: use plan price
        const amount = getActivePrice(
          plan.price,
          plan.discount
        );

        const res = await fetch(
          "https://minimart-ivrm.onrender.com/api/promote/init",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount }),
          }
        );

        const data = await res.json();

        if (!res.ok) throw new Error(data.message);

        // redirect to paystack
        window.location.href = data.data.authorization_url;
        return;
      }

      // ---------- NORMAL PRODUCT ----------
      const formData = new FormData();

      formData.append("title", form.title);
      formData.append("description", form.description);
      formData.append("price", form.price);
      formData.append("category_id", form.mainCategory);

      if (form.subCategory) {
        formData.append("subcategory_id", form.subCategory);
      }

      formData.append(
        "dynamicFields",
        JSON.stringify(cleanedDynamic)
      );

      // ✅ location included
      if (selectedCity) {
        formData.append("location", selectedCity);
      }

      images.forEach((img) =>
        formData.append("images", img)
      );

      const res = await fetch(
        "https://minimart-ivrm.onrender.com/api/marketplace/products",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      alert("Product added successfully!");

      // RESET
      setForm({
        title: "",
        description: "",
        price: "",
        mainCategory: "",
        subCategory: "",
        dynamic: {},
        promotionId: "",
      });

      setImages([]);
      setPreviewUrls([]);
      setSelectedState("");
      setSelectedCity("");
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- UI ----------------
  return (
    <div className="add-product-container">
      <button onClick={() => window.history.back()}>
        ← Back
      </button>

      <h2>Add Product</h2>

      {/* TITLE */}
      <input
        placeholder="Title"
        value={form.title}
        onChange={(e) => update("title", e.target.value)}
      />

      {/* DESCRIPTION */}
      <textarea
        placeholder="Description"
        value={form.description}
        onChange={(e) => update("description", e.target.value)}
      />

      {/* CATEGORY */}
      <select
        value={form.mainCategory}
        onChange={(e) => update("mainCategory", e.target.value)}
      >
        <option value="">Category</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {/* SUBCATEGORY */}
      {subcategories.length > 0 && (
        <select
          value={form.subCategory}
          onChange={(e) => update("subCategory", e.target.value)}
        >
          <option value="">Subcategory</option>
          {subcategories.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}

      {/* DYNAMIC FIELDS */}
      {dynamicFields.map((field) => {
        const value = form.dynamic[field];
        const isArray = field === "features";

        if (
          field === "used_detail" &&
          form.dynamic.condition !== "Used"
        )
          return null;

        return (
          <div key={field}>
            <label>{field}</label>

            {!optionsMap[field]?.length ? (
              <input
                value={value || ""}
                onChange={(e) =>
                  updateDynamic(field, e.target.value)
                }
              />
            ) : isArray ? (
              optionsMap[field].map((opt) => (
                <label key={opt}>
                  <input
                    type="checkbox"
                    checked={value?.includes(opt)}
                    onChange={() =>
                      updateDynamic(
                        field,
                        value?.includes(opt)
                          ? value.filter((v) => v !== opt)
                          : [...(value || []), opt]
                      )
                    }
                  />
                  {opt}
                </label>
              ))
            ) : (
              <select
                value={value || ""}
                onChange={(e) =>
                  updateDynamic(field, e.target.value)
                }
              >
                <option value="">Select</option>
                {optionsMap[field].map((opt) => (
                  <option key={opt}>{opt}</option>
                ))}
              </select>
            )}
          </div>
        );
      })}

      {/* STATE */}
      <select
        value={selectedState}
        onChange={(e) => handleStateChange(e.target.value)}
      >
        <option value="">Select state</option>
        {states.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>

      {/* CITY */}
      {selectedState && (
        <select
          value={selectedCity}
          onChange={(e) => handleCityChange(e.target.value)}
        >
          <option value="">Select city</option>
          {cities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      )}

      {/* PRICE */}
      <input
        value={formatPrice(form.price)}
        onChange={(e) =>
          handlePriceChange(e.target.value)
        }
        placeholder="Price"
      />

      {/* PROMOTION */}
      <select
        value={form.promotionId || ""}
        onChange={(e) => update("promotionId", e.target.value)}
      >
        <option value="">Promotion</option>
        {promotionPlans.map((plan) => {
          const discountPercent = getDiscountPercent(
            plan.originalPrice,
            plan.discount
          );
          const activePrice = getActivePrice(
            plan.price,
            plan.discount
          );

          return (
            <option key={plan.id} value={plan.id}>
              {plan.name} - ₦{activePrice.toLocaleString()} (
              {discountPercent}% off)
            </option>
          );
        })}
      </select>

      {/* IMAGES */}
      <input
        type="file"
        multiple
        onChange={(e) => handleImages(e.target.files)}
      />

      <div className="image-preview">
        {previewUrls.map((url, i) => (
          <img key={i} src={url} alt="preview" />
        ))}
      </div>

      {/* SUBMIT */}
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Saving..." : "Add Product"}
      </button>
    </div>
  );
}