import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// Product model
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: String,
  category: { type: String, default: 'general' },
  image: String,
  stock: { type: Number, default: 0 }
}, { timestamps: true });

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

// Products
router.post('/products', async (req, res) => {
  try {
    const product = new Product(req.body);
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
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

// Paystack Promotion Plans
router.post('/subscribe-plan', async (req, res) => {
  try {
    const { amount, email, metadata } = req.body;
    
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email || 'seller@minimart.com',
        amount,
        callback_url: `${process.env.FRONTEND_URL || 'https://minimart-ivrm.onrender.com'}/payment-success`,
        metadata
      })
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 👇 THIS LINE FIXES THE ERROR
export default router;