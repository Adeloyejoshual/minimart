import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';

const router = express.Router();

// Cloudinary - UNSIGNED UPLOAD (your preset)
cloudinary.config({
  cloud_name: process.env.VITE_CLOUDINARY_CLOUD_NAME,
  upload_preset: process.env.VITE_CLOUDINARY_UPLOAD_PRESET
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: String,
  category: { type: String, default: 'general' },
  image: String,
  stock: { type: Number, default: 0 }
}, { timestamps: true });

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

router.post('/products', upload.single('image'), async (req, res) => {
  try {
    let imageUrl = '';
    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'minimart', upload_preset: process.env.VITE_CLOUDINARY_UPLOAD_PRESET },
          (error, result) => error ? reject(error) : resolve(result)
        );
        stream.end(req.file.buffer);
      });
      imageUrl = result.secure_url;
    }

    const product = new Product({
      name: req.body.name,
      price: parseFloat(req.body.price),
      description: req.body.description || '',
      category: req.body.category || 'general',
      image: imageUrl || 'https://via.placeholder.com/400',
      stock: parseInt(req.body.stock) || 0
    });

    const saved = await product.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

export default router;  // ← THIS LINE FIXES EVERYTHING!