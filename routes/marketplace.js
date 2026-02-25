// routes/marketplace.js - NO MODEL DEPENDENCY
import express from 'express';

const router = express.Router();

// 🧪 TEST ENDPOINT - NO DATABASE NEEDED
router.post('/products', async (req, res) => {
  console.log('📦 Product received:', req.body.title);
  res.status(201).json({ 
    success: true,
    product: { 
      _id: 'test-' + Date.now(),
      ...req.body 
    },
    message: 'Product created successfully!'
  });
});

router.post('/products/:id/promote', (req, res) => {
  res.json({ success: true, message: 'Product promoted!' });
});

router.get('/products', (req, res) => {
  res.json({ success: true, products: [] });
});

export default router;  // ✅ ESM export