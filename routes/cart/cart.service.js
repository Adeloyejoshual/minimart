// routes/cart/cart.service.js
import cartRepository from "./cart.repository.js";
import { CartErrors } from "./cart.errors.js";

const PRICE_DRIFT_THRESHOLD = 0.01;

// Matches getProduct.js + cart.repository.js
const ALLOWED_STATUSES = new Set(["active", "approved"]);

class CartService {

  // ── Get full cart ─────────────────────────────────────────

  async getCart(userId) {
    const cart     = await cartRepository.upsertCart(userId);
    const items    = await cartRepository.getCartItems(cart.id);
    const { cleanItems, issues } = this._auditItems(items);

    const totalQty = cleanItems.reduce((s, i) => s + i.qty, 0);
    const subtotal = cleanItems.reduce(
      (s, i) => s + Number(i.live_price) * i.qty,
      0
    );

    return {
      cart_id:    cart.id,
      user_id:    userId,
      items:      cleanItems,
      item_count: cleanItems.length,
      total_qty:  totalQty,
      subtotal:   parseFloat(subtotal.toFixed(2)),
      currency:   "USD",
      has_issues: issues.length > 0,
      issues,
      updated_at: cart.updated_at,
    };
  }

  // ── Add item ──────────────────────────────────────────────

  async addItem(userId, productId, variantId, qty) {
    const cart = await cartRepository.upsertCart(userId);
    return cartRepository.addItem(
      cart.id,
      productId,
      variantId ?? null,
      qty
    );
  }

  // ── Update qty ────────────────────────────────────────────

  async updateQty(userId, itemId, qty) {
    const cart = await cartRepository.upsertCart(userId);
    return cartRepository.updateQty(cart.id, itemId, qty);
  }

  // ── Remove item ───────────────────────────────────────────

  async removeItem(userId, itemId) {
    const cart = await cartRepository.upsertCart(userId);
    return cartRepository.removeItem(cart.id, itemId);
  }

  // ── Clear cart ────────────────────────────────────────────

  async clearCart(userId) {
    const cart = await cartRepository.upsertCart(userId);
    return cartRepository.clearCart(cart.id);
  }

  // ── Pre-checkout validation ───────────────────────────────

  async validateForCheckout(userId) {
    const cart       = await cartRepository.upsertCart(userId);
    const rows       = await cartRepository.getItemsForCheckout(cart.id);
    const violations = [];

    if (rows.length === 0) {
      violations.push({
        type:    "EMPTY_CART",
        message: "Your cart is empty",
      });
      throw CartErrors.cartHasViolations(violations);
    }

    for (const row of rows) {
      // Use same ALLOWED_STATUSES as repository
      const unavailable =
        row.deleted_at                        ||
        !ALLOWED_STATUSES.has(row.status)     ||
        !row.is_active                        ||
        row.is_hidden                         ||
        row.is_paused;

      if (unavailable) {
        violations.push({
          item_id:      row.item_id,
          product_id:   row.product_id,
          product_name: row.product_name,
          type:         "PRODUCT_UNAVAILABLE",
          message:      `"${row.product_name}" is no longer available`,
        });
        continue;
      }

      // Stock check (variants only)
      if (row.variant_id && row.live_stock !== null) {
        if (Number(row.live_stock) <= 0) {
          violations.push({
            item_id:      row.item_id,
            product_id:   row.product_id,
            product_name: row.product_name,
            type:         "OUT_OF_STOCK",
            message:      `"${row.product_name}" is out of stock`,
          });
          continue;
        }

        if (Number(row.live_stock) < row.qty) {
          violations.push({
            item_id:      row.item_id,
            product_id:   row.product_id,
            product_name: row.product_name,
            type:         "INSUFFICIENT_STOCK",
            message: `Only ${row.live_stock} units of "${row.product_name}" available`,
            data: {
              available: Number(row.live_stock),
              requested: row.qty,
            },
          });
        }
      }

      // Price drift check
      const saved = Number(row.saved_price);
      const live  = Number(row.live_price);
      const drift = saved > 0
        ? Math.abs(live - saved) / saved
        : 0;

      if (drift > PRICE_DRIFT_THRESHOLD) {
        violations.push({
          item_id:      row.item_id,
          product_id:   row.product_id,
          product_name: row.product_name,
          type:         "PRICE_CHANGED",
          message:      `Price of "${row.product_name}" changed`,
          data:         { old_price: saved, new_price: live },
        });
      }
    }

    if (violations.length > 0) {
      throw CartErrors.cartHasViolations(violations);
    }

    return { valid: true, item_count: rows.length };
  }

  // ── Private: audit items for cart display ─────────────────

  _auditItems(items) {
    const cleanItems = [];
    const issues     = [];

    for (const item of items) {

      // Deleted → exclude entirely
      if (item.product_deleted_at) {
        issues.push({
          item_id:    item.id,
          product_id: item.product_id,
          type:       "PRODUCT_DELETED",
          message:    `"${item.product_name}" has been removed`,
        });
        continue;
      }

      // Unavailable → show greyed-out (still in list)
      const unavailable =
        !ALLOWED_STATUSES.has(item.product_status) ||
        !item.product_is_active                     ||
        item.product_is_hidden                      ||
        item.product_is_paused;

      if (unavailable) {
        issues.push({
          item_id:    item.id,
          product_id: item.product_id,
          type:       "PRODUCT_UNAVAILABLE",
          message:    `"${item.product_name}" is currently unavailable`,
        });
      }

      // Stock checks (variants only)
      if (
        item.variant_id                  &&
        item.live_stock !== null         &&
        Number(item.live_stock) <= 0
      ) {
        issues.push({
          item_id:    item.id,
          product_id: item.product_id,
          type:       "OUT_OF_STOCK",
          message:    `"${item.product_name}" is out of stock`,
        });
      } else if (
        item.variant_id                  &&
        item.live_stock !== null         &&
        item.qty > Number(item.live_stock)
      ) {
        issues.push({
          item_id:    item.id,
          product_id: item.product_id,
          type:       "INSUFFICIENT_STOCK",
          message: `Only ${item.live_stock} units of "${item.product_name}" available`,
          data: {
            available: Number(item.live_stock),
            requested: item.qty,
          },
        });
      }

      // Price drift
      const saved = Number(item.saved_price);
      const live  = Number(item.live_price);
      const drift = saved > 0
        ? Math.abs(live - saved) / saved
        : 0;

      if (drift > PRICE_DRIFT_THRESHOLD) {
        issues.push({
          item_id:    item.id,
          product_id: item.product_id,
          type:       "PRICE_CHANGED",
          message:    `Price of "${item.product_name}" has changed`,
          data:       { old_price: saved, new_price: live },
        });
      }

      cleanItems.push(item);
    }

    return { cleanItems, issues };
  }
}

const cartService = new CartService();
export default cartService;