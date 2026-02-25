// routes/marketplace.js - COMPLETE REWRITE using YOUR VITE_ env vars
import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';

const router = express.Router();

// ✅ Uses YOUR exact VITE_ environment variables
cloudinary.config({
  cloud_name: process.env.VITE_CLOUDINARY_CLOUD_NAME,  // di6zeyneq
  upload_preset: process.env.VITE_CLOUDINARY_UPLOAD_PRESET  // 0HoyRB6wC0eba-Cbat0nhiIRoa8
});

// ✅ Render-compatible memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

// Product model embedded
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: String,
  category: { type: String, default: 'general' },
  image: String,
  stock: { type: Number, default: 0 }
}, { timestamps: true });

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

// 🟢 GET all products
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// 🟢 GET single product
router.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Product fetch failed' });
  }
});

// 🔴 POST new product (YOUR MAIN ENDPOINT)
router.post('/products', upload.single('image'), async (req, res) => {
  try {
    console.log('📥 Form data:', req.body);
    console.log('📥 Image:', req.file?.originalname);

    let imageUrl = '';

    // ✅ CLOUDINARY UPLOAD using upload_preset
    if (req.file) {
      const result = await cloudinary.uploader.upload_stream(
        { 
          folder: 'minimart',
          use_filename: true,
          unique_filename: false
        },
        (error, result) => {
          if (error) throw error;
          imageUrl = result.secure_url;
        }
      ).end(req.file.buffer);

      console.log('✅ Image uploaded:', imageUrl);
    }

    const product = new Product({
      name: req.body.name,
      price: parseFloat(req.body.price),
      description: req.body.description || '',
      category: req.body.category || 'general',
      image: imageUrl,
      stock: parseInt(req.body.stock) || 0
    });

    const saved = await product.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// 🟡 PUT update product
router.put('/products/:id', upload.single('image'), async (req, res) => {
  try {
    const updates = {
      name: req.body.name,
      price: parseFloat(req.body.price),
      description: req.body.description,
      category: req.body.category,
      stock: parseInt(req.body.stock)
    };

    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { folder: 'minimart' },
          (error, result) => error ? reject(error) : resolve(result)
        ).end(req.file.buffer);
      });
      updates.image = result.secure_url;
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 🟠 DELETE product
router.delete('/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

export default router;