const mongoose = require("mongoose");

const MartProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  createdAt: Date,
});

module.exports = mongoose.model("MartProduct", MartProductSchema);