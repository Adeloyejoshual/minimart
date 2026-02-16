// src/config/categories.js

export const categories = [
  {
    name: "Babies & Kids",
    fields: [
      { key: "age_group", label: "Age Group", type: "text" },
      { key: "brand", label: "Brand", type: "text" },
      { key: "condition", label: "Condition", type: "select", options: ["New", "Used"] },
      { key: "color", label: "Color", type: "text" },
    ],
  },
  {
    name: "Beauty & Personal Care",
    fields: [
      { key: "brand", label: "Brand", type: "text" },
      { key: "condition", label: "Condition", type: "select", options: ["New", "Used"] },
      { key: "size", label: "Size / Volume", type: "text" },
      { key: "features", label: "Features", type: "textarea" },
    ],
  },
  {
    name: "Commercial Equipment & Tools",
    fields: [
      { key: "brand", label: "Brand", type: "text" },
      { key: "condition", label: "Condition", type: "select", options: ["New", "Used"] },
      { key: "features", label: "Features", type: "textarea" },
      { key: "model", label: "Model", type: "text" },
    ],
  },
  {
    name: "Electronics",
    fields: [
      { key: "brand", label: "Brand", type: "text" },
      { key: "model", label: "Model", type: "text" },
      { key: "condition", label: "Condition", type: "select", options: ["Brand New", "Used"] },
      { key: "ram", label: "RAM", type: "text" },
      { key: "storage", label: "Internal Storage", type: "text" },
      { key: "color", label: "Color", type: "text" },
      { key: "sim", label: "SIM", type: "text" },
      { key: "features", label: "Features", type: "textarea" },
    ],
  },
  {
    name: "Fashion",
    fields: [
      { key: "brand", label: "Brand", type: "text" },
      { key: "size", label: "Size", type: "text" },
      { key: "color", label: "Color", type: "text" },
      { key: "material", label: "Material", type: "text" },
      { key: "condition", label: "Condition", type: "select", options: ["New", "Used"] },
    ],
  },
  {
    name: "Food, Agriculture & Farming",
    fields: [
      { key: "brand", label: "Brand / Source", type: "text" },
      { key: "quantity", label: "Quantity", type: "text" },
      { key: "condition", label: "Condition", type: "select", options: ["Fresh", "Packaged"] },
    ],
  },
  {
    name: "Home, Furniture & Appliances",
    fields: [
      { key: "material", label: "Material", type: "text" },
      { key: "color", label: "Color", type: "text" },
      { key: "dimensions", label: "Dimensions", type: "text" },
      { key: "condition", label: "Condition", type: "select", options: ["New", "Used"] },
    ],
  },
  {
    name: "Jobs",
    fields: [
      { key: "position", label: "Position", type: "text" },
      { key: "experience", label: "Experience Required", type: "text" },
      { key: "location", label: "Location", type: "text" },
    ],
  },
  {
    name: "Leisure & Activities",
    fields: [
      { key: "activity_type", label: "Activity Type", type: "text" },
      { key: "age_group", label: "Age Group", type: "text" },
      { key: "condition", label: "Condition", type: "select", options: ["New", "Used"] },
    ],
  },
  {
    name: "Pets",
    fields: [
      { key: "species", label: "Species", type: "text" },
      { key: "breed", label: "Breed", type: "text" },
      { key: "age", label: "Age", type: "text" },
      { key: "sex", label: "Sex", type: "select", options: ["Male", "Female"] },
      { key: "vaccinated", label: "Vaccinated", type: "checkbox" },
    ],
  },
  {
    name: "Phones & Tablets",
    fields: [
      { key: "brand", label: "Brand", type: "text" },
      { key: "model", label: "Model", type: "text" },
      { key: "condition", label: "Condition", type: "select", options: ["Brand New", "Used"] },
      { key: "ram", label: "RAM", type: "text" },
      { key: "storage", label: "Internal Storage", type: "text" },
      { key: "color", label: "Color", type: "text" },
      { key: "sim", label: "SIM", type: "text" },
      { key: "features", label: "Features", type: "textarea" },
    ],
  },
  {
    name: "Property",
    fields: [
      { key: "property_type", label: "Property Type", type: "text" },
      { key: "bedrooms", label: "Bedrooms", type: "text" },
      { key: "bathrooms", label: "Bathrooms", type: "text" },
      { key: "size", label: "Size (sq ft)", type: "text" },
      { key: "location", label: "Location", type: "text" },
    ],
  },
  {
    name: "Repair & Construction",
    fields: [
      { key: "service_type", label: "Service Type", type: "text" },
      { key: "experience", label: "Experience", type: "text" },
      { key: "location", label: "Location", type: "text" },
    ],
  },
  {
    name: "Seeking Work CVs",
    fields: [
      { key: "position", label: "Position", type: "text" },
      { key: "experience", label: "Experience", type: "text" },
      { key: "skills", label: "Skills", type: "textarea" },
    ],
  },
  {
    name: "Services",
    fields: [
      { key: "service_type", label: "Service Type", type: "text" },
      { key: "location", label: "Location", type: "text" },
      { key: "features", label: "Features", type: "textarea" },
    ],
  },
  {
    name: "Vehicles",
    fields: [
      { key: "brand", label: "Brand", type: "text" },
      { key: "model", label: "Model", type: "text" },
      { key: "year", label: "Year", type: "text" },
      { key: "mileage", label: "Mileage", type: "text" },
      { key: "color", label: "Color", type: "text" },
      { key: "condition", label: "Condition", type: "select", options: ["New", "Used"] },
      { key: "fuel_type", label: "Fuel Type", type: "text" },
    ],
  },
];