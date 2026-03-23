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

  // ---------------- HELPERS ----------------
  const selectedCategory = categories.find(
    (c) => c.id === form.mainCategory
  );

  const dynamicFields = selectedCategory?.dynamicOptions?.fields || [];

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateDynamic = (key, value) => {
    setForm((prev) => ({
      ...prev,
      dynamic: { ...prev.dynamic, [key]: value },
    }));
  };

  // ---------------- RESET DYNAMIC FIELDS ON CATEGORY CHANGE ----------------
  useEffect(() => {
    if (!selectedCategory) return;

    const initialDynamic = Object.fromEntries(
      dynamicFields.map((field) => {
        if (field.type === "multiselect") return [field.name, []];
        return [field.name, ""];
      })
    );

    setForm((prev) => ({
      ...prev,
      dynamic: initialDynamic,
    }));
  }, [selectedCategory]);

  // ---------------- SUBMIT ----------------
  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.mainCategory) {
      return alert("Title, price, and category are required");
    }

    try {
      setLoading(true);

      // Prepare FormData for image upload
      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("price", form.price);
      formData.append("category_id", form.mainCategory);
      formData.append("dynamicFields", JSON.stringify(form.dynamic));

      images.forEach((img) => formData.append("images", img));

      const res = await fetch(
        "https://minimart-ivrm.onrender.com/api/marketplace/products",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();
      console.log("Saved:", data);
      alert("Product added successfully!");

      setForm({
        title: "",
        price: "",
        mainCategory: "",
        dynamic: {},
      });
      setImages([]);
    } catch (err) {
      console.error(err);
      alert("Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- RENDER ----------------
  return (
    <div className="add-product-container">
      <h2>Add Product</h2>

      {/* TITLE */}
      <div className="field">
        <label>Title</label>
        <input
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="e.g iPhone 13, Samsung Galaxy S21"
        />
      </div>

      {/* CATEGORY */}
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

      {/* DYNAMIC FIELDS */}
      {dynamicFields.map((field) => {
        const value = form.dynamic[field.name];

        // Conditional: show "used_detail" only if condition is "Used"
        if (field.name === "used_detail" && form.dynamic.condition !== "Used") {
          return null;
        }

        return (
          <div className="field" key={field.name}>
            <label>{field.name.replace(/_/g, " ").toUpperCase()}</label>

            {field.type === "text" && (
              <input
                value={value || ""}
                onChange={(e) => updateDynamic(field.name, e.target.value)}
                placeholder={`Enter ${field.name.replace("_", " ")}`}
              />
            )}

            {field.type === "select" && (
              <select
                value={value || ""}
                onChange={(e) => updateDynamic(field.name, e.target.value)}
              >
                <option value="">Select {field.name}</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {field.type === "multiselect" && (
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
            )}
          </div>
        );
      })}

      {/* PRICE */}
      <div className="field">
        <label>Price (₦)</label>
        <input
          type="number"
          value={form.price}
          onChange={(e) => update("price", e.target.value)}
        />
      </div>

      {/* IMAGES */}
      <div className="field">
        <label>Images</label>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => setImages([...e.target.files])}
        />
      </div>

      {/* SUBMIT */}
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Saving..." : "Add Product"}
      </button>
    </div>
  );
}