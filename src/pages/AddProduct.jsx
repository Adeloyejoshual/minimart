// src/pages/AddProductPage.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DropdownModal from "../components/DropdownModal.jsx";
import { locationsByState } from "../config/locationsByState.js";
import { promotionPlans, getActivePrice, getDiscountPercent } from "../config/promotions.js";
import "./AddProduct.css";

export default function AddProductPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
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
    deliveryName: "",
    deliveryRegion: "",
    deliveryDaysFrom: "",
    deliveryDaysTo: "",
    deliveryFee: false,
    videoLink: "",
  });

  const states = Object.keys(locationsByState || {});
  const cities = selectedState ? locationsByState[selectedState] : [];

  // ---------------- FETCH CATEGORIES ----------------
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/categories");
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

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const updateDynamic = (key, value) =>
    setForm(prev => ({ ...prev, dynamic: { ...prev.dynamic, [key]: value } }));

  // ---------------- RESET DYNAMIC FIELDS ON CATEGORY ----------------
  useEffect(() => {
    if (!selectedCategory) return;
    const currentDynamic = { ...form.dynamic };
    dynamicFields.forEach(f => {
      if (!(f in currentDynamic)) currentDynamic[f] = f === "features" ? [] : "";
    });
    currentDynamic.location = {
      state: selectedState || currentDynamic.location?.state || "",
      city: selectedCity || currentDynamic.location?.city || "",
    };
    setForm(prev => ({ ...prev, dynamic: currentDynamic, subCategory: "" }));
  }, [selectedCategory]);

  // ---------------- IMAGE PREVIEWS ----------------
  const handleImages = files => {
    const arr = [...images, ...Array.from(files)].slice(0, 8);
    setImages(arr);
    setPreviewUrls(arr.map(f => URL.createObjectURL(f)));
  };
  const removeImage = index => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  // ---------------- STATE & CITY ----------------
  const handleStateChange = state => {
    setSelectedState(state);
    setSelectedCity("");
    updateDynamic("location", { ...form.dynamic.location, state, city: "" });
  };
  const handleCityChange = city => {
    setSelectedCity(city);
    updateDynamic("location", { ...form.dynamic.location, city });
  };

  // ---------------- PRICE ----------------
  const handlePriceChange = value => {
    const numeric = value.replace(/[^0-9.]/g, "");
    update("price", numeric);
  };
  const formatPrice = price => {
    if (!price) return "";
    const [integer, decimal] = price.toString().split(".");
    return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (decimal ? "." + decimal : "");
  };

  // ---------------- SUBMIT ----------------
  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.mainCategory) return alert("Title, price, and category are required");
    if (!images.length) return alert("Please upload at least one image");

    const cleanedDynamic = Object.fromEntries(
      Object.entries(form.dynamic).filter(
        ([_, v]) => v !== "" && v !== null && !(Array.isArray(v) && !v.length)
      )
    );

    try {
      setLoading(true);

      // 1️⃣ Create product
      const productRes = await fetch("https://minimart-ivrm.onrender.com/api/marketplace/products", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          price: parseFloat(form.price),
          category_id: form.mainCategory,
          subcategory_id: form.subCategory || null,
          dynamicFields: cleanedDynamic,
          promotion_id: form.promotionId || null,
          negotiable: form.negotiable,
          contact_phone: form.contactPhone,
          delivery_name: form.deliveryName,
          delivery_region: form.deliveryRegion,
          delivery_days_from: form.deliveryDaysFrom || null,
          delivery_days_to: form.deliveryDaysTo || null,
          delivery_fee: form.deliveryFee,
          video_link: form.videoLink,
          terms_accepted: true,
          title_image: images[0] || null,
        }),
        headers: { "Content-Type": "application/json" },
      });

      const productData = await productRes.json();
      if (!productRes.ok) throw new Error(productData.message || "Failed to add product");

      const productId = productData.id;

      // 2️⃣ Upload images
      if (images.length) {
        const formDataArr = images.map(img => {
          const fd = new FormData();
          fd.append("images", img);
          return fd;
        });

        await Promise.all(
          formDataArr.map(fd =>
            fetch(`https://minimart-ivrm.onrender.com/api/marketplace/products/${productId}/images`, {
              method: "POST",
              body: fd,
            })
          )
        );
      }

      alert("Product added successfully!");
      // Reset
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
        deliveryName: "",
        deliveryRegion: "",
        deliveryDaysFrom: "",
        deliveryDaysTo: "",
        deliveryFee: false,
        videoLink: "",
      });
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
      {/* HEADER */}
      <div className="header">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        <h2>Add Product</h2>
      </div>

      {/* TITLE */}
      <div className="field">
        <label>Title</label>
        <input className="rounded-input" value={form.title} onChange={e => update("title", e.target.value)} placeholder="e.g iPhone 13" />
      </div>

      {/* DESCRIPTION */}
      <div className="field">
        <label>Description</label>
        <textarea className="rounded-input" value={form.description} onChange={e => update("description", e.target.value)} placeholder="Write product details here..." />
      </div>

      {/* CATEGORY */}
      <DropdownModal label="Category" value={form.mainCategory} onChange={val => update("mainCategory", val)} options={categories.map(c => ({ id: c.id, name: c.name }))} />

      {/* SUBCATEGORY */}
      {subcategories.length > 0 && (
        <DropdownModal label="Subcategory" value={form.subCategory} onChange={val => update("subCategory", val)} options={subcategories.map(s => ({ id: s.id, name: s.name }))} />
      )}

      {/* DYNAMIC FIELDS */}
      {dynamicFields.map(field => {
        const value = form.dynamic[field];
        if (field === "used_detail" && form.dynamic.condition !== "Used") return null;
        if (field === "features") {
          const current = Array.isArray(value) ? value : [];
          return (
            <div key={field} className="multi-select">
              <label>{field.replace(/_/g, " ").toUpperCase()}</label>
              {optionsMap[field].map(opt => (
                <label key={opt}>
                  <input type="checkbox" checked={current.includes(opt)} onChange={() =>
                    updateDynamic(field, current.includes(opt) ? current.filter(v => v !== opt) : [...current, opt])
                  }/>
                  {opt}
                </label>
              ))}
            </div>
          );
        }
        return (
          <DropdownModal key={field} label={field.replace(/_/g, " ").toUpperCase()} value={value || ""} onChange={val => updateDynamic(field, val)} options={optionsMap[field]} />
        );
      })}

      {/* STATE & CITY */}
      <DropdownModal label="State" value={selectedState} onChange={handleStateChange} options={states} />
      {selectedState && <DropdownModal label="City" value={selectedCity} onChange={handleCityChange} options={cities} />}

      {/* PRICE */}
      <div className="field">
        <label>Price (₦)</label>
        <input type="text" value={formatPrice(form.price)} onChange={e => handlePriceChange(e.target.value)} />
      </div>

      {/* NEGOTIATION */}
      <DropdownModal label="Are you open to negotiation?" value={form.negotiable} onChange={val => update("negotiable", val)} options={["Yes", "No", "Not sure"]} />

      {/* CONTACT PHONE */}
      <div className="field">
        <label>Phone number</label>
        <input value={form.contactPhone} onChange={e => update("contactPhone", e.target.value)} placeholder="Enter phone number" />
      </div>

      {/* DELIVERY */}
      <h4>Delivery</h4>
      <div className="field">
        <label>Name this delivery</label>
        <input value={form.deliveryName} onChange={e => update("deliveryName", e.target.value)} placeholder="Required" />
      </div>
      <div className="field">
        <label>Region</label>
        <input value={form.deliveryRegion} onChange={e => update("deliveryRegion", e.target.value)} placeholder="Region" />
      </div>
      <div className="field">
        <label>How many days it takes to deliver?</label>
        <input type="number" min={0} value={form.deliveryDaysFrom} onChange={e => update("deliveryDaysFrom", e.target.value)} placeholder="From" />
        <input type="number" min={0} value={form.deliveryDaysTo} onChange={e => update("deliveryDaysTo", e.target.value)} placeholder="To" />
      </div>
      <div className="field">
        <label>Do you charge fee for delivery?</label>
        <select value={form.deliveryFee} onChange={e => update("deliveryFee", e.target.value === "true")}>
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      </div>

      {/* VIDEO LINK */}
      <div className="field">
        <label>Link to Youtube or Facebook video</label>
        <input value={form.videoLink} onChange={e => update("videoLink", e.target.value)} placeholder="Optional" />
      </div>

      {/* TERMS */}
      <p>By clicking on Post Ad, you accept the <span className="link" onClick={() => navigate("/terms")}>Terms of Use</span>, confirm that you will abide by the Safety Tips, and declare that this posting does not include any Prohibited Items.</p>

      {/* IMAGES */}
      <div className="field">
        <label>Images (max 8) - First picture is the title picture</label>
        <div className="image-input-wrapper">
          <input type="file" accept="image/*" multiple onChange={e => handleImages(e.target.files)} />
          {images.length < 8 && <button type="button" onClick={() => document.querySelector('input[type="file"]').click()}>+</button>}
        </div>
        <div className="image-preview">
          {previewUrls.map((url, i) => (
            <div key={i} className="preview-wrapper">
              <img src={url} alt={`preview ${i}`} />
              <button type="button" onClick={() => removeImage(i)}>Remove</button>
            </div>
          ))}
        </div>
      </div>

      {/* SUBMIT */}
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Saving..." : "Post Ad"}
      </button>
    </div>
  );
}