const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { authenticateToken } = require('../middleware/auth');

// POST /api/marketplace/products
router.post('/products', authenticateToken, async (req, res) => {
  try {
    const productData = {
      ...req.body,
      ownerId: req.user.sub,
      ownerEmail: req.user.email
    };

    const product = new Product(productData);
    await product.save();

    res.status(201).json({
      message: 'Product created successfully',
      product: {
        id: product._id,
        title: product.title,
        slug: `${product.title.toLowerCase().replace(/s+/g, '-')}-${product._id}`,
        ...product.toObject()
      }
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(400).json({ message: error.message });
  }
});

// GET /api/marketplace/products
router.get('/products', async (req, res) => {
  try {
    const { category, state, city, brand, maxPrice, page = 1, limit = 20 } = req.query;
    const filters = {};

    if (category) filters.category = category;
    if (state) filters.state = state;
    if (city) filters.city = city;
    if (brand) filters.brand = brand;
    if (maxPrice) filters.price = { $lte: Number(maxPrice) };

    const products = await Product.find(filters)
      .sort({ isPromoted: -1, createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit))
      .select('-ownerEmail -phonePrimary -phoneSecondary');

    const total = await Product.countDocuments(filters);

    res.json({
      products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/marketplace/products/:id
router.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).select('-ownerEmail');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;