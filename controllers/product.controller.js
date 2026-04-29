import {
  getProducts,
  getProductById,
  createProduct,
  incrementViews,
} from "../services/product.service.js";

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

    if (!slug) {
      return sendError(res, "Invalid product slug", 400);
    }

    // 🔥 SAFE: Resolve product directly by slug (NO regex)
    const { rows } = await pool.query(
      `
      SELECT p.*,
        COALESCE(
          json_agg(pi.image_url ORDER BY pi.position_order)
          FILTER (WHERE pi.image_url IS NOT NULL),
          '[]'
        ) AS images
      FROM products p
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.slug = $1 AND p.is_active = true AND p.status = 'active'
      GROUP BY p.id
      `,
      [slug]
    );

    const product = rows[0];

    if (!product) {
      return sendError(res, "Product not found", 404);
    }

    // 🔥 Non-blocking engagement tracking
    incrementViews(product.id).catch((err) =>
      console.error("incrementViews error:", err)
    );

    return sendSuccess(res, product);
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
      seller_id: sellerId,
    });

    return sendSuccess(res, product, 201);
  } catch (err) {
    console.error("POST /products error:", err);

    /* ===================== STANDARD ERRORS ===================== */
    const errorMap = {
      INVALID_PRICE: [400, "Invalid price"],
      MISSING_TITLE: [400, "Title is required"],
      INVALID_CATEGORY: [400, "Invalid category"],
      SLUG_CONFLICT: [409, "Slug conflict - try another title"],
    };

    if (err?.code && errorMap[err.code]) {
      const [status, message] = errorMap[err.code];
      return sendError(res, message, status);
    }

    return sendError(res, "Failed to create product");
  }
};