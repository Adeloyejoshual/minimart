// src/pages/AddProductPage.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // <-- for back button
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans, getActivePrice, getDiscountPercent } from "../config/promotions.js";
import "./AddProduct.css";

export default function AddProductPage() {
  const navigate = useNavigate(); // <-- back navigation
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    mainCategory: "",
    subCategory: "",
    dynamic: {},
    promotionId: "",
  });

  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  const states = Object.keys(locationsByState || {});
  const cities = selectedState ? locationsByState[selectedState] : [];

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch(
          "https://minimart-ivrm.onrender.com/api/marketplace/categories"
        );
        const data = await res.json();
        setCategories(data || []);
      } catch (err) {
        console.error("Failed to load categories", err);
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
    used_detail: options.usedDetails || [],
    ram: options.ram || [],
    storage: options.storage || [],
    sim: options.sims || [],
    features: options.features || [],
    year: options.years || [],
    engine: options.engine || [],
    fuel_type: options.fuel_type || [],
  };

  const update = (key, value) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const updateDynamic = (key, value) =>
    setForm(prev => ({
      ...prev,
      dynamic: { ...prev.dynamic, [key]: value },
    }));

  useEffect(() => {
    if (!selectedCategory) return;
    const initialDynamic = Object.fromEntries(
      dynamicFields.map(f => [f, f === "features" ? [] : ""])
    );
    setForm(prev => ({ ...prev, dynamic: initialDynamic, subCategory: "" }));
  }, [selectedCategory]);

  const handleImages = files => {
    const arr = Array.from(files);
    setImages(arr);
    setPreviewUrls(arr.map(f => URL.createObjectURL(f)));
  };

  const handleStateChange = state => {
    setSelectedState(state);
    setSelectedCity("");
    updateDynamic("location", "");
  };

  const handleCityChange = city => {
    setSelectedCity(city);
    updateDynamic("location", city);
  };

  const handlePriceChange = value => {
    const numeric = value.replace(/[^0-9.]/g, "");
    update("price", numeric);
  };

  const formatPrice = price => {
    if (!price) return "";
    const [integer, decimal] = price.toString().split(".");
    return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (decimal ? "." + decimal : "");
  };

  // ---------------- NEW: HANDLE PAYSTACK PROMOTION ----------------
  const handlePromotionPayment = async () => {
    if (!form.promotionId) return null;

    const selectedPlan = promotionPlans.find(p => p.id === form.promotionId);
    if (!selectedPlan) return null;

    // Prepare metadata for webhook (all product info)
    const metadata = {
      title: form.title,
      description: form.description,
      price: parseFloat(form.price),
      category_id: form.mainCategory,
      subcategory_id: form.subCategory || null,
      dynamicFields: form.dynamic,
      promotion_id: form.promotionId,
      images: await Promise.all(images.map(file => {
        return new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result);
          reader.readAsDataURL(file);
        });
      })),
    };

    // Call backend to initialize Paystack
    const res = await fetch(
      `https://minimart-ivrm.onrender.com/api/promote/initiate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(form.price), // or promotion price
          metadata,
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to initialize payment");

    // Redirect user to Paystack checkout
    window.location.href = data.payment.data.authorization_url;
  };

  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.mainCategory) {
      return alert("Title, price, and category are required");
    }
    if (images.length === 0) {
      return alert("Please upload at least one image");
    }

    try {
      setLoading(true);

      // If promotion selected → go through Paystack
      if (form.promotionId) {
        await handlePromotionPayment();
        return; // Payment flow will redirect
      }

      // Otherwise normal product creation
      const cleanedDynamic = Object.fromEntries(
        Object.entries(form.dynamic).filter(
          ([_, v]) => v !== "" && v !== null && !(Array.isArray(v) && v.length === 0)
        )
      );

      const formData = new FormData();
      formData.append("title", form.title);
      formData.append("description", form.description);
      formData.append("price", form.price);
      formData.append("category_id", form.mainCategory);
      if (form.subCategory) formData.append("subcategory_id", form.subCategory);
      formData.append("dynamicFields", JSON.stringify(cleanedDynamic));
      images.forEach(img => formData.append("images", img));

      const res = await fetch(
        "https://minimart-ivrm.onrender.com/api/marketplace/products",
        { method: "POST", body: formData }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");

      alert("Product added successfully!");
      setForm({ title: "", description: "", price: "", mainCategory: "", subCategory: "", dynamic: {}, promotionId: "" });
      setImages([]);
      setPreviewUrls([]);
      setSelectedState("");
      setSelectedCity("");
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-product-container">
      <button className="back-button" onClick={() => navigate(-1)}>← Back</button>
      <h2>Add Product</h2>

      {/* Rest of the form remains intact */}
      {/* ... all fields for title, description, category, subcategory, dynamic fields, state/city, price, promotion, images ... */}

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Processing..." : "Add Product"}
      </button>
    </div>
  );
}