// src/features/cart/api/cartApi.js

const BASE_URL = "/api/cart";

// ─────────────────────────────────────────────────────────────
// TOKEN — reads marketplace_token from localStorage
// Matches TOKEN_KEYS.marketplace in App.jsx
// ─────────────────────────────────────────────────────────────
function getToken() {
  return localStorage.getItem("marketplace_token") ?? null;
}

function getHeaders() {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    "Accept":        "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// ─────────────────────────────────────────────────────────────
// CORE REQUEST HANDLER
// ─────────────────────────────────────────────────────────────
async function request(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: getHeaders(),
      ...options,
    });

    let data;
    try {
      data = await response.json();
    } catch {
      throw Object.assign(new Error("Invalid server response"), {
        code:   "INVALID_RESPONSE",
        status: response.status,
      });
    }

    if (response.ok) {
      return data;
    }

    const error          = new Error(data.message || "Cart request failed");
    error.code           = data.error      || "UNKNOWN_ERROR";
    error.status         = response.status;
    error.violations     = data.violations || [];
    error.context        = data.context    || {};
    error.issues         = data.issues     || [];
    throw error;

  } catch (err) {
    if (!err.status && err.code !== "INVALID_RESPONSE") {
      const networkError     = new Error(
        "Network error. Please check your connection."
      );
      networkError.code      = "NETWORK_ERROR";
      networkError.status    = 0;
      networkError.original  = err;
      throw networkError;
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// CART API
// ─────────────────────────────────────────────────────────────
export const cartApi = {

  getCart() {
    return request(BASE_URL);
  },

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

  updateQty(itemId, qty) {
    return request(`${BASE_URL}/items/${itemId}`, {
      method: "PATCH",
      body:   JSON.stringify({ qty }),
    });
  },

  removeItem(itemId) {
    return request(`${BASE_URL}/items/${itemId}`, {
      method: "DELETE",
    });
  },

  clearCart() {
    return request(BASE_URL, {
      method: "DELETE",
    });
  },

  validateCart() {
    return request(`${BASE_URL}/validate`, {
      method: "POST",
    });
  },
};