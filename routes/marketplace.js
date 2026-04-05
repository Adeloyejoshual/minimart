import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { Pool } from "pg";

const router = express.Router();
const pool = new Pool();

// ================= MULTER =================
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ================= HELPERS =================
const parseJSON = (val, fallback = {}) => {
  try {
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
};

const validate = (body) => {
  if (!body.title || !body.price || !body.category_id) {
    return "Missing required fields";
  }

  if (body.contact?.email) {
    const emailRegex = /^[^@]+@[^@]+\.[^@]+$/;
    if (!emailRegex.test(body.contact.email)) {
      return "Invalid email";
    }
  }

  if (body.contact?.phone) {
    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(body.contact.phone)) {
      return "Invalid phone";
    }
  }

  return null;
};

// ================= CREATE PRODUCT =================
router.post(
  "/products",
  upload.array("images", 6),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // ===== Parse Body =====
      const {
        title,
        description,
        price,
        category_id,
        subcategory_id,
        location_state,
        location_city,
        user_id
      } = req.body;

      const attributes = parseJSON(req.body.attributes);
      const delivery = parseJSON(req.body.delivery);
      const contact = parseJSON(req.body.contact);

      // ===== Validation =====
      const error = validate({
        title,
        price,
        category_id,
        contact
      });

      if (error) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error });
      }

      // ===== Upload Images =====
      const uploadedImages = [];

      for (const file of req.files) {
        const result = await cloudinary.uploader.upload_stream({
          folder: "marketplace"
        });

        // Convert buffer → stream
        const stream = require("streamifier").createReadStream(file.buffer);

        const uploadPromise = new Promise((resolve, reject) => {
          const streamUpload = cloudinary.uploader.upload_stream(
            { folder: "marketplace" },
            (err, result) => {
              if (err) reject(err);
              else resolve(result);
            }
          );
          stream.pipe(streamUpload);
        });

        const uploaded = await uploadPromise;

        uploadedImages.push(uploaded.secure_url);
      }

      // ===== Insert Product =====
      const productResult = await client.query(
        `
        INSERT INTO public.products (
          title,
          description,
          price,
          category_id,
          subcategory_id,
          attributes,
          location_state,
          location_city,
          delivery,
          contact,
          user_id,
          seller_id,
          media
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12
        )
        RETURNING *
        `,
        [
          title,
          description || "",
          price,
          category_id,
          subcategory_id || null,
          attributes,
          location_state,
          location_city,
          delivery,
          contact,
          user_id,
          JSON.stringify({
            images: uploadedImages,
            videos: []
          })
        ]
      );

      const product = productResult.rows[0];

      // ===== Insert Images (Ordered) =====
      for (let i = 0; i < uploadedImages.length; i++) {
        await client.query(
          `
          INSERT INTO public.product_images (
            product_id,
            image_url,
            position_order
          )
          VALUES ($1,$2,$3)
          `,
          [product.id, uploadedImages[i], i]
        );
      }

      await client.query("COMMIT");

      return res.json({
        success: true,
        product
      });

    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);

      return res.status(500).json({
        error: "Failed to create product"
      });

    } finally {
      client.release();
    }
  }
);

export default router;