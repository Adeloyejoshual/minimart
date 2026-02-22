// routes/marketplace.js
import express from 'express';
import MarketplaceProduct from '../models/MarketplaceProduct.js';
import { verifyPaystackPayment } from '../utils/paystackHelper.js';

const router = express.Router();
const DEFAULT_IMAGE = 'https://via.placeholder.com/500x500?text=No+Image';

const normalizePrices = (data) => {
  if (data.price != null) {
    data.price = typeof data.price === 'string' ? Number(data.price.replace(/,/g, '')) : Number(data.price);
  }
  if (data.discount_price != null) {
    data.discount_price = typeof data.discount_price === 'string' ? Number(data.discount_price.replace(/,/g, '')) : Number(data.discount_price);
    if (data.price != null && data.discount_price > data.price) data.discount_price = data.price;
  }
};

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

router.post('/', async (req, res) => {
  try {
    const data = req.body;
    
    const product = new MarketplaceProduct({
      ...data,
      createdBy: req.auth?.sub || data.createdBy,
      updatedBy: req.auth?.sub || data.createdBy
    });

    await product.save();
    const formatted = addFormattedPrices(product);
    
    res.status(201).json({ 
      success: true, 
      message: 'Product published successfully!', 
      productId: product._id,
      data: formatted 
    });
  } catch (err) {
    console.error('POST /api/marketplace error:', err);
    res.status(400).json({ 
      success: false, 
      message: err.message 
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const { 
      category, 
      promoted, 
      search, 
      state, 
      city, 
      minPrice, 
      maxPrice, 
      page = 1, 
      limit = 20 
    } = req.query;

    const filter = { 
      deleted: false, 
      status: 'active',
      ...(category && { category }),
      ...(promoted === 'true' && { promoted: true }),
      ...(state && { state }),
      ...(city && { city }),
      ...(minPrice && { price: { $gte: Number(minPrice) } }),
      ...(maxPrice && { price: { $lte: Number(maxPrice) } }),
      ...(search && { $text: { $search: search } })
    };

    const skip = (Number(page) - 1) * Number(limit);
    
    const products = await MarketplaceProduct.find(filter)
      .sort({ 
        promoted: -1, 
        createdAt: -1,
        ...(minPrice && { price: 1 })
      })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await MarketplaceProduct.countDocuments(filter);
    const formattedProducts = products.map(addFormattedPrices);

    res.json({ 
      success: true, 
      count: formattedProducts.length, 
      total, 
      page: Number(page), 
      pages: Math.ceil(total / Number(limit)),
      data: formattedProducts 
    });
  } catch (err) {
    console.error('GET /api/marketplace error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await MarketplaceProduct.findOne({ 
      _id: req.params.id, 
      deleted: false 
    }).lean();

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const formatted = addFormattedPrices(product);
    res.json({ success: true, data: formatted });
  } catch (err) {
    console.error('GET /api/marketplace/:id error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const data = req.body;
    normalizePrices(data);

    const product = await MarketplaceProduct.findOne({ 
      _id: req.params.id, 
      deleted: false 
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    Object.assign(product, data);
    product.updatedBy = req.auth?.sub || data.updatedBy;

    await product.save();
    const formatted = addFormattedPrices(product);
    
    res.json({ success: true, message: 'Product updated', data: formatted });
  } catch (err) {
    console.error('PUT /api/marketplace/:id error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const product = await MarketplaceProduct.findById(req.params.id);
    if (!product || product.deleted) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await product.softDelete();
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error('DELETE /api/marketplace/:id error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
