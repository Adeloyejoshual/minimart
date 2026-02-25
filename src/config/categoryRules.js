// src/config/categoryRules.js - Perfect match with your categoryFields
import { categoryFields } from './categoryFields';

export const categoryRules = {
  "Phones & Tablets": {
    required: ["title", "price", "phone_number", "images", "brand", "condition"],
    minDescription: 50,
    maxImages: 12,
    fields: ["brand", "model", "condition", "used_detail", "ram", "storage", "color", "sim", "features"],
    validation: {
      brand: { required: true },
      condition: { required: true },
      ram: { required: true },
      storage: { required: true }
    }
  },

  "Vehicles": {
    required: ["title", "price", "phone_number", "images", "brand", "year"],
    minDescription: 100,
    maxImages: 15,
    fields: ["brand", "model", "condition", "used_detail", "engine", "mileage", "year", "fuel_type", "transmission", "color", "features"],
    validation: {
      brand: { required: true },
      year: { required: true, min: 1990, max: 2026 },
      mileage: { required: true, min: 0 }
    }
  },

  "Computers & Laptops": {
    required: ["title", "price", "phone_number", "images", "brand"],
    minDescription: 50,
    maxImages: 10,
    fields: ["brand", "model", "condition", "used_detail", "ram", "storage", "features"],
    validation: {
      brand: { required: true },
      ram: { required: true },
      storage: { required: true }
    }
  },

  "Property": {
    required: ["title", "price", "phone_number", "images"],
    minDescription: 150,
    maxImages: 20,
    fields: ["bedrooms", "bathrooms", "size", "furnished", "features"],
    validation: {
      bedrooms: { required: true, min: 1 }
    }
  },

  "Electronics": {
    required: ["title", "price", "phone_number", "images"],
    minDescription: 40,
    maxImages: 8,
    fields: ["brand", "model", "condition", "used_detail", "features"]
  },

  "Fashion": {
    required: ["title", "price", "phone_number", "images"],
    minDescription: 30,
    maxImages: 8,
    fields: ["brand", "features", "size", "color"]
  },

  // Apply to ALL your other categories
  "Babies & Kids": { minDescription: 30, maxImages: 10, fields: categoryFields["Babies & Kids"] },
  "Beauty & Personal Care": { minDescription: 30, maxImages: 8, fields: categoryFields["Beauty & Personal Care"] },
  "Home, Furniture & Appliances": { minDescription: 50, maxImages: 12, fields: categoryFields["Home, Furniture & Appliances"] },
  "Commercial Equipment & Tools": { minDescription: 50, maxImages: 10, fields: categoryFields["Commercial Equipment & Tools"] },
  "Food, Agriculture & Farming": { minDescription: 40, maxImages: 8, fields: categoryFields["Food, Agriculture & Farming"] },
  "Leisure & Activities": { minDescription: 30, maxImages: 8, fields: categoryFields["Leisure & Activities"] },
  "Pets": { minDescription: 50, maxImages: 10, fields: categoryFields["Pets"] },
  "Jobs": { minDescription: 100, maxImages: 1, fields: categoryFields["Jobs"] },
  "Repair & Construction": { minDescription: 50, maxImages: 10, fields: categoryFields["Repair & Construction"] },
  "Seeking Work CVs": { minDescription: 150, maxImages: 1, fields: categoryFields["Seeking Work CVs"] },
  "Services": { minDescription: 100, maxImages: 1, fields: categoryFields["Services"] },
  "Vehicles Parts & Accessories": { minDescription: 40, maxImages: 8, fields: categoryFields["Vehicles Parts & Accessories"] },
  "Books & Stationery": { minDescription: 30, maxImages: 6, fields: categoryFields["Books & Stationery"] },
  "Musical Instruments": { minDescription: 50, maxImages: 10, fields: categoryFields["Musical Instruments"] },
  "Sports & Outdoors": { minDescription: 40, maxImages: 10, fields: categoryFields["Sports & Outdoors"] },
  "Gaming": { minDescription: 40, maxImages: 10, fields: categoryFields["Gaming"] },
  "Health & Fitness": { minDescription: 50, maxImages: 8, fields: categoryFields["Health & Fitness"] },
  "Art & Collectibles": { minDescription: 50, maxImages: 12, fields: categoryFields["Art & Collectibles"] },
  "Toys & Games": { minDescription: 30, maxImages: 10, fields: categoryFields["Toys & Games"] },

  // Default fallback
  "default": {
    required: ["title", "price", "phone_number", "images"],
    minDescription: 30,
    maxImages: 12,
    fields: []
  }
};

export const getCategoryRules = (category) => {
  return categoryRules[category] || categoryRules.default;
};