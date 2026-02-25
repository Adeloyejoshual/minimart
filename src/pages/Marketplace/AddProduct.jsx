// src/pages/Marketplace/AddProduct.jsx - BULLETPROOF VERSION
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AddMarketplaceProduct.css";

export default function AddProduct() {
  const navigate = useNavigate();
  
  const [form, setForm] = useState({
    title: "",
    category: "",
    price: "",
    phone: "",
    images: []
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Form submitted:", form);
    alert("Product would be published! Check console.");
  };

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Create Listing</h1>
      <button onClick={() => navigate(-1)}>← Back</button>
      
      <form onSubmit={handleSubmit} style={{ marginTop: "20px" }}>
        <div>
          <label>Title:</label>
          <input 
            value={form.title}
            onChange={(e) => setForm({...form, title: e.target.value})}
            style={{ width: "100%", padding: "10px", margin: "10px 0" }}
          />
        </div>
        
        <div>
          <label>Price (₦):</label>
          <input 
            type="number"
            value={form.price}
            onChange={(e) => setForm({...form, price: e.target.value})}
            style={{ width: "100%", padding: "10px", margin: "10px 0" }}
          />
        </div>
        
        <div>
          <label>Phone:</label>
          <input 
            value={form.phone}
            onChange={(e) => setForm({...form, phone: e.target.value.replace(/D/g, '')})}
            style={{ width: "100%", padding: "10px", margin: "10px 0" }}
          />
        </div>
        
        <button 
          type="submit" 
          style={{ 
            background: "#007bff", 
            color: "white", 
            padding: "12px 24px", 
            border: "none", 
            borderRadius: "6px" 
          }}
        >
          Test Publish
        </button>
      </form>
      
      <div style={{ marginTop: "20px", padding: "10px", background: "#f0f0f0" }}>
        <strong>Console Log:</strong>
        <pre>{JSON.stringify(form, null, 2)}</pre>
      </div>
    </div>
  );
}