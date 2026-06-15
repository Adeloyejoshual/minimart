// routes/cart/cart.routes.js
import { Router }         from "express";
import cartController     from "./cart.controller.js";
import { authenticateBuyer } from "../../middleware/auth.js";

const router = Router();

// ════════════════════════════════════════════════════════════
// All cart routes require buyer auth (public.users only)
// ════════════════════════════════════════════════════════════
router.use(authenticateBuyer);

// GET    /api/cart
// POST   /api/cart/items
// PATCH  /api/cart/items/:itemId
// DELETE /api/cart/items/:itemId
// DELETE /api/cart
// POST   /api/cart/validate

router.get("/",          cartController.getCart);
router.post("/items",    cartController.addItem);
router.patch("/items/:itemId",  cartController.updateQty);
router.delete("/items/:itemId", cartController.removeItem);
router.delete("/",       cartController.clearCart);
router.post("/validate", cartController.validateCheckout);

// ════════════════════════════════════════════════════════════
// Cart-specific error handler
// ════════════════════════════════════════════════════════════
router.use((err, req, res, next) => {
  // Known CartError
  if (err.name === "CartError") {
    return res.status(err.httpStatus ?? 400).json({
      error:   err.code,
      message: err.message,
      context: err.context ?? {},
    });
  }

  // CockroachDB constraint errors
  if (err.code === "23505") {
    return res.status(409).json({
      error:   "DUPLICATE_ITEM",
      message: "This item is already in your cart",
    });
  }

  if (err.code === "23514") {
    return res.status(400).json({
      error:   "INVALID_QTY",
      message: "Quantity must be between 1 and 99",
    });
  }

  if (err.code === "23503") {
    return res.status(404).json({
      error:   "REFERENCE_NOT_FOUND",
      message: "Product or cart reference not found",
    });
  }

  next(err);
});

export default router;