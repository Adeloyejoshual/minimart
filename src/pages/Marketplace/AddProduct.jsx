import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import "./AddProduct.css";

import { categoryFields } from "../../config/categoryFields";
import { categoryRules } from "../../config/categoryRules";
import { brands } from "../../config/brands";
import { models } from "../../config/models";
import { colors } from "../../config/colors";
import { conditions, usedDetails } from "../../config/conditions";
import { engines } from "../../config/engines";
import { featuresByCategory } from "../../config/featuresByCategory";
import { fuelTypes } from "../../config/fuelTypes";
import { ramOptions } from "../../config/ramOptions";
import { sims } from "../../config/sim";
import { storageOptions } from "../../config/storageOptions";
import { years } from "../../config/years";

// -------------------- Reusable Dynamic Field Component --------------------
function DynamicField({ field, formData, handleChange }) {
  const fieldComponents = {
    brand: <select name="brand" value={formData.brand} onChange={handleChange} aria-label="Brand">
      <option value="">Select Brand</option>{brands.map(b => <option key={b} value={b}>{b}</option>)}
    </select>,
    model: <select name="model" value={formData.model} onChange={handleChange} aria-label="Model">
      <option value="">Select Model</option>{(models[formData.brand] || []).map(m => <option key={m} value={m}>{m}</option>)}
    </select>,
    condition: <select name="condition" value={formData.condition} onChange={handleChange} aria-label="Condition">
      <option value="">Condition</option>{conditions.map(c => <option key={c} value={c}>{c}</option>)}
    </select>,
    used_detail: <select name="used_detail" value={formData.used_detail} onChange={handleChange} aria-label="Used Detail">
      <option value="">Used Detail</option>{usedDetails.map(u => <option key={u} value={u}>{u}</option>)}
    </select>,
    ram: <select name="ram" value={formData.ram} onChange={handleChange} aria-label="RAM">
      <option value="">RAM</option>{ramOptions.map(r => <option key={r} value={r}>{r}</option>)}
    </select>,
    storage: <select name="storage" value={formData.storage} onChange={handleChange} aria-label="Storage">
      <option value="">Storage</option>{storageOptions.map(s => <option key={s} value={s}>{s}</option>)}
    </select>,
    color: <select name="color" value={formData.color} onChange={handleChange} aria-label="Color">
      <option value="">Color</option>{colors.map(c => <option key={c} value={c}>{c}</option>)}
    </select>,
    engine: <select name="engine" value={formData.engine} onChange={handleChange} aria-label="Engine">
      <option value="">Engine</option>{engines.map(e => <option key={e} value={e}>{e}</option>)}
    </select>,
    fuel_type: <select name="fuel_type" value={formData.fuel_type} onChange={handleChange} aria-label="Fuel Type">
      <option value="">Fuel Type</option>{fuelTypes.map(f => <option key={f} value={f}>{f}</option>)}
    </select>,
    year: <select name="year" value={formData.year} onChange={handleChange} aria-label="Year">
      <option value="">Year</option>{years.map(y => <option key={y} value={y}>{y}</option>)}
    </select>,
    sim: <select name="sim" value={formData.sim} onChange={handleChange} aria-label="SIM">
      <option value="">SIM</option>{sims.map(s => <option key={s} value={s}>{s}</option>)}
    </select>,
    features: featuresByCategory[formData.category]?.length
      ? <div className="features-multiselect scrollable">
          {featuresByCategory[formData.category].map(f => (
            <label key={f}>
              <input type="checkbox" name="features" value={f} checked={formData.features.includes(f)} onChange={handleChange} />
              {f}
            </label>
          ))}
        </div>
      : <input type="text" name="features" value={formData.features} onChange={handleChange} aria-label="Features" placeholder="Features" />,
  };

  return <div className="field">{fieldComponents[field] || <input type="text" name={field} value={formData[field]} onChange={handleChange} />}</div>;
}

// -------------------- Main Component --------------------
export default function AddProduct() {
  const { user, isAuthenticated, loginWithRedirect, getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [imagesUploading, setImagesUploading] = useState(false);
  const [errors, setErrors] = useState({}); // Inline error messages

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

  // ---------------- Dynamic Fields & Subcategories ----------------
  useEffect(() => {
    if (formData.category) {
      setDynamicFields(categoryFields[formData.category] || []);
      setFormData(prev => ({
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

      const mockSubcategories = {
        "Phones & Tablets": ["Smartphones", "Tablets"],
        Vehicles: ["Cars", "Bikes"],
        "Computers & Laptops": ["Laptops", "Desktops"],
      };
      setSubcategories(mockSubcategories[formData.category] || []);
    }
  }, [formData.category]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, model: "" }));
  }, [formData.brand]);

  // ---------------- Handle Input ----------------
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === "features") {
      const updatedFeatures = checked
        ? [...formData.features, value]
        : formData.features.filter(f => f !== value);
      setFormData(prev => ({ ...prev, features: updatedFeatures }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  // ---------------- Image Upload ----------------
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const rules = categoryRules[formData.category];
    const maxImages = rules?.maxImages || 10;

    if (formData.images.length + files.length > maxImages) {
      return setErrors(prev => ({ ...prev, images: `Maximum ${maxImages} images allowed` }));
    }

    // Optional: file size validation (5MB max)
    const tooLarge = files.find(f => f.size > 5 * 1024 * 1024);
    if (tooLarge) return setErrors(prev => ({ ...prev, images: "One or more images exceed 5MB" }));

    setImagesUploading(true);
    const uploadedImages = await Promise.all(files.map(async (file) => {
      const data = new FormData();
      data.append("file", file);
      data.append("upload_preset", "YOUR_UPLOAD_PRESET"); // Replace
      try {
        const res = await fetch("https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/image/upload", { method: "POST", body: data });
        const result = await res.json();
        return res.ok ? result.secure_url : null;
      } catch (err) {
        console.error("Upload error", err);
        return null;
      }
    }));
    setFormData(prev => ({ ...prev, images: [...prev.images, ...uploadedImages.filter(Boolean)] }));
    setImagesUploading(false);
    setErrors(prev => ({ ...prev, images: "" }));
  };

  // ---------------- Submit ----------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) return loginWithRedirect();

    const rules = categoryRules[formData.category];
    const newErrors = {};

    // Dynamic field validation
    if (rules?.required) {
      for (const field of rules.required) {
        const value = formData[field];
        if (!value || (Array.isArray(value) && value.length === 0)) newErrors[field] = `${field} is required`;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setLoading(true);
      const token = await getAccessTokenSilently();

      await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...formData, poster_name: user?.name }),
      });

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
      setErrors({});
      setLoading(false);

      navigate("/");
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="add-product">
      <h2>Post New Ad</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input id="title" type="text" name="title" value={formData.title} required onChange={handleChange} />
          {errors.title && <p className="error">{errors.title}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="category">Category</label>
          <select id="category" name="category" value={formData.category} required onChange={handleChange}>
            <option value="">Select Category</option>
            {Object.keys(categoryFields).map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          {errors.category && <p className="error">{errors.category}</p>}
        </div>

        {subcategories.length > 0 && (
          <div className="form-group">
            <label htmlFor="subcategory">Subcategory</label>
            <select id="subcategory" name="subcategory" value={formData.subcategory} onChange={handleChange}>
              <option value="">Select Subcategory</option>
              {subcategories.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <p className="info">Selected Subcategory: {formData.subcategory || "None"}</p>
          </div>
        )}

        {dynamicFields.map(field => (
          <div key={field} className="form-group">
            <label>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
            <DynamicField field={field} formData={formData} handleChange={handleChange} />
            {errors[field] && <p className="error">{errors[field]}</p>}
          </div>
        ))}

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" value={formData.description} required onChange={handleChange} />
          {errors.description && <p className="error">{errors.description}</p>}
        </div>

        <div className="form-group">
          <label htmlFor="price">Price</label>
          <input id="price" type="number" name="price" value={formData.price} required onChange={handleChange} />
          {errors.price && <p className="error">{errors.price}</p>}
        </div>

        <div className="form-group">
          <label>Negotiable</label>
          <select name="negotiation" value={formData.negotiation} onChange={handleChange}>
            <option>No</option>
            <option>Yes</option>
          </select>
        </div>

        <div className="form-group">
          <label>Exchange Possible</label>
          <input type="checkbox" name="exchange_possible" checked={formData.exchange_possible} onChange={handleChange} />
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

        <button type="submit" disabled={loading || imagesUploading}>
          {loading ? "Posting..." : "Post Ad"}
        </button>
      </form>
    </div>
  );
}