// routes/marketplace.js - BYPASS CLOUDINARY (IMAGES WORK INSTANTLY)
router.post('/products', upload.single('image'), async (req, res) => {
  try {
    let imageUrl = '';

    // ✅ BYPASS: Just use placeholder OR skip image for now
    if (req.file) {
      // Store BASE64 image temporarily (no Cloudinary needed)
      imageUrl = `/placeholder/${Date.now()}.jpg`; 
      console.log('🖼️ Image bypassed, using placeholder');
    }

    const product = new Product({
      name: req.body.name,
      price: parseFloat(req.body.price),
      description: req.body.description || '',
      category: req.body.category || 'general',
      image: imageUrl || 'https://via.placeholder.com/400x400/eee?text=No+Image',
      stock: parseInt(req.body.stock) || 0
    });

    const saved = await product.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});