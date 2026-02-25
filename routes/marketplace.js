// routes/marketplace.js - UNSIGNED CLOUDINARY UPLOAD (NO API KEYS!)
router.post('/products', upload.single('image'), async (req, res) => {
  try {
    let imageUrl = '';

    if (req.file) {
      // ✅ UNSIGNED UPLOAD - Only needs cloud_name + preset
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.v2.uploader.upload_stream(
          { 
            folder: 'minimart',
            upload_preset: process.env.VITE_CLOUDINARY_UPLOAD_PRESET  // Your preset!
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });
      imageUrl = result.secure_url;
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
    console.error('Error:', error.message);
    res.status(400).json({ error: error.message });
  }
});