// src/pages/AddMarketplaceProduct.jsx
import { useState, useRef } from "react";

export default function AddMarketplaceProduct() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [condition, setCondition] = useState("");
  const [ram, setRam] = useState("");
  const [storage, setStorage] = useState("");
  const [color, setColor] = useState("");
  const [sim, setSim] = useState("");
  const [features, setFeatures] = useState("");
  const [exchangePossible, setExchangePossible] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [posterName, setPosterName] = useState("");
  const [location, setLocation] = useState("");
  const [videoLink, setVideoLink] = useState("");
  const [delivery, setDelivery] = useState({ daysFrom: "", daysTo: "", feeFrom: "", feeTo: "" });
  const [promoted, setPromoted] = useState(false);
  const [promoPlan, setPromoPlan] = useState("");

  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef(null);

  // Handle multiple image selection
  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files).slice(0, 20); // max 20 images
    setImages(files);
    setPreviews(files.map(file => URL.createObjectURL(file)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !price || images.length < 2) {
      alert("Title, price, and at least 2 images are required");
      return;
    }

    try {
      setLoading(true);

      // 1️⃣ Upload images to Cloudinary
      const uploadedImages = [];
      for (const image of images) {
        const formData = new FormData();
        formData.append("file", image);
        formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET);

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/upload`,
          { method: "POST", body: formData }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "Image upload failed");
        uploadedImages.push(data.secure_url);
      }

      // 2️⃣ Submit product data to backend
      const body = {
        title: title.trim(),
        description: description.trim(),
        price: parseFloat(price),
        images: uploadedImages,
        category,
        subcategory,
        brand,
        model,
        condition,
        ram,
        storage,
        color,
        sim,
        features,
        exchange_possible: exchangePossible,
        phone_number: phoneNumber,
        poster_name: posterName,
        location,
        video_link: videoLink,
        delivery,
        promoted,
        promo_plan: promoPlan,
      };

      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Failed to add product");

      alert("✅ Product added successfully!");

      // Reset form
      setTitle(""); setDescription(""); setPrice(""); setCategory(""); setSubcategory("");
      setBrand(""); setModel(""); setCondition(""); setRam(""); setStorage(""); setColor("");
      setSim(""); setFeatures(""); setExchangePossible(false); setPhoneNumber(""); setPosterName("");
      setLocation(""); setVideoLink(""); setDelivery({ daysFrom: "", daysTo: "", feeFrom: "", feeTo: "" });
      setPromoted(false); setPromoPlan(""); setImages([]); setPreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = null;

    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto" }}>
      <h2>Add Marketplace Product</h2>
      <form onSubmit={handleSubmit}>

        {/* Title */}
        <input type="text" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} required style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />

        {/* Category */}
        <input type="text" placeholder="Category" value={category} onChange={e => setCategory(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />
        <input type="text" placeholder="Subcategory" value={subcategory} onChange={e => setSubcategory(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />

        {/* Price */}
        <input type="number" placeholder="Price" value={price} onChange={e => setPrice(e.target.value)} required style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />

        {/* Images */}
        <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImagesChange} style={{ marginBottom: "10px" }} />
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
          {previews.map((p, idx) => <img key={idx} src={p} alt={`Preview ${idx}`} style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "5px" }} />)}
        </div>

        {/* Description */}
        <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />

        {/* Specs */}
        <input type="text" placeholder="Brand" value={brand} onChange={e => setBrand(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />
        <input type="text" placeholder="Model" value={model} onChange={e => setModel(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />
        <input type="text" placeholder="Condition" value={condition} onChange={e => setCondition(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />
        <input type="text" placeholder="RAM" value={ram} onChange={e => setRam(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />
        <input type="text" placeholder="Storage" value={storage} onChange={e => setStorage(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />
        <input type="text" placeholder="Color" value={color} onChange={e => setColor(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />
        <input type="text" placeholder="SIM" value={sim} onChange={e => setSim(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />
        <input type="text" placeholder="Features" value={features} onChange={e => setFeatures(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />

        {/* Exchange */}
        <label>
          <input type="checkbox" checked={exchangePossible} onChange={e => setExchangePossible(e.target.checked)} /> Exchange Possible
        </label>

        {/* Contact */}
        <input type="text" placeholder="Phone Number" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />
        <input type="text" placeholder="Your Name" value={posterName} onChange={e => setPosterName(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />

        {/* Location */}
        <input type="text" placeholder="Location" value={location} onChange={e => setLocation(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />

        {/* Video Link */}
        <input type="text" placeholder="Video Link (optional)" value={videoLink} onChange={e => setVideoLink(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px" }} />

        {/* Submit */}
        <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px", background: "black", color: "white", border: "none", cursor: "pointer" }}>
          {loading ? "Adding..." : "Post Ad"}
        </button>
      </form>
    </div>
  );
}