// routes/marketplace.js - ENTERPRISE READY
import express from 'express';
import MarketplaceProduct from '../models/MarketplaceProduct.js';
import { verifyPaystackPayment } from '../utils/paystackHelper.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Placeholder image for frontend
const DEFAULT_IMAGE = 'https://via.placeholder.com/500x500?text=No+Image';

// --- Helpers ---

// Normalize price & discount
const normalizePrices = (data) => {
  if (data.price != null) {
    data.price = typeof data.price === 'string' ? Number(data.price.replace(/,/g, '')) : Number(data.price);
  }
  if (data.discount_price != null) {
    data.discount_price = typeof data.discount_price === 'string' ? Number(data.discount_price.replace(/,/g, '')) : Number(data.discount_price);
    if (data.price != null && data.discount_price > data.price) data.discount_price = data.price;
  }
};

// Add formatted prices & min/max + default image
const addFormattedPrices = (product) => {
  const obj = product.toObject ? product.toObject() : product;
  obj.formattedPrice = obj.price != null ? Number(obj.price).toLocaleString() : '0';
  obj.formattedDiscountPrice = obj.discount_price != null ? Number(obj.discount_price).toLocaleString() : '0';

  const prices = [obj.price, obj.discount_price].filter(v => v != null && v > 0);
  obj.minPrice = prices.length ? Math.min(...prices) : 0;
  obj.maxPrice = prices.length ? Math.max(...prices) : 0;
  obj.formattedMinPrice = obj.minPrice.toLocaleString();
  obj.formattedMaxPrice = obj.maxPrice.toLocaleString();

  if (!Array.isArray(obj.images) || !obj.images.length) obj.images = [DEFAULT_IMAGE];

  return obj;
};

// --- Routes ---

// POST /api/marketplace - Create product
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    const requiredFields = ['title', 'price', 'category', 'description', 'phone_number', 'poster_name', 'createdBy'];
    const missing = requiredFields.filter(f => !data[f]);
    if (missing.length) return res.status(400).json({ success: false, message: `Missing: ${missing.join(', ')}` });

    // Normalize phones
    data.phone_number = data.phone_number.replace(/[^0-9+]/g, '').replace(/^0/, '+234');
    if (data.additional_phone) data.additional_phone = data.additional_phone.replace(/[^0-9+]/g, '').replace(/^0/, '+234');

    // Normalize prices
    normalizePrices(data);

    // Payment verification for promoted products
    if (data.promoted && data.payment_reference) {
      const payment = await verifyPaystackPayment(data.payment_reference);
      if (payment.status !== 'success') return res.status(402).json({ success: false, message: 'Payment failed' });
      data.promo_status = 'paid';
    }

    const product = new MarketplaceProduct({ ...data });
    await product.save();

    const formatted = addFormattedPrices(product);
    res.status(201).json({ success: true, message: 'Product created', data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// GET /api/marketplace - List products with filters & pagination
router.get('/', async (req, res) => {
  try {
    const { category, promoted, search, page = 1, limit = 20 } = req.query;
    const filter = { deleted: false, status: 'active' };
    if (category) filter.category = category;
    if (promoted) filter.promoted = promoted === 'true';
    if (search) filter.$text = { $search: search };

    const skip = (page - 1) * limit;
    const products = await MarketplaceProduct.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await MarketplaceProduct.countDocuments(filter);
    const formattedProducts = products.map(addFormattedPrices);

    res.json({ success: true, count: formattedProducts.length, total, page: Number(page), data: formattedProducts });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch', error: err.message });
  }
});

// GET /api/marketplace/:id - Single product
router.get('/:id', async (req, res) => {
  try {
    const product = await MarketplaceProduct.findOne({ _id: req.params.id, deleted: false });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const formatted = addFormattedPrices(product);
    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// PUT /api/marketplace/:id - Update product
router.put('/:id', async (req, res) => {
  try {
    const data = req.body;

    // Normalize phones
    if (data.phone_number) data.phone_number = data.phone_number.replace(/[^0-9+]/g, '').replace(/^0/, '+234');
    if (data.additional_phone) data.additional_phone = data.additional_phone.replace(/[^0-9+]/g, '').replace(/^0/, '+234');

    // Normalize prices
    normalizePrices(data);

    const product = await MarketplaceProduct.findOne({ _id: req.params.id, deleted: false });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    Object.keys(data).forEach(key => { product[key] = data[key]; });

    // Payment verification if promoted changed
    if (product.promoted && product.payment_reference && product.promo_status !== 'paid') {
      const payment = await verifyPaystackPayment(product.payment_reference);
      if (payment.status === 'success') product.promo_status = 'paid';
    }

    await product.save();
    const formatted = addFormattedPrices(product);
    res.json({ success: true, message: 'Product updated', data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// DELETE /api/marketplace/:id - Soft delete
router.delete('/:id', async (req, res) => {
  try {
    const product = await MarketplaceProduct.findById(req.params.id);
    if (!product || product.deleted) return res.status(404).json({ success: false, message: 'Product not found' });

    await product.softDelete();
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

export default router;