// routes/marketplace.js - ✅ MULTER + PAYSTACK + NO AUTH
import express from 'express';
import Product from '../models/Product.js';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import { paystackPayment, verifyPayment } from '../utils/paystackHelper.js';

const router = express.Router();

// ✅ FIXED: Multer for images + NO AUTH for public uploads
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

router.post('/products', upload.array('images', 8), async (req, res) => {
  try {
    const images = req.files || [];
    const productData = req.body;

    // ✅ CLOUDINARY UPLOAD
    const imageUrls = [];
    for (let i = 0; i < images.length; i++) {
      const result = await cloudinary.uploader.upload_stream(
        { folder: 'marketplace' },
        (error, result) => {
          if (result) imageUrls.push(result.secure_url);
        }
      ).end(images[i].buffer);
    }

    // ✅ SANITIZED PRODUCT DATA
    const product = new Product({
      title: productData.title?.trim(),
      category: productData.category,
      brand: productData.brand || '',
      model: productData.model || '',
      price: parseInt(productData.price) || 0,
      phone_number: productData.phone_number || '',
      state: productData.state || 'Lagos',
      city: productData.city || '',
      description: productData.description?.trim() || '',
      negotiation: productData.negotiation || 'no',
      poster_name: productData.poster_name || 'Anonymous Seller',
      country: 'Nigeria',
      features: Array.isArray(productData.features) ? productData.features : productData.features?.split(',') || [],
      images: imageUrls,
      promotion_plan: productData.promotion_plan ? parseInt(productData.promotion_plan) : null,
      status: productData.promotion_plan && productData.promotion_plan !== '3' ? 'promoted' : 'active'
    });

    // Dynamic fields
    ['condition', 'ram', 'storage', 'color', 'sim', 'engine', 'fuel_type', 'transmission', 'year', 'mileage'].forEach(field => {
      if (productData[field]) product.product[field] = productData[field];
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

// ✅ PAYSTACK ENDPOINTS
router.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, planId, email, productTitle } = req.body;
    
    const paymentData = {
      amount: amount, // kobo
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

// 📱 GET Products (Public)
router.get('/products', async (req, res) => {
  try {
    const { category, state, city, limit = 20, page = 1, promoted = 'true' } = req.query;
    
    const query = { 
      status: { $in: ['active', 'promoted'] },
      ...(promoted === 'false' && { promotion_plan: null })
    };
    
    if (category) query.category = category;
    if (state) query.state = state;
    if (city) query.city = city;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const products = await Product.find(query)
      .sort({ 
        ...(promoted === 'true' && { promotion_plan: -1 }),
        createdAt: -1 
      })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    res.json({
      success: true,
      data: products,
      pagination: { total: products.length, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 👤 GET My Products
router.get('/my-products', async (req, res) => {
  try {
    const { seller_email } = req.query;
    const products = await Product.find({ 
      seller_email,
      status: { $ne: 'deleted' }
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;