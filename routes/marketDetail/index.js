// routes/products/index.js

import express from "express";

import suggestionsRouter    from "./suggestions.js";    // ← NEW
import getProductRouter     from "./getProduct.js";
import relatedProductsRouter from "./relatedProducts.js";
import wishlistRouter       from "./wishlist.js";
import reportRouter         from "./report.js";
import shareRouter          from "./share.js";

const router = express.Router();

/* ══════════════════════════════════════════════════════════
   ⚠️  ORDER MATTERS
   suggestionsRouter MUST come before getProductRouter.
   getProductRouter handles /:slug — if it comes first,
   "suggestions" and "trending" get matched as product slugs
   and return 404.
══════════════════════════════════════════════════════════ */

/* Static routes first */
router.use("/", suggestionsRouter);      // GET /suggestions, /trending

/* Parameterised routes after */
router.use("/", getProductRouter);       // GET /:slug
router.use("/", relatedProductsRouter);  // GET /:slug/related  (or similar)
router.use("/", wishlistRouter);         // POST /:slug/wishlist
router.use("/", reportRouter);           // POST /:slug/report
router.use("/", shareRouter);            // POST /:slug/share

export default router;