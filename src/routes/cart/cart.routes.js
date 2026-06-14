// src/routes/cart/cart.routes.js
const express        = require("express");
const CartRepository = require("./cart.repository");
const CartService    = require("./cart.service");
const CartController = require("./cart.controller");
const {
  requireAuth,
  cartErrorHandler,
  cartLogger,
} = require("./cart.middleware");

/**
 * Factory function
 * Receives the shared pg Pool from app.js
 *
 * Usage:
 *   const cartRouter = require("./routes/cart/cart.routes");
 *   app.use("/api/cart", cartRouter(pool));
 */
function createCartRouter(pool) {
  const router = express.Router();

  // ── DI wiring ──────────────────────────────────────────────
  const repository = new CartRepository(pool);
  const service    = new CartService(repository);
  const controller = new CartController(service);

  // ── Middleware (all cart routes) ───────────────────────────
  router.use(cartLogger);
  router.use(requireAuth);

  // ── Routes ─────────────────────────────────────────────────

  /**
   * GET /api/cart
   * Returns full enriched cart with items + issues
   *
   * Response 200:
   * {
   *   success: true,
   *   data: {
   *     cart_id, user_id, items[], item_count,
   *     total_qty, subtotal, currency,
   *     has_issues, issues[], updated_at
   *   }
   * }
   */
  router.get(
    "/",
    controller.getCart
  );

  /**
   * POST /api/cart/items
   * Add item to cart (creates cart if needed)
   *
   * Body: { product_id: UUID, variant_id?: UUID, qty: number }
   *
   * Response 201:
   * { success: true, message, data: CartItem }
   *
   * Errors:
   *   422 VALIDATION_ERROR
   *   404 PRODUCT_NOT_FOUND
   *   404 VARIANT_NOT_FOUND
   *   409 PRODUCT_UNAVAILABLE
   *   409 OUT_OF_STOCK
   *   409 INSUFFICIENT_STOCK
   */
  router.post(
    "/items",
    controller.addItem
  );

  /**
   * PATCH /api/cart/items/:itemId
   * Update item quantity
   *
   * Params: itemId (UUID)
   * Body:   { qty: number }
   *
   * Response 200:
   * { success: true, message, data: CartItem }
   *
   * Errors:
   *   422 VALIDATION_ERROR
   *   404 ITEM_NOT_FOUND
   *   409 OUT_OF_STOCK
   *   409 INSUFFICIENT_STOCK
   */
  router.patch(
    "/items/:itemId",
    controller.updateQty
  );

  /**
   * DELETE /api/cart/items/:itemId
   * Remove single item from cart
   *
   * Params: itemId (UUID)
   *
   * Response 200:
   * { success: true, message }
   *
   * Errors:
   *   422 VALIDATION_ERROR
   *   404 ITEM_NOT_FOUND
   */
  router.delete(
    "/items/:itemId",
    controller.removeItem
  );

  /**
   * DELETE /api/cart
   * Clear all items from cart
   *
   * Response 200:
   * { success: true, message }
   */
  router.delete(
    "/",
    controller.clearCart
  );

  /**
   * POST /api/cart/validate
   * Server-side pre-checkout validation
   * Re-validates stock + price + availability
   *
   * Response 200: { success: true, data: { valid, item_count } }
   * Response 409: { success: false, error, message, violations[] }
   *
   * NEVER trust client cart data for checkout
   */
  router.post(
    "/validate",
    controller.validateCheckout
  );

  // ── Error handler (must be last) ───────────────────────────
  router.use(cartErrorHandler);

  return router;
}

module.exports = createCartRouter;