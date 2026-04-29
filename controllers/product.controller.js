// controllers/product.controller.js

import {
  getProducts,
  getProductById,
  createProduct,
  incrementViews,
} from "../services/product.service.js";

import { generateSlugWithId } from "../utils/slug.js";
import { pool } from "../config/db.js";

/* ===================== RESPONSE HELPERS ===================== */
const sendSuccess = (res, data, status = 200) =>
  res.status(status).json({ success: true, data });

const sendError = (res, message, status = 500) =>
  res.status(status).json({ success: false, message });

/* ===================== GET PRODUCTS ===================== */
export const getProductsHandler = async (req, res) => {
  try {
    const { skip = 0, limit = 20, state, category_id } = req.query;

    const result = await getProducts(
      Number(skip),
      Number(limit),
      state,
      category_id
    );

    return sendSuccess(res, result);
  } catch (err) {
    console.error("GET /products error:", err);
    return sendError(res, "Failed to fetch products");
  }
};

/* ===================== GET PRODUCT BY SLUG ===================== */
export const getProductHandler = async (req, res) => {
  try {
    const { slug } = req.params;

    // Extract UUID safely from slug
    const id = slug.match(/[0-9a-fA-F-]{36}$/)?.[0];

    if (!id) {
      return sendError(res, "Invalid product slug", 400);
    }

    const product = await getProductById(id);

    if (!product) {
      return sendError(res, "Product not found", 404);
    }

    const canonicalSlug =
      product.slug || generateSlugWithId(product.title, product.id);

    // SEO redirect if slug mismatch
    if (slug !== canonicalSlug) {
      if (!product.slug) {
        await pool.query(
          "UPDATE products SET slug = $1 WHERE id = $2",
          [canonicalSlug, id]
        );
      }

      return res.redirect(301, `/product/${canonicalSlug}`);
    }

    // Non-blocking view increment
    incrementViews(id).catch((err) =>
      console.error("incrementViews error:", err)
    );

    return sendSuccess(res, {
      ...product,
      slug: canonicalSlug,
    });
  } catch (err) {
    console.error("GET /product/:slug error:", err);
    return sendError(res, "Failed to fetch product");
  }
};

/* ===================== GET PRODUCT BY ID ===================== */
export const getProductByIdHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await getProductById(id);

    if (!product) {
      return sendError(res, "Product not found", 404);
    }

    incrementViews(id).catch(() => {});

    return sendSuccess(res, product);
  } catch (err) {
    console.error("GET /products/:id error:", err);
    return sendError(res, "Failed to fetch product");
  }
};

/* ===================== CREATE PRODUCT ===================== */
export const createProductHandler = async (req, res) => {
  try {
    const sellerId = req.user?.id;

    if (!sellerId) {
      return sendError(res, "Unauthorized", 401);
    }

    const {
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
      return sendError(res, "Title is required", 400);
    }

    if (!price || isNaN(price) || Number(price) <= 0) {
      return sendError(res, "Valid price is required", 400);
    }

    if (!category_id) {
      return sendError(res, "Category is required", 400);
    }

    if (!req.files?.length) {
      return sendError(res, "At least one image is required", 400);
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
      seller_id: sellerId, // secure injection from auth
    });

    return sendSuccess(res, product, 201);
  } catch (err) {
    console.error("POST /products error:", err);

    /* ===================== KNOWN ERRORS ===================== */
    if (err.code === "INVALID_CATEGORY_OR_PROMOTION") {
      return sendError(res, "Invalid category or promotion", 400);
    }

    if (err.code === "MISSING_REQUIRED_FIELDS") {
      return sendError(res, "Missing required fields", 400);
    }

    if (err.code === "SLUG_CONFLICT") {
      return sendError(res, "Slug conflict - try another title", 409);
    }

    return sendError(res, "Failed to create product");
  }
};