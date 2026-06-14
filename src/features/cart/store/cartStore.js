// src/features/cart/store/cartStore.js
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { cartApi }  from "../api/cartApi";
import { calcCartTotals } from "../utils/cartHelpers";

/**
 * ─────────────────────────────────────────────────────────────
 * CART STORE
 * Built with Zustand
 * Uses devtools middleware for Redux DevTools support
 *
 * State shape matches CartSummary from backend:
 * {
 *   cart_id, user_id, items[], issues[],
 *   subtotal, currency, has_issues, updated_at
 * }
 * ─────────────────────────────────────────────────────────────
 */
const useCartStore = create(
  devtools(
    (set, get) => ({

      // ── State ───────────────────────────────────────────────
      cartId:      null,
      userId:      null,
      items:       [],
      issues:      [],
      currency:    "USD",
      subtotal:    0,
      totalQty:    0,
      hasIssues:   false,
      updatedAt:   null,

      // Request state
      status:      "idle",   // "idle" | "loading" | "syncing" | "error"
      error:       null,

      // ── Computed (always derived, never stale) ──────────────
      getItemCount() {
        return get().items.length;
      },

      getItemById(itemId) {
        return get().items.find((i) => i.id === itemId) ?? null;
      },

      getSubtotal() {
        return calcCartTotals(get().items).subtotal;
      },

      getTotalQty() {
        return calcCartTotals(get().items).totalQty;
      },

      // ── Internal helpers ────────────────────────────────────
      _setCartData(data) {
        const { totalQty, subtotal } = calcCartTotals(data.items);

        set({
          cartId:    data.cart_id,
          userId:    data.user_id,
          items:     data.items      ?? [],
          issues:    data.issues     ?? [],
          currency:  data.currency   ?? "USD",
          hasIssues: (data.issues ?? []).length > 0,
          updatedAt: data.updated_at ?? null,
          subtotal,
          totalQty,
          status:    "idle",
          error:     null,
        });
      },

      // ── Actions ─────────────────────────────────────────────

      /**
       * Fetch full cart from server
       * Called on mount + after login
       */
      fetchCart: async () => {
        set({ status: "loading", error: null });

        try {
          const res = await cartApi.getCart();
          get()._setCartData(res.data);
        } catch (err) {
          set({
            status: "error",
            error:  err.message ?? "Failed to load cart",
          });
        }
      },

      /**
       * Add item to cart
       * Full refetch after success (ensures server state)
       */
      addItem: async (productId, variantId = null, qty = 1) => {
        set({ status: "syncing", error: null });

        try {
          await cartApi.addItem(productId, variantId, qty);
          await get().fetchCart();
        } catch (err) {
          set({ status: "error", error: err.message });
          throw err;  // re-throw so UI can handle
        }
      },

      /**
       * Update item quantity
       * Optimistic update → server sync → rollback on failure
       */
      updateQty: async (itemId, newQty) => {
        // Snapshot for rollback
        const snapshot = {
          items:    get().items,
          issues:   get().issues,
          subtotal: get().subtotal,
          totalQty: get().totalQty,
        };

        // 1. Optimistic update
        const updatedItems = get().items.map((item) =>
          item.id === itemId ? { ...item, qty: newQty } : item
        );

        const { subtotal, totalQty } = calcCartTotals(updatedItems);

        set({
          items:    updatedItems,
          subtotal,
          totalQty,
        });

        // 2. Server sync
        try {
          await cartApi.updateQty(itemId, newQty);
        } catch (err) {
          // 3. Rollback
          set({
            items:    snapshot.items,
            subtotal: snapshot.subtotal,
            totalQty: snapshot.totalQty,
            error:    err.message,
          });
        }
      },

      /**
       * Remove item from cart
       * Optimistic remove → server sync → rollback on failure
       */
      removeItem: async (itemId) => {
        // Snapshot for rollback
        const snapshot = {
          items:    get().items,
          issues:   get().issues,
          subtotal: get().subtotal,
          totalQty: get().totalQty,
        };

        // 1. Optimistic remove
        const filteredItems = get().items.filter((i) => i.id !== itemId);
        const filteredIssues = get().issues.filter(
          (issue) => issue.item_id !== itemId
        );
        const { subtotal, totalQty } = calcCartTotals(filteredItems);

        set({
          items:     filteredItems,
          issues:    filteredIssues,
          hasIssues: filteredIssues.length > 0,
          subtotal,
          totalQty,
        });

        // 2. Server sync
        try {
          await cartApi.removeItem(itemId);
        } catch (err) {
          // 3. Rollback
          set({
            items:     snapshot.items,
            issues:    snapshot.issues,
            hasIssues: snapshot.issues.length > 0,
            subtotal:  snapshot.subtotal,
            totalQty:  snapshot.totalQty,
            error:     err.message,
          });

          throw err;
        }
      },

      /**
       * Clear all items
       * Optimistic clear → server sync → rollback on failure
       */
      clearCart: async () => {
        const snapshot = {
          items:    get().items,
          issues:   get().issues,
          subtotal: get().subtotal,
          totalQty: get().totalQty,
        };

        // 1. Optimistic clear
        set({
          items:     [],
          issues:    [],
          hasIssues: false,
          subtotal:  0,
          totalQty:  0,
        });

        // 2. Server sync
        try {
          await cartApi.clearCart();
        } catch (err) {
          // 3. Rollback
          set({
            items:     snapshot.items,
            issues:    snapshot.issues,
            hasIssues: snapshot.issues.length > 0,
            subtotal:  snapshot.subtotal,
            totalQty:  snapshot.totalQty,
            error:     err.message,
          });
        }
      },

      // ── UI helpers ──────────────────────────────────────────
      clearError: () => set({ error: null }),

      setError: (message) => set({ error: message }),

      resetStatus: () => set({ status: "idle", error: null }),
    }),

    // devtools config
    {
      name:    "CartStore",
      enabled: process.env.NODE_ENV === "development",
    }
  )
);

export default useCartStore;