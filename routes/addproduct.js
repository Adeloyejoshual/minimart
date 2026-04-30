// routes/addproduct.js
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

const uploadToCloudinary = (buffer, folder = "minimart/products") =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
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
   CREATE PRODUCT
===================================== */
router.post(
  "/products",
  authenticate,
  upload.array("images[]", 6),
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
      const incomingMedia = safeParse(req.body.media, {
        images: [],
        videos: [],
      });

      const phone = req.body.phone || contact.phone || null;
      const whatsapp = req.body.whatsapp || contact.whatsapp || null;
      const whatsapp_link =
        req.body.whatsapp_link || contact.whatsapp_link || null;

      const seo_title = req.body.seo_title || null;
      const seo_description = req.body.seo_description || null;
      const seo_keywords = req.body.seo_keywords || null;
      const canonical_url = req.body.canonical_url || null;
      const search_text = req.body.search_text || null;

      const files = req.files || [];

      /* ===========================
         UPLOAD IMAGES
      =========================== */
      const uploadedImages = await Promise.all(
        files.map(async (file, index) => {
          const result = await uploadToCloudinary(file.buffer);

          return {
            id: `img_${Date.now()}_${index}`,
            url: result.secure_url,
            public_id: result.public_id,
            filename: file.originalname,
            size: file.size,
            mime_type: file.mimetype,
            width: result.width,
            height: result.height,
          };
        })
      );

      const media = {
        images: uploadedImages.length
          ? uploadedImages
          : incomingMedia.images || [],
        videos: incomingMedia.videos || [],
      };

      /* ===========================
         SLUG
      =========================== */
      const baseSlug = generateSlug(title);
      let slug = baseSlug;

      const slugCheck = await client.query(
        `SELECT id FROM products WHERE slug = $1 LIMIT 1`,
        [slug]
      );

      if (slugCheck.rows.length) {
        slug = `${baseSlug}-${Date.now()}`;
      }

      await client.query("BEGIN");

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
          media,
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
          search_vector
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          $21,$22,$23,$24,$25,$26,
          to_tsvector(
            'english',
            coalesce($1,'') || ' ' ||
            coalesce($2,'') || ' ' ||
            coalesce($26,'')
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
        JSON.stringify(attributes),
        location_state,
        location_city,
        JSON.stringify(delivery),
        JSON.stringify(contact),
        JSON.stringify(media),
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
        JSON.stringify(highlights),
        JSON.stringify(specifications),
        JSON.stringify(faq),
        search_text,
      ];

      const { rows } = await client.query(insertQuery, values);

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message: "Product created successfully",
        product: rows[0],
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

/* =====================================
   ACTIVATE PRODUCT
===================================== */
router.post(
  "/products/:id/activate",
  authenticate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { promotion_id = null } = req.body;

      const existing = await pool.query(
        `SELECT id
         FROM products
         WHERE id = $1 AND seller_id = $2
         LIMIT 1`,
        [id, req.user.id]
      );

      if (!existing.rows.length) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      await pool.query(
        `
        UPDATE products
        SET
          status = 'active',
          is_active = true,
          promotion_id = $1,
          updated_at = NOW()
        WHERE id = $2
        `,
        [promotion_id, id]
      );

      return res.json({
        success: true,
        message: "Product activated successfully",
      });
    } catch (error) {
      console.error("Activate error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to activate product",
        error: error.message,
      });
    }
  }
);

/* =====================================
   DELETE PRODUCT
===================================== */
router.delete(
  "/products/:id",
  authenticate,
  async (req, res) => {
    try {
      const { id } = req.params;

      const existing = await pool.query(
        `SELECT media
         FROM products
         WHERE id = $1 AND seller_id = $2
         LIMIT 1`,
        [id, req.user.id]
      );

      if (!existing.rows.length) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      const media = existing.rows[0].media || {};
      const images = media.images || [];

      await Promise.allSettled(
        images.map((img) =>
          img.public_id
            ? cloudinary.uploader.destroy(img.public_id)
            : Promise.resolve()
        )
      );

      await pool.query(`DELETE FROM products WHERE id = $1`, [id]);

      return res.json({
        success: true,
        message: "Product deleted successfully",
      });
    } catch (error) {
      console.error("Delete error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to delete product",
        error: error.message,
      });
    }
  }
);

export default router;