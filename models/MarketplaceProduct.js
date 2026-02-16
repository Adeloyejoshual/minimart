// src/models/MarketplaceProduct.js
import mongoose from "mongoose";

const marketplaceProductSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true },      // e.g., Mobile Phones
    subcategory: { type: String },                   // optional
    brand: { type: String },
    model: { type: String },
    condition: { type: String },                     // Brand New, Used, etc.
    ram: { type: String },
    storage: { type: String },
    color: { type: String },
    sim: { type: String },
    features: { type: String },                      // comma-separated string
    exchange_possible: { type: Boolean, default: false },
    description: { type: String },
    price: { type: Number, required: true },
    bulk_price: { type: String },
    negotiation: { type: String },                  // Yes / No / Not sure
    phone_number: { type: String },
    poster_name: { type: String },
    second_condition: { type: String },
    screen_size: { type: String },
    os: { type: String },
    display_type: { type: String },
    resolution: { type: String },
    card_slot: { type: String },
    main_camera: { type: String },
    selfie_camera: { type: String },
    battery: { type: String },
    location: { type: String },                      // e.g., Ijebu Ode
    delivery: {
      name: String,
      region: String,
      days_from: Number,
      days_to: Number,
      fee_charged: Boolean,
      fee_from: Number,
      fee_to: Number,
    },
    images: [{ type: String }],                     // store multiple image URLs
    video_link: { type: String },
    promoted: { type: Boolean, default: false },
    promo_plan: { type: String },                   // e.g., "TOP promo"
  },
  { timestamps: true }
);

export default mongoose.model("MarketplaceProduct", marketplaceProductSchema);