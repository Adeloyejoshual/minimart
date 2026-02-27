// routes/marketplace.js - ✅ FIXED + GLOBAL + CLOUDINARY
import express from 'express';
import Product from '../models/Product.js';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import { paystackPayment, verifyPayment } from '../utils/paystackHelper.js';

const router = express.Router();

// ✅ FIXED: Multer config
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'), false);
    }
  }
});

// ✅ FIXED: Products POST - Proper Cloudinary + seller_email
router.post('/products', upload.array('images', 8), async (req, res) => {
  try {
    const images = req.files || [];
    const productData = req.body;

    // ✅ FIXED: Proper Cloudinary upload (Promise-based)
    const imageUrls = [];
    for (const image of images) {
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { folder: 'marketplace' },
          (error, result) => {
            if (error) reject(error);
            else resolve(result.secure_url);
          }
        ).end(image.buffer);
      });
      imageUrls.push(result);
    }

    // ✅ GLOBAL USER TRACKING
    const product = new Product({
      title: productData.title?.trim() || '',
      category: productData.category || '',
      brand: productData.brand || '',
      model: productData.model || '',
      price: parseInt(productData.price) || 0,
      phone_number: productData.phone_number || '',
      state: productData.state || 'Lagos',
      city: productData.city || '',
      description: productData.description?.trim() || '',
      negotiation: productData.negotiation || 'no',
      poster_name: productData.poster_name || 'Anonymous Seller',
      seller_email: productData.seller_email || '',  // ✅ GLOBAL TRACKING
      country: 'Nigeria',
      features: Array.isArray(productData.features) 
        ? productData.features 
        : productData.features?.split(',').map(f => f.trim()).filter(Boolean) || [],
      images: imageUrls,
      promotion_plan: productData.promotion_plan ? parseInt(productData.promotion_plan) : null,
      status: productData.promotion_plan && productData.promotion_plan !== '3' ? 'promoted' : 'active'
    });

    // ✅ FIXED: Dynamic fields (CORRECT SYNTAX)
    ['condition', 'ram', 'storage', 'color', 'sim', 'engine', 'fuel_type', 'transmission', 'year', 'mileage', 'used_detail'].forEach(field => {
      if (productData[field]) {
        product[field] = productData[field];  // ✅ FIXED: product[field] not product.product[field]
      }
    });

    await product.save();

    res.json({
      success: true,
      data: product,
      message: 'Product created successfully!'
    });
  } catch (error) {
    console.error('Product creation error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// ✅ PAYSTACK ENDPOINTS (UNCHANGED)
router.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, planId, email, productTitle } = req.body;
    
    const paymentData = {
      amount: amount,
      email,
      reference: 'mrkt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      metadata: { planId, productTitle }
    };

    const response = await paystackPayment(paymentData);
    res.json({ success: true, data: response });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/verify-payment', async (req, res) => {
  try {
    const { reference } = req.body;
    const response = await verifyPayment(reference);
    
    if (response.status) {
      res.json({ 
        success: true, 
        data: response.data,
        message: 'Payment verified successfully'
      });
    } else {
      res.status(400).json({ success: false, message: 'Payment verification failed' });
    }
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ✅ GET Products (Public) - FIXED pagination
router.get('/products', async (req, res) => {
  try {
    const { category, state, city, limit = 20, page = 1, promoted = 'true' } = req.query;
    
    const query = { 
      status: { $in: ['active', 'promoted'] }
    };
    
    if (promoted === 'false') query.promotion_plan = null;
    if (category) query.category = category;
    if (state) query.state = state;
    if (city) query.city = city;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Product.countDocuments(query);
    
    const products = await Product.find(query)
      .sort({ 
        promotion_plan: promoted === 'true' ? -1 : 1,
        createdAt: -1 
      })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    res.json({
      success: true,
      data: products,
      pagination: { total, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ GET My Products - GLOBAL
router.get('/my-products', async (req, res) => {
  try {
    const { seller_email } = req.query;
    
    if (!seller_email) {
      return res.status(400).json({ success: false, message: 'seller_email required' });
    }

    const products = await Product.find({ 
      seller_email,
      status: { $ne: 'deleted' }
    }).sort({ createdAt: -1 }).lean();

    res.json({ 
      success: true, 
      data: products,
      count: products.length 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;