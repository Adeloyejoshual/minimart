// src/features/cart/api/cartApi.js

const BASE_URL = "/api/cart";

/**
 * ─────────────────────────────────────────────────────────────
 * CORE REQUEST HANDLER
 * All cart API calls go through here
 * Throws enriched Error objects on failure
 * ─────────────────────────────────────────────────────────────
 */
async function request(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Accept":        "application/json",
      },
      credentials: "include",   // sends session cookie / JWT cookie
      ...options,
    });

    // Parse body (always JSON from our API)
    let data;
    try {
      data = await response.json();
    } catch {
      throw Object.assign(new Error("Invalid server response"), {
        code:   "INVALID_RESPONSE",
        status: response.status,
      });
    }

    // Successful response
    if (response.ok) {
      return data;
    }

    // Server returned an error
    const error         = new Error(data.message || "Cart request failed");
    error.code          = data.error      || "UNKNOWN_ERROR";
    error.status        = response.status;
    error.violations    = data.violations || [];
    error.context       = data.context    || {};
    error.issues        = data.issues     || [];

    throw error;

  } catch (err) {
    // Network failure — no response at all
    if (!err.status && err.code !== "INVALID_RESPONSE") {
      const networkError    = new Error(
        "Network error. Please check your connection."
      );
      networkError.code     = "NETWORK_ERROR";
      networkError.status   = 0;
      networkError.original = err;
      throw networkError;
    }

    throw err;
  }
}

/**
 * ─────────────────────────────────────────────────────────────
 * CART API
 * Matches backend routes exactly:
 *
 * GET    /api/cart
 * POST   /api/cart/items
 * PATCH  /api/cart/items/:itemId
 * DELETE /api/cart/items/:itemId
 * DELETE /api/cart
 * POST   /api/cart/validate
 * ─────────────────────────────────────────────────────────────
 */
export const cartApi = {

  /**
   * GET /api/cart
   * Returns full CartSummary:
   * { cart_id, user_id, items[], issues[], subtotal, currency, ... }
   */
  getCart() {
    return request(BASE_URL);
  },

  /**
   * POST /api/cart/items
   * @param {string}      productId  - UUID
   * @param {string|null} variantId  - UUID or null
   * @param {number}      qty        - 1–99
   */
  addItem(productId, variantId = null, qty = 1) {
    return request(`${BASE_URL}/items`, {
      method: "POST",
      body:   JSON.stringify({
        product_id: productId,
        variant_id: variantId,
        qty,
      }),
    });
  },

  /**
   * PATCH /api/cart/items/:itemId
   * @param {string} itemId - UUID
   * @param {number} qty    - 1–99
   */
  updateQty(itemId, qty) {
    return request(`${BASE_URL}/items/${itemId}`, {
      method: "PATCH",
      body:   JSON.stringify({ qty }),
    });
  },

  /**
   * DELETE /api/cart/items/:itemId
   * @param {string} itemId - UUID
   */
  removeItem(itemId) {
    return request(`${BASE_URL}/items/${itemId}`, {
      method: "DELETE",
    });
  },

  /**
   * DELETE /api/cart
   * Clears all items in the cart
   */
  clearCart() {
    return request(BASE_URL, {
      method: "DELETE",
    });
  },

  /**
   * POST /api/cart/validate
   * Server-side pre-checkout validation
   * Returns 200 if valid
   * Returns 409 with violations[] if issues found
   */
  validateCart() {
    return request(`${BASE_URL}/validate`, {
      method: "POST",
    });
  },
};