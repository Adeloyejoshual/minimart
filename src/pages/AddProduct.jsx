import { useEffect, useState, useCallback } from "react";
import { models, getModelsByCategoryBrand } from "../../config/models";
import { brands } from "../../config/brands";
import "./AddProduct.css";

export default function AddProduct() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  
  // Enhanced form with validation
  const [form, setForm] = useState({
    title: "",
    price: "",
    mainCategory: "",
    dynamic: {},
  });
  const [errors, setErrors] = useState({});

  // ---------------- FETCH CATEGORIES ----------------
  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then(res => res.json())
      .then(setCategories)
      .catch(err => console.error("Failed to fetch categories", err));
  }, []);

  // ---------------- HELPERS ----------------
  const selectedCategory = categories.find(c => c.id === form.mainCategory);
  const parseFields = (fields) => {
    try {
      return typeof fields === "string" ? JSON.parse(fields) : fields || [];
    } catch {
      return [];
    }
  };

  const dynamicFields = parseFields(selectedCategory?.fields);
  
  // Get brand options for current category
  const brandOptions = brands[selectedCategory?.name] || [];
  
  // Get model options based on selected brand
  const modelOptions = getModelsByCategoryBrand(
    selectedCategory?.name, 
    form.dynamic.brand
  );

  const update = useCallback((key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    // Clear related errors
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: "" }));
  }, [errors]);

  const updateDynamic = useCallback((key, value) => {
    setForm(prev => ({
      ...prev,
      dynamic: { ...prev.dynamic, [key]: value },
    }));
  }, []);

  // ---------------- RESET DYNAMIC FIELDS ----------------
  useEffect(() => {
    if (!selectedCategory) return;
    
    const initialDynamic = Object.fromEntries(
      dynamicFields.map(field => 
        field.type === "multiselect" ? [field.name, []] : [field.name, ""]
      )
    );
    
    setForm(prev => ({ ...prev, dynamic: initialDynamic }));
    setErrors({});
  }, [selectedCategory, dynamicFields]);

  // ---------------- VALIDATION ----------------
  const validateForm = () => {
    const newErrors = {};
    
    if (!form.title.trim()) newErrors.title = "Title is required";
    if (!form.price || form.price <= 0) newErrors.price = "Valid price required";
    if (!form.mainCategory) newErrors.mainCategory = "Category required";
    
    dynamicFields.forEach(field => {
      const value = form.dynamic[field.name];
      if (!value || (Array.isArray(value) && value.length === 0)) {
        newErrors[field.name] = `${field.name} is required`;
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ---------------- SUBMIT ----------------
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      setLoading(true);
      const formData = new FormData();
      
      formData.append("title", form.title);
      formData.append("price", form.price);
      formData.append("category_id", form.mainCategory);
      formData.append("dynamicFields", JSON.stringify(form.dynamic));
      
      images.forEach(img => formData.append("images", img));
      
      const res = await fetch(
        "https://minimart-ivrm.onrender.com/api/marketplace/products",
        { method: "POST", body: formData }
      );
      
      if (res.ok) {
        alert("✅ Product added successfully!");
        setForm({ title: "", price: "", mainCategory: "", dynamic: {} });
        setImages([]);
      } else {
        alert("Failed to add product");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to add product");
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
          onChange={(e) => update("title", e.target.value)}
          placeholder="e.g iPhone 16 Pro Max, Toyota Corolla 2023"
          className={errors.title ? "error" : ""}
        />
        {errors.title && <span className="error-text">{errors.title}</span>}
      </div>

      {/* CATEGORY */}
      <div className="field">
        <label>Category</label>
        <select
          value={form.mainCategory}
          onChange={(e) => update("mainCategory", e.target.value)}
          className={errors.mainCategory ? "error" : ""}
        >
          <option value="">Select category</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {/* DYNAMIC FIELDS WITH YOUR CONFIGS */}
      {dynamicFields.map(field => {
        const value = form.dynamic[field.name];
        
        // Hide used_detail unless condition is "Used"
        if (field.name === "used_detail" && form.dynamic.condition !== "Used") {
          return null;
        }

        // Special handling for brand field - use your config
        if (field.name === "brand") {
          return (
            <div className="field" key={field.name}>
              <label>{field.label || "Brand"}</label>
              <select
                value={value || ""}
                onChange={(e) => updateDynamic(field.name, e.target.value)}
                className={errors[field.name] ? "error" : ""}
              >
                <option value="">{brandOptions.length} brands available</option>
                {brandOptions.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
              {errors[field.name] && (
                <span className="error-text">{errors[field.name]}</span>
              )}
            </div>
          );
        }

        // Special handling for model field - dynamic from your models.js
        if (field.name === "model") {
          return (
            <div className="field" key={field.name}>
              <label>{field.label || "Model"}</label>
              <select
                value={value || ""}
                onChange={(e) => updateDynamic(field.name, e.target.value)}
                className={errors[field.name] ? "error" : ""}
                disabled={!form.dynamic.brand}
              >
                <option value="">
                  {form.dynamic.brand 
                    ? `${modelOptions.length} models` 
                    : "Select brand first"
                  }
                </option>
                {modelOptions.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
              {errors[field.name] && (
                <span className="error-text">{errors[field.name]}</span>
              )}
            </div>
          );
        }

        return (
          <div className="field" key={field.name}>
            <label>{field.name.replace(/_/g, " ").toUpperCase()}</label>
            
            {field.type === "text" && (
              <input
                value={value || ""}
                onChange={(e) => updateDynamic(field.name, e.target.value)}
                placeholder={`Enter ${field.name.replace("_", " ")}`}
                className={errors[field.name] ? "error" : ""}
              />
            )}

            {field.type === "select" && field.name !== "brand" && (
              <select
                value={value || ""}
                onChange={(e) => updateDynamic(field.name, e.target.value)}
                className={errors[field.name] ? "error" : ""}
              >
                <option value="">Select {field.name}</option>
                {field.options?.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}

            {field.type === "multiselect" && (
              <div className="multi-select">
                {field.options?.map(opt => {
                  const current = Array.isArray(value) ? value : [];
                  return (
                    <label key={opt}>
                      <input
                        type="checkbox"
                        checked={current.includes(opt)}
                        onChange={() => {
                          if (current.includes(opt)) {
                            updateDynamic(field.name, current.filter(v => v !== opt));
                          } else {
                            updateDynamic(field.name, [...current, opt]);
                          }
                        }}
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>
            )}
            
            {errors[field.name] && (
              <span className="error-text">{errors[field.name]}</span>
            )}
          </div>
        );
      })}

      {/* PRICE */}
      <div className="field">
        <label>Price (₦)</label>
        <input
          type="number"
          min="0"
          step="1000"
          value={form.price}
          onChange={(e) => update("price", e.target.value)}
          className={errors.price ? "error" : ""}
          placeholder="50000"
        />
        {errors.price && <span className="error-text">{errors.price}</span>}
      </div>

      {/* IMAGES */}
      <div className="field">
        <label>Images (Max 8)</label>
        <input
          type="file"
          multiple
          accept="image/*"
          max={8}
          onChange={(e) => setImages(Array.from(e.target.files).slice(0, 8))}
        />
        <div>{images.length}/8 images selected</div>
      </div>

      {/* SUBMIT */}
      <button 
        onClick={handleSubmit} 
        disabled={loading || Object.keys(errors).length > 0}
        className="submit-btn"
      >
        {loading ? "⏳ Publishing..." : "🚀 Publish Product"}
      </button>
    </div>
  );
}