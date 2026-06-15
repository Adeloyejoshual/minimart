// src/features/cart/store/cartStore.js
import { create }   from "zustand";
import { devtools } from "zustand/middleware";
import { cartApi }  from "../api/cartApi";
import { calcCartTotals } from "../utils/cartHelpers";

function getToken() {
  return localStorage.getItem("marketplace_token") ?? null;
}

const useCartStore = create(
  devtools(
    (set, get) => ({

      // ── State ─────────────────────────────────────────────
      cartId:    null,
      userId:    null,
      items:     [],
      issues:    [],
      currency:  "USD",
      subtotal:  0,
      totalQty:  0,
      hasIssues: false,
      updatedAt: null,

      // "idle" | "loading" | "syncing" | "error" | "unauthenticated"
      status:    "idle",
      error:     null,

      // ── Computed ──────────────────────────────────────────
      getItemById(itemId) {
        return get().items.find((i) => i.id === itemId) ?? null;
      },

      // ── Internal ──────────────────────────────────────────
      _setCartData(data) {
        const { totalQty, subtotal } = calcCartTotals(data.items);
        set({
          cartId:    data.cart_id,
          userId:    data.user_id,
          items:     data.items    ?? [],
          issues:    data.issues   ?? [],
          currency:  data.currency ?? "USD",
          hasIssues: (data.issues  ?? []).length > 0,
          updatedAt: data.updated_at ?? null,
          subtotal,
          totalQty,
          status:    "idle",
          error:     null,
        });
      },

      // ── Actions ───────────────────────────────────────────

      fetchCart: async () => {
        // No token → show empty cart, not an error
        if (!getToken()) {
          set({
            status:    "unauthenticated",
            items:     [],
            issues:    [],
            subtotal:  0,
            totalQty:  0,
            hasIssues: false,
            error:     null,
          });
          return;
        }

        set({ status: "loading", error: null });

        try {
          const res = await cartApi.getCart();
          get()._setCartData(res.data);
        } catch (err) {
          // Token expired / invalid
          if (err.status === 401) {
            set({
              status:   "unauthenticated",
              items:    [],
              issues:   [],
              subtotal: 0,
              totalQty: 0,
              error:    null,
            });
            return;
          }

          set({
            status: "error",
            error:  err.message ?? "Failed to load cart",
          });
        }
      },

      addItem: async (productId, variantId = null, qty = 1) => {
        if (!getToken()) return;

        set({ status: "syncing", error: null });
        try {
          await cartApi.addItem(productId, variantId, qty);
          await get().fetchCart();
        } catch (err) {
          set({ status: "error", error: err.message });
          throw err;
        }
      },

      updateQty: async (itemId, newQty) => {
        if (!getToken()) return;

        const snapshot = {
          items:    get().items,
          subtotal: get().subtotal,
          totalQty: get().totalQty,
        };

        // Optimistic update
        const updatedItems = get().items.map((item) =>
          item.id === itemId ? { ...item, qty: newQty } : item
        );
        const { subtotal, totalQty } = calcCartTotals(updatedItems);
        set({ items: updatedItems, subtotal, totalQty });

        try {
          await cartApi.updateQty(itemId, newQty);
        } catch (err) {
          // Rollback
          set({
            items:    snapshot.items,
            subtotal: snapshot.subtotal,
            totalQty: snapshot.totalQty,
            error:    err.message,
          });
        }
      },

      removeItem: async (itemId) => {
        if (!getToken()) return;

        const snapshot = {
          items:    get().items,
          issues:   get().issues,
          subtotal: get().subtotal,
          totalQty: get().totalQty,
        };

        const filteredItems  = get().items.filter((i) => i.id !== itemId);
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

        try {
          await cartApi.removeItem(itemId);
        } catch (err) {
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

      clearCart: async () => {
        if (!getToken()) return;

        const snapshot = {
          items:    get().items,
          issues:   get().issues,
          subtotal: get().subtotal,
          totalQty: get().totalQty,
        };

        set({
          items:     [],
          issues:    [],
          hasIssues: false,
          subtotal:  0,
          totalQty:  0,
        });

        try {
          await cartApi.clearCart();
        } catch (err) {
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

      clearError:  () => set({ error: null }),
      resetStatus: () => set({ status: "idle", error: null }),
    }),

    {
      name:    "CartStore",
      enabled: process.env.NODE_ENV === "development",
    }
  )
);

export default useCartStore;