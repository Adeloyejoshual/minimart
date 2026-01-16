import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate, useLocation } from "react-router-dom";
import categoryRules from "../config/categoryRules";
import locations from "../config/locations";
import { useAdLimitCheck } from "../hooks/useAdLimits";

const AddProduct = () => {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [condition, setCondition] = useState("");
  const [stateLocation, setStateLocation] = useState("");
  const [cityLocation, setCityLocation] = useState("");
  const [isPromoted, setIsPromoted] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const locationQuery = useLocation();
  const params = new URLSearchParams(locationQuery.search);
  const marketType = params.get("market") || "marketplace";

  const rules = categoryRules[category] || categoryRules.Default;
  const cities = stateLocation ? locations[stateLocation] : [];

  // ✅ Hook called at top level
  const { checkLimit } = useAdLimitCheck();

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setImages(selectedFiles);
    setPreviewImages(selectedFiles.map((f) => URL.createObjectURL(f)));
  };

  const resetForm = () => {
    setTitle("");
    setCategory("");
    setPrice("");
    setDescription("");
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
    if (!title || !category || !price || images.length === 0) {
      return alert("All required fields must be filled!");
    }
    if (!auth.currentUser) return alert("Please log in to add a product.");

    // ✅ Check free ad limit
    const limitReached = await checkLimit(auth.currentUser.uid, category);
    if (limitReached && !isPromoted) {
      return alert("Free ad limit reached. You can promote this ad to bypass the limit.");
    }

    try {
      setLoading(true);

      // Upload images to Cloudinary
      const imageUrls = [];
      for (let file of images) {
        const url = await uploadToCloudinary(file);
        if (!url) throw new Error("Image upload failed");
        imageUrls.push(url);
      }

      // Add product to Firestore
      await addDoc(collection(db, "products"), {
        title,
        category,
        price: parseFloat(price),
        description,
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

      <select value={category} onChange={(e) => setCategory(e.target.value)} required>
        <option value="">Select Category</option>
        {Object.keys(categoryRules).map((cat) => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Title*"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={rules.maxTitle}
        required
      />

      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={rules.maxDescription}
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
      {rules.requireBrand && <input placeholder="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} />}
      {rules.requireModel && <input placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} />}
      {rules.requireCondition && (
        <select value={condition} onChange={(e) => setCondition(e.target.value)}>
          <option value="">Select Condition</option>
          <option value="New">New</option>
          <option value="Used">Used</option>
        </select>
      )}

      {/* Location */}
      {rules.requireLocation && (
        <>
          <select value={stateLocation} onChange={(e) => { setStateLocation(e.target.value); setCityLocation(""); }}>
            <option value="">Select State</option>
            {Object.keys(locations).map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
          <select value={cityLocation} onChange={(e) => setCityLocation(e.target.value)}>
            <option value="">Select City</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </>
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