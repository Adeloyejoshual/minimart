// models/Product.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    // 🔹 Basic Info
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    category: {
      type: String,
      required: true,
      index: true
    },

    brand: {
      type: String,
      default: '',
      index: true
    },

    model: {
      type: String,
      default: ''
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: ''
    },

    // 🔹 Pricing
    price: {
      type: Number,
      required: true,
      min: 0,
      index: true
    },

    negotiation: {
      type: String,
      enum: ['yes', 'no'],
      default: 'no'
    },

    // 🔹 Condition & Specs
    condition: {
      type: String,
      default: ''
    },

    color: {
      type: String,
      default: ''
    },

    // 🔹 Location
    state: {
      type: String,
      required: true,
      index: true
    },

    city: {
      type: String,
      default: ''
    },

    // 🔹 Contact
    phone_number: {
      type: String,
      required: true,
      trim: true
    },

    // 🔹 Images
    images: [
      {
        type: String
      }
    ],

    // 🔹 Seller Info (from Auth0)
    sellerId: {
      type: String,
      required: true,
      index: true
    },

    seller_email: {
      type: String,
      required: true
    },

    seller_name: {
      type: String,
      required: true
    },

    // 🔹 Marketplace Status
    status: {
      type: String,
      enum: ['active', 'sold', 'pending', 'rejected'],
      default: 'active',
      index: true
    },

    isApproved: {
      type: Boolean,
      default: true
    },

    views: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true // adds createdAt and updatedAt automatically
  }
);

// 🔥 TEXT SEARCH INDEX (Very Important)
productSchema.index({
  title: 'text',
  description: 'text',
  brand: 'text',
  model: 'text'
});

// 🔥 COMPOUND INDEX (Filtering Optimization)
productSchema.index({ category: 1, state: 1, price: 1 });

module.exports = mongoose.model('Product', productSchema);