import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate, useLocation } from "react-router-dom";
import categories from "../config/categories";
import locations from "../config/locations";
import { useAdLimitCheck } from "../hooks/useAdLimits";

const AddProduct = () => {
  // Product info
  const [mainCategory, setMainCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [images, setImages] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);

  // Conditional fields
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [condition, setCondition] = useState("");

  // Location
  const [stateLocation, setStateLocation] = useState("");
  const [cityLocation, setCityLocation] = useState("");

  // Promotion
  const [isPromoted, setIsPromoted] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const locationQuery = useLocation();
  const params = new URLSearchParams(locationQuery.search);
  const marketType = params.get("market") || "marketplace";

  const subCategories = mainCategory ? categories[mainCategory] || [] : [];

  // ✅ Hook-compliant
  const { checkLimit } = useAdLimitCheck();

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setImages(selectedFiles);
    setPreviewImages(selectedFiles.map((f) => URL.createObjectURL(f)));
  };

  const resetForm = () => {
    setMainCategory("");
    setSubCategory("");
    setTitle("");
    setDescription("");
    setPrice("");
    setImages([]);
    setPreviewImages([]);
    setBrand("");
    setModel("");
    setCondition("");
    setStateLocation("");
    setCityLocation("");
    setIsPromoted(false);
  };

  const handleAdd = async (e) => {
    e.preventDefault();

    if (!title || !mainCategory || !subCategory || !price || images.length === 0) {
      return alert("Please fill all required fields!");
    }
    if (!auth.currentUser) return alert("Login required.");

    // ✅ Check free ad limit
    const limitReached = await checkLimit(auth.currentUser.uid, mainCategory);
    if (limitReached && !isPromoted) {
      return alert("Free ad limit reached. Promote to post more.");
    }

    try {
      setLoading(true);

      // Upload images
      const imageUrls = [];
      for (let file of images) {
        const url = await uploadToCloudinary(file);
        if (!url) throw new Error("Image upload failed");
        imageUrls.push(url);
      }

      // Add to Firestore
      await addDoc(collection(db, "products"), {
        mainCategory,
        subCategory,
        title,
        description,
        price: parseFloat(price),
        images: imageUrls,
        coverImage: imageUrls[0],
        ownerId: auth.currentUser.uid,
        marketType,
        brand,
        model,
        condition,
        state: stateLocation,
        city: cityLocation,
        isPromoted,
        promotedAt: isPromoted ? new Date() : null,
        promotionExpiresAt: isPromoted
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : null,
        createdAt: serverTimestamp(),
      });

      alert(`Product added successfully${isPromoted ? " and promoted for 30 days!" : "!"}`);
      resetForm();
      navigate(`/${marketType}`);
    } catch (err) {
      console.error(err);
      alert("Error adding product: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleAdd}
      style={{
        maxWidth: "600px",
        margin: "20px auto",
        display: "flex",
        flexDirection: "column",
        gap: "15px",
        padding: "20px",
        border: "1px solid #ddd",
        borderRadius: "8px",
        background: "#fff",
      }}
    >
      <h2>Add Product ({marketType})</h2>

      {/* Main Category */}
      <select
        value={mainCategory}
        onChange={(e) => {
          setMainCategory(e.target.value);
          setSubCategory("");
        }}
        required
      >
        <option value="">Select Category</option>
        {Object.keys(categories).map((cat) => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      {/* Subcategory */}
      {subCategories.length > 0 && (
        <select
          value={subCategory}
          onChange={(e) => setSubCategory(e.target.value)}
          required
        >
          <option value="">Select Subcategory</option>
          {subCategories.map((sub) => (
            <option key={sub} value={sub}>{sub}</option>
          ))}
        </select>
      )}

      <input
        type="text"
        placeholder="Title*"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />

      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <input type="number" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} required />

      <input type="file" multiple accept="image/*" onChange={handleFileChange} required />
      {previewImages.length > 0 && (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {previewImages.map((src, idx) => (
            <img key={idx} src={src} alt={`preview-${idx}`} style={{ width: "80px", height: "80px", objectFit: "cover", border: "1px solid #ccc" }} />
          ))}
        </div>
      )}

      {/* Conditional fields */}
      <input placeholder="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
      <input placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} />
      <select value={condition} onChange={(e) => setCondition(e.target.value)}>
        <option value="">Select Condition</option>
        <option value="New">New</option>
        <option value="Used">Used</option>
      </select>

      {/* Location */}
      <select value={stateLocation} onChange={(e) => { setStateLocation(e.target.value); setCityLocation(""); }}>
        <option value="">Select State</option>
        {Object.keys(locations).map((st) => <option key={st} value={st}>{st}</option>)}
      </select>
      {stateLocation && (
        <select value={cityLocation} onChange={(e) => setCityLocation(e.target.value)}>
          <option value="">Select City</option>
          {locations[stateLocation].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      <label>
        <input type="checkbox" checked={isPromoted} onChange={() => setIsPromoted(!isPromoted)} />
        Promote this product (free, 30 days)
      </label>

      <button type="submit" disabled={loading}>
        {loading ? "Uploading..." : `Add to ${marketType}`}
      </button>
    </form>
  );
};

export default AddProduct;