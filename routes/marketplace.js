// routes/marketplace.js
import express from 'express';
import Product from '../models/Product.js';
import auth from '../middleware/auth.js';
import cloudinary from '../config/cloudinary.js';
import { verifyPaystackPayment } from '../services/paystack.js';

const router = express.Router();

// 🛡️ PROTECTED: Add Product (Auth0)
router.post('/products', auth, async (req, res) => {
  try {
    const user = req.user; // Auth0 user

    const productData = {
      ...req.body,
      seller_id: user.sub, // Auth0 user_id
      seller_name: user.name,
      seller_email: user.email,
      auth0_user_id: user.sub
    };

    const product = new Product(productData);
    await product.save();

    res.status(201).json({
      success: true,
      data: product,
      message: 'Product created successfully'
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 📱 GET Products (Public + Seller's own)
router.get('/products', async (req, res) => {
  try {
    const { category, state, city, limit = 20, page = 1, seller_id } = req.query;
    
    const query = { status: 'active' };
    if (category) query.category = category;
    if (state) query.state = state;
    if (city) query.city = city;
    if (seller_id) query.seller_id = seller_id;

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      data: products,
      pagination: { total, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 👤 GET Seller's Products (Protected)
router.get('/products/my-products', auth, async (req, res) => {
  try {
    const products = await Product.find({ seller_id: req.user.sub })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 🛍️ GET Single Product
router.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Increment view count
    product.views += 1;
    await product.save();

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 🔄 Update Product (Protected)
router.put('/products/:id', auth, async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, seller_id: req.user.sub },
      req.body,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 🗑️ Delete Product (Protected)
router.delete('/products/:id', auth, async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      seller_id: req.user.sub
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 💰 Paystack Promotion Payment (Protected)
router.post('/products/:id/promote', auth, async (req, res) => {
  try {
    const { plan } = req.body;
    const session = await verifyPaystackPayment(req.body.reference);

    if (session.data.status === 'success') {
      const product = await Product.findByIdAndUpdate(
        req.params.id,
        {
          promoted: true,
          promo_plan: plan,
          promo_expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        },
        { new: true }
      );

      res.json({ success: true, data: product });
    }
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;