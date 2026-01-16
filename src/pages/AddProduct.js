import React, { useState } from "react";
import { auth } from "../firebase";
import categoryRules from "../config/categoryRules";
import locations from "../config/locations";
import { validateAd } from "../utils/validators";
import { uploadImages } from "../services/uploadService";
import { createAd } from "../services/adsService";
import { useAdLimitCheck } from "../hooks/useAdLimits";

const PostAdForm = () => {
  // Basic info
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [images, setImages] = useState([]);
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");

  // Conditional fields
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [type, setType] = useState("");
  const [condition, setCondition] = useState("");

  // Location
  const [stateLocation, setStateLocation] = useState("");
  const [cityLocation, setCityLocation] = useState("");

  // Promotion
  const [isPromoted, setIsPromoted] = useState(false);

  const [loading, setLoading] = useState(false);

  const rules = categoryRules[category] || categoryRules.Default;
  const cities = stateLocation ? locations[stateLocation] : [];

  const handleFileChange = (e) => setImages([...e.target.files]);

  const resetForm = () => {
    setTitle("");
    setCategory("");
    setImages([]);
    setDescription("");
    setPrice("");
    setBrand("");
    setModel("");
    setType("");
    setCondition("");
    setStateLocation("");
    setCityLocation("");
    setIsPromoted(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!auth.currentUser) return alert("Login required");

    // Validate
    const error = validateAd({
      title,
      images,
      description,
      rules,
      brand,
      model,
      type,
      condition,
      location: cityLocation,
    });
    if (error) return alert(error);

    // Free ad limit check (promotion counts as free)
    const limitReached = await useAdLimitCheck(auth.currentUser.uid, category);
    if (limitReached && !isPromoted) {
      return alert("Free ad limit reached. You can promote this ad to bypass the limit.");
    }

    try {
      setLoading(true);

      // Upload images
      const imageUrls = await uploadImages(images);

      // Create ad in Firestore
      await createAd({
        title,
        category,
        description,
        price: Number(price),
        images: imageUrls,
        coverImage: imageUrls[0],
        ownerId: auth.currentUser.uid,
        isPromoted,
        promotedAt: isPromoted ? new Date() : null,
        promotionExpiresAt: isPromoted
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
          : null,
        brand,
        model,
        type,
        condition,
        state: stateLocation,
        city: cityLocation,
      });

      alert(`Ad posted successfully${isPromoted ? " and promoted for 30 days!" : "!"}`);
      resetForm();
    } catch (err) {
      console.error(err);
      alert("Error posting ad: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        maxWidth: "600px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "15px",
        padding: "20px",
        border: "1px solid #ddd",
        borderRadius: "8px",
      }}
    >
      <h2>Post Ad</h2>

      {/* Category */}
      <label>Category*</label>
      <select value={category} onChange={(e) => setCategory(e.target.value)} required>
        <option value="">Select Category</option>
        {Object.keys(categoryRules).map((cat) => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      {/* Title */}
      <label>Title* ({title.length}/{rules.maxTitle})</label>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={rules.maxTitle}
        placeholder="Enter title"
        required
      />

      {/* Images */}
      <label>Images* (min {rules.minImages}, max {rules.maxImages})</label>
      <input type="file" multiple accept="image/*" onChange={handleFileChange} />
      {images.length > 0 && (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {Array.from(images).map((file, idx) => (
            <img
              key={idx}
              src={URL.createObjectURL(file)}
              alt={`preview-${idx}`}
              style={{ width: "80px", height: "80px", objectFit: "cover", border: "1px solid #ccc" }}
            />
          ))}
        </div>
      )}

      {/* Conditional fields */}
      {rules.requireBrand && <input placeholder="Brand*" value={brand} onChange={(e) => setBrand(e.target.value)} required />}
      {rules.requireModel && <input placeholder="Model*" value={model} onChange={(e) => setModel(e.target.value)} required />}
      {rules.requireType && <input placeholder="Type*" value={type} onChange={(e) => setType(e.target.value)} required />}
      {rules.requireCondition && (
        <select value={condition} onChange={(e) => setCondition(e.target.value)} required>
          <option value="">Select Condition*</option>
          <option value="New">New</option>
          <option value="Used">Used</option>
        </select>
      )}

      {/* Location */}
      {rules.requireLocation && (
        <>
          <label>State*</label>
          <select value={stateLocation} onChange={(e) => { setStateLocation(e.target.value); setCityLocation(""); }} required>
            <option value="">Select State</option>
            {Object.keys(locations).map((st) => <option key={st} value={st}>{st}</option>)}
          </select>

          <label>City*</label>
          <select value={cityLocation} onChange={(e) => setCityLocation(e.target.value)} required>
            <option value="">Select City</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </>
      )}

      {/* Description */}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={rules.maxDescription}
        placeholder="Description*"
        required
      />

      {/* Price */}
      <input type="number" placeholder="Price (₦)" value={price} onChange={(e) => setPrice(e.target.value)} min="0" />

      {/* Promote */}
      <label>
        <input type="checkbox" checked={isPromoted} onChange={() => setIsPromoted(!isPromoted)} />
        Promote this ad (free, visible for 30 days)
      </label>

      <button type="submit" disabled={loading}>{loading ? "Posting..." : "Post Ad"}</button>
    </form>
  );
};

export default PostAdForm;