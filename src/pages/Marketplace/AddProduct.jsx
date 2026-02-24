import React, { useState, useCallback } from "react";

// 🔥 ALL CONFIG IMPORTS - COPY THESE EXACTLY
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

import ProductDetailsSection from "../../components/AddProduct/ProductDetailsSection";

const initializeForm = () => ({
  title: "",
  category: "",
  brand: "",
  model: "",
  condition: "",
  color: "",
  ram: "",
  storage: "",
  sim: [],
  features: [],
  year: "",
  engine: "",
  fuel_type: "",
  used_detail: ""
});

export default function AddProduct() {
  const [form, setForm] = useState(initializeForm());
  const [touched, setTouched] = useState({});

  const handleFieldChange = useCallback((field, value) => {
    console.log(`📝 ${field}:`, value);
    setForm(prev => ({ ...prev, [field]: value }));
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  const openSelectionModal = useCallback(() => {}, []);

  return (
    <div style={{ padding: 24, maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ fontSize: 32, color: "#10b981", marginBottom: 24 }}>
        ✅ PRODUCT DETAILS WORKING!
      </h1>
      
      <ProductDetailsSection
        form={form}
        onFieldChange={handleFieldChange}
        openSelectionModal={openSelectionModal}
        categoryFields={categoryFields}
        brands={brands}
        models={models}
        conditions={conditions}
        usedDetails={usedDetails}
        ramOptions={ramOptions}
        storageOptions={storageOptions}
        colors={colors}
        sims={sims}
        years={years}
        engines={engines}
        fuelTypes={fuelTypes}
        featuresByCategory={featuresByCategory}
        errors={{}}
        touched={touched}
      />
      
      <div style={{ 
        marginTop: 32, 
        padding: 16, 
        background: "#f0fdf4", 
        borderRadius: 8, 
        borderLeft: "4px solid #10b981"
      }}>
        <strong>🔍 LIVE DEBUG:</strong>
        <pre style={{ fontSize: 13, marginTop: 8 }}>
Title: "<strong>{form.title || "empty"}</strong>"
Category: "<strong>{form.category || "empty"}</strong>"
Brand: "<strong>{form.brand || "empty"}</strong>"
        </pre>
      </div>
    </div>
  );
}