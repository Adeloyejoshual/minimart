const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const auth = require('../middleware/auth'); // Auth0 middleware

// POST /api/products - Create product
router.post('/', auth, async (req, res) => {
  try {
    const product = new Product({
      ...req.body,
      sellerId: req.user.sub // Auth0 user ID
    });
    const saved = await product.save();
    res.status(201).json({ product: saved, message: 'Product created' });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(400).json({ message: error.message });
  }
});

// POST /api/products/:id/promote - Promote product
router.post('/:id/promote', auth, async (req, res) => {
  try {
    const { promo_plan, paystack_ref } = req.body;
    
    // Verify Paystack webhook/transaction (implement Paystack verification)
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, sellerId: req.user.sub },
      { promoted: true, promo_plan, paystack_ref },
      { new: true }
    );
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json({ message: 'Promotion activated', product });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;