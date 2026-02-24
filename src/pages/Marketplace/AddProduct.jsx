import React, { useState } from "react";

// configs
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

// ONLY ONE CHILD FOR NOW
import ProductDetailsSection from "../../components/AddProduct/ProductDetailsSection";

const initializeForm = () => ({
  title: "",
  description: "",
  price: "",
  discount_price: "",
  category: "",
  subcategory: "",
  brand: "",
  model: "",
  condition: "",
  used_detail: "",
  color: "",
  features: [],
  sim: [],
  ram: "",
  storage: "",
  engine: "",
  mileage: "",
  year: "",
  fuel_type: "",
  transmission: "",
  bedrooms: "",
  bathrooms: "",
  size: "",
  furnished: false,
  age_range: "",
  breed: "",
  experience_level: "",
  skills: [],
  education: "",
  phone_number: "",
  additional_phone: "",
  poster_name: "",
  state: "",
  city: "",
  images: [],
  video_link: "",
  promoted: false,
  promo_plan: "",
  flash_sale: false,
  negotiable: false,
  deliveryRegions: [],
  has_warranty: false,
  warranty_duration: "",
  return_policy: false,
  stock_quantity: "",
  featured: false,
  whatsapp_available: false
});

export default function AddProduct() {
  const [form, setForm] = useState(() => initializeForm());
  const [ui, setUi] = useState({ errors: {}, touched: {} });

  const handleFieldChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setUi(prev => ({
      ...prev,
      touched: { ...prev.touched, [field]: true }
    }));
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 32, marginBottom: 16, color: "#2563eb" }}>
        🧪 AddProduct partial test
      </h1>

      <ProductDetailsSection
        form={form}
        onFieldChange={handleFieldChange}
        openSelectionModal={() => {}}
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
        errors={ui.errors}
        touched={ui.touched}
      />
    </div>
  );
}