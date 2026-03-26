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
    negotiable: "unknown",
  });

  const states = Object.keys(locationsByState || {});
  const cities = selectedState ? locationsByState[selectedState] : [];

  /* ================= FETCH ================= */
  useEffect(() => {
    fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories")
      .then(res => res.json())
      .then(setCategories)
      .catch(console.error);
  }, []);

  /* ================= AUTOSAVE ================= */
  useEffect(() => {
    localStorage.setItem(
      "product_draft",
      JSON.stringify({ form, selectedState, selectedCity })
    );
  }, [form, selectedState, selectedCity]);

  useEffect(() => {
    const saved = localStorage.getItem("product_draft");
    if (saved) {
      const d = JSON.parse(saved);
      setForm(d.form || {});
      setSelectedState(d.selectedState || "");
      setSelectedCity(d.selectedCity || "");
    }
  }, []);

  /* ================= CATEGORY ================= */
  const selectedCategory = categories.find(c => c.id === form.mainCategory);
  const subcategories = selectedCategory?.subcategories || [];
  const dynamicFields = selectedCategory?.dynamicOptions?.fields || [];
  const options = selectedCategory?.dynamicOptions || {};

  const optionsMap = {
    brand: options.brands || [],
    model: options.models?.[form.dynamic.brand] || [],
    color: options.colors || [],
    condition: options.conditions || [],
    ram: options.ram || [],
    storage: options.storage || [],
  };

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const updateDynamic = (k, v) =>
    setForm(p => ({ ...p, dynamic: { ...p.dynamic, [k]: v } }));

  useEffect(() => {
    if (!selectedCategory) return;
    const init = Object.fromEntries(
      dynamicFields.map(f => [f, ""])
    );
    setForm(p => ({ ...p, dynamic: init }));
  }, [selectedCategory]);

  /* ================= IMAGE COMPRESSION ================= */
  const compressImage = async file =>
    await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1280,
      useWebWorker: true,
    });

  const processImages = async files => {
    const arr = files.slice(0, 8);
    const compressed = await Promise.all(arr.map(compressImage));

    setImages(compressed);
    setPreviewUrls(compressed.map(f => URL.createObjectURL(f)));
  };

  /* ================= DRAG DROP ================= */
  const handleDrop = e => {
    e.preventDefault();
    setDragging(false);
    processImages(Array.from(e.dataTransfer.files));
  };

  /* ================= REORDER ================= */
  const handleDragStart = i => setDragIndex(i);

  const handleDragEnter = i => {
    if (dragIndex === null || dragIndex === i) return;

    const newImgs = [...images];
    const moved = newImgs.splice(dragIndex, 1)[0];
    newImgs.splice(i, 0, moved);

    setImages(newImgs);
    setPreviewUrls(newImgs.map(f => URL.createObjectURL(f)));
    setDragIndex(i);
  };

  const removeImage = i => {
    setImages(p => p.filter((_, x) => x !== i));
    setPreviewUrls(p => p.filter((_, x) => x !== i));
  };

  /* ================= SUBMIT ================= */
  const uploadWithProgress = fd =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open("POST", "https://minimart-ivrm.onrender.com/api/marketplace/products");

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

  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.mainCategory)
      return alert("Required fields missing");

    if (!images.length) return alert("Add at least one image");

    try {
      setLoading(true);
      setProgress(0);

      const fd = new FormData();

      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("price", form.price);
      fd.append("category_id", form.mainCategory);
      fd.append("subcategory_id", form.subCategory || "");
      fd.append("promotion_id", form.promotionId || "");
      fd.append("negotiable", form.negotiable);
      fd.append("location_state", selectedState);
      fd.append("location_city", selectedCity);
      fd.append("dynamicFields", JSON.stringify(form.dynamic));

      images.forEach(img => fd.append("images", img));

      await uploadWithProgress(fd);

      alert("✅ Product added!");
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
        negotiable: "unknown",
      });
      setImages([]);
      setPreviewUrls([]);
      setSelectedState("");
      setSelectedCity("");

    } catch (err) {
      alert(err.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  /* ================= UI ================= */
  return (
    <div className="add-product-container">
      <h2>Add Product</h2>

      <input placeholder="Title" value={form.title} onChange={e => update("title", e.target.value)} />
      <textarea placeholder="Description" value={form.description} onChange={e => update("description", e.target.value)} />

      <DropdownModal label="Category" value={form.mainCategory} onChange={v => update("mainCategory", v)}
        options={categories.map(c => ({ id: c.id, name: c.name }))} />

      {subcategories.length > 0 && (
        <DropdownModal label="Subcategory" value={form.subCategory}
          onChange={v => update("subCategory", v)}
          options={subcategories.map(s => ({ id: s.id, name: s.name }))} />
      )}

      {dynamicFields.map(f => (
        <DropdownModal key={f} label={f}
          value={form.dynamic[f] || ""}
          onChange={v => updateDynamic(f, v)}
          options={optionsMap[f] || []}
        />
      ))}

      <DropdownModal label="State" value={selectedState} onChange={setSelectedState} options={states} />
      {selectedState && <DropdownModal label="City" value={selectedCity} onChange={setSelectedCity} options={cities} />}

      <input placeholder="Price" value={form.price} onChange={e => update("price", e.target.value)} />

      <DropdownModal label="Promotion" value={form.promotionId}
        onChange={v => update("promotionId", v)}
        options={promotionPlans.map(p => ({
          id: p.id,
          name: `${p.name} - ₦${getActivePrice(p.price, p.discount)}`
        }))} />

      {/* DROP ZONE */}
      <div
        className={`drop-zone ${dragging ? "dragging" : ""}`}
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
      >
        Drag & drop or click
        <input type="file" multiple onChange={e => processImages(Array.from(e.target.files))} />
      </div>

      {/* PREVIEW */}
      <div className="image-preview">
        {previewUrls.map((url, i) => (
          <div key={i}
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