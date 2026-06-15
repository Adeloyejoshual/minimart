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

// ─────────────────────────────────────────────────────────────
// useCart — main hook, fetches cart on mount
// ─────────────────────────────────────────────────────────────
export function useCart() {
  const store = useCartStore();

  useEffect(() => {
    store.fetchCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    // State
    cartId:          store.cartId,
    items:           store.items,
    issues:          store.issues,
    currency:        store.currency,
    subtotal:        store.subtotal,
    totalQty:        store.totalQty,
    hasIssues:       store.hasIssues,
    status:          store.status,
    error:           store.error,

    // Derived
    isEmpty:         store.items.length === 0,
    isLoading:       store.status === "loading",
    isSyncing:       store.status === "syncing",
    isError:         store.status === "error",
    isUnauthenticated: store.status === "unauthenticated",

    // Actions
    fetchCart:       store.fetchCart,
    addItem:         store.addItem,
    updateQty:       store.updateQty,
    removeItem:      store.removeItem,
    clearCart:       store.clearCart,
    clearError:      store.clearError,
  };
}

// ─────────────────────────────────────────────────────────────
// useCartItem — per-item hook, granular subscription
// ─────────────────────────────────────────────────────────────
export function useCartItem(itemId) {
  const item = useCartStore(
    useCallback(
      (state) => state.items.find((i) => i.id === itemId) ?? null,
      [itemId]
    )
  );

  const updateQty  = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);

  const debouncedSync = useRef(
    debounce((id, qty) => {
      cartApi.updateQty(id, qty).catch(() => {});
    }, 600)
  );

  useEffect(() => {
    const sync = debouncedSync.current;
    return () => sync.cancel?.();
  }, []);

  const handleQtyChange = useCallback(
    (newQty) => {
      if (!item) return;
      const clamped = clampQty(newQty, item.live_stock);
      if (clamped === item.qty) return;
      updateQty(itemId, clamped);
      debouncedSync.current(itemId, clamped);
    },
    [item, itemId, updateQty]
  );

  const handleRemove = useCallback(async () => {
    await removeItem(itemId);
  }, [itemId, removeItem]);

  return { item, handleQtyChange, handleRemove };
}

// ─────────────────────────────────────────────────────────────
// useCartTotals — subscribes only to items + currency
// ─────────────────────────────────────────────────────────────
export function useCartTotals() {
  const items    = useCartStore((s) => s.items);
  const currency = useCartStore((s) => s.currency);

  const totals = useMemo(
    () => calcCartTotals(items),
    [items]
  );

  return { ...totals, currency };
}

// ─────────────────────────────────────────────────────────────
// useCartIssues
// ─────────────────────────────────────────────────────────────
export function useCartIssues() {
  const issues    = useCartStore((s) => s.issues);
  const hasIssues = useCartStore((s) => s.hasIssues);
  return { issues, hasIssues };
}

// ─────────────────────────────────────────────────────────────
// useCartStatus
// ─────────────────────────────────────────────────────────────
export function useCartStatus() {
  const status     = useCartStore((s) => s.status);
  const error      = useCartStore((s) => s.error);
  const clearError = useCartStore((s) => s.clearError);
  const fetchCart  = useCartStore((s) => s.fetchCart);

  return {
    status,
    error,
    isLoading:         status === "loading",
    isSyncing:         status === "syncing",
    isError:           status === "error",
    isIdle:            status === "idle",
    isUnauthenticated: status === "unauthenticated",
    clearError,
    retry: fetchCart,
  };
}

// ─────────────────────────────────────────────────────────────
// useCartBadge — nav badge (just total qty)
// ─────────────────────────────────────────────────────────────
export function useCartBadge() {
  return useCartStore((s) => s.totalQty);
}