import { useEffect, useState } from "react";
import DropdownModal from "../components/DropdownModal.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans, getActivePrice } from "../config/promotions.js";
import imageCompression from "browser-image-compression";
import "./AddProduct.css";

export default function AddProductPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [images, setImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);

  const [dragging, setDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);

  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    mainCategory: "",
    subCategory: "",
    dynamic: {},
    promotionId: "",
    negotiable: "Not sure",

    // ✅ NEW FIELDS
    contact_phone: "",
    video_link: "",
    delivery_name: "",
    delivery_region: "",
    delivery_days_from: "",
    delivery_days_to: "",
    delivery_fee: false,
  });

  const states = Object.keys(locationsByState || {});
  const cities = selectedState ? locationsByState[selectedState] : [];

  /* ================= FETCH CATEGORIES ================= */
  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then(res => res.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  /* ================= AUTOSAVE DRAFT ================= */
  useEffect(() => {
    localStorage.setItem(
      "product_draft",
      JSON.stringify({ form, selectedState, selectedCity })
    );
  }, [form, selectedState, selectedCity]);

  useEffect(() => {
    const saved = localStorage.getItem("product_draft");
    if (!saved) return;

    const d = JSON.parse(saved);
    setForm(d.form || form);
    setSelectedState(d.selectedState || "");
    setSelectedCity(d.selectedCity || "");
  }, []);

  /* ================= CATEGORY LOGIC ================= */
  const selectedCategory = categories.find(c => c.id === form.mainCategory);
  const subcategories = selectedCategory?.subcategories || [];
  const dynamicFields = selectedCategory?.dynamicOptions?.fields || [];
  const options = selectedCategory?.dynamicOptions || {};

  const optionsMap = {
    brand: options.brands || [],
    model: form.dynamic.brand
      ? options.models?.[form.dynamic.brand] || []
      : [],
    color: options.colors || [],
    condition: options.conditions || [],
    ram: options.ram || [],
    storage: options.storage || [],
  };

  const update = (k, v) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const updateDynamic = (k, v) =>
    setForm(prev => ({
      ...prev,
      dynamic: { ...prev.dynamic, [k]: v },
    }));

  /* ================= RESET DYNAMIC FIELDS ================= */
  useEffect(() => {
    if (!selectedCategory) return;

    setForm(prev => {
      if (Object.keys(prev.dynamic || {}).length > 0) return prev;

      return {
        ...prev,
        dynamic: Object.fromEntries(dynamicFields.map(f => [f, ""])),
      };
    });
  }, [selectedCategory]);

  /* ================= RESET CITY ON STATE CHANGE ================= */
  useEffect(() => {
    setSelectedCity("");
  }, [selectedState]);

  /* ================= IMAGE COMPRESSION ================= */
  const compressImage = async file =>
    await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1280,
      useWebWorker: true,
    });

  const createPreviews = files => {
    previewUrls.forEach(url => URL.revokeObjectURL(url));

    const urls = files.map(f => URL.createObjectURL(f));
    setPreviewUrls(urls);
  };

  const processImages = async files => {
    const limited = files.slice(0, 8);
    const compressed = await Promise.all(limited.map(compressImage));

    setImages(compressed);
    createPreviews(compressed);
  };

  /* ================= DRAG & DROP ================= */
  const handleDrop = e => {
    e.preventDefault();
    setDragging(false);
    processImages(Array.from(e.dataTransfer.files));
  };

  const handleDragStart = i => setDragIndex(i);

  const handleDragEnter = i => {
    if (dragIndex === null || dragIndex === i) return;

    const newImgs = [...images];
    const moved = newImgs.splice(dragIndex, 1)[0];
    newImgs.splice(i, 0, moved);

    setImages(newImgs);
    createPreviews(newImgs);
    setDragIndex(i);
  };

  const removeImage = i => {
    const newImgs = images.filter((_, x) => x !== i);
    setImages(newImgs);
    createPreviews(newImgs);
  };

  /* ================= UPLOAD ================= */
  const uploadWithProgress = fd =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open(
        "POST",
        "https://minimart-ivrm.onrender.com/api/marketplace/products"
      );

      xhr.upload.onprogress = e => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        const data = JSON.parse(xhr.responseText);
        xhr.status >= 200 && xhr.status < 300
          ? resolve(data)
          : reject(data);
      };

      xhr.onerror = () => reject({ message: "Upload failed" });

      xhr.send(fd);
    });

  /* ================= SUBMIT ================= */
  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.mainCategory)
      return alert("Required fields missing");

    if (!images.length)
      return alert("Add at least one image");

    try {
      setLoading(true);
      setProgress(0);

      const fd = new FormData();

      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("price", form.price);
      fd.append("category_id", form.mainCategory);

      if (form.subCategory)
        fd.append("subcategory_id", form.subCategory);

      fd.append("promotion_id", form.promotionId);
      fd.append("negotiable", form.negotiable);

      fd.append("location_state", selectedState);
      fd.append("location_city", selectedCity);

      // dynamic fields
      fd.append("attributes", JSON.stringify(form.dynamic));

      // delivery + contact
      fd.append("contact_phone", form.contact_phone);
      fd.append("video_link", form.video_link);
      fd.append("delivery_name", form.delivery_name);
      fd.append("delivery_region", form.delivery_region);
      fd.append("delivery_days_from", form.delivery_days_from);
      fd.append("delivery_days_to", form.delivery_days_to);
      fd.append("delivery_fee", form.delivery_fee);

      images.forEach(img => fd.append("images", img));

      await uploadWithProgress(fd);

      alert("✅ Product added successfully!");
      localStorage.removeItem("product_draft");

      // RESET
      setForm({
        title: "",
        description: "",
        price: "",
        mainCategory: "",
        subCategory: "",
        dynamic: {},
        promotionId: "",
        negotiable: "Not sure",
        contact_phone: "",
        video_link: "",
        delivery_name: "",
        delivery_region: "",
        delivery_days_from: "",
        delivery_days_to: "",
        delivery_fee: false,
      });

      setImages([]);
      setPreviewUrls([]);
      setSelectedState("");
      setSelectedCity("");

    } catch (err) {
      alert(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  /* ================= UI ================= */
  return (
    <div className="add-product-container">
      <h2>Add Product</h2>

      <input
        placeholder="Title"
        value={form.title}
        onChange={e => update("title", e.target.value)}
      />

      <textarea
        placeholder="Description"
        value={form.description}
        onChange={e => update("description", e.target.value)}
      />

      {/* CATEGORY */}
      <DropdownModal
        label="Category"
        value={form.mainCategory}
        onChange={v => update("mainCategory", v)}
        options={categories.map(c => ({ id: c.id, name: c.name }))}
      />

      {/* SUBCATEGORY */}
      {subcategories.length > 0 && (
        <DropdownModal
          label="Subcategory"
          value={form.subCategory}
          onChange={v => update("subCategory", v)}
          options={subcategories.map(s => ({ id: s.id, name: s.name }))}
        />
      )}

      {/* DYNAMIC FIELDS */}
      {dynamicFields.map(f => (
        <DropdownModal
          key={f}
          label={f}
          value={form.dynamic[f] || ""}
          onChange={v => updateDynamic(f, v)}
          options={optionsMap[f] || []}
        />
      ))}

      {/* LOCATION */}
      <DropdownModal
        label="State"
        value={selectedState}
        onChange={setSelectedState}
        options={states}
      />

      {selectedState && (
        <DropdownModal
          label="City"
          value={selectedCity}
          onChange={setSelectedCity}
          options={cities}
        />
      )}

      <input
        placeholder="Price"
        value={form.price}
        onChange={e => update("price", e.target.value)}
      />

      {/* PHONE */}
      <input
        placeholder="Phone number"
        value={form.contact_phone}
        onChange={e => update("contact_phone", e.target.value)}
      />

      {/* VIDEO */}
      <input
        placeholder="Video link"
        value={form.video_link}
        onChange={e => update("video_link", e.target.value)}
      />

      {/* DELIVERY */}
      <input
        placeholder="Delivery name"
        value={form.delivery_name}
        onChange={e => update("delivery_name", e.target.value)}
      />

      <input
        placeholder="Delivery region"
        value={form.delivery_region}
        onChange={e => update("delivery_region", e.target.value)}
      />

      <div style={{ display: "flex", gap: 10 }}>
        <input
          type="number"
          placeholder="From days"
          value={form.delivery_days_from}
          onChange={e => update("delivery_days_from", e.target.value)}
        />

        <input
          type="number"
          placeholder="To days"
          value={form.delivery_days_to}
          onChange={e => update("delivery_days_to", e.target.value)}
        />
      </div>

      <label>
        <input
          type="checkbox"
          checked={form.delivery_fee}
          onChange={e => update("delivery_fee", e.target.checked)}
        />
        Delivery fee available
      </label>

      {/* DROP ZONE */}
      <div
        className={`drop-zone ${dragging ? "dragging" : ""}`}
        onDrop={handleDrop}
        onDragOver={e => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
      >
        Drag & drop or click
        <input
          type="file"
          multiple
          onChange={e => processImages(Array.from(e.target.files))}
        />
      </div>

      {/* PREVIEW */}
      <div className="image-preview">
        {previewUrls.map((url, i) => (
          <div
            key={i}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragEnter={() => handleDragEnter(i)}
            className={i === 0 ? "main" : ""}
          >
            <img src={url} alt="" />
            {i === 0 && <span>Main</span>}
            <button onClick={() => removeImage(i)}>X</button>
          </div>
        ))}
      </div>

      {/* PROGRESS */}
      {loading && (
        <div className="progress-bar">
          <div style={{ width: `${progress}%` }} />
          <span>{progress}%</span>
        </div>
      )}

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Uploading..." : "Add Product"}
      </button>
    </div>
  );
}