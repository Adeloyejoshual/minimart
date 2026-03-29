import { useEffect, useMemo, useState } from "react";
import AddProductHeader from "../components/AddProductHeader.jsx";
import { categoryRules } from "../config/categoryRules.js";
import "./AddProduct.css";

/* ================= INITIAL STATE ================= */
const INITIAL_FORM = {
  title: "",
  description: "",
  price: "",
  category_id: "",

  attributes: {
    features: [],
    condition: "",
  },

  delivery: {
    available: true,
    duration: {
      from: "",
      to: "",
    },
    fee: "",
    note: "",
  },

  contact: {
    phone: "",
    whatsapp: "",
    preferred: "chat",
  },
};

/* ================= HELPERS ================= */
const onlyNumbers = (v = "") => v.toString().replace(/[^\d]/g, "");

const formatPrice = (v = "") =>
  v.replace(/[^\d]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/* ================= COMPONENT ================= */
export default function AddProduct() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [isValid, setIsValid] = useState(false);

  /* ================= FETCH CATEGORIES ================= */
  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {});
  }, []);

  const selectedCategory = useMemo(
    () =>
      categories.find((c) => String(c.id) === String(form.category_id)),
    [categories, form.category_id]
  );

  const activeRule = useMemo(() => {
    const name = selectedCategory?.name;
    return categoryRules[name] || categoryRules.default;
  }, [selectedCategory]);

  const validate = () => {
    if (!form.title || form.title.length < 3)
      return "Title too short";

    if (!form.description || form.description.length < 10)
      return "Description too short";

    if (!form.price) return "Price required";
    if (!form.category_id) return "Select category";

    if (!form.attributes.condition)
      return "Select condition";

    if (!form.contact.phone || form.contact.phone.length < 10)
      return "Valid phone required";

    if (form.delivery.available) {
      const from = Number(form.delivery.duration.from);
      const to = Number(form.delivery.duration.to);

      if (!from || !to) return "Delivery duration required";
      if (from > to) return "Invalid delivery range";
    }

    if (images.length < (activeRule.minImages || 1))
      return `Upload at least ${activeRule.minImages || 1} images`;

    if (images.length > (activeRule.maxImages || 10))
      return `Max ${activeRule.maxImages || 10} images allowed`;

    return null;
  };

  useEffect(() => {
    const err = validate();
    setError(err);
    setIsValid(!err);
  }, [form, images]);

  /* ================= IMAGE HANDLING ================= */
  const handleImages = (files) => {
    const list = Array.from(files);

    if (images.length + list.length > 10) {
      return alert("Max 10 images allowed");
    }

    const newImages = list.map((f) => ({
      file: f,
      url: URL.createObjectURL(f),
    }));

    setImages((p) => [...p, ...list]);
    setPreviews((p) => [...p, ...newImages.map((i) => i.url)]);
  };

  const removeImage = (i) => {
    setImages((p) => p.filter((_, x) => x !== i));
    setPreviews((p) => p.filter((_, x) => x !== i));
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async () => {
    const err = validate();
    if (err) return alert(err);

    setLoading(true);

    try {
      const fd = new FormData();

      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("price", onlyNumbers(form.price));
      fd.append("category_id", form.category_id);

      fd.append("attributes", JSON.stringify(form.attributes));
      fd.append("contact", JSON.stringify(form.contact));

      fd.append(
        "delivery",
        JSON.stringify({
          available: form.delivery.available,
          duration: {
            from: Number(form.delivery.duration.from),
            to: Number(form.delivery.duration.to),
          },
          fee: onlyNumbers(form.delivery.fee),
          note: form.delivery.note,
        })
      );

      fd.append("location_state", form.location_state || "");
      fd.append("location_city", form.location_city || "");

      images.forEach((img) => {
        fd.append("images", img);
      });

      const res = await fetch(
        "https://minimart-ivrm.onrender.com/api/marketplace/products",
        {
          method: "POST",
          body: fd,
        }
      );

      if (!res.ok) throw new Error();

      alert("Product created successfully");

      setForm(INITIAL_FORM);
      setImages([]);
      setPreviews([]);
    } catch (e) {
      alert("Upload failed");
    }

    setLoading(false);
  };

  /* ================= UI ================= */
  return (
    <div className="add-product-container">
      <AddProductHeader title="Add Product" />

      {/* TITLE */}
      <input
        placeholder="Product title"
        value={form.title}
        onChange={(e) =>
          setForm({ ...form, title: e.target.value })
        }
      />

      {/* DESCRIPTION */}
      <textarea
        placeholder="Description"
        value={form.description}
        onChange={(e) =>
          setForm({ ...form, description: e.target.value })
        }
      />

      {/* PRICE */}
      <input
        placeholder="Price"
        value={form.price}
        onChange={(e) =>
          setForm({
            ...form,
            price: formatPrice(e.target.value),
          })
        }
      />

      {/* DELIVERY */}
      <div>
        <input
          placeholder="From days"
          value={form.delivery.duration.from}
          onChange={(e) =>
            setForm({
              ...form,
              delivery: {
                ...form.delivery,
                duration: {
                  ...form.delivery.duration,
                  from: e.target.value,
                },
              },
            })
          }
        />

        <input
          placeholder="To days"
          value={form.delivery.duration.to}
          onChange={(e) =>
            setForm({
              ...form,
              delivery: {
                ...form.delivery,
                duration: {
                  ...form.delivery.duration,
                  to: e.target.value,
                },
              },
            })
          }
        />
      </div>

      {/* IMAGES */}
      <label>
        + Add Images
        <input
          type="file"
          multiple
          hidden
          onChange={(e) => handleImages(e.target.files)}
        />
      </label>

      <div className="preview-grid">
        {previews.map((src, i) => (
          <div key={i}>
            <img src={src} alt="" />
            <button onClick={() => removeImage(i)}>×</button>
          </div>
        ))}
      </div>

      {/* ERROR */}
      {error && <div className="error-box">{error}</div>}

      {/* SUBMIT */}
      <button disabled={!isValid || loading} onClick={handleSubmit}>
        {loading ? "Uploading..." : "Create Product"}
      </button>
    </div>
  );
}