// routes/products/index.js

import express from "express";

import suggestionsRouter     from "./suggestions.js";
import relatedProductsRouter from "./relatedProducts.js";
import wishlistRouter        from "./wishlist.js";
import reportRouter          from "./report.js";
import shareRouter           from "./share.js";
import reviewsRouter         from "./reviews.js";
import getProductRouter      from "./getProduct.js"; // ← MUST BE LAST

const router = express.Router();

/* Static routes */
router.use("/", suggestionsRouter);

/* Sub-action routes */
router.use("/", reviewsRouter);          // POST /:idOrSlug/reviews
router.use("/", relatedProductsRouter);  // GET /:slug/related
router.use("/", wishlistRouter);         // POST /:slug/wishlist
router.use("/", reportRouter);           // POST /:slug/report
router.use("/", shareRouter);            // POST /:slug/share

/* Catch-all route (LAST) */
router.use("/", getProductRouter);       // GET /:slug

export default router;