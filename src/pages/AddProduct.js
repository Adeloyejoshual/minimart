// src/pages/AddProduct.js
import React, { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate, useLocation } from "react-router-dom";

import categoriesData from "../config/categoriesData";
import productOptions from "../config/productOptions";
import { locationsByRegion } from "../config/locationsByRegion";

import ProductOptionsSelector from "../components/ProductOptionsSelector";
import { useAdLimitCheck } from "../hooks/useAdLimits";

const MAX_IMAGES = 10;

const AddProduct = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const marketType =
    new URLSearchParams(location.search).get("market") || "marketplace";

  const { checkLimit } = useAdLimitCheck();

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    mainCategory: "",
    subCategory: "",
    brand: "",
    model: "",
    condition: "",
    title: "",
    description: "",
    price: "",
    phoneNumber: "",
    images: [],
    previewImages: [],
    region: "",
    stateLocation: "",
    cityLocation: "",
    selectedOptions: {},
    isPromoted: false,
  });

  /* -------------------- DERIVED DATA -------------------- */

  const subCategories = form.mainCategory
    ? categoriesData[form.mainCategory]?.subcategories || []
    : [];

  const regions = Object.keys(locationsByRegion);
  const states = form.region
    ? Object.keys(locationsByRegion[form.region] || {})
    : [];

  const cities =
    form.region && form.stateLocation
      ? locationsByRegion[form.region][form.stateLocation] || []
      : [];

  /* -------------------- HANDLERS -------------------- */

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: "" }));

    if (field === "mainCategory") {
      setForm(prev => ({
        ...prev,
        subCategory: "",
        brand: "",
        model: "",
        selectedOptions: {},
      }));
    }

    if (field === "subCategory") {
      setForm(prev => ({
        ...prev,
        brand: "",
        model: "",
        selectedOptions: {},
      }));
    }

    if (field === "region") {
      setForm(prev => ({ ...prev, stateLocation: "", cityLocation: "" }));
    }

    if (field === "stateLocation") {
      setForm(prev => ({ ...prev, cityLocation: "" }));
    }
  };

  const handlePriceChange = e => {
    const raw = e.target.value.replace(/,/g, "");
    if (!/^\d*\.?\d{0,2}$/.test(raw)) return;

    const formatted =
      raw === "" ? "" : Number(raw).toLocaleString("en-US");
    setForm(prev => ({ ...prev, price: formatted }));
  };

  const handleImages = e => {
    const files = Array.from(e.target.files);
    if (files.length + form.images.length > MAX_IMAGES) {
      alert(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }

    setForm(prev => ({
      ...prev,
      images: [...prev.images, ...files],
      previewImages: [
        ...prev.previewImages,
        ...files.map(f => URL.createObjectURL(f)),
      ],
    }));
  };

  const removeImage = index => {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
      previewImages: prev.previewImages.filter((_, i) => i !== index),
    }));
  };

  /* -------------------- VALIDATION -------------------- */

  const validate = () => {
    const e = {};
    const required = [
      "mainCategory",
      "subCategory",
      "title",
      "price",
      "phoneNumber",
      "region",
      "stateLocation",
      "cityLocation",
    ];

    required.forEach(f => {
      if (!form[f]) e[f] = "Required";
    });

    if (form.images.length === 0) {
      e.images = "Upload at least one image";
    }

    if (!/^\d{10,15}$/.test(form.phoneNumber)) {
      e.phoneNumber = "Invalid phone number";
    }

    const price = parseFloat(form.price.replace(/,/g, ""));
    if (isNaN(price) || price <= 0) {
      e.price = "Invalid price";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* -------------------- SUBMIT -------------------- */

  const handleSubmit = async e => {
    e.preventDefault();
    if (!auth.currentUser) {
      setErrors({ general: "Login required" });
      return;
    }

    if (!validate()) return;

    try {
      setLoading(true);

      const limitReached = await checkLimit(
        auth.currentUser.uid,
        form.mainCategory
      );

      if (limitReached && !form.isPromoted) {
        setErrors({ general: "Free ad limit reached" });
        return;
      }

      const imageUrls = await Promise.all(
        form.images.map(img => uploadToCloudinary(img))
      );

      await addDoc(collection(db, "products"), {
        ...form,
        price: parseFloat(form.price.replace(/,/g, "")),
        images: imageUrls,
        coverImage: imageUrls[0],
        ownerId: auth.currentUser.uid,
        marketType,
        createdAt: serverTimestamp(),
      });

      alert("Product added successfully");
      navigate(`/${marketType}`);
    } catch (err) {
      console.error(err);
      setErrors({ general: err.message });
    } finally {
      setLoading(false);
    }
  };

  /* -------------------- CLEANUP -------------------- */

  useEffect(() => {
    return () => {
      form.previewImages.forEach(url => URL.revokeObjectURL(url));
    };
  }, [form.previewImages]);

  /* -------------------- UI -------------------- */

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 750, margin: "20px auto" }}>
      <h2>Post Ad</h2>

      {errors.general && <p style={{ color: "red" }}>{errors.general}</p>}

      {/* CATEGORY */}
      <select
        value={form.mainCategory}
        onChange={e => handleChange("mainCategory", e.target.value)}
      >
        <option value="">Select Category</option>
        {Object.keys(categoriesData).map(cat => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>

      {/* SUBCATEGORY (FIXED) */}
      {subCategories.length > 0 && (
        <select
          value={form.subCategory}
          onChange={e => handleChange("subCategory", e.target.value)}
        >
          <option value="">Select Subcategory</option>
          {subCategories.map(sub => (
            <option key={sub} value={sub}>
              {sub}
            </option>
          ))}
        </select>
      )}

      {/* OPTIONS */}
      {form.subCategory && (
        <ProductOptionsSelector
          mainCategory={form.mainCategory}
          subCategory={form.subCategory}
          onChange={opts =>
            setForm(prev => ({
              ...prev,
              brand: opts.brand || "",
              model: opts.model || "",
              selectedOptions: { ...prev.selectedOptions, ...opts },
            }))
          }
        />
      )}

      <input
        placeholder="Title"
        value={form.title}
        onChange={e => handleChange("title", e.target.value)}
      />

      <textarea
        placeholder="Description"
        value={form.description}
        onChange={e => handleChange("description", e.target.value)}
      />

      <input
        placeholder="Price"
        value={form.price}
        onChange={handlePriceChange}
      />

      <input
        placeholder="Phone Number"
        value={form.phoneNumber}
        onChange={e => handleChange("phoneNumber", e.target.value)}
      />

      <input type="file" multiple accept="image/*" onChange={handleImages} />

      {form.previewImages.map((img, i) => (
        <img key={i} src={img} alt="" width={70} />
      ))}

      {/* LOCATION */}
      <select
        value={form.region}
        onChange={e => handleChange("region", e.target.value)}
      >
        <option value="">Select Region</option>
        {regions.map(r => (
          <option key={r}>{r}</option>
        ))}
      </select>

      {states.length > 0 && (
        <select
          value={form.stateLocation}
          onChange={e => handleChange("stateLocation", e.target.value)}
        >
          <option value="">Select State</option>
          {states.map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>
      )}

      {cities.length > 0 && (
        <select
          value={form.cityLocation}
          onChange={e => handleChange("cityLocation", e.target.value)}
        >
          <option value="">Select City</option>
          {cities.map(c => (
            <option key={c}>{c}</option>
          ))}
        </select>
      )}

      <button disabled={loading}>
        {loading ? "Uploading..." : "Post Ad"}
      </button>
    </form>
  );
};

export default AddProduct;