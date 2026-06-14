// src/features/cart/hooks/useCart.js
import {
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import useCartStore          from "../store/cartStore";
import { cartApi }           from "../api/cartApi";
import {
  debounce,
  clampQty,
  calcCartTotals,
} from "../utils/cartHelpers";

/**
 * ─────────────────────────────────────────────────────────────
 * useCart
 * Main cart hook — use in CartPage
 * Fetches cart on mount, exposes all store state + actions
 * ─────────────────────────────────────────────────────────────
 */
export function useCart() {
  const store = useCartStore();

  useEffect(() => {
    store.fetchCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    // State
    cartId:    store.cartId,
    items:     store.items,
    issues:    store.issues,
    currency:  store.currency,
    subtotal:  store.subtotal,
    totalQty:  store.totalQty,
    hasIssues: store.hasIssues,
    status:    store.status,
    error:     store.error,

    // Derived
    isEmpty:   store.items.length === 0,
    isLoading: store.status === "loading",
    isSyncing: store.status === "syncing",
    isError:   store.status === "error",

    // Actions
    fetchCart:  store.fetchCart,
    addItem:    store.addItem,
    updateQty:  store.updateQty,
    removeItem: store.removeItem,
    clearCart:  store.clearCart,
    clearError: store.clearError,
  };
}

/**
 * ─────────────────────────────────────────────────────────────
 * useCartItem
 * Per-item hook — use inside CartItem component
 * Only subscribes to the specific item → avoids full re-renders
 *
 * @param {string} itemId - UUID of the cart item
 * ─────────────────────────────────────────────────────────────
 */
export function useCartItem(itemId) {
  // Granular subscription — only re-renders when THIS item changes
  const item = useCartStore(
    useCallback(
      (state) => state.items.find((i) => i.id === itemId) ?? null,
      [itemId]
    )
  );

  const updateQty  = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);

  // Debounced API sync (600ms after last change)
  // Keeps ref stable across renders
  const debouncedSync = useRef(
    debounce((id, qty) => {
      cartApi.updateQty(id, qty).catch(() => {
        // Errors handled by store rollback
      });
    }, 600)
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    const sync = debouncedSync.current;
    return () => sync.cancel?.();
  }, []);

  /**
   * Handle quantity change
   * 1. Clamp qty to valid range
   * 2. Optimistic update in store
   * 3. Debounced API sync
   */
  const handleQtyChange = useCallback(
    (newQty) => {
      if (!item) return;

      const clamped = clampQty(newQty, item.live_stock);
      if (clamped === item.qty) return;   // no change

      updateQty(itemId, clamped);               // optimistic
      debouncedSync.current(itemId, clamped);   // deferred API
    },
    [item, itemId, updateQty]
  );

  /**
   * Handle remove
   * Calls store.removeItem (handles optimistic + rollback)
   */
  const handleRemove = useCallback(async () => {
    await removeItem(itemId);
  }, [itemId, removeItem]);

  return {
    item,
    handleQtyChange,
    handleRemove,
  };
}

/**
 * ─────────────────────────────────────────────────────────────
 * useCartTotals
 * Subscribes only to items for total calculation
 * Avoids re-render on non-total state changes
 * ─────────────────────────────────────────────────────────────
 */
export function useCartTotals() {
  const items    = useCartStore((s) => s.items);
  const currency = useCartStore((s) => s.currency);

  const totals = useMemo(
    () => calcCartTotals(items),
    [items]
  );

  return {
    ...totals,
    currency,
  };
}

/**
 * ─────────────────────────────────────────────────────────────
 * useCartIssues
 * Subscribes only to issues array
 * ─────────────────────────────────────────────────────────────
 */
export function useCartIssues() {
  const issues    = useCartStore((s) => s.issues);
  const hasIssues = useCartStore((s) => s.hasIssues);

  return { issues, hasIssues };
}

/**
 * ─────────────────────────────────────────────────────────────
 * useCartStatus
 * Subscribes only to status + error
 * Use in loading/error states
 * ─────────────────────────────────────────────────────────────
 */
export function useCartStatus() {
  const status     = useCartStore((s) => s.status);
  const error      = useCartStore((s) => s.error);
  const clearError = useCartStore((s) => s.clearError);
  const fetchCart  = useCartStore((s) => s.fetchCart);

  return {
    status,
    error,
    isLoading: status === "loading",
    isSyncing: status === "syncing",
    isError:   status === "error",
    isIdle:    status === "idle",
    clearError,
    retry:     fetchCart,
  };
}

/**
 * ─────────────────────────────────────────────────────────────
 * useCartBadge
 * Lightweight hook for nav badge (just total qty)
 * Minimal re-renders
 * ─────────────────────────────────────────────────────────────
 */
export function useCartBadge() {
  return useCartStore((s) => s.totalQty);
}