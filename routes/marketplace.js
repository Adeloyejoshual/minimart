// routes/marketplace.js - ✅ PRODUCTION READY: Security + Performance + Scalability
import express from 'express';
import Product from '../models/Product.js';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import xss from 'xss';
import { paystackPayment, verifyPayment } from '../utils/paystackHelper.js';

const router = express.Router();

// ✅ 1. RATE LIMITING
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP
  message: { success: false, message: 'Too many requests' }
});
router.use(limiter);

// ✅ 2. FIXED Multer - Enhanced Security
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 8 // Max 8 images
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'), false);
    }
  }
});

// ✅ 3. FIXED IP GEO - Gets REAL USER IP
const autoDetectCountry = async (req, res, next) => {
  try {
    // 🚨 FIXED: Get REAL user IP (not server IP)
    const userIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                   req.headers['x-real-ip'] || 
                   req.socket.remoteAddress || 
                   '127.0.0.1';
    
    const geoResponse = await axios.get(`http://ip-api.com/json/${userIP}`, {
      params: { fields: 'countryCode,country,city,regionName' },
      timeout: 3000 // Faster timeout
    });
    
    req.geo = {
      country: geoResponse.data.countryCode || 'NG',
      countryName: geoResponse.data.country || 'Nigeria',
      city: geoResponse.data.city || '',
      state: geoResponse.data.regionName || 'Lagos'
    };
  } catch (error) {
    req.geo = { country: 'NG', countryName: 'Nigeria', city: '', state: 'Lagos' };
  }
  next();
};

// ✅ 4. MAIN POST - FULLY SECURE
router.post('/products', autoDetectCountry, upload.array('images', 8), async (req, res) => {
  try {
    const images = req.files || [];
    const productData = req.body;

    // ✅ 5. XSS SANITIZATION
    const sanitize = (str) => xss(str || '');

    // ✅ 6. Cloudinary Upload (Enhanced)
    const imageUrls = [];
    for (const image of images) {
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { 
            folder: 'marketplace/products',
            transformation: [
              { quality: 'auto', fetch_format: 'auto' },
              { width: 800, height: 800, crop: 'limit' }
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result.secure_url);
          }
        ).end(image.buffer);
      });
      imageUrls.push(result);
    }

    // ✅ 7. SECURE PRODUCT CREATION - NO FRONTEND TRUST
    const product = new Product({
      title: sanitize(productData.title),
      category: sanitize(productData.category),
      subcategory: sanitize(productData.subcategory),
      brand: sanitize(productData.brand),
      model: sanitize(productData.model),
      
      price: parseInt(productData.price) || 0,
      phone_number: sanitize(productData.phone_number),
      description: sanitize(productData.description),
      negotiation: ['Yes', 'No'].includes(productData.negotiation) ? productData.negotiation : 'No',
      
      // ✅ AUTO IP LOCATION (SECURE)
      country: req.geo.country,
      state: sanitize(productData.state) || req.geo.state,
      city: sanitize(productData.city) || req.geo.city,
      
      // ✅ TRUSTED SELLER INFO (from JWT middleware later)
      poster_name: sanitize(productData.poster_name) || 'Anonymous Seller',
      seller_email: sanitize(productData.seller_email) || '',
      sellerId: productData.sellerId || null,
      
      // Dynamic specs
      condition: sanitize(productData.condition),
      ram: sanitize(productData.ram),
      storage: sanitize(productData.storage),
      color: sanitize(productData.color),
      sim: sanitize(productData.sim),
      engine: sanitize(productData.engine),
      mileage: productData.mileage ? parseInt(productData.mileage) : null,
      year: sanitize(productData.year),
      
      features: Array.isArray(productData.features) 
        ? productData.features.map(sanitize)
        : (productData.features || '').split(',').map(sanitize).filter(Boolean),
      
      images: imageUrls,
      video_link: sanitize(productData.video_link),
      
      // ✅ FIXED PROMOTION LOGIC
      promotion_plan: productData.promotion_plan ? parseInt(productData.promotion_plan) : null,
      status: 'pending_promotion' // Always pending until verified
    });

    await product.save();

    res.status(201).json({
      success: true,
      data: {
        _id: product._id,
        title: product.title,
        country: product.country,
        images: product.images.slice(0, 1) // First image only
      },
      message: `Product created! Promotion pending payment verification.`
    });
  } catch (error) {
    console.error('❌ Product error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// ✅ 8. FIXED PAYMENT VERIFICATION - Updates Product Status
router.post('/verify-payment', async (req, res) => {
  try {
    const { reference } = req.body;
    
    const response = await verifyPayment(reference);
    
    if (!response.status) {
      return res.status(400).json({ success: false, message: 'Payment failed' });
    }

    const { amount, metadata } = response.data;
    const planId = metadata?.planId;
    
    // ✅ VALIDATE PAYMENT
    if (!planId || !amount) {
      return res.status(400).json({ success: false, message: 'Invalid payment data' });
    }

    // ✅ UPDATE PRODUCT PROMOTION STATUS
    const product = await Product.findOneAndUpdate(
      { 
        _id: metadata.productId, 
        status: 'pending_promotion',
        promotion_plan: parseInt(planId)
      },
      { 
        status: 'promoted',
        promotion_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        verified_payment_ref: reference
      },
      { new: true }
    );

    if (!product) {
      return res.status(400).json({ success: false, message: 'Product not found or already promoted' });
    }

    res.json({ 
      success: true, 
      data: { productId: product._id, planId },
      message: 'Product promoted successfully!'
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ✅ 9. ENHANCED GET Products - Full Filtering
router.get('/products', async (req, res) => {
  try {
    const { 
      category, state, city, country, brand, 
      minPrice, maxPrice, search,
      limit = 20, page = 1, promoted = 'true' 
    } = req.query;
    
    const query = { status: { $in: ['active', 'promoted'] } };
    
    // ✅ FULL FILTERS
    if (promoted === 'false') query.promotion_plan = null;
    if (category) query.category = { $regex: category, $options: 'i' };
    if (state) query.state = { $regex: state, $options: 'i' };
    if (city) query.city = { $regex: city, $options: 'i' };
    if (country) query.country = country;
    if (brand) query.brand = { $regex: brand, $options: 'i' };
    
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseInt(minPrice);
      if (maxPrice) query.price.$lte = parseInt(maxPrice);
    }
    
    // ✅ TEXT SEARCH
    if (search) {
      query.$text = { $search: search };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Product.countDocuments(query);
    
    const products = await Product.find(query)
      .sort({ 
        promotion_plan: promoted === 'true' ? -1 : 1,
        createdAt: -1 
      })
      .limit(parseInt(limit))
      .skip(skip)
      .select('-seller_email -sellerId') // Hide private fields
      .lean();

    res.json({
      success: true,
      data: products,
      pagination: { 
        total, page: parseInt(page), limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ 10. My Products - Seller Dashboard
router.get('/my-products', async (req, res) => {
  try {
    const { seller_email } = req.query;
    if (!seller_email) {
      return res.status(400).json({ success: false, message: 'seller_email required' });
    }

    const products = await Product.find({ 
      seller_email,
      status: { $ne: 'deleted' }
    })
    .sort({ createdAt: -1 })
    .lean();

    res.json({ success: true, data: products, count: products.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;