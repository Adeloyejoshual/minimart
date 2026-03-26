// src/pages/AddProductPage.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DropdownModal from "../components/DropdownModal.jsx";
import { locationsByState } from "../config/locationsByState.js";
import "./AddProduct.css";

export default function AddProductPage() {
  const navigate = useNavigate();

  const fileInputRef = useRef(null);

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  const [uploadProgress, setUploadProgress] = useState(0);

  const [images, setImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);

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
    contactPhone: "",
    videoLink: "",
  });

  const states = Object.keys(locationsByState || {});
  const cities = selectedState ? locationsByState[selectedState] : [];

  const API = "https://minimart-ivrm.onrender.com/api/marketplace";

  /* =========================================================
     DRAFT SAVE (LOCAL STORAGE)
  ========================================================= */
  useEffect(() => {
    const draft = localStorage.getItem("product_draft");
    if (draft) {
      const parsed = JSON.parse(draft);
      setForm(parsed.form || form);
      setSelectedState(parsed.state || "");
      setSelectedCity(parsed.city || "");
    }
  }, []);

  useEffect(() => {
    const draft = {
      form,
      state: selectedState,
      city: selectedCity,
    };
    localStorage.setItem("product_draft", JSON.stringify(draft));
  }, [form, selectedState, selectedCity]);

  const clearDraft = () => {
    localStorage.removeItem("product_draft");
    setForm({
      title: "",
      description: "",
      price: "",
      mainCategory: "",
      subCategory: "",
      dynamic: {},
      promotionId: "",
      negotiable: "Not sure",
      contactPhone: "",
      videoLink: "",
    });
    setImages([]);
    setPreviewUrls([]);
    setSelectedState("");
    setSelectedCity("");
  };

  /* =========================================================
     FETCH CATEGORIES
  ========================================================= */
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch(`${API}/categories`);
        const data = await res.json();
        setCategories(data || []);
      } catch (err) {
        console.error(err);
      }
    }
    fetchCategories();
  }, []);

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
    sim: options.sims || [],
    features: options.features || [],
    year: options.years || [],
  };

  const update = (key, value) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const updateDynamic = (key, value) =>
    setForm(prev => ({
      ...prev,
      dynamic: { ...prev.dynamic, [key]: value },
    }));

  /* =========================================================
     IMAGE COMPRESSION (AUTO)
  ========================================================= */
  const compressImage = (file, quality = 0.7, maxWidth = 1200) => {
    return new Promise(resolve => {
      const reader = new FileReader();

      reader.onload = e => {
        const img = new Image();
        img.src = e.target.result;

        img.onload = () => {
          const canvas = document.createElement("canvas");
          const scale = Math.min(maxWidth / img.width, 1);

          canvas.width = img.width * scale;
          canvas.height = img.height * scale;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          canvas.toBlob(blob => {
            const compressed = new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressed);
          }, "image/jpeg", quality);
        };
      };

      reader.readAsDataURL(file);
    });
  };

  /* =========================================================
     HANDLE IMAGES
  ========================================================= */
  const handleImages = async files => {
    const arr = Array.from(files).slice(0, 8);

    const compressed = await Promise.all(
      arr.map(file => compressImage(file))
    );

    const newImages = [...images, ...compressed].slice(0, 8);

    setImages(newImages);
    setPreviewUrls(newImages.map(f => URL.createObjectURL(f)));
  };

  const removeImage = index => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  /* =========================================================
     SUBMIT WITH PROGRESS
  ========================================================= */
  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.mainCategory)
      return alert("Title, price, category required");

    if (!images.length)
      return alert("Upload at least 1 image");

    try {
      setLoading(true);
      setUploadProgress(10);

      const cleanedDynamic = Object.fromEntries(
        Object.entries(form.dynamic).filter(
          ([_, v]) =>
            v !== "" &&
            v !== null &&
            !(Array.isArray(v) && !v.length)
        )
      );

      const formData = new FormData();

      formData.append("title", form.title);
      formData.append("description", form.description);
      formData.append("price", form.price);
      formData.append("category_id", form.mainCategory);
      formData.append("subcategory_id", form.subCategory || "");
      formData.append("dynamicFields", JSON.stringify(cleanedDynamic));

      formData.append("promotion_id", form.promotionId || "");
      formData.append("contact_phone", form.contactPhone);
      formData.append("negotiable", form.negotiable);

      formData.append("location_state", selectedState);
      formData.append("location_city", selectedCity);
      formData.append("video_link", form.videoLink || "");

      images.forEach(img => formData.append("images", img));

      setUploadProgress(40);

      const res = await fetch(`${API}/products`, {
        method: "POST",
        body: formData,
      });

      setUploadProgress(80);

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setUploadProgress(100);

      // CLEAR DRAFT
      localStorage.removeItem("product_draft");

      // RESET
      clearDraft();

      // REDIRECT TO PRODUCT PAGE
      setTimeout(() => {
        navigate(`/product/${data.id}`);
      }, 500);

    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  /* =========================================================
     UI
  ========================================================= */
  return (
    <div className="add-product-container">

      {/* STICKY HEADER */}
      <div className="sticky-header">
        <button onClick={() => navigate(-1)}>← Back</button>
        <h2>Add Product</h2>
        <button onClick={clearDraft}>Clear</button>
      </div>

      {/* PROGRESS BAR */}
      {uploadProgress > 0 && (
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {/* FORM */}
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

      <DropdownModal
        label="Category"
        value={form.mainCategory}
        onChange={val => update("mainCategory", val)}
        options={categories.map(c => ({
          id: c.id,
          name: c.name,
        }))}
      />

      {/* PRICE */}
      <input
        placeholder="Price"
        value={form.price}
        onChange={e => update("price", e.target.value)}
      />

      {/* PHONE */}
      <input
        placeholder="Phone"
        value={form.contactPhone}
        onChange={e => update("contactPhone", e.target.value)}
      />

      {/* IMAGES */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={e => handleImages(e.target.files)}
      />

      <div className="preview-grid">
        {previewUrls.map((url, i) => (
          <div key={i}>
            <img src={url} />
            <button onClick={() => removeImage(i)}>X</button>
          </div>
        ))}
      </div>

      {/* SUBMIT */}
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Uploading..." : "Post Product"}
      </button>
    </div>
  );
}