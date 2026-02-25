// routes/marketplace.js - 100% ESM
import express from 'express';
import Product from '../models/Product.js';

const router = express.Router();

// 🧪 TEST: POST /api/marketplace/products
router.post('/products', async (req, res) => {
  try {
    console.log('📦 Creating:', req.body.title);
    const product = new Product(req.body);
    await product.save();
    res.status(201).json({ 
      success: true, 
      product: product.toJSON(),
      id: product._id 
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/products/:id/promote', (req, res) => {
  res.json({ success: true, message: 'Promoted!' });
});

export default router;