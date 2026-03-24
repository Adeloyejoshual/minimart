import { useEffect, useMemo, useState } from "react";
import "./AddProduct.css";

const API = "https://minimart-ivrm.onrender.com/api/marketplace";

export default function AddProduct() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    mainCategory: "",
    subcategory: "",
    dynamic: {},
  });

  // ---------------- FETCH CATEGORIES ----------------
  useEffect(() => {
    fetch(`${API}/categories`)
      .then((res) => res.json())
      .then(setCategories)
      .catch((err) => console.error("Categories error:", err));
  }, []);

  // ---------------- SELECTED CATEGORY ----------------
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === form.mainCategory),
    [categories, form.mainCategory]
  );

  const subcategories = selectedCategory?.subcategories || [];

  const selectedSubcategory = useMemo(
    () => subcategories.find((s) => s.id === form.subcategory),
    [subcategories, form.subcategory]
  );

  // Prefer subcategory fields if available
  const dynamicFields = useMemo(() => {
    return selectedSubcategory?.fields || selectedCategory?.fields || [];
  }, [selectedCategory, selectedSubcategory]);

  // ---------------- HELPERS ----------------
  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateDynamic = (key, value) => {
    setForm((prev) => ({
      ...prev,
      dynamic: { ...prev.dynamic, [key]: value },
    }));
  };

  // ---------------- RESET DYNAMIC FIELDS ----------------
  useEffect(() => {
    if (!dynamicFields.length) return;

    const initial = Object.fromEntries(
      dynamicFields.map((f) => [
        f.name,
        f.type === "multiselect" ? [] : "",
      ])
    );

    setForm((prev) => ({ ...prev, dynamic: initial }));
  }, [dynamicFields]);

  // ---------------- SUBMIT ----------------
  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.mainCategory) {
      return alert("Title, price, and category required");
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("description", form.description);
      formData.append("price", form.price);
      formData.append("category_id", form.mainCategory);
      formData.append("subcategory_id", form.subcategory || "");
      formData.append(
        "dynamicFields",
        JSON.stringify(form.dynamic || {})
      );

      images.forEach((img) => formData.append("images", img));

      const res = await fetch(`${API}/products`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed");
      }

      alert("✅ Product added!");

      // RESET
      setForm({
        title: "",
        description: "",
        price: "",
        mainCategory: "",
        subcategory: "",
        dynamic: {},
      });
      setImages([]);
    } catch (err) {
      console.error(err);
      alert(err.message);
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
        />
      </div>

      {/* DESCRIPTION */}
      <div className="field">
        <label>Description</label>
        <textarea
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
        />
      </div>

      {/* CATEGORY */}
      <div className="field">
        <label>Category</label>
        <select
          value={form.mainCategory}
          onChange={(e) => {
            update("mainCategory", e.target.value);
            update("subcategory", "");
          }}
        >
          <option value="">Select category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* SUBCATEGORY */}
      {subcategories.length > 0 && (
        <div className="field">
          <label>Subcategory</label>
          <select
            value={form.subcategory}
            onChange={(e) => update("subcategory", e.target.value)}
          >
            <option value="">Select subcategory</option>
            {subcategories.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* DYNAMIC FIELDS */}
      {dynamicFields.map((field) => {
        const value = form.dynamic[field.name];

        // conditional logic example
        if (
          field.name === "used_detail" &&
          form.dynamic.condition !== "Used"
        ) {
          return null;
        }

        return (
          <div className="field" key={field.name}>
            <label>{field.name.replace(/_/g, " ")}</label>

            {field.type === "text" && (
              <input
                value={value || ""}
                onChange={(e) =>
                  updateDynamic(field.name, e.target.value)
                }
              />
            )}

            {field.type === "select" && (
              <select
                value={value || ""}
                onChange={(e) =>
                  updateDynamic(field.name, e.target.value)
                }
              >
                <option value="">Select</option>
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
                  const arr = Array.isArray(value) ? value : [];
                  return (
                    <label key={opt}>
                      <input
                        type="checkbox"
                        checked={arr.includes(opt)}
                        onChange={() => {
                          updateDynamic(
                            field.name,
                            arr.includes(opt)
                              ? arr.filter((v) => v !== opt)
                              : [...arr, opt]
                          );
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
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            setImages(files);
          }}
        />
      </div>

      {/* SUBMIT */}
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Saving..." : "Add Product"}
      </button>
    </div>
  );
}