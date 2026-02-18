// src/pages/Marketplace/AddMarketplaceProduct.jsx
import { useState, useRef } from "react";
const [showPreview, setShowPreview] = useState(false);
import { useAuth0 } from "@auth0/auth0-react";
import { categoryFields } from "../../config/categoryFields";
import { conditions, usedDetails } from "../../config/conditions";
import { ramOptions } from "../../config/ram";
import { storageOptions } from "../../config/storage";
import { colors } from "../../config/color";
import { engines } from "../../config/engine";
import { fuelTypes } from "../../config/fuelTypes";
import { featuresByCategory } from "../../config/features";
import { promotionPlans } from "../../config/promotion";
import { locationsByState } from "../../config/locationsByState";
import { brands } from "../../config/brands";
import { models } from "../../config/models";
import { sims } from "../../config/sim";
import { years } from "../../config/years";

export default function AddMarketplaceProduct() {
const { user } = useAuth0();

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
sim: "",
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
});

const [imageFiles, setImageFiles] = useState([]);
const [imagePreviews, setImagePreviews] = useState([]);
const [loading, setLoading] = useState(false);
const fileInputRef = useRef(null);

const handleChange = (field, value) => {
setForm((prev) => ({ ...prev, [field]: value }));
if (field === "brand") setForm((prev) => ({ ...prev, model: "" }));
if (field === "state") setForm((prev) => ({ ...prev, city: "" }));
};

const addDeliveryRegion = () => {

if (!deliveryForm.state || !deliveryForm.city) {
alert("Select delivery state and city");
return;
}

if (!deliveryForm.from || !deliveryForm.to) {
alert("Set delivery time range");
return;
}

if (Number(deliveryForm.from) > Number(deliveryForm.to)) {
alert("From days cannot be greater than To days");
return;
}

const isFreeDelivery =
deliveryForm.chargeFee && Number(deliveryForm.fee) === 0;

setForm(prev => ({
...prev,
deliveryRegions: [
...prev.deliveryRegions,
{ ...deliveryForm, isFreeDelivery }
]
}));

setDeliveryForm({
state: "",
city: "",
method: "Courier",
from: "",
to: "",
chargeFee: false,
fee: "",
expressAvailable: false,
warehouseAddress: ""
});
};

const removeDeliveryRegion = (index) => {
setForm(prev => ({
...prev,
deliveryRegions: prev.deliveryRegions.filter((_, i) => i !== index)
}));
};
const handleImagesChange = (e) => {
const files = Array.from(e.target.files);
if (files.length > 10) {
alert("You can upload maximum 10 images");
return;
}
setImageFiles(files);
setImagePreviews(files.map((file) => URL.createObjectURL(file)));
};

const validateForm = () => {
const errors = {};

if (!form.title || form.title.trim().length < 30)
errors.title = "Title must be at least 30 characters";

if (!form.description || form.description.trim().length < 50)
errors.description = "Description must be at least 50 characters";

if (!form.price || Number(form.price) <= 0)
errors.price = "Price must be greater than 0";

if (!form.phone_number || !/^\d{10,11}$/.test(form.phone_number))
errors.phone_number = "Enter valid phone number";

if (!form.state) errors.state = "State required";
if (!form.city) errors.city = "City required";

if (imageFiles.length < 1)
errors.images = "Minimum 1 image required";

if (imageFiles.length > 10)
errors.images = "Maximum 10 images allowed";

return errors;
};

const handleSubmit = async (e) => {
e.preventDefault();
const errors = validateForm();
if (Object.keys(errors).length > 0) {
alert(Object.values(errors)[0]);
return;
}

try {    
  setLoading(true);    
  const uploadedUrls = [];    
  for (let file of imageFiles) {    
    const formData = new FormData();    
    formData.append("file", file);    
    formData.append(    
      "upload_preset",    
      import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET    
    );    
    const res = await fetch(    
      `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/upload`,    
      { method: "POST", body: formData }    
    );    
    const data = await res.json();    
    uploadedUrls.push(data.secure_url);    
  }    

  const productData = { ...form, images: uploadedUrls };    

  const response = await fetch("/api/marketplace", {    
    method: "POST",    
    headers: { "Content-Type": "application/json" },    
    body: JSON.stringify(productData),    
  });    

  const result = await response.json();    
  if (!response.ok) throw new Error(result.message || "Failed to add product");    

  alert("✅ Product added successfully!");    
  setForm((prev) => ({    
    ...prev,    
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
    sim: "",    
    engine: "",    
    mileage: "",    
    year: "",    
    fuel_type: "",    
    transmission: "",    
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
    delivery: {},    
  }));    
  setImageFiles([]);    
  setImagePreviews([]);    
  if (fileInputRef.current) fileInputRef.current.value = null;    
} catch (err) {    
  console.error(err);    
  alert(err.message || "Failed to add product");    
} finally {    
  setLoading(false);    
}

};

const visibleFields = categoryFields[form.category] || [];
const availableBrands = brands[form.category] || [];
const availableModels = form.brand ? models[form.category]?.[form.brand] || [] : [];
const categoryFeatures = featuresByCategory[form.category] || [];
const availableSims = sims || [];
const availableYears = years || [];
const availableCities = locationsByState[form.state] || [];

const sectionStyle = {
border: "2px solid #007BFF",
borderRadius: "12px",
padding: "20px",
marginBottom: "20px",
background: "#E6F0FF",
};

return (
<div style={{ maxWidth: "700px", margin: "40px auto" }}>
<h2 style={{ textAlign: "center", marginBottom: "20px" }}>Post Marketplace Ad</h2>
<form onSubmit={handleSubmit}>

{/* SECTION 1: Product Details */}    
    <div style={sectionStyle}>    
      <h3>Product Details</h3>    
      <input type="text" placeholder="Product Name" value={form.title} onChange={(e) => handleChange("title", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />    
      <select value={form.category} onChange={(e) => handleChange("category", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>    
        <option value="">Select Category</option>    
        {Object.keys(categoryFields).map((cat) => <option key={cat} value={cat}>{cat}</option>)}    
      </select>    
      <select value={form.subcategory} onChange={(e) => handleChange("subcategory", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>    
        <option value="">Select Subcategory</option>    
      </select>    
      {visibleFields.map((field) => {    
        switch (field) {    
          case "brand":    
            return (    
              <select key={field} value={form.brand} onChange={(e) => handleChange("brand", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>    
                <option value="">Select Brand</option>    
                {availableBrands.map((b) => <option key={b} value={b}>{b}</option>)}    
              </select>    
            );    
          case "model":    
            return (    
              <input key={field} type="text" placeholder="Model / Variant" value={form.model} onChange={(e) => handleChange("model", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />    
            );    
          case "condition":    
            return (    
              <select key={field} value={form.condition} onChange={(e) => handleChange("condition", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>    
                <option value="">Select Condition</option>    
                {conditions.map((c) => <option key={c} value={c}>{c}</option>)}    
              </select>    
            );    
          case "quantity":    
            return (    
              <input key={field} type="number" placeholder="Quantity / Stock" value={form.quantity} onChange={(e) => handleChange("quantity", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />    
            );    
          default:    
            return null;    
        }    
      })}    
    </div>    

    {/* SECTION 2: Pricing & Offers */}    
    <div style={sectionStyle}>    
      <h3>Pricing & Offers</h3>    
      <input type="number" placeholder="Price" value={form.price} onChange={(e) => handleChange("price", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />    
      <input type="number" placeholder="Discount / Sale Price (Optional)" value={form.discount_price} onChange={(e) => handleChange("discount_price", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />    
      <label style={{ display: "block", marginBottom: "15px" }}>    
        <input type="checkbox" checked={form.flash_sale} onChange={(e) => handleChange("flash_sale", e.target.checked)} /> Flash Sale    
      <label style={{ display: "block", marginBottom: "10px" }}>

<input
type="checkbox"
checked={form.negotiable}
onChange={(e) => handleChange("negotiable", e.target.checked)}
/> Price Negotiable
</label>

<label style={{ display: "block", marginBottom: "10px" }}>
<input
type="checkbox"
checked={form.exchange_possible}
onChange={(e) => handleChange("exchange_possible", e.target.checked)}
/> Exchange Possible
</label>
</div>

{/* SECTION 3: Product Description & Details */}    
    <div style={sectionStyle}>    
      <h3>Product Description & Details</h3>    
      <textarea placeholder="Short Description" value={form.description} onChange={(e) => handleChange("description", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />    
    </div>    

    {/* SECTION 4: Product Images / Media */}    
    <div style={sectionStyle}>    
      <h3>Product Images / Media</h3>    
      <input type="file" accept="image/*" multiple ref={fileInputRef} onChange={handleImagesChange} style={{ marginBottom: "15px" }} />    
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "15px" }}>    
        {imagePreviews.map((src, i) => (    
          <img key={i} src={src} alt="Preview" style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "5px" }} />    
        ))}    
      </div>    
      <input type="text" placeholder="Optional Video / 360° View Link" value={form.video_link} onChange={(e) => handleChange("video_link", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />    
    </div>    

    {/* SECTION 6: Contact & Seller Info */}    
    <div style={sectionStyle}>    
      <h3>Contact & Seller Info</h3>    
      <input type="text" placeholder="Phone Number" value={form.phone_number} onChange={(e) => handleChange("phone_number", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />    
      <input type="text" placeholder="Additional Phone / WhatsApp" value={form.additional_phone} onChange={(e) => handleChange("additional_phone", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />    
      <input type="text" placeholder="Seller Name" value={form.poster_name} readOnly style={{ width: "100%", padding: "10px", marginBottom: "15px", background: "#f5f5f5" }} />    
      <select value={form.state} onChange={(e) => handleChange("state", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>    
        <option value="">Select State</option>    
        {Object.keys(locationsByState).map((st) => <option key={st} value={st}>{st}</option>)}    
      </select>    
      <select value={form.city} onChange={(e) => handleChange("city", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }}>    
        <option value="">Select City</option>    
        {availableCities.map((ct) => <option key={ct} value={ct}>{ct}</option>)}    
      </select>    
      <input type="text" placeholder="Location / Address" value={form.location} onChange={(e) => handleChange("location", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />    
      <input type="text" placeholder="Social Media / Store Link (Optional)" value={form.social_link} onChange={(e) => handleChange("social_link", e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px" }} />    
    </div>    

     {/* SECTION: Delivery Options */}

<div style={sectionStyle}>    
  <h3>Delivery Options</h3>    {/* Delivery Form */}
<select
value={deliveryForm.state}
onChange={(e) =>
setDeliveryForm(prev => ({
...prev,
state: e.target.value,
city: ""
}))
}
style={{ width: "100%", padding: "10px", marginBottom: "10px" }}

> 

<option value="">Select State</option>    
{Object.keys(locationsByState).map((st) => (    
  <option key={st} value={st}>{st}</option>    
))}

  </select>    <select
value={deliveryForm.city}
onChange={(e) =>
setDeliveryForm(prev => ({
...prev,
city: e.target.value
}))
}
style={{ width: "100%", padding: "10px", marginBottom: "10px" }}

> 

<option value="">Select City</option>    
{(locationsByState[deliveryForm.state] || []).map((ct) => (    
  <option key={ct} value={ct}>{ct}</option>    
))}

  </select>    <select
value={deliveryForm.method}
onChange={(e) =>
setDeliveryForm(prev => ({
...prev,
method: e.target.value
}))
}
style={{ width: "100%", padding: "10px", marginBottom: "10px" }}

> 

<option value="Courier">Courier</option>    
<option value="Pickup">Pickup</option>    
<option value="Both">Both</option>

  </select>    <input
type="number"
placeholder="From (days)"
value={deliveryForm.from}
onChange={(e) =>
setDeliveryForm(prev => ({
...prev,
from: e.target.value
}))
}
style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
/>

<input
type="number"
placeholder="To (days)"
value={deliveryForm.to}
onChange={(e) =>
setDeliveryForm(prev => ({
...prev,
to: e.target.value
}))
}
style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
/>

<label style={{ display: "block", marginBottom: "10px" }}>
<input
type="checkbox"
checked={deliveryForm.chargeFee}
onChange={(e) =>
setDeliveryForm(prev => ({
...prev,
chargeFee: e.target.checked
}))
}
/> Charge Delivery Fee
</label>

{deliveryForm.chargeFee && (
<input
type="number"
placeholder="Delivery Fee"
value={deliveryForm.fee}
onChange={(e) =>
setDeliveryForm(prev => ({
...prev,
fee: e.target.value
}))
}
style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
/>
)}

<label style={{ display: "block", marginBottom: "10px" }}>
<input
type="checkbox"
checked={deliveryForm.expressAvailable}
onChange={(e) =>
setDeliveryForm(prev => ({
...prev,
expressAvailable: e.target.checked
}))
}
/> Express Delivery Available
</label>

<input
type="text"
placeholder="Warehouse Address (Optional)"
value={deliveryForm.warehouseAddress}
onChange={(e) =>
setDeliveryForm(prev => ({
...prev,
warehouseAddress: e.target.value
}))
}
style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
/>

<button
type="button"
onClick={addDeliveryRegion}
style={{
width: "100%",
padding: "10px",
background: "#007BFF",
color: "#fff",
border: "none",
borderRadius: "8px",
cursor: "pointer"
}}

> 

Add Delivery Region

  </button>    {/* Show Added Regions */}
{form.deliveryRegions.map((region, index) => (
<div
key={index}
style={{
background: "#fff",
padding: "10px",
borderRadius: "8px",
marginTop: "10px",
border: "1px solid #ccc"
}}
>
<strong>{region.state} - {region.city}</strong>
<div>{region.method} • {region.from}-{region.to} days</div>
{region.isFreeDelivery && <div style={{ color: "green" }}>FREE DELIVERY</div>}
{region.expressAvailable && <div style={{ color: "#007BFF" }}>Express Available</div>}
<button
type="button"
onClick={() => removeDeliveryRegion(index)}
style={{
marginTop: "5px",
background: "red",
color: "#fff",
border: "none",
padding: "5px 10px",
borderRadius: "5px"
}}
>
Remove
</button>
</div>
))}

</div>    {/* SECTION 7: Preview & Publish */}    
    <div style={sectionStyle}>    
      <h3>Preview & Publish</h3>    
      <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px", background: "black", color: "#fff", border: "none", cursor: "pointer", fontSize: "16px", marginBottom: "10px" }}>    
        {loading ? "Posting..." : "Preview Product"}    
      </button>    
      <label style={{ display: "block", marginBottom: "15px" }}>    
        <input type="checkbox" /> I agree to Terms & Conditions    
      </label>    
    </div>    

  </form>    
</div>

);
}
