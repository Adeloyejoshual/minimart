// routes/marketplace.js - COMPLETE WORKING VERSION
import express from 'express';
import MarketplaceProduct from '../models/MarketplaceProduct.js';
import { verifyPaystackPayment } from '../utils/paystackHelper.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// POST /api/marketplace - Create product
router.post('/', async (req, res) => {
  try {
    const productData = req.body;
    
    // Input validation
    const requiredFields = ['title', 'price', 'category', 'description'];
    const missingFields = requiredFields.filter(field => !productData[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing: ${missingFields.join(', ')}`
      });
    }

    // Payment verification
    if (productData.promoted && productData.payment_reference) {
      const verification = await verifyPaystackPayment(productData.payment_reference);
      if (verification.status !== 'success') {
        return res.status(402).json({
          success: false,
          message: 'Payment failed'
        });
      }
      productData.promo_status = 'paid';
    }

    // Generate poster_id
    if (!productData.poster_id) {
      productData.poster_id = `seller_${uuidv4().slice(0, 8)}`;
    }

    // Phone sanitization (Nigeria)
    if (productData.phone_number) {
      productData.phone_number = productData.phone_number
        .replace(/[^0-9+]/g, '')
        .replace(/^0/, '+234');
    }

    // Save to MongoDB
    const product = new MarketplaceProduct({ 
      ...productData, 
      createdAt: new Date() 
    });
    await product.save();

    res.status(201).json({
      success: true,
      message: 'Product created!',
      data: {
        id: product._id,
        title: product.title,
        price: product.price
      }
    });

  } catch (error) {
    console.error('Marketplace error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// GET /api/marketplace - List products
router.get('/', async (req, res) => {
  try {
    const products = await MarketplaceProduct.find({ status: 'active' })
      .limit(20)
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch' });
  }
});

export default router;