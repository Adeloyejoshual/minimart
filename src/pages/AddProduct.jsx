// src/components/AddProduct.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { categoryFields } from "../config/categoryFields";

const AddProduct = () => {
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState(0);
  const [dynamicFields, setDynamicFields] = useState({});

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data } = await axios.get(
          "https://minimart-ivrm.onrender.com/api/categories"
        );
        setCategories(data);
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      }
    };
    fetchCategories();
  }, []);

  // Handle dynamic field change
  const handleFieldChange = (field, value) => {
    setDynamicFields((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title || !price || !categoryId) {
      alert("Title, price, and category are required");
      return;
    }

    try {
      const { data } = await axios.post(
        "https://minimart-ivrm.onrender.com/api/products",
        {
          title,
          price,
          stock,
          category_id: categoryId,
          subcategory_id: subcategoryId || null,
          dynamicFields,
        }
      );
      console.log("Product added:", data);
      alert("Product added successfully!");
      // Reset form
      setTitle("");
      setPrice("");
      setStock(0);
      setCategoryId("");
      setSubcategoryId("");
      setDynamicFields({});
    } catch (err) {
      console.error("Failed to add product:", err);
      alert("Failed to add product");
    }
  };

  // Get subcategories for selected category
  const subcategories =
    categories.find((c) => c.id === categoryId)?.subcategories || [];

  // Get dynamic fields for selected category
  const currentFields = categoryFields[categoryId] || [];

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Title:</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div>
        <label>Price:</label>
        <input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>

      <div>
        <label>Stock:</label>
        <input
          type="number"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
        />
      </div>

      <div>
        <label>Category:</label>
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setSubcategoryId(""); // reset subcategory
            setDynamicFields({}); // reset dynamic fields
          }}
        >
          <option value="">Select Category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {subcategories.length > 0 && (
        <div>
          <label>Subcategory:</label>
          <select
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
          >
            <option value="">Select Subcategory</option>
            {subcategories.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {currentFields.length > 0 && (
        <div>
          <h4>Additional Details:</h4>
          {currentFields.map((field) => (
            <div key={field}>
              <label>{field.replace("_", " ").toUpperCase()}:</label>
              <input
                type="text"
                value={dynamicFields[field] || ""}
                onChange={(e) => handleFieldChange(field, e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      <button type="submit">Add Product</button>
    </form>
  );
};

export default AddProduct;