// src/pages/AddProduct.js
import React, { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadToCloudinary } from "../cloudinary";
import { useNavigate, useLocation } from "react-router-dom";
import categoriesData from "../config/categoriesData";
import productOptions from "../config/productOptions";
import { locationsByRegion } from "../config/locationsByRegion";
import { useAdLimitCheck } from "../hooks/useAdLimits";
import ProductOptionsSelector from "../components/ProductOptionsSelector";

const AddProduct = () => {
  const [mainCategory, setMainCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [condition, setCondition] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [images, setImages] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);
  const [stateLocation, setStateLocation] = useState("");
  const [cityLocation, setCityLocation] = useState("");
  const [isPromoted, setIsPromoted] = useState(false);
  const [selectedStorage, setSelectedStorage] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSIM, setSelectedSIM] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [phoneNumber, setPhoneNumber] = useState("");

  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const locationQuery = useLocation();
  const params = new URLSearchParams(locationQuery.search);
  const marketType = params.get("market") || "marketplace";

  const { checkLimit } = useAdLimitCheck();

  const subCategories = mainCategory
    ? categoriesData[mainCategory]?.subcategories || []
    : [];

  const options = mainCategory ? productOptions[mainCategory] || {} : {};

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => previewImages.forEach(url => URL.revokeObjectURL(url));
  }, [previewImages]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + images.length > 10) return alert("Max 10 images allowed");
    setImages(prev => [...prev, ...files]);
    setPreviewImages(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]);
  };

  const resetForm = () => {
    previewImages.forEach(url => URL.revokeObjectURL(url));
    setMainCategory(""); setSubCategory(""); setBrand(""); setModel("");
    setCondition(""); setTitle(""); setDescription(""); setPrice("");
    setImages([]); setPreviewImages([]); setStateLocation(""); setCityLocation("");
    setIsPromoted(false); setSelectedStorage(""); setSelectedColor(""); setSelectedSIM("");
    setSelectedFeatures([]); setPhoneNumber("");
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return alert("Login required.");

    if (
      !mainCategory || !subCategory || !brand || !model || !condition || !title || !price ||
      images.length === 0 || !stateLocation || !cityLocation
    ) return alert("Please fill all required fields.");

    if (!selectedStorage || !selectedColor || !selectedSIM)
      return alert("Please select storage, color, and SIM type.");

    if (!/^\d{10,15}$/.test(phoneNumber)) return alert("Enter a valid phone number.");

    // Price validation regex
    const numericPrice = price.replace(/,/g, "");
    if(!/^\d+(\.\d{1,2})?$/.test(numericPrice)) return alert("Enter a valid price");

    try {
      setLoading(true);

      const limitReached = await checkLimit(auth.currentUser.uid, mainCategory);
      if (limitReached && !isPromoted) {
        setLoading(false);
        return alert("Free ad limit reached. Promote ad to post more.");
      }

      const imageUrls = await Promise.all(images.map(file => uploadToCloudinary(file)));

      await addDoc(collection(db, "products"), {
        mainCategory, subCategory, brand, model, condition, title, description,
        price: parseFloat(numericPrice), images: imageUrls, coverImage: imageUrls[0],
        ownerId: auth.currentUser.uid, marketType, state: stateLocation, city: cityLocation,
        isPromoted, promotedAt: isPromoted ? new Date() : null,
        promotionExpiresAt: isPromoted ? new Date(Date.now() + 30*24*60*60*1000) : null,
        createdAt: serverTimestamp(), storage: selectedStorage, color: selectedColor,
        sim: selectedSIM, features: selectedFeatures, phoneNumber
      });

      alert(`Product added successfully${isPromoted ? " and promoted for 30 days!" : ""}`);
      resetForm();
      navigate(`/${marketType}`);
    } catch (err) {
      console.error(err);
      alert("Error adding product: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Price input with comma formatting
  const handlePriceChange = (val) => {
    let num = val.replace(/,/g, "");
    if (num === "" || isNaN(num)) return setPrice("");
    const parts = num.split(".");
    const intPart = Number(parts[0]).toLocaleString();
    const decimalPart = parts[1] ? "." + parts[1].slice(0,2) : "";
    setPrice(intPart + decimalPart);
  };

  // Get all states
  const allStates = Object.values(locationsByRegion).flatMap(region => Object.keys(region));

  // Get cities for selected state
  const allCities = stateLocation
    ? Object.values(locationsByRegion).flatMap(region => region[stateLocation] || [])
    : [];

  return (
    <form onSubmit={handleAdd} className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg flex flex-col gap-4">
      <h2 className="text-3xl text-center text-blue-600 font-bold">Post Ad ({marketType})</h2>

      {/* Main Category */}
      <select value={mainCategory} onChange={e => { setMainCategory(e.target.value); setSubCategory(""); setBrand(""); setModel(""); }} required className="p-3 border rounded">
        <option value="">Select Category</option>
        {Object.keys(categoriesData).map(cat => <option key={cat} value={cat}>{cat}</option>)}
      </select>

      {/* Subcategory */}
      {subCategories.length > 0 && (
        <select value={subCategory} onChange={e => { setSubCategory(e.target.value); setBrand(""); setModel(""); }} required className="p-3 border rounded">
          <option value="">Select Subcategory</option>
          {subCategories.map(sub => <option key={sub} value={sub}>{sub}</option>)}
        </select>
      )}

      {/* Product Options */}
      {subCategory && (
        <ProductOptionsSelector
          mainCategory={mainCategory}
          subCategory={subCategory}
          onChange={({ brand, model, storage, color, sim, features, state, city }) => {
            setBrand(brand); setModel(model);
            setSelectedStorage(storage || "");
            setSelectedColor(color || "");
            setSelectedSIM(sim || "");
            setSelectedFeatures(features || []);
            if(state) setStateLocation(state);
            if(city) setCityLocation(city);
          }}
        />
      )}

      {/* Title & Description */}
      <input type="text" placeholder="Title*" value={title} onChange={e => setTitle(e.target.value)} maxLength={70} required className="p-3 border rounded"/>
      <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} maxLength={850} className="p-3 border rounded"/>

      {/* Price & Phone */}
      <input type="text" placeholder="Price*" value={price} onChange={e => handlePriceChange(e.target.value)} required className="p-3 border rounded"/>
      <input type="tel" placeholder="Your phone number*" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} maxLength={15} required className="p-3 border rounded"/>

      {/* Images */}
      <input type="file" multiple accept="image/*" onChange={handleFileChange} className="p-2 border rounded"/>
      {previewImages.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {previewImages.map((src, i) => (
            <div key={i} className="relative">
              <img src={src} alt={`preview-${i}`} className="w-20 h-20 object-cover rounded border"/>
              <button
                type="button"
                onClick={() => {
                  const newImages = images.filter((_, idx) => idx !== i);
                  const newPreviews = previewImages.filter((_, idx) => idx !== i);
                  setImages(newImages); setPreviewImages(newPreviews);
                }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                aria-label="Remove image"
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* Location */}
      <select value={stateLocation} onChange={e => { setStateLocation(e.target.value); setCityLocation(""); }} required className="p-3 border rounded">
        <option value="">Select State</option>
        {allStates.map(state => <option key={state} value={state}>{state}</option>)}
      </select>
      {stateLocation && (
        <select value={cityLocation} onChange={e => setCityLocation(e.target.value)} required className="p-3 border rounded">
          <option value="">Select City</option>
          {allCities.map(city => <option key={city} value={city}>{city}</option>)}
        </select>
      )}

      {/* Promote */}
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={isPromoted} onChange={() => setIsPromoted(!isPromoted)} className="w-4 h-4 border rounded focus:ring-blue-400"/>
        Promote this product (free, 30 days)
      </label>

      <button type="submit" disabled={loading} className="p-3 bg-blue-600 text-white rounded hover:bg-blue-700">
        {loading ? "Uploading..." : `Add to ${marketType}`}
      </button>
    </form>
  );
};

export default AddProduct;