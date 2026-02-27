// models/Product.js

import mongoose from "mongoose";

const bulkPriceSchema = new mongoose.Schema({
  from: { type: Number },
  per_piece: { type: Number },
});

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
    },

    subcategory: String,

    // ---------- Dynamic Fields ----------
    brand: String,
    model: String,
    condition: String,
    used_detail: String,
    ram: String,
    storage: String,
    color: String,
    sim: String,
    engine: String,
    mileage: Number,
    year: String,
    fuel_type: String,
    transmission: String,
    age_range: String,
    bedrooms: Number,
    bathrooms: Number,
    size: String,
    furnished: Boolean,
    features: [String],
    breed: String,
    experience_level: String,
    skills: String,
    education: String,

    // ---------- Pricing ----------
    price: {
      type: Number,
      required: true,
    },

    bulk_price: bulkPriceSchema,

    negotiation: {
      type: String,
      enum: ["Yes", "No"],
      default: "No",
    },

    exchange_possible: {
      type: Boolean,
      default: false,
    },

    // ---------- Location ----------
    country: {
      type: String,
      default: "Nigeria",
    },

    state: String,
    city: String,
    location: String,

    // ---------- Media ----------
    images: [
      {
        type: String,
      },
    ],

    video_link: String,

    // ---------- Promotion ----------
    promoted: {
      type: Boolean,
      default: false,
    },

    promo_plan: String,

    // ---------- Seller ----------
    poster_name: String,
    user_id: {
      type: String,
      required: true,
    },

    phone_number: String,
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);