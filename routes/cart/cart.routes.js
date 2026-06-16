// routes/cart/cart.routes.js
import { Router }            from "express";
import cartController        from "./cart.controller.js";
import { authenticateBuyer } from "../../middleware/auth.js";  // ← fixed
import { CartError }         from "./cart.errors.js";

const router = Router();

// All cart routes require buyer auth (public.users only)
router.use(authenticateBuyer);

router.get    ("/",               cartController.getCart);
router.post   ("/items",          cartController.addItem);
router.patch  ("/items/:itemId",  cartController.updateQty);
router.delete ("/items/:itemId",  cartController.removeItem);
router.delete ("/",               cartController.clearCart);
router.post   ("/validate",       cartController.validateCheckout);

// ── Cart-specific error handler ───────────────────────────────
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {

  console.error(
    `[CartRouter] ${req.method} ${req.originalUrl}`,
    {
      code:    err.code,
      message: err.message,
      context: err.context,
      status:  err.httpStatus ?? err.status,
    }
  );

  // Known CartError
  if (err instanceof CartError || err.name === "CartError") {
    return res.status(err.httpStatus ?? 400).json({
      success: false,
      error:   err.code,
      message: err.message,
      context: err.context ?? {},
    });
  }

  // CockroachDB constraint violations
  if (err.code === "23505") {
    return res.status(409).json({
      success: false,
      error:   "DUPLICATE_ITEM",
      message: "This item is already in your cart",
    });
  }

  if (err.code === "23514") {
    return res.status(400).json({
      success: false,
      error:   "INVALID_QTY",
      message: "Quantity must be between 1 and 99",
    });
  }

  if (err.code === "23503") {
    return res.status(404).json({
      success: false,
      error:   "REFERENCE_NOT_FOUND",
      message: "Product or cart reference not found",
    });
  }

  next(err);
});

export default router;