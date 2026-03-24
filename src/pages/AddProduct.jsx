import { useEffect, useState } from "react";
import "./AddProduct.css";

export default function AddProduct() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);

  const [form, setForm] = useState({
    title: "",
    price: "",
    mainCategory: "",
    dynamic: {},
  });

  // ---------------- FETCH CATEGORIES ----------------
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(
          "https://minimart-ivrm.onrender.com/api/marketplace/categories"
        );
        const data = await res.json();
        setCategories(data || []);
      } catch (err) {
        console.error("Failed to fetch categories", err);
      }
    };
    fetchCategories();
  }, []);

  const selectedCategory = categories.find(
    (c) => c.id === form.mainCategory
  );

  const parseFields = (fields) => {
    if (!fields) return [];
    try {
      return typeof fields === "string" ? JSON.parse(fields) : fields;
    } catch {
      return [];
    }
  };

  const dynamicFields = parseFields(selectedCategory?.fields);

  // ---------------- UPDATE FORM ----------------
  const update = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const updateDynamic = (key, value) =>
    setForm((prev) => ({
      ...prev,
      dynamic: { ...prev.dynamic, [key]: value },
    }));

  // ---------------- RESET DYNAMIC ON CATEGORY CHANGE ----------------
  useEffect(() => {
    if (!selectedCategory) return;
    const initialDynamic = Object.fromEntries(
      dynamicFields.map((field) => [
        field.name,
        field.type === "multiselect" ? [] : "",
      ])
    );
    setForm((prev) => ({ ...prev, dynamic: initialDynamic }));
  }, [selectedCategory]);

  // ---------------- HANDLE SUBMIT ----------------
  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.mainCategory) {
      return alert("Title, price, and category are required");
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("price", form.price);
      formData.append("category_id", form.mainCategory);
      formData.append("dynamicFields", JSON.stringify(form.dynamic));

      images.forEach((img) => formData.append("images", img));

      const res = await fetch(
        "https://minimart-ivrm.onrender.com/api/marketplace/products",
        { method: "POST", body: formData }
      );

      const data = await res.json();
      console.log("Saved:", data);
      alert("Product added successfully!");

      setForm({ title: "", price: "", mainCategory: "", dynamic: {} });
      setImages([]);
    } catch (err) {
      console.error(err);
      alert("Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- RENDER FIELD ----------------
  const renderField = (field) => {
    const value = form.dynamic[field.name];

    // Example conditional: used_detail only for used items
    if (field.name === "used_detail" && form.dynamic.condition !== "Used") return null;

    const label = field.name.replace(/_/g, " ").toUpperCase();

    switch (field.type) {
      case "text":
        return (
          <input
            value={value || ""}
            onChange={(e) => updateDynamic(field.name, e.target.value)}
            placeholder={`Enter ${label}`}
          />
        );

      case "select":
        return (
          <select
            value={value || ""}
            onChange={(e) => updateDynamic(field.name, e.target.value)}
          >
            <option value="">Select {label}</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case "multiselect":
        return (
          <div className="multi-select">
            {field.options?.map((opt) => {
              const current = Array.isArray(value) ? value : [];
              return (
                <label key={opt}>
                  <input
                    type="checkbox"
                    checked={current.includes(opt)}
                    onChange={() => {
                      if (current.includes(opt)) {
                        updateDynamic(
                          field.name,
                          current.filter((v) => v !== opt)
                        );
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
        );

      default:
        return null;
    }
  };

  return (
    <div className="add-product-container">
      <h2>Add Product</h2>

      <div className="field">
        <label>Title</label>
        <input
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="e.g iPhone 13, Samsung Galaxy S21"
        />
      </div>

      <div className="field">
        <label>Category</label>
        <select
          value={form.mainCategory}
          onChange={(e) => update("mainCategory", e.target.value)}
        >
          <option value="">Select category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {dynamicFields.map((field) => (
        <div className="field" key={field.name}>
          <label>{field.name.replace(/_/g, " ").toUpperCase()}</label>
          {renderField(field)}
        </div>
      ))}

      <div className="field">
        <label>Price (₦)</label>
        <input
          type="number"
          value={form.price}
          onChange={(e) => update("price", e.target.value)}
        />
      </div>

      <div className="field">
        <label>Images</label>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => setImages([...e.target.files])}
        />
      </div>

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Saving..." : "Add Product"}
      </button>
    </div>
  );
}