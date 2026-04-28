// controllers/product.controller.js

import {
  getProducts,
  getProductById,
  createProduct,
  incrementViews,
} from "../services/product.service.js";

import { pool } from "../config/db.js";
import { generateSlugWithId } from "../utils/slug.js";
import { normalizeProduct } from "../utils/normalizeProduct.js";

/* ===================== GET PRODUCTS ===================== */
export const getProductsHandler = async (req, res) => {
  try {
    const { skip = 0, limit = 20, state, category_id } = req.query;

    const result = await getProducts(
      Number(skip),
      Number(limit),
      state || null,
      category_id || null
    );

    return res.json(result);
  } catch (err) {
    console.error("GET /products error:", err);
    return res.status(500).json({
      message: err.message || "Failed to fetch products",
    });
  }
};

/* ===================== GET PRODUCT BY SLUG ===================== */
export const getProductHandler = async (req, res) => {
  try {
    const { slug } = req.params;

    const parts = slug.split("-");
    const id = parts[parts.length - 1];

    if (!id) {
      return res.status(400).json({ message: "Invalid slug format" });
    }

    const product = await getProductById(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const canonicalSlug =
      product.slug || generateSlugWithId(product.title, product.id);

    // Auto-fix slug mismatch
    if (product.slug !== slug) {
      if (!product.slug) {
        await pool.query(
          "UPDATE products SET slug = $1 WHERE id = $2",
          [canonicalSlug, id]
        );
      }

      return res.redirect(301, `/product/${canonicalSlug}`);
    }

    // fire-and-forget view increment
    incrementViews(id).catch((err) =>
      console.error("incrementViews error:", err)
    );

    return res.json(
      normalizeProduct({ ...product, slug: canonicalSlug })
    );
  } catch (err) {
    console.error("GET /product/:slug error:", err);
    return res.status(500).json({
      message: err.message || "Failed to fetch product",
    });
  }
};

/* ===================== GET PRODUCT BY ID ===================== */
export const getProductByIdHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await getProductById(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    incrementViews(id).catch((err) =>
      console.error("incrementViews error:", err)
    );

    return res.json(normalizeProduct(product));
  } catch (err) {
    console.error("GET /products/:id error:", err);
    return res.status(500).json({
      message: err.message || "Failed to fetch product",
    });
  }
};

/* ===================== CREATE PRODUCT ===================== */
export const createProductHandler = async (req, res) => {
  try {
    const sellerId = req.user?.id;

    if (!sellerId) {
      return res.status(401).json({
        message: "Unauthorized: missing seller_id",
      });
    }

    let {
      title,
      price,
      category_id,
      attributes,
      delivery,
      contact,
      description,
      subcategory_id,
      location_state,
      location_city,
    } = req.body;

    /* ===================== VALIDATION ===================== */
    if (!title?.trim()) {
      return res.status(400).json({ message: "Title required" });
    }

    if (!price || isNaN(price) || Number(price) <= 0) {
      return res.status(400).json({ message: "Valid price required" });
    }

    if (!category_id) {
      return res.status(400).json({ message: "Category required" });
    }

    if (!req.files?.length) {
      return res.status(400).json({
        message: "At least one image required",
      });
    }

    /* ===================== CREATE PRODUCT ===================== */
    const product = await createProduct({
      title,
      price: Number(price),
      category_id,       // ✅ KEEP UUID AS STRING
      subcategory_id,    // ✅ KEEP UUID AS STRING
      attributes,
      delivery,
      contact,
      description,
      location_state,
      location_city,
      imagesFiles: req.files,
      seller_id: sellerId,
    });

    return res.status(201).json({
      success: true,
      product,
    });
  } catch (err) {
    console.error("POST /products error:", err);

    return res.status(500).json({
      message: err.message || "Failed to create product",
      code: err.code || null,
      detail: err.detail || null,
    });
  }
};