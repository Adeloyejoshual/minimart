import { useEffect, useState } from "react";
import "./AddProduct.css";

export default function AddProduct() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

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

  const parseFields = (fields) => {
    try {
      if (!fields) return [];
      return typeof fields === "string" ? JSON.parse(fields) : fields;
    } catch {
      return [];
    }
  };

  const dynamicFields = parseFields(selectedCategory?.fields);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateDynamic = (key, value) => {
    setForm((prev) => ({
      ...prev,
      dynamic: {
        ...prev.dynamic,
        [key]: value,
      },
    }));
  };

  // ---------------- SUBMIT ----------------
  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.mainCategory) {
      return alert("Title, price and category required");
    }

    try {
      setLoading(true);

      const res = await fetch(
        "https://minimart-ivrm.onrender.com/api/marketplace/products",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title,
            price: Number(form.price),
            category_id: form.mainCategory,
            dynamicFields: form.dynamic,
          }),
        }
      );

      const data = await res.json();

      console.log("Saved:", data);
      alert("Product added successfully!");

      // reset form
      setForm({
        title: "",
        price: "",
        mainCategory: "",
        dynamic: {},
      });
    } catch (err) {
      console.error(err);
      alert("Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- UI ----------------
  return (
    <div className="add-product-container">
      <h2>Add Product</h2>

      {/* TITLE */}
      <div className="field">
        <label>Title</label>
        <input
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="e.g iPhone 11"
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

        return (
          <div className="field" key={field.name}>
            <label>{field.name}</label>

            {/* TEXT */}
            {field.type === "text" && (
              <input
                value={value || ""}
                onChange={(e) =>
                  updateDynamic(field.name, e.target.value)
                }
                placeholder={`Enter ${field.name}`}
              />
            )}

            {/* SELECT */}
            {field.type === "select" && (
              <select
                value={value || ""}
                onChange={(e) =>
                  updateDynamic(field.name, e.target.value)
                }
              >
                <option value="">Select {field.name}</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {/* MULTISELECT */}
            {field.type === "multiselect" && (
              <div className="multi-select">
                {field.options?.map((opt) => (
                  <label key={opt}>
                    <input
                      type="checkbox"
                      checked={value?.includes(opt) || false}
                      onChange={() => {
                        const current = value || [];
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
                ))}
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

      {/* SUBMIT */}
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Saving..." : "Add Product"}
      </button>
    </div>
  );
}