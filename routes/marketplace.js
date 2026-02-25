// routes/marketplace.js - NOW WITH MONGODB ✅
import express from 'express';
import Product from '../models/Product.js';

const router = express.Router();

// 🛒 CREATE PRODUCT
router.post('/products', async (req, res) => {
  try {
    console.log('📦 Saving to MongoDB:', req.body.title);
    
    const product = new Product({
      ...req.body,
      sellerId: req.auth?.sub || req.body.sellerId || 'anonymous'
    });
    
    await product.save();
    
    res.status(201).json({ 
      success: true,
      product: product.toJSON(),
      message: 'Product created successfully!'
    });
  } catch (error) {
    console.error('❌ MongoDB error:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// 📋 LIST PRODUCTS
router.get('/products', async (req, res) => {
  try {
    const products = await Product.find({ status: 'published' })
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json({ 
      success: true, 
      products: products.map(p => p.toJSON()),
      count: products.length 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;