// routes/products.js
const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const router = express.Router();

// Configure Cloudinary (use your .env vars)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  preset: process.env.CLOUDINARY_UPLOAD_PRESET
});

// Multer for file handling
const upload = multer({ dest: 'uploads/' });

router.post('/', upload.single('image'), async (req, res) => {
  try {
    let imageUrl = '';
    
    // Upload image to Cloudinary
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      imageUrl = result.secure_url;
    }

    // Save to MongoDB
    const product = new Product({
      name: req.body.name,
      price: req.body.price,
      description: req.body.description,
      image: imageUrl,
      category: req.body.category
    });

    await product.save();
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

module.exports = router;