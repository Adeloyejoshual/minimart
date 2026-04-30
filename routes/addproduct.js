// routes/addproduct.js
import express from "express";
import { pool } from "../config/db.js";
import { getCategoriesHandler } from "../controllers/category.controller.js";

const router = express.Router();

/* ================================
   CATEGORY ROUTES
================================ */
router.get("/categories", getCategoriesHandler);

/* ================================
   CREATE PRODUCT
================================ */
router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      title,
      description = "",
      price,
      category_id = null,
      subcategory_id = null,
      seller_id,
      attributes = {},
      promotion_id = null,
      promotion_start = null,
      promotion_end = null,
      is_promoted = false,
      promotion_type = null,
      promotion_priority = 0,
      promotion_expires_at = null,
      location_state = null,
      location_city = null,
      delivery = {},
      contact = {},
      media = { images: [], videos: [] },
      status = "draft",
      is_active = true,
      whatsapp = null,
      whatsapp_link = null,
      phone = null,
      slug = null,
      seo_title = null,
      seo_description = null,
      seo_keywords = null,
      canonical_url = null,
      highlights = [],
      specifications = {},
      faq = [],
      search_text = null,
    } = req.body;

    if (!title || !price || !seller_id) {
      return res.status(400).json({
        message: "title, price and seller_id are required",
      });
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
        promotion_id,
        promotion_start,
        promotion_end,
        is_promoted,
        promotion_type,
        promotion_priority,
        promotion_expires_at,
        location_state,
        location_city,
        delivery,
        contact,
        media,
        status,
        is_active,
        whatsapp,
        whatsapp_link,
        phone,
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
        $1,  $2,  $3,  $4,  $5,  $6,  $7,
        $8,  $9,  $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26, $27, $28,
        $29, $30, $31, $32,
        to_tsvector('english', coalesce($1,'') || ' ' || coalesce($2,'') || ' ' || coalesce($33,''))
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
      promotion_id,
      promotion_start,
      promotion_end,
      is_promoted,
      promotion_type,
      promotion_priority,
      promotion_expires_at,
      location_state,
      location_city,
      JSON.stringify(delivery),
      JSON.stringify(contact),
      JSON.stringify(media),
      status,
      is_active,
      whatsapp,
      whatsapp_link,
      phone,
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
      message: "Product created successfully",
      product: rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create product error:", error);

    return res.status(500).json({
      message: "Failed to create product",
      error: error.message,
    });
  } finally {
    client.release();
  }
});

/* ================================
   UPDATE PRODUCT
================================ */
router.put("/:id", async (req, res) => {
  const client = await pool.connect();
  const { id } = req.params;

  try {
    const {
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
      media,
      status,
      is_active,
      whatsapp,
      whatsapp_link,
      phone,
      seo_title,
      seo_description,
      seo_keywords,
      canonical_url,
      highlights,
      specifications,
      faq,
      search_text,
    } = req.body;

    await client.query("BEGIN");

    const query = `
      UPDATE products
      SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        price = COALESCE($3, price),
        category_id = COALESCE($4, category_id),
        subcategory_id = COALESCE($5, subcategory_id),
        attributes = COALESCE($6, attributes),
        location_state = COALESCE($7, location_state),
        location_city = COALESCE($8, location_city),
        delivery = COALESCE($9, delivery),
        contact = COALESCE($10, contact),
        media = COALESCE($11, media),
        status = COALESCE($12, status),
        is_active = COALESCE($13, is_active),
        whatsapp = COALESCE($14, whatsapp),
        whatsapp_link = COALESCE($15, whatsapp_link),
        phone = COALESCE($16, phone),
        seo_title = COALESCE($17, seo_title),
        seo_description = COALESCE($18, seo_description),
        seo_keywords = COALESCE($19, seo_keywords),
        canonical_url = COALESCE($20, canonical_url),
        highlights = COALESCE($21, highlights),
        specifications = COALESCE($22, specifications),
        faq = COALESCE($23, faq),
        search_text = COALESCE($24, search_text),
        updated_at = now(),
        search_vector = to_tsvector(
          'english',
          coalesce(COALESCE($1, title),'') || ' ' ||
          coalesce(COALESCE($2, description),'') || ' ' ||
          coalesce(COALESCE($24, search_text),'')
        )
      WHERE id = $25
      RETURNING *;
    `;

    const values = [
      title,
      description,
      price,
      category_id,
      subcategory_id,
      attributes ? JSON.stringify(attributes) : null,
      location_state,
      location_city,
      delivery ? JSON.stringify(delivery) : null,
      contact ? JSON.stringify(contact) : null,
      media ? JSON.stringify(media) : null,
      status,
      is_active,
      whatsapp,
      whatsapp_link,
      phone,
      seo_title,
      seo_description,
      seo_keywords,
      canonical_url,
      highlights ? JSON.stringify(highlights) : null,
      specifications ? JSON.stringify(specifications) : null,
      faq ? JSON.stringify(faq) : null,
      search_text,
      id,
    ];

    const { rows } = await client.query(query, values);

    await client.query("COMMIT");

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json({
      message: "Product updated successfully",
      product: rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update product error:", error);

    return res.status(500).json({
      message: "Failed to update product",
      error: error.message,
    });
  } finally {
    client.release();
  }
});

/* ================================
   GET SINGLE PRODUCT
================================ */
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT *
      FROM products
      WHERE id = $1
      LIMIT 1
      `,
      [req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error("Fetch product error:", error);
    return res.status(500).json({
      message: "Failed to fetch product",
      error: error.message,
    });
  }
});

/* ================================
   DELETE PRODUCT
================================ */
router.delete("/:id", async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM products WHERE id = $1`,
      [req.params.id]
    );

    if (!rowCount) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete product error:", error);
    return res.status(500).json({
      message: "Failed to delete product",
      error: error.message,
    });
  }
});

export default router;