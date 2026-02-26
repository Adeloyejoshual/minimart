// routes/marketplace.js - ENTERPRISE ROUTES ✅
import express from 'express';
import Product from '../models/Product.js';

const router = express.Router();

// 🛒 CREATE PRODUCT (handles full enterprise schema)
router.post('/products', async (req, res) => {
  try {
    const productData = {
      ...req.body,
      price: parseFloat(req.body.price),
      discount_price: req.body.discount_price ? parseFloat(req.body.discount_price) : null,
      images: req.body.images || [],
      features: req.body.features || [],
      sim: req.body.sim || [],
      deliveryRegions: req.body.deliveryRegions || [],
      views: 0,
      status: 'active'
    };

    const product = new Product(productData);
    const saved = await product.save();

    res.status(201).json({
      success: true,
      data: saved,
      message: 'Product created successfully'
    });
  } catch (error) {
    console.error('Create product error:', error);
    
    // MongoDB validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create product'
    });
  }
});

// 📋 GET PRODUCTS (with filters)
router.get('/products', async (req, res) => {
  try {
    const {
      category,
      state,
      brand,
      minPrice,
      maxPrice,
      condition,
      promoted,
      page = 1,
      limit = 20,
      sort = 'createdAt'
    } = req.query;

    const query = { status: 'active' };

    if (category) query.category = category;
    if (state) query.state = state;
    if (brand) query.brand = brand;
    if (condition) query.condition = condition;
    if (promoted === 'true') query.promoted = true;

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    const skip = (page - 1) * limit;
    const sortOptions = { [sort]: -1 };

    const [products, total] = await Promise.all([
      Product.find(query)
        .select('-__v')
        .sort(sortOptions)
        .limit(limit * 1)
        .skip(skip * 1)
        .lean(),
      Product.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products'
    });
  }
});

// 🔍 GET SINGLE PRODUCT
router.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .select('-__v')
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Increment views
    await Product.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product'
    });
  }
});

// ✏️ UPDATE PRODUCT
router.put('/products/:id', async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      price: parseFloat(req.body.price),
      discount_price: req.body.discount_price ? parseFloat(req.body.discount_price) : null
    };

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-__v');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product,
      message: 'Product updated successfully'
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update product'
    });
  }
});

// 🗑️ DELETE PRODUCT
router.delete('/products/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product'
    });
  }
});

// 💰 PAYSTACK PROMOTION PLANS
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
        email,
        amount, // kobo
        callback_url: `${process.env.FRONTEND_URL || 'https://your-app.onrender.com'}/payment-success`,
        metadata: {
          custom_fields: [
            {
              display_name: "Plan",
              variable_name: "plan",
              value: metadata?.plan_name || "Promotion Plan"
            }
          ]
        }
      })
    });

    const data = await response.json();
    
    if (!data.status) {
      return res.status(400).json({
        success: false,
        message: data.message || 'Payment initialization failed'
      });
    }

    res.json({
      success: true,
      data: data.data
    });
  } catch (error) {
    console.error('Paystack error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment service unavailable'
    });
  }
});

// 📊 STATS
router.get('/stats', async (req, res) => {
  try {
    const stats = await Promise.all([
      Product.countDocuments({ status: 'active' }),
      Product.countDocuments({ promoted: true }),
      Product.distinct('category', { status: 'active' }).then(categories => categories.length)
    ]);

    res.json({
      success: true,
      data: {
        totalProducts: stats[0],
        promotedProducts: stats[1],
        categories: stats[2]
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

export default router;