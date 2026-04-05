// routes/marketplace.js
import express from 'express';
import multer from 'multer';
import { Pool } from 'pg'; // CockroachDB uses pg driver
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// CockroachDB connection pool (configure your connection string)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://root@localhost:26257/defaultdb?sslmode=disable',
  ssl: process.env.NODE_ENV === 'production',
});

// Multer config for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/products/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'), false);
  }
});

// Your config imports (for validation/dynamic fields)
import { brands, colors, categoryFields, conditions, usedDetails, featuresByCategory, models, ramOptions, sims, storageOptions, years, engines, fuelTypes, locationsByState, fieldOptions } from "../src/config/brands.js"; // Adjust paths as needed

// GET /api/marketplace/categories
router.get('/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, parent_id as "parentId" 
      FROM categories 
      WHERE parent_id IS NULL 
      ORDER BY name ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Categories error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/marketplace/categories/:id/subcategories
router.get('/categories/:id/subcategories', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT id, name 
      FROM categories 
      WHERE parent_id = $1 
      ORDER BY name ASC
    `, [id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Subcategories error:', error);
    res.status(500).json({ error: 'Failed to fetch subcategories' });
  }
});

// POST /api/marketplace/products - Create product
router.post('/products', upload.array('images', 6), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      title, description, price, category_id, subcategory_id,
      location_state, location_city, status = 'pending',
      delivery, contact, attributes, state = 'draft'
    } = req.body;

    // Parse JSON fields
    const deliveryJson = delivery ? JSON.parse(delivery) : {};
    const contactJson = contact ? JSON.parse(contact) : {};
    const attributesJson = attributes ? JSON.parse(attributes) : {};

    // Validate required fields
    if (!title || !price || !category_id) {
      throw new Error('Missing required fields: title, price, category_id');
    }

    // Validate price
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      throw new Error('Invalid price');
    }

    // Validate location
    if (!locationsByState[location_state]?.includes(location_city)) {
      console.warn('Invalid location:', location_state, location_city);
    }

    // Insert product
    const productResult = await client.query(`
      INSERT INTO products (
        title, description, price, category_id, subcategory_id,
        location_state, location_city, status, delivery, contact,
        attributes, state, user_id, seller_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
      RETURNING id, created_at
    `, [
      title, description || '', priceNum, category_id, subcategory_id || null,
      location_state, location_city, status, deliveryJson, contactJson,
      attributesJson, state, req.user?.id // Assume auth middleware sets req.user
    ]);

    const productId = productResult.rows[0].id;

    // Insert images with position_order
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        await client.query(`
          INSERT INTO product_images (product_id, image_url, position_order, "position")
          VALUES ($1, $2, $3, $3)
        `, [productId, `/uploads/products/${req.files[i].filename}`, i]);
      }
    }

    await client.query('COMMIT');

    // Return product with images
    const fullProduct = await client.query(`
      SELECT 
        p.*, 
        json_agg(
          json_build_object(
            'id', pi.id,
            'image_url', pi.image_url,
            'position_order', pi.position_order
          )
        ) FILTER (WHERE pi.id IS NOT NULL) as images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.id = $1
      GROUP BY p.id
    `, [productId]);

    res.json({
      success: true,
      product: fullProduct.rows[0],
      message: 'Product created successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Product creation error:', error);
    res.status(400).json({ error: error.message || 'Failed to create product' });
  } finally {
    client.release();
  }
});

// PUT /api/marketplace/products/:id - Update product (draft/publish)
router.put('/products/:id', upload.array('images', 6), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const updates = req.body;

    // Handle JSON fields
    if (updates.delivery) updates.delivery = JSON.parse(updates.delivery);
    if (updates.contact) updates.contact = JSON.parse(updates.contact);
    if (updates.attributes) updates.attributes = JSON.parse(updates.attributes);

    // Update product
    const updateFields = Object.keys(updates).map((key, i) => `${key} = $${i + 1}`).join(', ');
    const updateValues = Object.values(updates);
    updateValues.push(id, req.user?.id);

    await client.query(`
      UPDATE products 
      SET ${updateFields}, updated_at = now(), user_id = $${updateValues.length}
      WHERE id = $${updateValues.length} AND (user_id = $${updateValues.length} OR seller_id = $${updateValues.length})
    `, updateValues);

    // Handle new images (delete old if provided signal, but here append)
    if (req.files?.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const order = await client.query('SELECT COALESCE(MAX(position_order), -1) + 1 FROM product_images WHERE product_id = $1', [id]);
        await client.query(`
          INSERT INTO product_images (product_id, image_url, position_order, "position")
          VALUES ($1, $2, $3, $3)
        `, [id, `/uploads/products/${req.files[i].filename}`, order.rows[0].max + 1]);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Product updated' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Product update error:', error);
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
});

// DELETE /api/marketplace/products/:id/images/:imageId
router.delete('/products/:productId/images/:imageId', async (req, res) => {
  try {
    const { productId, imageId } = req.params;
    await pool.query('DELETE FROM product_images WHERE id = $1 AND product_id = $2', [imageId, productId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;