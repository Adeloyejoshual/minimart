import express from 'express';
const router = express.Router();

router.post('/products', async (req, res) => {
  console.log('📦 Product:', req.body.title);
  res.status(201).json({ 
    success: true,
    product: { ...req.body, _id: 'success-123' },
    message: 'Product created!'
  });
});

router.post('/products/:id/promote', async (req, res) => {
  res.json({ success: true, message: 'Promoted!' });
});

router.get('/products', async (req, res) => {
  res.json({ success: true, products: [] });
});

export default router;  // LAST LINE ONLY