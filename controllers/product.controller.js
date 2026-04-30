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

    if (!slug || typeof slug !== "string" || !slug.trim()) {
      return sendError(res, "Invalid product slug", 400);
    }

    // Direct slug lookup (no regex, safe)
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
      [slug.trim()]
    );

    const product = rows[0];

    if (!product) {
      return sendError(res, "Product not found", 404);
    }

    // Fire view increment non‑blocking
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

    if (!id || !id.trim()) {
      return sendError(res, "Invalid product ID", 400);
    }

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
      promotion_id,
    } = req.body;

    const imagesFiles = req.files?.length ? req.files : null;

    /* ===================== VALIDATION ===================== */
    if (!title || !title.trim()) {
      return sendError(res, "Title is required", 400);
    }

    const safePrice = Number(price);
    if (!safePrice || Number.isNaN(safePrice) || safePrice <= 0) {
      return sendError(res, "Valid price is required", 400);
    }

    if (!category_id) {
      return sendError(res, "Category is required", 400);
    }

    if (!imagesFiles) {
      return sendError(res, "At least one image is required", 400);
    }

    /* ===================== CREATE PRODUCT ===================== */
    const product = await createProduct(
      {
        title,
        price: safePrice,
        category_id,
        attributes,
        delivery,
        contact,
        description,
        subcategory_id,
        promotion_id,
        location_state,
        location_city,
        imagesFiles,
        seller_id: sellerId,
      },
      sellerId
    );

    return sendSuccess(res, product, 201);
  } catch (err) {
    console.error("POST /products error:", err);

    /* ===================== STANDARD ERRORS ===================== */
    const errorMap = {
      INVALID_PRICE: [400, "Invalid price"],
      MISSING_FIELDS: [400, "Missing required fields"],
      SLUG_CONFLICT: [409, "Slug conflict - try another title"],
    };

    if (err.message && errorMap[err.message]) {
      const [status, message] = errorMap[err.message];
      return sendError(res, message, status);
    }

    return sendError(res, "Failed to create product");
  }
};