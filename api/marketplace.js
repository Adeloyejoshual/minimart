// routes/marketplace.js - EXPRESS ROUTER (NOT Next.js)
import express from 'express';
import MarketplaceProduct from '../models/MarketplaceProduct.js';
import { verifyPaystackPayment } from '../utils/paystackHelper.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// POST /api/marketplace - Create product
router.post('/', async (req, res) => {
  try {
    const productData = req.body;
    
    // 🛡️ Input validation
    const requiredFields = ['title', 'price', 'category', 'description'];
    const missingFields = requiredFields.filter(field => !productData[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing fields: ${missingFields.join(', ')}`
      });
    }

    // 💰 Payment verification
    if (productData.promoted && productData.payment_reference) {
      const verification = await verifyPaystackPayment(productData.payment_reference);
      if (verification.status !== 'success') {
        return res.status(402).json({
          success: false,
          message: 'Payment verification failed'
        });
      }
      productData.promo_status = 'paid';
      productData.promoted_until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    // 🆔 Generate poster_id
    if (!productData.poster_id) {
      productData.poster_id = `seller_${uuidv4().slice(0, 8)}`;
    }

    // 📍 Location formatting
    if (productData.latitude && productData.longitude) {
      productData.location = {
        type: 'Point',
        coordinates: [parseFloat(productData.longitude), parseFloat(productData.latitude)]
      };
      delete productData.latitude;
      delete productData.longitude;
    }

    // ☎️ Phone sanitization
    if (productData.phone_number) {
      productData.phone_number = productData.phone_number
        .replace(/[^0-9+]/g, '')
        .replace(/^0/, '+234');
    }

    // 💾 Save product
    const product = new MarketplaceProduct({ ...productData, createdAt: new Date() });
    await product.save();

    res.status(201).json({
      success: true,
      message: 'Product listed successfully!',
      data: {
        id: product._id,
        title: product.title,
        price: product.price,
        poster_id: product.poster_id
      }
    });

  } catch (error) {
    console.error('Marketplace POST error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create product'
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
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
});

export default router;