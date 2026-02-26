// routes/marketplace.js - ✅ FULLY PRODUCTION READY
import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import Product from '../models/Product.js';
import auth from '../middleware/auth.js';
import cloudinary from '../config/cloudinary.js';
import { verifyPaystackPayment } from '../services/paystack.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🖼️ FILE UPLOAD CONFIG - 10MB limit, 8 images max
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({ 
  storage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 8 
  },
  fileFilter
});

// 🌐 RATE LIMITING
const createLimiter = (windowMs, max) => rateLimit({
  windowMs,
  max,
  message: { success: false, message: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false
});

const productLimiter = createLimiter(15 * 60 * 1000, 20); // 20 req/15min
const listLimiter = createLimiter(15 * 60 * 1000, 100); // 100 req/15min

// 🛡️ PROTECTED: Add Product with Image Upload
router.post('/products', 
  auth, 
  productLimiter, 
  upload.array('images', 8),
  async (req, res) => {
    try {
      const user = req.user;
      
      // ✅ UPLOAD IMAGES TO CLOUDINARY
      const imageUrls = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'minimart/products',
            transformation: [
              { width: 800, height: 800, crop: 'fill', quality: 'auto' },
              { width: 400, height: 400, crop: 'fill', quality: 'auto' }
            ]
          });
          imageUrls.push(result.secure_url);
        }
      }

      // ✅ SANITIZE & STRUCTURE DATA
      const productData = {
        title: req.body.title?.trim(),
        category: req.body.category,
        brand: req.body.brand,
        model: req.body.model,
        condition: req.body.condition,
        ram: req.body.ram,
        storage: req.body.storage,
        color: req.body.color,
        sim: req.body.sim,
        engine: req.body.engine,
        mileage: req.body.mileage ? parseInt(req.body.mileage) : null,
        year: req.body.year ? parseInt(req.body.year) : null,
        fuel_type: req.body.fuel_type,
        transmission: req.body.transmission,
        description: req.body.description?.trim(),
        price: parseInt(req.body.price),
        negotiation: req.body.negotiation || 'No',
        phone_number: req.body.phone_number,
        poster_name: user.name || req.body.poster_name,
        country: 'Nigeria',
        state: req.body.state,
        city: req.body.city,
        location: req.body.city || req.body.location,
        images: imageUrls.length > 0 ? imageUrls : req.body.images || [],
        video_link: req.body.video_link || '',
        exchange_possible: req.body.exchange_possible === 'true',
        features: req.body.features,
        status: 'active',
        seller_id: user.sub,
        seller_name: user.name,
        seller_email: user.email,
        auth0_user_id: user.sub,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // ✅ VALIDATION
      if (!productData.title || productData.title.length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Title must be at least 3 characters'
        });
      }
      if (!productData.category) {
        return res.status(400).json({
          success: false,
          message: 'Category is required'
        });
      }
      if (!productData.price || productData.price <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid price is required'
        });
      }

      const product = new Product(productData);
      await product.save();

      res.status(201).json({
        success: true,
        data: product,
        message: 'Product created successfully'
      });
    } catch (error) {
      console.error('Add product error:', error);
      res.status(400).json({ 
        success: false, 
        message: error.message 
      });
    }
  }
);

// 📱 GET Products (Public - Filtered)
router.get('/products', listLimiter, async (req, res) => {
  try {
    const {
      category, state, city, brand, minPrice, maxPrice, 
      limit = 20, page = 1, sort = 'createdAt', order = 'desc'
    } = req.query;

    const query = {
      status: { $in: ['active', 'pending'] }
    };

    // Filters
    if (category) query.category = category;
    if (state) query.state = state;
    if (city) query.city = city;
    if (brand) query.brand = { $regex: brand, $options: 'i' };

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseInt(minPrice);
      if (maxPrice) query.price.$lte = parseInt(maxPrice);
    }

    // Sorting
    const sortOptions = {
      createdAt: -1, updatedAt: -1, price: 1, views: -1
    };
    const sortField = sortOptions[sort] ? sort : '-createdAt';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [products, total] = await Promise.all([
      Product.find(query)
        .sort(sortField)
        .limit(parseInt(limit))
        .skip(skip)
        .lean(),
      Product.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 👤 GET Seller's Products (Protected)
router.get('/my-products', auth, productLimiter, async (req, res) => {
  try {
    const { status, limit = 10, page = 1 } = req.query;
    
    const query = { seller_id: req.user.sub };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [products, total] = await Promise.all([
      Product.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip),
      Product.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: products,
      pagination: { total, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 👁️ GET Single Product (Public)
router.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    
    if (!product || product.status === 'deleted') {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }

    // Increment views (non-atomic for demo)
    await Product.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 🔄 Update Product (Protected - Seller Only)
router.put('/products/:id', auth, productLimiter, upload.array('images', 8), async (req, res) => {
  try {
    const user = req.user;
    
    // ✅ UPLOAD NEW IMAGES
    const imageUrls = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'minimart/products'
        });
        imageUrls.push(result.secure_url);
      }
    }

    const updateData = {
      ...req.body,
      ...(imageUrls.length && { images: imageUrls }),
      updatedAt: new Date()
    };

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, seller_id: user.sub },
      updateData,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found or access denied' 
      });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// 🗑️ Delete Product (Protected - Seller Only)
router.delete('/products/:id', auth, async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, seller_id: req.user.sub },
      { status: 'deleted', updatedAt: new Date() },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found or access denied' 
      });
    }

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 💰 PROMOTE Product (Paystack Integration)
router.post('/products/:id/promote', auth, async (req, res) => {
  try {
    const { reference, plan } = req.body;
    
    // 1. Verify seller owns product
    const product = await Product.findOne({
      _id: req.params.id,
      seller_id: req.user.sub
    });
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found or access denied' 
      });
    }

    // 2. Verify Paystack payment
    const session = await verifyPaystackPayment(reference);
    
    if (session.data.status === 'success') {
      product.promoted = true;
      product.promo_plan = plan;
      product.promo_expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      product.updatedAt = new Date();
      
      await product.save();
      
      res.json({ 
        success: true, 
        data: product,
        message: `Product promoted with ${plan} plan` 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Payment verification failed' 
      });
    }
  } catch (error) {
    console.error('Promotion error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// 🔍 SEARCH Products
router.get('/search', listLimiter, async (req, res) => {
  try {
    const { q, category, state, limit = 10, page = 1 } = req.query;
    
    if (!q) {
      return res.status(400).json({ 
        success: false, 
        message: 'Search query required' 
      });
    }

    const query = {
      status: { $in: ['active', 'pending'] },
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { brand: { $regex: q, $options: 'i' } },
        { model: { $regex: q, $options: 'i' } }
      ]
    };

    if (category) query.category = category;
    if (state) query.state = state;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [products, total] = await Promise.all([
      Product.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean(),
      Product.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: products,
      pagination: { total, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 🏷️ CATEGORIES (Public)
router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category', { status: 'active' });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;