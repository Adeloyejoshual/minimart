import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

/* ================= CONFIG (ASSUMED FROM YOUR SYSTEM) ================= */
import { brands } from "../config/brands";
import { colors } from "../config/colors";
import { conditions } from "../config/conditions";
import { models } from "../config/models";
import { ramOptions } from "../config/ramOptions";
import { storageOptions } from "../config/storageOptions";
import { sims } from "../config/sims";
import { years } from "../config/years";

/* ================= IMAGE COMPRESSION ================= */
const compressImage = (file, quality = 0.7, maxWidth = 1024) => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        const canvas = document.createElement("canvas");

        const scale = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            const compressedFile = new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          "image/jpeg",
          quality
        );
      };
    };
  });
};

/* ================= COMPONENT ================= */
export default function AddProduct() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category_id: "",
    subcategory_id: "",
    brand: "",
    model: "",
    color: "",
    condition: "",
    year: "",
    ram: "",
    storage: "",
    sim: "",
    location_state: "",
    location_city: "",
    contact_phone: "",
    negotiable: "",
  });

  const [images, setImages] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  /* ================= LOAD CATEGORIES ================= */
  useEffect(() => {
    axios.get("/api/categories").then((res) => {
      setCategories(res.data);
    });
  }, []);

  /* ================= HANDLE INPUT ================= */
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  /* ================= IMAGE SELECT ================= */
  const handleImages = async (e) => {
    const files = Array.from(e.target.files);

    const compressed = await Promise.all(
      files.map((file) => compressImage(file))
    );

    const preview = compressed.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));

    setImages((prev) => [...prev, ...preview]);
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();

      /* ===== BASIC ===== */
      formData.append("title", form.title);
      formData.append("description", form.description);
      formData.append("price", form.price);
      formData.append("category_id", form.category_id);
      formData.append("subcategory_id", form.subcategory_id);

      /* ===== ATTRIBUTES ===== */
      formData.append("brand", form.brand);
      formData.append("model", form.model);
      formData.append("color", form.color);
      formData.append("condition", form.condition);
      formData.append("year", form.year);
      formData.append("ram", form.ram);
      formData.append("storage", form.storage);
      formData.append("sim", form.sim);

      /* ===== LOCATION ===== */
      formData.append("location_state", form.location_state);
      formData.append("location_city", form.location_city);

      /* ===== CONTACT ===== */
      formData.append(
        "contact",
        JSON.stringify({
          phone: form.contact_phone,
        })
      );

      /* ===== DELIVERY ===== */
      formData.append(
        "delivery",
        JSON.stringify({
          negotiable: form.negotiable,
        })
      );

      /* ===== IMAGES ===== */
      images.forEach((img) => {
        formData.append("images", img.file);
      });

      await axios.post("/api/products", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percent);
        },
      });

      alert("Product created successfully");

      /* RESET */
      setForm({
        title: "",
        description: "",
        price: "",
        category_id: "",
        subcategory_id: "",
        brand: "",
        model: "",
        color: "",
        condition: "",
        year: "",
        ram: "",
        storage: "",
        sim: "",
        location_state: "",
        location_city: "",
        contact_phone: "",
        negotiable: "",
      });

      setImages([]);
      setUploadProgress(0);
    } catch (err) {
      console.error(err);
      alert("Failed to create product");
    } finally {
      setLoading(false);
    }
  };

  /* ================= FILTER OPTIONS ================= */
  const brandOptions = useMemo(() => {
    return brands["default"] || [];
  }, []);

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <h2>Create Product</h2>

      <form onSubmit={handleSubmit}>
        {/* TITLE */}
        <input
          name="title"
          placeholder="Title"
          value={form.title}
          onChange={handleChange}
          required
        />

        {/* PRICE */}
        <input
          name="price"
          placeholder="Price"
          type="number"
          value={form.price}
          onChange={handleChange}
          required
        />

        {/* DESCRIPTION */}
        <textarea
          name="description"
          placeholder="Description"
          value={form.description}
          onChange={handleChange}
        />

        {/* CATEGORY */}
        <select
          name="category_id"
          value={form.category_id}
          onChange={handleChange}
          required
        >
          <option value="">Select Category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* BRAND */}
        <select name="brand" value={form.brand} onChange={handleChange}>
          <option value="">Brand</option>
          {brandOptions.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        {/* CONDITION */}
        <select
          name="condition"
          value={form.condition}
          onChange={handleChange}
        >
          <option value="">Condition</option>
          {conditions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* LOCATION */}
        <input
          name="location_state"
          placeholder="State"
          value={form.location_state}
          onChange={handleChange}
        />

        <input
          name="location_city"
          placeholder="City"
          value={form.location_city}
          onChange={handleChange}
        />

        {/* CONTACT */}
        <input
          name="contact_phone"
          placeholder="Phone"
          value={form.contact_phone}
          onChange={handleChange}
        />

        {/* IMAGES */}
        <input type="file" multiple accept="image/*" onChange={handleImages} />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {images.map((img, i) => (
            <div key={i}>
              <img
                src={img.url}
                alt=""
                width={80}
                height={80}
                style={{ objectFit: "cover" }}
              />
              <button type="button" onClick={() => removeImage(i)}>
                X
              </button>
            </div>
          ))}
        </div>

        {/* UPLOAD PROGRESS */}
        {uploadProgress > 0 && (
          <div style={{ marginTop: 10 }}>
            <div>Uploading: {uploadProgress}%</div>
            <div
              style={{
                height: 6,
                background: "#eee",
                borderRadius: 4,
              }}
            >
              <div
                style={{
                  width: `${uploadProgress}%`,
                  height: "100%",
                  background: "green",
                }}
              />
            </div>
          </div>
        )}

        <button disabled={loading} type="submit">
          {loading ? "Uploading..." : "Create Product"}
        </button>
      </form>
    </div>
  );
}