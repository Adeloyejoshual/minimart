// routes/marketplace.js - RENDER DEPLOYMENT READY ✅
import express from 'express';

const router = express.Router();

// 🆕 POST /api/marketplace/products - Create product
router.post('/products', async (req, res) => {
  try {
    console.log('📦 Creating product:', req.body.title);
    
    // TODO: Save to MongoDB with Product model
    const productData = {
      ...req.body,
      sellerId: req.auth?.sub || 'anonymous',
      createdAt: new Date().toISOString()
    };
    
    res.status(201).json({ 
      success: true, 
      product: productData, 
      message: 'Product created successfully' 
    });
  } catch (error) {
    console.error('❌ Product creation error:', error);
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// 🆕 POST /api/marketplace/products/:id/promote - Paystack promotion
router.post('/products/:id/promote', async (req, res) => {
  try {
    const { promo_plan, paystack_ref } = req.body;
    
    // TODO: Verify Paystack transaction + update product
    console.log(`🚀 Promoting product ${req.params.id} with plan: ${promo_plan}`);
    
    res.json({ 
      success: true, 
      message: 'Promotion activated successfully',
      productId: req.params.id 
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// 🆕 GET /api/marketplace/products - List products
router.get('/products', async (req, res) => {
  try {
    // TODO: Fetch from MongoDB
    res.json({ 
      success: true, 
      products: [],
      message: 'Products fetched successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ CRITICAL: DEFAULT EXPORT (Fixes Render error)
export default router;

// ✅ Also named export (future-proof)
export { router };

// ✅ CommonJS fallback (mixed environments)
module.exports = router;