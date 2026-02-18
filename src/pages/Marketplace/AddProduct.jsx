import { useState, useRef, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Helmet } from "react-helmet-async";

import "../../pages/Marketplace/AddProduct.css";

import { categoryFields } from "../../config/categoryFields";
import { conditions, usedDetails } from "../../config/conditions";
import { ramOptions } from "../../config/ram";
import { storageOptions } from "../../config/storage";
import { colors } from "../../config/color";
import { engines } from "../../config/engine";
import { featuresByCategory } from "../../config/features";
import { brands } from "../../config/brands";
import { models } from "../../config/models";
import { sims } from "../../config/sim";
import { years } from "../../config/years";
import { locationsByState } from "../../config/locationsByState";

export default function AddMarketplaceProduct() {
  const { user } = useAuth0();
  const fileInputRef = useRef(null);

  // ===== Form State =====
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    discount_price: "",
    quantity: "",
    category: "",
    subcategory: "",
    brand: "",
    model: "",
    condition: "",
    used_detail: "",
    ram: "",
    storage: "",
    color: "",
    sim: [],
    engine: "",
    mileage: "",
    year: "",
    fuel_type: "",
    transmission: "",
    phone_number: user?.phone_number || "",
    additional_phone: "",
    poster_name: user?.name || "",
    state: "",
    city: "",
    location: "",
    social_link: "",
    images: [],
    video_link: "",
    promoted: false,
    promo_plan: "",
    flash_sale: false,
    exchange_possible: false,
    negotiable: false,
    deliveryRegions: [],
    features: [],
  });

  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);

  const [deliveryForm, setDeliveryForm] = useState({
    state: "",
    city: "",
    method: "Courier",
    from: "",
    to: "",
    chargeFee: false,
    fee: "",
    expressAvailable: false,
    warehouseAddress: "",
  });
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [selectorField, setSelectorField] = useState(null);
  const [selectorOptions, setSelectorOptions] = useState([]);

  // ===== Load Draft =====
  useEffect(() => {
    const draft = localStorage.getItem("marketplace_draft");
    if (draft) setForm(JSON.parse(draft));
  }, []);

  useEffect(() => {
    localStorage.setItem("marketplace_draft", JSON.stringify(form));
  }, [form]);

  // ===== Handlers =====
  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === "brand") setForm(prev => ({ ...prev, model: "" }));
    if (field === "state") setForm(prev => ({ ...prev, city: "" }));
  };

  const handleMultiSelect = (field, value) => {
    setForm(prev => {
      const arr = prev[field];
      if (arr.includes(value)) return { ...prev, [field]: arr.filter(v => v !== value) };
      return { ...prev, [field]: [...arr, value] };
    });
  };

  const openSelector = (field, options) => {
    setSelectorField(field);
    setSelectorOptions(options);
  };

  const selectOption = value => {
    handleChange(selectorField, value);
    setSelectorField(null);
  };

  const handleImagesChange = e => {
    const files = Array.from(e.target.files);
    if (files.length > 10) return alert("Maximum 10 images allowed");
    setImageFiles(files);
    setImagePreviews(files.map(file => URL.createObjectURL(file)));
  };

  const handlePriceChange = e => {
    const raw = e.target.value.replace(/,/g, "");
    if (!isNaN(raw)) setForm(prev => ({ ...prev, price: raw }));
  };

  // ===== Delivery =====
  const addDeliveryRegion = () => {
    if (!deliveryForm.state || !deliveryForm.city) return alert("Select delivery state and city");
    if (!deliveryForm.from || !deliveryForm.to) return alert("Set delivery time range");
    if (Number(deliveryForm.from) > Number(deliveryForm.to)) return alert("From days cannot be greater than To days");

    const isFreeDelivery = deliveryForm.chargeFee && Number(deliveryForm.fee) === 0;
    setForm(prev => ({
      ...prev,
      deliveryRegions: [...prev.deliveryRegions, { ...deliveryForm, isFreeDelivery }],
    }));
    setDeliveryForm({ state: "", city: "", method: "Courier", from: "", to: "", chargeFee: false, fee: "", expressAvailable: false, warehouseAddress: "" });
    setShowDeliveryForm(false);
  };

  const removeDeliveryRegion = index => {
    setForm(prev => ({ ...prev, deliveryRegions: prev.deliveryRegions.filter((_, i) => i !== index) }));
  };

  // ===== Validation =====
  const validateForm = () => {
    const errors = {};
    if (!form.title || form.title.trim().length < 30) errors.title = "Title must be at least 30 characters";
    if (!form.description || form.description.trim().length < 50) errors.description = "Description must be at least 50 characters";
    if (!form.price || Number(form.price) <= 0) errors.price = "Price must be greater than 0";
    if (!form.phone_number || !/^\d{10,11}$/.test(form.phone_number)) errors.phone_number = "Enter valid phone number";
    if (!form.state) errors.state = "State required";
    if (!form.city) errors.city = "City required";
    if (imageFiles.length < 1) errors.images = "Minimum 1 image required";
    if (imageFiles.length > 10) errors.images = "Maximum 10 images allowed";
    return errors;
  };

  const handleSubmit = e => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) return alert(Object.values(errors)[0]);
    setShowPreview(true);
  };

  const confirmPublish = () => {
    setLoading(true);
    setTimeout(() => {
      alert("Product published successfully!");
      localStorage.removeItem("marketplace_draft");
      setLoading(false);
      setShowPreview(false);
      setForm(prev => ({ ...prev, title: "", description: "", images: [], deliveryRegions: [] }));
    }, 1500);
  };

  // ===== Options =====
  const visibleFields = categoryFields[form.category] || [];
  const availableBrands = brands[form.category] || [];
  const availableModels = form.brand ? models[form.category]?.[form.brand] || [] : [];
  const categoryFeatures = featuresByCategory[form.category] || [];
  const availableSims = sims || [];
  const availableYears = years || [];
  const availableCities = locationsByState[form.state] || [];

  const getFieldOptions = field => {
    switch (field) {
      case "brand": return availableBrands;
      case "model": return availableModels;
      case "ram": return ramOptions;
      case "storage": return storageOptions;
      case "color": return colors;
      case "sim": return availableSims;
      case "features": return categoryFeatures;
      case "year": return availableYears;
      case "condition": return conditions;
      case "used_detail": return usedDetails;
      default: return [];
    }
  };

  return (
    <div className="add-product-container">
      <Helmet>
        <title>{form.title ? `${form.title} - MiniMart Marketplace` : "Post Marketplace Ad - MiniMart"}</title>
      </Helmet>

      <h2 className="add-product-title">Post Marketplace Ad</h2>

      <form onSubmit={handleSubmit}>
        {/* === Product Details === */}
        <div className="add-product-section">
          <h3>Product Details</h3>
          <input type="text" placeholder="Product Name" value={form.title} onChange={e => handleChange("title", e.target.value)} />
          <button type="button" onClick={() => openSelector("category", Object.keys(categoryFields))}>{form.category || "Select Category"}</button>

          {visibleFields.map(field =>
            field === "features" || field === "sim" ? (
              <div key={field}>
                <p>{field.replace("_", " ")}</p>
                {getFieldOptions(field).map(opt => (
                  <label key={opt}>
                    <input type="checkbox" checked={form[field].includes(opt)} onChange={() => handleMultiSelect(field, opt)} />
                    {opt}
                  </label>
                ))}
              </div>
            ) : (
              <button key={field} type="button" onClick={() => openSelector(field, getFieldOptions(field))}>{form[field] || `Select ${field.replace("_", " ")}`}</button>
            )
          )}

          {availableBrands.length > 0 && <button type="button" onClick={() => openSelector("brand", availableBrands)}>{form.brand || "Select Brand"}</button>}
          {availableModels.length > 0 && <button type="button" onClick={() => openSelector("model", availableModels)}>{form.model || "Select Model"}</button>}
        </div>

        {/* === Pricing === */}
        <div className="add-product-section">
          <h3>Pricing & Offers</h3>
          <input type="text" placeholder="Price" value={Number(form.price).toLocaleString()} onChange={handlePriceChange} />
          <input type="number" placeholder="Discount Price" value={form.discount_price} onChange={e => handleChange("discount_price", e.target.value)} />
          <label><input type="checkbox" checked={form.negotiable} onChange={e => handleChange("negotiable", e.target.checked)} /> Negotiable</label>
          <label><input type="checkbox" checked={form.exchange_possible} onChange={e => handleChange("exchange_possible", e.target.checked)} /> Exchange Possible</label>
          <label><input type="checkbox" checked={form.flash_sale} onChange={e => handleChange("flash_sale", e.target.checked)} /> Flash Sale</label>
        </div>

        {/* === Description === */}
        <div className="add-product-section">
          <h3>Description & Quantity</h3>
          <textarea placeholder="Description" value={form.description} onChange={e => handleChange("description", e.target.value)} />
          <input type="number" placeholder="Quantity" value={form.quantity} onChange={e => handleChange("quantity", e.target.value)} />
        </div>

        {/* === Images === */}
        <div className="add-product-section">
          <h3>Images / Media</h3>
          <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImagesChange} />
          <div className="image-preview-container">
            {imagePreviews.map((src, i) => <img key={i} src={src} alt="Preview" />)}
          </div>
          <input type="text" placeholder="Video / 360° Link" value={form.video_link} onChange={e => handleChange("video_link", e.target.value)} />
        </div>

        {/* === Contact & Seller === */}
        <div className="add-product-section">
          <h3>Contact & Seller Info</h3>
          <button type="button" onClick={() => openSelector("state", Object.keys(locationsByState))}>{form.state || "Select State"}</button>
          <button type="button" onClick={() => form.state ? openSelector("city", locationsByState[form.state]) : alert("Select a state first")}>{form.city || "Select City"}</button>
          <input type="text" placeholder="Address" value={form.location} onChange={e => handleChange("location", e.target.value)} />
          <input type="text" placeholder="Phone" value={form.phone_number} onChange={e => handleChange("phone_number", e.target.value)} />
          <input type="text" placeholder="Additional Phone" value={form.additional_phone} onChange={e => handleChange("additional_phone", e.target.value)} />
          <input type="text" placeholder="Seller Name" value={form.poster_name} readOnly className="readonly-input" />
          <input type="text" placeholder="Social Link" value={form.social_link} onChange={e => handleChange("social_link", e.target.value)} />
        </div>

        {/* === Delivery === */}
        <div className="add-product-section">
          <h3>Delivery Options</h3>
          <button type="button" onClick={() => setShowDeliveryForm(!showDeliveryForm)}>
            {showDeliveryForm ? "Close Delivery Form" : "Add Delivery Region"}
          </button>

          {showDeliveryForm && (
            <div className="delivery-form">
              <button type="button" onClick={() => openSelector("deliveryFormState", Object.keys(locationsByState))}>{deliveryForm.state || "Select State"}</button>
              <button type="button" onClick={() => deliveryForm.state ? openSelector("deliveryFormCity", locationsByState[deliveryForm.state]) : alert("Select a state first")}>{deliveryForm.city || "Select City"}</button>

              <select value={deliveryForm.method} onChange={e => setDeliveryForm(prev => ({ ...prev, method: e.target.value }))}>
                <option value="Courier">Courier</option>
                <option value="Pickup">Pickup</option>
                <option value="Both">Both</option>
              </select>

              <div className="delivery-days">
                <input type="number" placeholder="From" value={deliveryForm.from} onChange={e => setDeliveryForm(prev => ({ ...prev, from: e.target.value }))} />
                <input type="number" placeholder="To" value={deliveryForm.to} onChange={e => setDeliveryForm(prev => ({ ...prev, to: e.target.value }))} />
              </div>

              <label><input type="checkbox" checked={deliveryForm.chargeFee} onChange={e => setDeliveryForm(prev => ({ ...prev, chargeFee: e.target.checked }))} /> Charge Delivery Fee</label>
              {deliveryForm.chargeFee && <input type="number" placeholder="Fee" value={deliveryForm.fee} onChange={e => setDeliveryForm(prev => ({ ...prev, fee: e.target.value }))} />}
              <label><input type="checkbox" checked={deliveryForm.expressAvailable} onChange={e => setDeliveryForm(prev => ({ ...prev, expressAvailable: e.target.checked }))} /> Express Delivery Available</label>
              <input type="text" placeholder="Warehouse Address (Optional)" value={deliveryForm.warehouseAddress} onChange={e => setDeliveryForm(prev => ({ ...prev, warehouseAddress: e.target.value }))} />

              <button type="button" onClick={addDeliveryRegion}>Add Region</button>
            </div>
          )}

          {form.deliveryRegions.map((region, i) => (
            <div key={i} className="delivery-region-card">
              <strong>{region.state} - {region.city}</strong>
              <div>{region.method} • {region.from}-{region.to} days</div>
              {region.isFreeDelivery && <div className="free-delivery">FREE DELIVERY</div>}
              {region.expressAvailable && <div className="express-delivery">Express Available</div>}
              <button onClick={() => removeDeliveryRegion(i)}>Remove</button>
            </div>
          ))}
        </div>

        <button type="submit" className="submit-button">Preview & Post Marketplace Ad</button>
      </form>

      {/* === Full-page Selector === */}
      {selectorField && (
        <div className="selector-modal">
          <div className="selector-content">
            {selectorOptions.map(opt => (
              <div key={opt} className={`selector-option ${form[selectorField] === opt ? "selected" : ""}`} onClick={() => selectOption(opt)}>
                {opt}
              </div>
            ))}
            <button className="selector-cancel" onClick={() => setSelectorField(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* === Preview Modal === */}
      {showPreview && (
        <div className="preview-modal">
          <div className="preview-content">
            <h2>{form.title}</h2>
            <p><strong>Price:</strong> ₦{Number(form.price).toLocaleString()}</p>
            {form.negotiable && <p>💬 Negotiable</p>}
            {form.exchange_possible && <p>🔄 Exchange Possible</p>}
            <p>{form.description}</p>
            <div className="image-preview-container">
              {imagePreviews.map((src, i) => <img key={i} src={src} alt="Preview" />)}
            </div>
            {form.deliveryRegions.length > 0 && (
              <div>
                <h4>Delivery Regions</h4>
                {form.deliveryRegions.map((d, i) => <div key={i}>{d.state} - {d.city} • {d.from}-{d.to} days</div>)}
              </div>
            )}
            <div className="preview-buttons">
              <button onClick={() => setShowPreview(false)}>Edit</button>
              <button onClick={confirmPublish} disabled={loading}>{loading ? "Publishing..." : "Confirm & Publish"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}