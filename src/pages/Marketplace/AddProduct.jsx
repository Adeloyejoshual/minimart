import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import "./AddProduct.css";

import { categoryFields } from "../../config/categoryFields";
import { brands } from "../../config/brands";
import { models } from "../../config/models";
import { colors } from "../../config/colors";
import { conditions, usedDetails } from "../../config/conditions";
import { engines } from "../../config/engines";
import { featuresByCategory } from "../../config/featuresByCategory";
import { fieldOptions } from "../../config/fieldOptions";
import { fuelTypes } from "../../config/fuelTypes";
import { locationsByState } from "../../config/locationsByState";
import { ramOptions } from "../../config/ramOptions";
import { sims } from "../../config/sim";
import { storageOptions } from "../../config/storageOptions";
import { years } from "../../config/years";

export default function AddProduct() {
  const { user, isAuthenticated, loginWithRedirect, getAccessTokenSilently } =
    useAuth0();

  const [loading, setLoading] = useState(false);
  const [imagesUploading, setImagesUploading] = useState(false);

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
  });

  const [dynamicFields, setDynamicFields] = useState([]);

  /* ------------------ CATEGORY CHANGE ------------------ */
  useEffect(() => {
    if (formData.category) {
      setDynamicFields(categoryFields[formData.category] || []);
    }
  }, [formData.category]);

  /* ------------------ HANDLE INPUT ------------------ */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  /* ------------------ CLOUDINARY UPLOAD ------------------ */
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setImagesUploading(true);

    const uploadedImages = [];

    for (const file of files) {
      const data = new FormData();
      data.append("file", file);
      data.append("upload_preset", "YOUR_UPLOAD_PRESET");

      const res = await fetch(
        "https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/image/upload",
        {
          method: "POST",
          body: data,
        }
      );

      const result = await res.json();
      uploadedImages.push(result.secure_url);
    }

    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, ...uploadedImages],
    }));

    setImagesUploading(false);
  };

  /* ------------------ RENDER DYNAMIC FIELD ------------------ */
  const renderField = (field) => {
    switch (field) {
      case "brand":
        return (
          <select name="brand" onChange={handleChange}>
            <option value="">Select Brand</option>
            {brands?.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        );

      case "model":
        return (
          <select name="model" onChange={handleChange}>
            <option value="">Select Model</option>
            {(models?.[formData.brand] || []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        );

      case "condition":
        return (
          <select name="condition" onChange={handleChange}>
            <option value="">Condition</option>
            {conditions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        );

      case "used_detail":
        return (
          <select name="used_detail" onChange={handleChange}>
            <option value="">Used Detail</option>
            {usedDetails.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        );

      case "ram":
        return (
          <select name="ram" onChange={handleChange}>
            <option value="">RAM</option>
            {ramOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        );

      case "storage":
        return (
          <select name="storage" onChange={handleChange}>
            <option value="">Storage</option>
            {storageOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        );

      case "color":
        return (
          <select name="color" onChange={handleChange}>
            <option value="">Color</option>
            {colors.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        );

      case "engine":
        return (
          <select name="engine" onChange={handleChange}>
            <option value="">Engine</option>
            {engines.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        );

      case "fuel_type":
        return (
          <select name="fuel_type" onChange={handleChange}>
            <option value="">Fuel Type</option>
            {fuelTypes.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        );

      case "year":
        return (
          <select name="year" onChange={handleChange}>
            <option value="">Year</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        );

      case "sim":
        return (
          <select name="sim" onChange={handleChange}>
            <option value="">SIM</option>
            {sims.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        );

      case "features":
        return (
          <select name="features" onChange={handleChange}>
            <option value="">Features</option>
            {(featuresByCategory[formData.category] || []).map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        );

      default:
        return (
          <input
            type="text"
            name={field}
            placeholder={field.replace("_", " ").toUpperCase()}
            onChange={handleChange}
          />
        );
    }
  };

  /* ------------------ SUBMIT ------------------ */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isAuthenticated) {
      return loginWithRedirect();
    }

    try {
      setLoading(true);

      const token = await getAccessTokenSilently();

      await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          poster_name: user?.name,
        }),
      });

      alert("Product Added Successfully");
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  /* ------------------ UI ------------------ */
  return (
    <div className="add-product">
      <h2>Post New Ad</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="title"
          placeholder="Ad Title"
          required
          onChange={handleChange}
        />

        <select name="category" required onChange={handleChange}>
          <option value="">Select Category</option>
          {Object.keys(categoryFields).map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* Dynamic Fields */}
        {dynamicFields.map((field) => (
          <div key={field} className="field">
            {renderField(field)}
          </div>
        ))}

        <textarea
          name="description"
          placeholder="Description"
          required
          onChange={handleChange}
        />

        <input
          type="number"
          name="price"
          placeholder="Price"
          required
          onChange={handleChange}
        />

        <label>
          Negotiable
          <select name="negotiation" onChange={handleChange}>
            <option>No</option>
            <option>Yes</option>
          </select>
        </label>

        <label>
          Exchange Possible
          <input
            type="checkbox"
            name="exchange_possible"
            onChange={handleChange}
          />
        </label>

        <input type="file" multiple onChange={handleImageUpload} />

        {imagesUploading && <p>Uploading images...</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Posting..." : "Post Ad"}
        </button>
      </form>
    </div>
  );
}