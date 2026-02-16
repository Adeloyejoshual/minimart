// src/models/MarketplaceProduct.js
import mongoose from "mongoose";

const marketplaceProductSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true },
    subcategory: { type: String, default: "" },

    // Electronics / Phones
    brand: { type: String, default: "" },
    model: { type: String, default: "" },
    condition: { type: String, default: "" },
    ram: { type: String, default: "" },
    storage: { type: String, default: "" },
    color: { type: String, default: "" },
    sim: { type: String, default: "" },

    // Vehicles
    engine: { type: String, default: "" },
    mileage: { type: Number, default: null },
    year: { type: Number, default: null },
    fuel_type: { type: String, default: "" },
    transmission: { type: String, default: "" },

    // Babies & Kids
    age_range: { type: String, default: "" },

    // Property / Real Estate
    bedrooms: { type: Number, default: null },
    bathrooms: { type: Number, default: null },
    size: { type: String, default: "" },
    furnished: { type: Boolean, default: false },

    // Common fields
    features: { type: String, default: "" },
    exchange_possible: { type: Boolean, default: false },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    bulk_price: {
      from: { type: Number, default: null },      // e.g., 10 pieces
      per_piece: { type: Number, default: null }, // e.g., ₦1,000 per piece
    },
    negotiation: { type: String, default: "" }, // Yes / No / Not sure
    phone_number: { type: String, default: "" },
    poster_name: { type: String, default: "" },

    // Location
    country: { type: String, default: "Nigeria" },
    state: { type: String, default: "" },
    city: { type: String, default: "" },
    location: { type: String, default: "" },

    // Media
    images: { type: [String], default: [] }, // multiple images
    video_link: { type: String, default: "" },

    // Promotion
    promoted: { type: Boolean, default: false },
    promo_plan: { type: String, default: "" },

    // Delivery options
    delivery: { type: Object, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model("MarketplaceProduct", marketplaceProductSchema);