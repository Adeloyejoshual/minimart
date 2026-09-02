// routes/products/index.js

import express from "express";

import suggestionsRouter    from "./suggestions.js";
import getProductRouter     from "./getProduct.js";
import relatedProductsRouter from "./relatedProducts.js";
import wishlistRouter       from "./wishlist.js";
import reportRouter         from "./report.js";
import shareRouter          from "./share.js";
import reviewsRouter        from "./reviews.js"; // ← IMPORT THE NEW ROUTER

const router = express.Router();

/* Static routes first */
router.use("/", suggestionsRouter);      // GET /suggestions, /trending

/* Parameterised routes after */
router.use("/", getProductRouter);       // GET /:slug
router.use("/", relatedProductsRouter);  // GET /:slug/related
router.use("/", wishlistRouter);         // POST /:slug/wishlist
router.use("/", reportRouter);           // POST /:slug/report
router.use("/", shareRouter);            // POST /:slug/share
router.use("/", reviewsRouter);          // POST /:idOrSlug/reviews (or GET reviews) // ← REGISTER HERE

export default router;