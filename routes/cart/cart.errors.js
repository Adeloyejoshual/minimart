// routes/cart/cart.errors.js

const CART_ERROR_CODES = {
  CART_NOT_FOUND:        "CART_NOT_FOUND",
  ITEM_NOT_FOUND:        "ITEM_NOT_FOUND",
  PRODUCT_NOT_FOUND:     "PRODUCT_NOT_FOUND",
  VARIANT_NOT_FOUND:     "VARIANT_NOT_FOUND",
  VARIANT_MISMATCH:      "VARIANT_MISMATCH",
  PRODUCT_UNAVAILABLE:   "PRODUCT_UNAVAILABLE",
  OUT_OF_STOCK:          "OUT_OF_STOCK",
  INSUFFICIENT_STOCK:    "INSUFFICIENT_STOCK",
  INVALID_QTY:           "INVALID_QTY",
  PRICE_CHANGED:         "PRICE_CHANGED",
  CART_HAS_VIOLATIONS:   "CART_HAS_VIOLATIONS",
  UNAUTHORIZED:          "UNAUTHORIZED",
  VALIDATION_ERROR:      "VALIDATION_ERROR",
  DB_ERROR:              "DB_ERROR",
};

class CartError extends Error {
  constructor(code, message, context = {}, httpStatus = 400) {
    super(message);
    this.name       = "CartError";
    this.code       = code;
    this.context    = context;
    this.httpStatus = httpStatus;
  }
}

const CartErrors = {
  cartNotFound: (userId) =>
    new CartError(
      CART_ERROR_CODES.CART_NOT_FOUND,
      `No cart found for user ${userId}`,
      { userId },
      404
    ),

  itemNotFound: (itemId) =>
    new CartError(
      CART_ERROR_CODES.ITEM_NOT_FOUND,
      `Cart item ${itemId} not found`,
      { itemId },
      404
    ),

  productNotFound: (productId) =>
    new CartError(
      CART_ERROR_CODES.PRODUCT_NOT_FOUND,
      `Product ${productId} not found`,
      { productId },
      404
    ),

  variantNotFound: (variantId) =>
    new CartError(
      CART_ERROR_CODES.VARIANT_NOT_FOUND,
      `Variant ${variantId} not found`,
      { variantId },
      404
    ),

  variantMismatch: (variantId, productId) =>
    new CartError(
      CART_ERROR_CODES.VARIANT_MISMATCH,
      `Variant ${variantId} does not belong to product ${productId}`,
      { variantId, productId },
      400
    ),

  productUnavailable: (reason) =>
    new CartError(
      CART_ERROR_CODES.PRODUCT_UNAVAILABLE,
      `Product is not available: ${reason}`,
      { reason },
      409
    ),

  outOfStock: (productId) =>
    new CartError(
      CART_ERROR_CODES.OUT_OF_STOCK,
      `Product ${productId} is out of stock`,
      { productId },
      409
    ),

  insufficientStock: (available, requested) =>
    new CartError(
      CART_ERROR_CODES.INSUFFICIENT_STOCK,
      `Only ${available} units available, ${requested} requested`,
      { available, requested },
      409
    ),

  invalidQty: (qty) =>
    new CartError(
      CART_ERROR_CODES.INVALID_QTY,
      `Quantity ${qty} is invalid. Must be between 1 and 99`,
      { qty },
      400
    ),

  cartHasViolations: (violations) =>
    new CartError(
      CART_ERROR_CODES.CART_HAS_VIOLATIONS,
      "Cart has unresolved issues. Please fix them before checkout.",
      { violations },
      409
    ),

  unauthorized: () =>
    new CartError(
      CART_ERROR_CODES.UNAUTHORIZED,
      "You must be logged in to access your cart",
      {},
      401
    ),

  validationError: (issues) =>
    new CartError(
      CART_ERROR_CODES.VALIDATION_ERROR,
      "Validation failed",
      { issues },
      422
    ),

  dbError: (cause) =>
    new CartError(
      CART_ERROR_CODES.DB_ERROR,
      "A database error occurred",
      { cause: cause?.message ?? String(cause) },
      500
    ),
};

export { CartError, CartErrors, CART_ERROR_CODES };