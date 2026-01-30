// src/pages/MartProduct.js
import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export default function MartProduct() {
  const [step, setStep] = useState("category");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    mainCategory: "",
    subCategory: "",
    brand: "",
    model: "",
    condition: "",
    usedDetails: "",
    title: "",
    description: "",
    price: "",
    images: [],
    state: "",
    city: "",
    promoted: false,
    promotionPlan: "",
  });

  // Auto save draft
  useEffect(() => {
    localStorage.setItem("martProductDraft", JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    const draft = localStorage.getItem("martProductDraft");
    if (draft) setForm(JSON.parse(draft));
  }, []);

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await addDoc(collection(db, "products"), {
        ...form,
        sellerId: auth.currentUser.uid,
        createdAt: serverTimestamp(),
        status: "active"
      });

      localStorage.removeItem("martProductDraft");
      alert("Product submitted successfully!");
      window.location.reload();
    } catch (err) {
      alert("Error submitting product");
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: "0 auto" }}>
      <h2>Sell on MiniMart (Smart Listing)</h2>

      {/* STEP FLOW LIKE JUMIA */}
      {step === "category" && (
        <>
          <h3>Select Category</h3>
          <button onClick={() => { updateField("mainCategory", "Electronics"); setStep("subcategory"); }}>
            Electronics
          </button>
        </>
      )}

      {step === "subcategory" && (
        <>
          <h3>Select Subcategory</h3>
          <button onClick={() => { updateField("subCategory", "Phones"); setStep("brand"); }}>
            Phones
          </button>
        </>
      )}

      {step === "brand" && (
        <>
          <h3>Select Brand</h3>
          <button onClick={() => { updateField("brand", "Samsung"); setStep("model"); }}>
            Samsung
          </button>
        </>
      )}

      {step === "model" && (
        <>
          <h3>Enter Model</h3>
          <input onChange={(e) => updateField("model", e.target.value)} />
          <button onClick={() => setStep("condition")}>Next</button>
        </>
      )}

      {step === "condition" && (
        <>
          <h3>Condition</h3>
          <button onClick={() => { updateField("condition", "Used"); setStep("details"); }}>
            Used
          </button>
          <button onClick={() => { updateField("condition", "New"); setStep("details"); }}>
            New
          </button>
        </>
      )}

      {step === "details" && (
        <>
          <h3>Product Details</h3>
          <input placeholder="Title" onChange={(e) => updateField("title", e.target.value)} />
          <textarea placeholder="Description" onChange={(e) => updateField("description", e.target.value)} />
          <input placeholder="Price" type="number" onChange={(e) => updateField("price", e.target.value)} />
          <button onClick={() => setStep("location")}>Next</button>
        </>
      )}

      {step === "location" && (
        <>
          <h3>Location</h3>
          <input placeholder="State" onChange={(e) => updateField("state", e.target.value)} />
          <input placeholder="City" onChange={(e) => updateField("city", e.target.value)} />
          <button onClick={() => setStep("promotion")}>Next</button>
        </>
      )}

      {step === "promotion" && (
        <>
          <h3>Promotion Plan</h3>
          <button onClick={() => updateField("promotionPlan", "Basic Boost")}>Basic</button>
          <button onClick={() => updateField("promotionPlan", "Premium Boost")}>Premium</button>
          <br /><br />
          <button onClick={handleSubmit} disabled={loading}>
            {loading ? "Submitting..." : "Publish Product"}
          </button>
        </>
      )}
    </div>
  );
}