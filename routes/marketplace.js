// routes/marketplace.js - DELETE LINE 74 COMPLETELY
import express from 'express';

const router = express.Router();

// 🛒 CREATE PRODUCT - Your frontend calls this
router.post('/products', async (req, res) => {
  try {
    console.log('📦 Product:', req.body.title);
    res.status(201).json({ 
      success: true, 
      product: { ...req.body, _id: 'fake-123' },
      message: 'Product created!'
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 🚀 PROMOTE PRODUCT
router.post('/products/:id/promote', async (req, res) => {
  res.json({ success: true, message: 'Promoted!' });
});

// 📋 LIST PRODUCTS
router.get('/products', async (req, res) => {
  res.json({ success: true, products: [] });
});

// ✅ ONLY THIS LINE - NO module.exports ANYWHERE
export default router;