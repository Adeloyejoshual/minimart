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

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    mainCategory: "",
    subCategory: "",
    dynamic: {},
    promotionId: "",
  });

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

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const updateDynamic = (key, value) =>
    setForm(prev => ({ ...prev, dynamic: { ...prev.dynamic, [key]: value } }));

  // ---------------- RESET DYNAMIC FIELDS (Preserve existing) ----------------
  useEffect(() => {
    if (!selectedCategory) return;

    setForm(prev => {
      const updatedDynamic = { ...prev.dynamic };

      // Initialize missing dynamic fields only
      dynamicFields.forEach(f => {
        if (f === "features") {
          if (!Array.isArray(updatedDynamic[f])) updatedDynamic[f] = [];
        } else if (!(f in updatedDynamic)) {
          updatedDynamic[f] = "";
        }
      });

      // Always update location
      updatedDynamic.location = { state: selectedState || "", city: selectedCity || "" };

      return { ...prev, dynamic: updatedDynamic };
    });

    // Reset subcategory only when mainCategory changes
    setForm(prev => ({ ...prev, subCategory: "" }));
  }, [selectedCategory, dynamicFields, selectedState, selectedCity]);

  // ---------------- IMAGE PREVIEWS ----------------
  const handleImages = files => {
    const arr = Array.from(files).slice(0, 8 - images.length); // max 8 images
    setImages(prev => [...prev, ...arr]);
    setPreviewUrls(prev => [...prev, ...arr.map(f => URL.createObjectURL(f))]);
  };
  const removeImage = index => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  // ---------------- STATE & CITY ----------------
  const handleStateChange = state => {
    setSelectedState(state);
    setSelectedCity("");
    updateDynamic("location", { state, city: "" });
  };
  const handleCityChange = city => {
    setSelectedCity(city);
    updateDynamic("location", { state: selectedState, city });
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

    try {
      setLoading(true);

      // 1️⃣ Create product first (without images)
      const productRes = await fetch(
        "https://minimart-ivrm.onrender.com/api/marketplace/products",
        {
          method: "POST",
          body: JSON.stringify({
            title: form.title,
            description: form.description,
            price: parseFloat(form.price),
            category_id: form.mainCategory,
            subcategory_id: form.subCategory || null,
            dynamicFields: cleanedDynamic,
            promotion_id: form.promotionId || null,
          }),
          headers: { "Content-Type": "application/json" },
        }
      );
      const productData = await productRes.json();
      if (!productRes.ok) throw new Error(productData.message || "Failed to create product");

      const productId = productData.id;

      // 2️⃣ Upload all images in parallel
      await Promise.all(
        images.map(async (img, index) => {
          const fd = new FormData();
          fd.append("product_id", productId);
          fd.append("images", img);

          const res = await fetch(
            `https://minimart-ivrm.onrender.com/api/marketplace/products/${productId}/images`,
            { method: "POST", body: fd }
          );

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.message || `Failed to upload image #${index + 1}`);
          }
        })
      );

      // ✅ Success
      alert("Product added successfully!");
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

  return (
    <div className="add-product-container">
      <h2>Add Product</h2>

      {/* TITLE */}
      <div className="field">
        <label>Title</label>
        <input
          value={form.title}
          onChange={e => update("title", e.target.value)}
          placeholder="e.g iPhone 13"
        />
      </div>

      {/* DESCRIPTION */}
      <div className="field">
        <label>Description</label>
        <textarea
          value={form.description}
          onChange={e => update("description", e.target.value)}
          placeholder="Write product details here..."
        />
      </div>

      {/* CATEGORY & SUBCATEGORY */}
      <DropdownModal
        label="Category"
        value={form.mainCategory}
        onChange={val => update("mainCategory", val)}
        options={categories.map(c => ({ id: c.id, name: c.name }))}
      />
      {subcategories.length > 0 && (
        <DropdownModal
          label="Subcategory"
          value={form.subCategory}
          onChange={val => update("subCategory", val)}
          options={subcategories.map(s => ({ id: s.id, name: s.name }))}
        />
      )}

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
                  <input
                    type="checkbox"
                    checked={current.includes(opt)}
                    onChange={() =>
                      updateDynamic(
                        field,
                        current.includes(opt)
                          ? current.filter(v => v !== opt)
                          : [...current, opt]
                      )
                    }
                  />
                  {opt}
                </label>
              ))}
            </div>
          );
        }

        return (
          <DropdownModal
            key={field}
            label={field.replace(/_/g, " ").toUpperCase()}
            value={value || ""}
            onChange={val => updateDynamic(field, val)}
            options={optionsMap[field]}
          />
        );
      })}

      {/* STATE & CITY */}
      <DropdownModal
        label="State"
        value={selectedState}
        onChange={handleStateChange}
        options={states}
      />
      {selectedState && (
        <DropdownModal
          label="City"
          value={selectedCity}
          onChange={handleCityChange}
          options={cities}
        />
      )}

      {/* PRICE */}
      <div className="field">
        <label>Price (₦)</label>
        <input
          type="text"
          value={formatPrice(form.price)}
          onChange={e => handlePriceChange(e.target.value)}
        />
      </div>

      {/* PROMOTION */}
      <DropdownModal
        label="Promotion"
        value={form.promotionId}
        onChange={val => update("promotionId", val)}
        options={promotionPlans.map(plan => {
          const activePrice = getActivePrice(plan.price, plan.discount);
          const discountPercent = getDiscountPercent(plan.originalPrice, plan.discount);
          return {
            id: plan.id,
            name: `${plan.name} - ₦${activePrice.toLocaleString()} (${discountPercent}% off)`,
          };
        })}
      />

      {/* IMAGES */}
      <div className="field">
        <label>Images (max 8)</label>
        <div className="image-grid">
          {previewUrls.map((url, i) => (
            <div key={i} className="preview-wrapper">
              <img src={url} alt={`preview ${i}`} />
              <button type="button" className="remove-btn" onClick={() => removeImage(i)}>
                ✕
              </button>
            </div>
          ))}

          {/* + Add More Button */}
          {images.length + previewUrls.length < 8 && (
            <div className="add-more-wrapper">
              <label htmlFor="add-more-input" className="add-more-btn">＋</label>
              <input
                id="add-more-input"
                type="file"
                multiple
                accept="image/*"
                style={{ display: "none" }}
                onChange={e => handleImages(e.target.files)}
              />
            </div>
          )}
        </div>
      </div>

      {/* SUBMIT */}
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Saving..." : "Add Product"}
      </button>
    </div>
  );
}