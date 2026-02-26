// routes/marketplace.js - ✅ RENDER DEPLOYMENT READY
import express from 'express';
import Product from '../models/Product.js';
import auth from '../middleware/auth.js';
import cloudinary from '../config/cloudinary.js';

const router = express.Router();

// 🛡️ PROTECTED: Add Product (SIMPLIFIED - No multer for now)
router.post('/products', auth, async (req, res) => {
  try {
    const user = req.user;
    
    // ✅ SANITIZE DATA - Match your AddProduct.jsx exactly
    const productData = {
      title: req.body.title?.trim(),
      category: req.body.category,
      brand: req.body.brand || '',
      model: req.body.model || '',
      condition: req.body.condition || '',
      ram: req.body.ram || '',
      storage: req.body.storage || '',
      color: req.body.color || '',
      sim: req.body.sim || '',
      description: req.body.description?.trim() || '',
      price: parseInt(req.body.price) || 0,
      negotiation: req.body.negotiation || 'No',
      phone_number: req.body.phone_number || '08000000000',
      poster_name: user.name || 'Anonymous Seller',
      country: 'Nigeria',
      state: req.body.state || 'Lagos',
      city: req.body.city || '',
      location: req.body.city || '',
      images: Array.isArray(req.body.images) ? req.body.images : [],
      video_link: req.body.video_link || '',
      exchange_possible: req.body.exchange_possible === 'true',
      features: req.body.features || '',
      status: 'active',
      seller_id: user.sub,
      seller_name: user.name,
      seller_email: user.email || '',
      auth0_user_id: user.sub
    };

    // ✅ VALIDATION
    if (!productData.title || productData.title.length < 3) {
      return res.status(400).json({ success: false, message: 'Title must be 3+ chars' });
    }
    if (!productData.category) {
      return res.status(400).json({ success: false, message: 'Category required' });
    }
    if (!productData.price || productData.price <= 0) {
      return res.status(400).json({ success: false, message: 'Valid price required' });
    }
    if (!productData.phone_number || !/^0[789][01]d{8}$/.test(productData.phone_number)) {
      return res.status(400).json({ success: false, message: 'Valid Nigerian phone required' });
    }

    const product = new Product(productData);
    await product.save();

    res.status(201).json({
      success: true,
      data: product,
      message: 'Product created successfully!'
    });
  } catch (error) {
    console.error('Add product error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// 📱 GET Products (Public)
router.get('/products', async (req, res) => {
  try {
    const { category, state, city, limit = 20, page = 1 } = req.query;
    
    const query = { status: { $in: ['active', 'pending'] } };
    if (category) query.category = category;
    if (state) query.state = state;
    if (city) query.city = city;

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
    console.error('Get products error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 👤 GET My Products (Protected)
router.get('/my-products', auth, async (req, res) => {
  try {
    const products = await Product.find({ 
      seller_id: req.user.sub,
      status: { $ne: 'deleted' }
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 👁️ GET Single Product
router.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      status: { $ne: 'deleted' }
    }).lean();

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 🔄 Update Product
router.put('/products/:id', auth, async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, seller_id: req.user.sub },
      { ...req.body, updatedAt: new Date() },
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

// 🗑️ Delete Product (Soft delete)
router.delete('/products/:id', auth, async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, seller_id: req.user.sub },
      { status: 'deleted' },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;