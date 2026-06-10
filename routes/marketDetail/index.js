import express from "express";

import getProductRouter      from "./getProduct.js";
import relatedProductsRouter from "./relatedProducts.js";
import wishlistRouter        from "./wishlist.js";
import reportRouter          from "./report.js";
import shareRouter           from "./share.js";

const router = express.Router();

/* Main product detail */
router.use("/", getProductRouter);

/* Related products */
router.use("/", relatedProductsRouter);

/* Interactions */
router.use("/", wishlistRouter);
router.use("/", reportRouter);
router.use("/", shareRouter);

export default router;