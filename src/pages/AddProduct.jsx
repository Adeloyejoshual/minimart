// src/components/AddProduct.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";

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

  useEffect(() => {
    // Fetch categories from backend
    axios.get(`${API}/categories`)
      .then(res => setCategories(res.data))
      .catch(err => console.error("Failed to load categories", err));
  }, []);

  const handleImageChange = (e) => {
    setImages([...e.target.files]);
  };

  const handleDynamicFieldChange = (field, value) => {
    setDynamicFields(prev => ({ ...prev, [field]: value }));
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

    images.forEach((img) => {
      formData.append("images", img);
    });

    try {
      setLoading(true);
      const { data } = await axios.post(`${API}/products`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert(`Product "${data.title}" added successfully!`);
      // Reset form
      setTitle(""); setDescription(""); setPrice(""); setStock(0);
      setCategoryId(""); setSubcategoryId(""); setImages([]); setDynamicFields({});
    } catch (err) {
      console.error(err);
      alert("Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-product-form">
      <h2>Add Product</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <input
          type="number"
          placeholder="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
        />

        <input
          type="number"
          placeholder="Stock"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
        >
          <option value="">Select Category</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        <select
          value={subcategoryId}
          onChange={(e) => setSubcategoryId(e.target.value)}
        >
          <option value="">Select Subcategory</option>
          {categories
            .find(cat => cat.id === categoryId)?.subcategories?.map(sub => (
              <option key={sub.id} value={sub.id}>{sub.name}</option>
            ))}
        </select>

        <input type="file" multiple onChange={handleImageChange} />

        {/* Example dynamic fields */}
        {Object.keys(dynamicFields).map(key => (
          <input
            key={key}
            type="text"
            placeholder={key}
            value={dynamicFields[key]}
            onChange={(e) => handleDynamicFieldChange(key, e.target.value)}
          />
        ))}

        <label>
          <input
            type="checkbox"
            checked={isPromoted}
            onChange={(e) => setIsPromoted(e.target.checked)}
          />
          Promote Product
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Adding..." : "Add Product"}
        </button>
      </form>
    </div>
  );
};

export default AddProduct;