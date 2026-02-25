// src/config/categoryRules.js
export const categoryRules = {
  "Phones & Tablets": {
    required: ["title", "price", "phone_number", "images", "brand", "condition"],
    minDescription: 50,
    maxImages: 12,
    fields: ["brand", "model", "condition", "ram", "storage", "color", "sim", "features"],
    validation: {
      ram: { required: true },
      storage: { required: true },
      condition: { required: true }
    }
  },

  "Vehicles": {
    required: ["title", "price", "phone_number", "images", "brand", "year", "condition"],
    minDescription: 100,
    maxImages: 15,
    fields: ["brand", "model", "condition", "engine", "mileage", "year", "fuel_type", "transmission", "color", "features"],
    validation: {
      year: { required: true, min: 1990, max: 2026 },
      mileage: { required: true, min: 0 },
      condition: { required: true }
    }
  },

  "Computers & Laptops": {
    required: ["title", "price", "phone_number", "images", "brand", "ram", "storage"],
    minDescription: 50,
    maxImages: 10,
    fields: ["brand", "model", "condition", "ram", "storage", "features"],
    validation: {
      ram: { required: true },
      storage: { required: true }
    }
  },

  "Electronics": {
    required: ["title", "price", "phone_number", "images"],
    minDescription: 30,
    maxImages: 8,
    fields: ["brand", "model", "condition", "features"]
  },

  "Property": {
    required: ["title", "price", "phone_number", "images", "bedrooms"],
    minDescription: 150,
    maxImages: 20,
    fields: ["bedrooms", "bathrooms", "size", "furnished", "features"],
    validation: {
      bedrooms: { required: true, min: 1 },
      bathrooms: { min: 1 }
    }
  },

  "Fashion": {
    required: ["title", "price", "phone_number", "images"],
    minDescription: 30,
    maxImages: 8,
    fields: ["brand", "size", "color", "features"]
  },

  "default": {
    required: ["title", "price", "phone_number", "images"],
    minDescription: 30,
    maxImages: 12,
    fields: []
  }
};

// Helper function to get rules for category
export const getCategoryRules = (category) => {
  return categoryRules[category] || categoryRules.default;
};