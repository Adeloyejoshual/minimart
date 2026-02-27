import React, { useState, useEffect } from "react";

function AddProduct() {
  const [formData, setFormData] = useState({
    title: "",
    price: "",
    category: "",
    subcategory: "",
    brand: "",
    model: "",
    condition: "",
    year: "",
    ram: "",
    storage: "",
    features: [],
    images: [],
  });

  const [dynamicFields, setDynamicFields] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [errors, setErrors] = useState({});
  const [imagePreviews, setImagePreviews] = useState([]);

  // -------------------------
  // Category Rules
  // -------------------------
  const categoryFields = {
    "Phones": ["brand", "model", "ram", "storage", "features"],
    "Vehicles": ["brand", "model", "year", "condition"],
  };

  const subcategoryMap = {
    Phones: ["Smartphones", "Tablets"],
    Vehicles: ["Cars", "Bikes"],
  };

  const featuresByCategory = {
    Phones: ["Bluetooth", "5G", "Dual SIM", "Fast Charging"],
  };

  // -------------------------
  // Handle Category Change
  // -------------------------
  useEffect(() => {
    if (formData.category) {
      setDynamicFields(categoryFields[formData.category] || []);
      setSubcategories(subcategoryMap[formData.category] || []);

      // Reset only dependent fields
      setFormData(prev => ({
        ...prev,
        subcategory: "",
        brand: "",
        model: "",
        condition: "",
        year: "",
        ram: "",
        storage: "",
        features: [],
      }));
    }
  }, [formData.category]);

  // -------------------------
  // Handle Input Change
  // -------------------------
  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;

    if (type === "checkbox") {
      setFormData(prev => ({
        ...prev,
        features: checked
          ? [...prev.features, value]
          : prev.features.filter(f => f !== value),
      }));
      return;
    }

    if (type === "file") {
      const fileArray = Array.from(files);

      // File size validation (2MB max)
      const validFiles = fileArray.filter(file => file.size <= 2 * 1024 * 1024);

      setFormData(prev => ({
        ...prev,
        images: validFiles,
      }));

      // Preview
      const previews = validFiles.map(file =>
        URL.createObjectURL(file)
      );
      setImagePreviews(previews);
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  // -------------------------
  // Validation
  // -------------------------
  const validate = () => {
    const newErrors = {};

    if (!formData.title) newErrors.title = "Title is required";
    if (!formData.price) newErrors.price = "Price is required";
    if (!formData.category) newErrors.category = "Category is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // -------------------------
  // Submit
  // -------------------------
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validate()) return;

    console.log("Submitted Data:", formData);
    alert("Product added successfully!");
  };

  const features = featuresByCategory[formData.category] || [];

  return (
    <div className="container">
      <h2>Add Product</h2>

      <form onSubmit={handleSubmit}>

        {/* Title */}
        <div>
          <label>Title</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
          />
          {errors.title && <p className="error">{errors.title}</p>}
        </div>

        {/* Price */}
        <div>
          <label>Price</label>
          <input
            type="number"
            name="price"
            value={formData.price}
            onChange={handleChange}
          />
          {errors.price && <p className="error">{errors.price}</p>}
        </div>

        {/* Category */}
        <div>
          <label>Category</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
          >
            <option value="">Select Category</option>
            <option value="Phones">Phones</option>
            <option value="Vehicles">Vehicles</option>
          </select>
          {errors.category && <p className="error">{errors.category}</p>}
        </div>

        {/* Subcategory */}
        {subcategories.length > 0 && (
          <div>
            <label>Subcategory</label>
            <select
              name="subcategory"
              value={formData.subcategory}
              onChange={handleChange}
            >
              <option value="">Select Subcategory</option>
              {subcategories.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
        )}

        {/* Dynamic Fields */}
        {dynamicFields.map(field => (
          <div key={field}>
            <label>{field}</label>

            {field === "features" && features.length > 0 ? (
              <div className="features-scroll">
                {features.map(f => (
                  <label key={f} style={{ marginRight: "10px" }}>
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
              <input
                type="text"
                name={field}
                value={formData[field] || ""}
                onChange={handleChange}
              />
            )}
          </div>
        ))}

        {/* Images */}
        <div>
          <label>Upload Images (Max 2MB each)</label>
          <input
            type="file"
            multiple
            onChange={handleChange}
          />
        </div>

        {/* Image Preview */}
        <div className="image-preview">
          {imagePreviews.map((src, index) => (
            <img
              key={index}
              src={src}
              alt="preview"
              style={{ width: "100px", marginRight: "10px" }}
            />
          ))}
        </div>

        <button type="submit">Submit</button>
      </form>
    </div>
  );
}

export default AddProduct;