// src/components/AddProduct.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";

// Config imports
import { categoryFields } from "../config/categoryFields";
import { brands } from "../config/brands";
import { colors } from "../config/colors";
import { conditions, usedDetails } from "../config/conditions";
import { engines } from "../config/engines";
import { featuresByCategory } from "../config/featuresByCategory";
import { fuelTypes } from "../config/fuelTypes";
import { models } from "../config/models";
import { ramOptions } from "../config/ramOptions";
import { sims } from "../config/sim";
import { storageOptions } from "../config/storageOptions";
import { years } from "../config/years";
import { locationsByState } from "../config/locationsByState";
import { fieldOptions } from "../config/fieldOptions";

const API = "https://minimart-ivrm.onrender.com/api";

const AddProduct = () => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState(0);
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [categories, setCategories] = useState([]);
  const [images, setImages] = useState([]);
  const [dynamicFields, setDynamicFields] = useState({});
  const [isPromoted, setIsPromoted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch categories from backend
  useEffect(() => {
    axios
      .get(`${API}/categories`)
      .then((res) => setCategories(res.data))
      .catch((err) => console.error("Failed to load categories", err));
  }, []);

  const handleImageChange = (e) => setImages([...e.target.files]);

  const handleDynamicFieldChange = (field, value) => {
    setDynamicFields((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !price || !categoryId) {
      alert("Title, price, and category are required");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("price", price);
    formData.append("stock", stock);
    formData.append("category_id", categoryId);
    if (subcategoryId) formData.append("subcategory_id", subcategoryId);
    formData.append("isPromoted", isPromoted);
    formData.append("dynamicFields", JSON.stringify(dynamicFields));

    images.forEach((img) => formData.append("images", img));

    try {
      setLoading(true);
      const { data } = await axios.post(`${API}/products`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert(`Product "${data.title}" added successfully!`);

      // Reset form
      setTitle("");
      setDescription("");
      setPrice("");
      setStock(0);
      setCategoryId("");
      setSubcategoryId("");
      setImages([]);
      setDynamicFields({});
      setIsPromoted(false);
    } catch (err) {
      console.error(err);
      alert("Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  // Get dynamic fields for selected category
  const selectedFields = categoryFields[categoryId] || [];

  const renderFieldInput = (field) => {
    switch (field) {
      case "brand":
        return (
          <select key={field} value={dynamicFields[field] || ""} onChange={(e) => handleDynamicFieldChange(field, e.target.value)}>
            <option value="">Select Brand</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        );
      case "model":
        return (
          <select key={field} value={dynamicFields[field] || ""} onChange={(e) => handleDynamicFieldChange(field, e.target.value)}>
            <option value="">Select Model</option>
            {models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        );
      case "color":
        return (
          <select key={field} value={dynamicFields[field] || ""} onChange={(e) => handleDynamicFieldChange(field, e.target.value)}>
            <option value="">Select Color</option>
            {colors.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        );
      case "condition":
        return (
          <select key={field} value={dynamicFields[field] || ""} onChange={(e) => handleDynamicFieldChange(field, e.target.value)}>
            <option value="">Select Condition</option>
            {conditions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        );
      case "used_detail":
        return (
          <select key={field} value={dynamicFields[field] || ""} onChange={(e) => handleDynamicFieldChange(field, e.target.value)}>
            <option value="">Select Usage</option>
            {usedDetails.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        );
      case "ram":
        return (
          <select key={field} value={dynamicFields[field] || ""} onChange={(e) => handleDynamicFieldChange(field, e.target.value)}>
            <option value="">Select RAM</option>
            {ramOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        );
      case "storage":
        return (
          <select key={field} value={dynamicFields[field] || ""} onChange={(e) => handleDynamicFieldChange(field, e.target.value)}>
            <option value="">Select Storage</option>
            {storageOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        );
      case "engine":
        return (
          <select key={field} value={dynamicFields[field] || ""} onChange={(e) => handleDynamicFieldChange(field, e.target.value)}>
            <option value="">Select Engine</option>
            {engines.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        );
      case "sim":
        return (
          <select key={field} value={dynamicFields[field] || ""} onChange={(e) => handleDynamicFieldChange(field, e.target.value)}>
            <option value="">Select SIM</option>
            {sims.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        );
      case "year":
        return (
          <select key={field} value={dynamicFields[field] || ""} onChange={(e) => handleDynamicFieldChange(field, e.target.value)}>
            <option value="">Select Year</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        );
      case "fuel_type":
        return (
          <select key={field} value={dynamicFields[field] || ""} onChange={(e) => handleDynamicFieldChange(field, e.target.value)}>
            <option value="">Select Fuel Type</option>
            {fuelTypes.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        );
      case "location":
        return (
          <select key={field} value={dynamicFields[field] || ""} onChange={(e) => handleDynamicFieldChange(field, e.target.value)}>
            <option value="">Select Location</option>
            {Object.entries(locationsByState).map(([state, areas]) => (
              <optgroup key={state} label={state}>
                {areas.map((area) => <option key={area} value={area}>{area}</option>)}
              </optgroup>
            ))}
          </select>
        );
      default:
        return (
          <input
            key={field}
            type="text"
            placeholder={field}
            value={dynamicFields[field] || ""}
            onChange={(e) => handleDynamicFieldChange(field, e.target.value)}
          />
        );
    }
  };

  return (
    <div className="add-product-form">
      <h2>Add Product</h2>
      <form onSubmit={handleSubmit}>
        <input type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />

        <input type="number" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} required />
        <input type="number" placeholder="Stock" value={stock} onChange={(e) => setStock(e.target.value)} />

        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
          <option value="">Select Category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        <select value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)}>
          <option value="">Select Subcategory</option>
          {categories.find((c) => c.id === categoryId)?.subcategories?.map((sub) => (
            <option key={sub.id} value={sub.id}>{sub.name}</option>
          ))}
        </select>

        <input type="file" multiple onChange={handleImageChange} />

        {/* Dynamic Fields */}
        {selectedFields.map((field) => renderFieldInput(field))}

        <label>
          <input type="checkbox" checked={isPromoted} onChange={(e) => setIsPromoted(e.target.checked)} />
          Promote Product
        </label>

        <button type="submit" disabled={loading}>{loading ? "Adding..." : "Add Product"}</button>
      </form>
    </div>
  );
};

export default AddProduct;