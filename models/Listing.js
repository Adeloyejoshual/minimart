const mongoose = require("mongoose");

const ListingSchema = new mongoose.Schema(
  {
    title: String,
    price: Number,
    location: String,
    images: [String],
    isPromoted: Boolean,
    isProSeller: Boolean,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Listing", ListingSchema);