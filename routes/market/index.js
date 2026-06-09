/**
 * Market products router — mounts all sub-routers.
 *
 * Mount in server.js:
 *   import marketRouter from "./routes/market/index.js";
 *   app.use("/api/products", marketRouter);
 */

import express from "express";
import multer  from "multer";

import publicRoutes  from "./public.js";
import addProduct    from "./addProduct.js";
import editProduct   from "./editProduct.js";
import deleteProduct from "./deleteProduct.js";
import sellerActions from "./sellerActions.js";
import interactions  from "./interactions.js";

const router = express.Router();

/**
 * ⚠️ ORDER MATTERS — static paths BEFORE /:id
 *
 * 1. Seller static paths (seller/mine)
 * 2. Create product (POST /)
 * 3. Public listing (GET /) + detail (GET /:idOrSlug)
 * 4. Edit / Delete (PATCH /:id, DELETE /:id)
 * 5. Seller actions (/:id/pause)
 * 6. Interactions (/:id/wishlist, /:id/report, /:id/share)
 */

/* ── 1. Seller static paths ── */
router.use("/", sellerActions);

/* ── 2. Create product ── */
router.use("/", addProduct);

/* ── 3. Public routes (listing + detail) ── */
router.use("/", publicRoutes);

/* ── 4. Edit + Delete ── */
router.use("/", editProduct);
router.use("/", deleteProduct);

/* ── 5. Interactions ── */
router.use("/", interactions);

/* ── Error handler ── */
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError)
    return res.status(400).json({ success: false, message: err.message });
  if (err.status === 415)
    return res.status(415).json({ success: false, message: err.message });

  console.error("Market router error:", err);
  res.status(500).json({ success: false, message: "Unexpected server error" });
});

export default router;