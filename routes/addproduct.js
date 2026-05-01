import express from "express";
import multer from "multer";
import streamifier from "streamifier";
import { pool } from "../config/db.js";
import { v2 as cloudinary } from "cloudinary";
import { getCategoriesHandler } from "../controllers/category.controller.js";
import authenticate from "../middleware/auth.js";

const router = express.Router();

/* =====================================
   MULTER CONFIG
===================================== */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 3 * 1024 * 1024,
    files: 6,
  },
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images allowed"));
    }
    cb(null, true);
  },
});

/* =====================================
   HELPERS
===================================== */
const safeParse = (value, fallback) => {
  try {
    if (!value) return fallback;
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
};

const generateSlug = (title = "") =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

// FIX 4: Added Cloudinary transformation for auto-optimization
const uploadToCloudinary = (buffer, folder = "minimart/products") =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [
          { width: 1200, crop: "limit" },
          { quality: "auto" },
          { fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });

/* =====================================
   CATEGORY ROUTES
===================================== */
router.get("/categories", getCategoriesHandler);

/* =====================================
   CREATE PRODUCT (FIXED VERSION)
===================================== */
router.post(
  "/products",
  authenticate,
  upload.array("images", 6), // FIX 5: changed "images[]" → "images"
  async (req, res) => {
    const client = await pool.connect();

    try {
      const seller_id = req.user.id;

      const title = req.body.title?.trim();
      const description = req.body.description?.trim() || "";
      const price = Number(req.body.price);

      if (!title) {
        return res.status(400).json({
          success: false,
          message: "Title is required",
        });
      }

      if (!price || Number.isNaN(price) || price <= 0) {
        return res.status(400).json({
          success: false,
          message: "Valid price is required",
        });
      }

      const category_id = req.body.category_id || null;
      const subcategory_id = req.body.subcategory_id || null;
      const location_state = req.body.location_state || null;
      const location_city = req.body.location_city || null;
      const status = req.body.status || "draft";
      const is_active = String(req.body.is_active) === "true";

      const attributes = safeParse(req.body.attributes, {});
      const delivery = safeParse(req.body.delivery, {});
      const contact = safeParse(req.body.contact, {});
      const highlights = safeParse(req.body.highlights, []);
      const specifications = safeParse(req.body.specifications, {});
      const faq = safeParse(req.body.faq, []);

      const phone = req.body.phone || contact.phone || null;
      const whatsapp = req.body.whatsapp || contact.whatsapp || null;
      const whatsapp_link = req.body.whatsapp_link || contact.whatsapp_link || null;

      const seo_title = req.body.seo_title || null;
      const seo_description = req.body.seo_description || null;
      const seo_keywords = req.body.seo_keywords || null;
      const canonical_url = req.body.canonical_url || null;
      const search_text = req.body.search_text || null;

      const files = req.files || [];

      /* =====================================
         UPLOAD IMAGES TO CLOUDINARY
         (parallel uploads are fine — this is external I/O, not DB writes)
      ====================================== */
      const uploadedImages = await Promise.all(
        files.map(async (file, index) => {
          const result = await uploadToCloudinary(file.buffer);
          return {
            image_url: result.secure_url,
            public_id: result.public_id,
            position_order: index,
          };
        })
      );

      // FIX 3: Derive thumbnail from first uploaded image
      const thumbnail_url = uploadedImages[0]?.image_url || null;

      /* =====================================
         SLUG
         Always append Date.now() — eliminates the extra SELECT query and
         the race condition window entirely. The UNIQUE constraint on slug
         remains the final safety net for any edge cases.
      ====================================== */
      const slug = `${generateSlug(title)}-${Date.now()}`;

      await client.query("BEGIN");

      /* =====================================
         INSERT PRODUCT
      ====================================== */
      const insertQuery = `
        INSERT INTO products (
          title,
          description,
          price,
          category_id,
          subcategory_id,
          seller_id,
          attributes,
          location_state,
          location_city,
          delivery,
          contact,
          status,
          is_active,
          phone,
          whatsapp,
          whatsapp_link,
          slug,
          seo_title,
          seo_description,
          seo_keywords,
          canonical_url,
          highlights,
          specifications,
          faq,
          search_text,
          thumbnail_url,
          search_vector
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          $21,$22,$23,$24,$25,$26,
          to_tsvector('english',
            coalesce($1,'') || ' ' ||
            coalesce($2,'') || ' ' ||
            coalesce($25,'')
          )
        )
        RETURNING *;
      `;

      const values = [
        title,
        description,
        price,
        category_id,
        subcategory_id,
        seller_id,
        attributes,        // FIX 6B: pass object directly — pg handles JSONB serialization
        location_state,
        location_city,
        delivery,          // FIX 6B: same
        contact,           // FIX 6B: same
        status,
        is_active,
        phone,
        whatsapp,
        whatsapp_link,
        slug,
        seo_title,
        seo_description,
        seo_keywords,
        canonical_url,
        highlights,        // FIX 6B: same
        specifications,    // FIX 6B: same
        faq,               // FIX 6B: same
        search_text,
        thumbnail_url,     // FIX 3: insert thumbnail
      ];

      const { rows } = await client.query(insertQuery, values);
      const product = rows[0];

      /* =====================================
         INSERT IMAGES — BULK INSERT (single DB call)
         FIX 1: use client (not pool) to stay inside the transaction
         FIX 2: one bulk INSERT instead of N parallel queries
      ====================================== */
      if (uploadedImages.length > 0) {
        const valuePlaceholders = uploadedImages
          .map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`)
          .join(", ");

        const params = [product.id];
        uploadedImages.forEach((img) => {
          params.push(img.image_url, img.position_order);
        });

        await client.query(
          `INSERT INTO product_images (product_id, image_url, position_order)
           VALUES ${valuePlaceholders}`,
          params
        );
      }

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message: "Product created successfully",
        product,
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Create product error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to create product",
        error: error.message,
      });
    } finally {
      client.release();
    }
  }
);

export default router;
