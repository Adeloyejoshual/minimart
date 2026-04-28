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
    const {
      skip = 0,
      limit = 20,
      state,
      category_id,
    } = req.query;

    const result = await getProducts(
      Number(skip),
      Number(limit),
      state,
      category_id ? Number(category_id) : null
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
    incrementViews(id).catch((e) =>
      console.error("incrementViews error:", e)
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

    incrementViews(id).catch((e) =>
      console.error("incrementViews error:", e)
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

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        message: "At least one image required",
      });
    }

    /* ===================== TYPE FIXING ===================== */
    price = Number(price);
    category_id = Number(category_id);
    subcategory_id = subcategory_id ? Number(subcategory_id) : null;

    if (typeof attributes === "string") {
      try {
        attributes = JSON.parse(attributes);
      } catch {
        attributes = {};
      }
    }

    if (typeof delivery === "string") {
      try {
        delivery = JSON.parse(delivery);
      } catch {
        delivery = {};
      }
    }

    if (typeof contact === "string") {
      try {
        contact = JSON.parse(contact);
      } catch {
        contact = {};
      }
    }

    /* ===================== CREATE PRODUCT ===================== */
    const product = await createProduct({
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
      imagesFiles: req.files,
      seller_id: sellerId, // 🔥 CRITICAL FIX
    });

    return res.status(201).json({
      success: true,
      product,
    });
  } catch (err) {
    console.error("POST /products error:", err);

    // Better error exposure for debugging
    return res.status(500).json({
      message: err.message || "Failed to create product",
      code: err.code,
      detail: err.detail,
    });
  }
};