// models/Product.js
import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  title: { type: String, required: true },
  price: Number,
  category: String,
  phone_number: String,
  sellerId: String
}, { timestamps: true });

export default mongoose.model('Product', productSchema);