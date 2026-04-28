// controllers/product.controller.js
import { getProducts, getProductById, createProduct, incrementViews } from "../services/product.service.js";

export const getProductsHandler = async (req, res) => {
  try {
    const { skip, limit, state, category_id } = req.query;
    const result = await getProducts(skip, limit, state, category_id);

    res.json(result);
  } catch (err) {
    console.error("GET /products error:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
};

export const getProductHandler = async (req, res) => {
  try {
    const { slug } = req.params;

    const parts = slug.split("-");
    const id = parts[parts.length - 1];

    if (!id)
      return res.status(404).json({ message: "Invalid slug format" });

    const product = await getProductById(id);

    if (!product)
      return res.status(404).json({ message: "Product not found" });

    const canonicalSlug =
      product.slug || generateSlugWithId(product.title, product.id);

    if (product.slug !== slug) {
      if (!product.slug) {
        await pool.query("UPDATE products SET slug = $1 WHERE id = $2", [
          canonicalSlug,
          id,
        ]);
      }
      return res.redirect(301, `/product/${canonicalSlug}`);
    }

    incrementViews(id);

    res.json(normalizeProduct({ ...product, slug: canonicalSlug }));
  } catch (err) {
    console.error("GET /product/:slug error:", err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
};

export const getProductByIdHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await getProductById(id);

    if (!product)
      return res.status(404).json({ message: "Product not found" });

    incrementViews(id);

    res.json(normalizeProduct(product));
  } catch (err) {
    console.error("GET /products/:id error:", err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
};

export const createProductHandler = async (req, res) => {
  try {
    const sellerId = req.user?.id;
    if (!sellerId) {
      return res.status(401).json({ message: "Unauthorized: missing seller_id" });
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

    if (!title?.trim())
      return res.status(400).json({ message: "Title required" });

    if (!price || isNaN(price) || +price <= 0) {
      return res.status(400).json({ message: "Valid price required" });
    }
    if (!category_id)
      return res.status(400).json({ message: "Category required" });
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "At least one image required" });
    }

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
    });

    res.status(201).json({ success: true, product });
  } catch (err) {
    console.error("POST /products error:", err);

    if (err.code === "INVALID_CATEGORY_OR_PROMOTION") {
      return res.status(400).json({ message: "Invalid category or promotion" });
    }
    if (err.code === "MISSING_REQUIRED_FIELDS") {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (err.code === "SLUG_CONFLICT") {
      return res
        .status(409)
        .json({ message: "Slug conflict - try different title" });
    }

    res.status(500).json({ message: "Failed to create product" });
  }
};