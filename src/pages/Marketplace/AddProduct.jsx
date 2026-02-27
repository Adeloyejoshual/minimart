import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import { loadScript } from "@paystack/inline-js";

import "./AddProduct.css";
import { categoryFields } from "../config/categoryFields";
import { categoryRules } from "../config/categoryRules";
import { brands } from "../config/brands";
import { models } from "../config/models";
import { colors } from "../config/colors";
import { conditions, usedDetails } from "../config/conditions";
import { engines } from "../config/engines";
import { featuresByCategory } from "../config/featuresByCategory";
import { fuelTypes } from "../config/fuelTypes";
import { ramOptions } from "../config/ramOptions";
import { sims } from "../config/sim";
import { storageOptions } from "../config/storageOptions";
import { years } from "../config/years";
import { promotionPlans, getActivePrice } from "../config/promotion";

// ---------------- DynamicField Component ----------------
function DynamicField({ field, formData, handleChange, currentCategory }) {
  const fieldComponents = {
    brand: (
      <select name="brand" value={formData.brand} onChange={handleChange}>
        <option value="">Select Brand</option>
        {(brandsByCategory[currentCategory] || []).map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>
    ),
    model: (
      <select name="model" value={formData.model} onChange={handleChange}>
        <option value="">Select Model</option>
        {(models[formData.brand] || []).map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    ),
    condition: (
      <select name="condition" value={formData.condition} onChange={handleChange}>
        <option value="">Condition</option>
        {conditions.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    ),
    used_detail: (
      <select name="used_detail" value={formData.used_detail} onChange={handleChange}>
        <option value="">Used Detail</option>
        {usedDetails.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
    ),
    ram: (
      <select name="ram" value={formData.ram} onChange={handleChange}>
        <option value="">RAM</option>
        {ramOptions.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
    ),
    storage: (
      <select name="storage" value={formData.storage} onChange={handleChange}>
        <option value="">Storage</option>
        {storageOptions.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    ),
    color: (
      <select name="color" value={formData.color} onChange={handleChange}>
        <option value="">Color</option>
        {colors.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    ),
    engine: (
      <select name="engine" value={formData.engine} onChange={handleChange}>
        <option value="">Engine</option>
        {engines.map((e) => <option key={e} value={e}>{e}</option>)}
      </select>
    ),
    fuel_type: (
      <select name="fuel_type" value={formData.fuel_type} onChange={handleChange}>
        <option value="">Fuel Type</option>
        {fuelTypes.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
    ),
    year: (
      <select name="year" value={formData.year} onChange={handleChange}>
        <option value="">Year</option>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    ),
    sim: (
      <select name="sim" value={formData.sim} onChange={handleChange}>
        <option value="">SIM</option>
        {sims.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    ),
    features:
      (featuresByCategory[currentCategory] || []).length > 0 ? (
        <div className="features-multiselect scrollable">
          {featuresByCategory[currentCategory].map((f) => (
            <label key={f}>
              <input
                type="checkbox"
                name="features"
                value={f}
                checked={formData.features.includes(f)}
                onChange={handleChange}
              />
              {f}
            </label>
          ))}
        </div>
      ) : (
        <input type="text" name="features" value={formData.features} onChange={handleChange} placeholder="Features" />
      ),
  };

  return <div className="field">{fieldComponents[field] || <input type="text" name={field} value={formData[field]} onChange={handleChange} />}</div>;
}

// ---------------- Brands by Category ----------------
const brandsByCategory = {
  "Phones & Tablets": ["Apple", "Samsung", "Tecno", "Infinix"],
  "Computers & Laptops": ["Dell", "HP", "Apple"],
  Vehicles: ["Toyota", "Honda", "Lexus"],
};

// ---------------- Main Component ----------------
export default function AddProduct() {
  const { user, isAuthenticated, loginWithRedirect } = useAuth0();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [imagesUploading, setImagesUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [selectedPlan, setSelectedPlan] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    category: "",
    subcategory: "",
    description: "",
    price: "",
    negotiation: "No",
    exchange_possible: false,
    country: "Nigeria",
    state: "",
    city: "",
    location: "",
    images: [],
    brand: "",
    model: "",
    condition: "",
    used_detail: "",
    ram: "",
    storage: "",
    color: "",
    engine: "",
    fuel_type: "",
    year: "",
    sim: "",
    features: [],
  });

  const [dynamicFields, setDynamicFields] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const currentCategory = formData.category;

  // ---------------- Category change ----------------
  useEffect(() => {
    if (currentCategory) {
      setDynamicFields(categoryFields[currentCategory] || []);

      const subcats = {
        "Phones & Tablets": ["Smartphones", "Tablets"],
        "Computers & Laptops": ["Laptops", "Desktops"],
        Vehicles: ["Cars", "Bikes"],
      };
      setSubcategories(subcats[currentCategory] || []);

      setFormData((prev) => ({
        ...prev,
        brand: "",
        model: "",
        condition: "",
        used_detail: "",
        ram: "",
        storage: "",
        color: "",
        engine: "",
        fuel_type: "",
        year: "",
        sim: "",
        features: [],
        subcategory: "",
      }));
    }
  }, [currentCategory]);

  // Reset model when brand changes
  useEffect(() => setFormData((prev) => ({ ...prev, model: "" })), [formData.brand]);

  // ---------------- Handle input ----------------
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === "features") {
      const updatedFeatures = checked
        ? [...formData.features, value]
        : formData.features.filter((f) => f !== value);
      setFormData((prev) => ({ ...prev, features: updatedFeatures }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  // ---------------- Image Upload ----------------
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const maxImages = categoryRules[currentCategory]?.maxImages || 10;
    if (formData.images.length + files.length > maxImages) {
      return setErrors((prev) => ({ ...prev, images: `Maximum ${maxImages} images allowed` }));
    }

    if (files.some((f) => f.size > 5 * 1024 * 1024)) {
      return setErrors((prev) => ({ ...prev, images: "One or more images exceed 5MB" }));
    }

    setImagesUploading(true);
    const uploadedImages = await Promise.all(
      files.map(async (file) => {
        const data = new FormData();
        data.append("file", file);
        data.append("upload_preset", "YOUR_UPLOAD_PRESET"); // Replace
        try {
          const res = await fetch("https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/image/upload", {
            method: "POST",
            body: data,
          });
          const result = await res.json();
          return res.ok ? result.secure_url : null;
        } catch (err) {
          console.error("Upload error", err);
          return null;
        }
      })
    );

    setFormData((prev) => ({ ...prev, images: [...prev.images, ...uploadedImages.filter(Boolean)] }));
    setImagesUploading(false);
    setErrors((prev) => ({ ...prev, images: "" }));
  };

  // ---------------- Paystack Checkout ----------------
  const handlePaystackPayment = async (plan) => {
    if (!isAuthenticated) return loginWithRedirect();
    const amountNGN = getActivePrice(plan.price, plan.discount) * 100;
    const paystackPublicKey = import.meta.env.VITE_PAYSTACK_KEY;

    const script = await loadScript("https://js.paystack.co/v1/inline.js");
    if (!script) return alert("Failed to load Paystack");

    const handler = window.PaystackPop.setup({
      key: paystackPublicKey,
      email: user.email,
      amount: amountNGN,
      currency: "NGN",
      ref: `PS-${Date.now()}`,
      onClose: () => alert("Payment cancelled"),
      callback: () => {
        alert("Payment successful!");
        setSelectedPlan(plan);
      },
    });

    handler.openIframe();
  };

  // ---------------- Submit ----------------
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isAuthenticated) return loginWithRedirect();

    const rules = categoryRules[currentCategory];
    const newErrors = {};

    if (rules?.required) {
      for (const field of rules.required) {
        const value = formData[field];
        if (!value || (Array.isArray(value) && value.length === 0))
          newErrors[field] = `${field} is required`;
      }
    }

    if (!formData.title) newErrors.title = "Title is required";
    if (!formData.category) newErrors.category = "Category is required";
    if (!formData.description) newErrors.description = "Description is required";
    if (!formData.price) newErrors.price = "Price is required";
    if (!selectedPlan) newErrors.plan = "Please select a promotion plan";

    if (Object.keys(newErrors).length) return setErrors(newErrors);

    const productData = {
      ...formData,
      poster_name: user?.name,
      promo_plan: selectedPlan?.name,
    };

    console.log("Product Submitted:", productData);

    // Reset form
    setFormData({
      title: "",
      category: "",
      subcategory: "",
      description: "",
      price: "",
      negotiation: "No",
      exchange_possible: false,
      country: "Nigeria",
      state: "",
      city: "",
      location: "",
      images: [],
      brand: "",
      model: "",
      condition: "",
      used_detail: "",
      ram: "",
      storage: "",
      color: "",
      engine: "",
      fuel_type: "",
      year: "",
      sim: "",
      features: [],
    });
    setDynamicFields([]);
    setSubcategories([]);
    setSelectedPlan(null);
    setErrors({});
    navigate("/");
  };

  return (
    <div className="add-product">
      <h2>Post New Ad</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Title</label>
          <input type="text" name="title" value={formData.title} onChange={handleChange} />
          {errors.title && <p className="error">{errors.title}</p>}
        </div>

        <div className="form-group">
          <label>Category</label>
          <select name="category" value={formData.category} onChange={handleChange}>
            <option value="">Select Category</option>
            {Object.keys(categoryFields).map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          {errors.category && <p className="error">{errors.category}</p>}
        </div>

        {subcategories.length > 0 && (
          <div className="form-group">
            <label>Subcategory</label>
            <select name="subcategory" value={formData.subcategory} onChange={handleChange}>
              <option value="">Select Subcategory</option>
              {subcategories.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        {dynamicFields.map((field) => (
          <div key={field} className="form-group">
            <label>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
            <DynamicField field={field} formData={formData} handleChange={handleChange} currentCategory={currentCategory} />
            {errors[field] && <p className="error">{errors[field]}</p>}
          </div>
        ))}

        <div className="form-group">
          <label>Description</label>
          <textarea name="description" value={formData.description} onChange={handleChange} />
          {errors.description && <p className="error">{errors.description}</p>}
        </div>

        <div className="form-group">
          <label>Price (NGN)</label>
          <input type="number" name="price" value={formData.price} onChange={handleChange} />
          {errors.price && <p className="error">{errors.price}</p>}
        </div>

        <div className="form-group">
          <label>Promotion Plan</label>
          <div className="plans">
            {promotionPlans.map((plan) => (
              <div
                key={plan.id}
                className={`plan ${selectedPlan?.id === plan.id ? "selected" : ""}`}
                onClick={() => handlePaystackPayment(plan)}
              >
                <plan.icon size={24} />
                <h4>{plan.name}</h4>
                <p>{getActivePrice(plan.price, plan.discount).toLocaleString()} NGN {plan.discount > 0 && <span className="discount">({plan.discount} NGN OFF)</span>}</p>
              </div>
            ))}
          </div>
          {errors.plan && <p className="error">{errors.plan}</p>}
        </div>

        <div className="form-group">
          <label>Images</label>
          <input type="file" multiple onChange={handleImageUpload} />
          {imagesUploading && <p>Uploading images...</p>}
          {errors.images && <p className="error">{errors.images}</p>}
        </div>

        <div className="image-preview">
          {formData.images.map((url, idx) => <img key={idx} src={url} alt="preview" />)}
        </div>

        <button type="submit" disabled={loading || imagesUploading}>{loading ? "Posting..." : "Post Ad"}</button>
      </form>
    </div>
  );
}