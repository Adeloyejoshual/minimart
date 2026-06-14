import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import CartItem from "./Cart/CartItem";
import OrderSummary from "./Cart/OrderSummary";
import EmptyCart from "./Cart/EmptyCart";
import RecentlyViewed from "./Cart/RecentlyViewed";
import YouMayAlsoLike from "./Cart/YouMayAlsoLike";
import Footer from "../components/Footer";

import "../styles/Cart.css";

// ─── Constants ────────────────────────────────────────────────
const CART_KEY  = "mm_cart";
const SAVED_KEY = "mm_saved";
const CART_API  = "https://minimart-ivrm.onrender.com/api/cart";

// ─── Helpers ──────────────────────────────────────────────────
const fmt = (n) =>
  `₦${Number(n ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

function authHeaders() {
  const token = localStorage.getItem("marketplace_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function loadLocal(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); }
  catch { return []; }
}

function saveLocal(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function syncCartEvent() {
  window.dispatchEvent(new Event("cart-updated"));
}

// ─── API Layer ────────────────────────────────────────────────
const cartApi = {
  fetch:    ()          => axios.get(CART_API,                  { headers: authHeaders() }),
  addItem:  (pId, vId, qty) =>
    axios.post(CART_API, { productId: pId, variantId: vId ?? null, qty: qty ?? 1 },
               { headers: authHeaders() }),
  updateQty: (id, qty) => axios.patch(`${CART_API}/${id}`, { qty }, { headers: authHeaders() }),
  remove:   (id)        => axios.delete(`${CART_API}/${id}`,       { headers: authHeaders() }),
  clear:    ()          => axios.delete(CART_API,                  { headers: authHeaders() }),
  saveItem: (id)        => axios.post(`${CART_API}/save/${id}`, {}, { headers: authHeaders() }),
  moveItem: (id)        => axios.post(`${CART_API}/move/${id}`, {}, { headers: authHeaders() }),
  getSaved: ()          => axios.get(`${CART_API}/saved`,           { headers: authHeaders() }),
  rmSaved:  (id)        => axios.delete(`${CART_API}/saved/${id}`,  { headers: authHeaders() }),
};

// ─── Toast ────────────────────────────────────────────────────
const Toast = memo(function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`ct-toast ct-toast--${type}`} role="alert" aria-live="polite">
      <span>{msg}</span>
      <button onClick={onClose} aria-label="Dismiss">✕</button>
    </div>
  );
});

// ─── Price-change banner ──────────────────────────────────────
const PriceBanner = memo(function PriceBanner({ count, onDismiss }) {
  if (!count) return null;
  return (
    <div className="ct-price-changed-banner" role="alert">
      <p>
        {count} item{count > 1 ? "s have" : " has"} been updated to current pricing.
      </p>
      <button onClick={onDismiss} aria-label="Dismiss">✕</button>
    </div>
  );
});

// ─── Saved-for-later row ──────────────────────────────────────
const SavedRow = memo(function SavedRow({ item, onMove, onRemove }) {
  const [imgErr, setImgErr] = useState(false);
  const src = !imgErr
    ? (Array.isArray(item.images) ? item.images[0] : item.image ?? null)
    : null;

  return (
    <div className="ct-saved-item">
      <div className="ct-saved-img-wrap">
        {src ? (
          <img src={src} alt={item.name} loading="lazy" onError={() => setImgErr(true)} />
        ) : (
          <div className="ct-saved-img-empty" aria-hidden="true">📦</div>
        )}
      </div>
      <div className="ct-saved-info">
        <p className="ct-saved-name">{item.name}</p>
        {item.variant && (
          <p className="ct-saved-variant">{item.variant.name}</p>
        )}
        <p className="ct-saved-price">{fmt(item.price)}</p>
      </div>
      <div className="ct-saved-actions">
        <button className="ct-saved-move"   onClick={() => onMove(item.id)}>
          Move to Cart
        </button>
        <button className="ct-saved-remove" onClick={() => onRemove(item.id)}>
          Remove
        </button>
      </div>
    </div>
  );
});

// ─── Skeleton loader ──────────────────────────────────────────
function CartSkeleton() {
  return (
    <div className="ct-layout" aria-busy="true" aria-label="Loading cart">
      <div className="ct-items-col">
        {[1, 2, 3].map((i) => (
          <div key={i} className="ct-skeleton-item">
            <div className="ct-skeleton-img ct-shimmer" />
            <div className="ct-skeleton-lines">
              <div className="ct-skeleton-line ct-skeleton-line--wide  ct-shimmer" />
              <div className="ct-skeleton-line ct-skeleton-line--mid   ct-shimmer" />
              <div className="ct-skeleton-line ct-skeleton-line--short ct-shimmer" />
            </div>
          </div>
        ))}
      </div>
      <div className="ct-summary-col">
        <div className="ct-skeleton-summary ct-shimmer" />
      </div>
    </div>
  );
}

// ─── Free-shipping progress bar ───────────────────────────────
const FREE_SHIPPING_THRESHOLD = 15000; // ₦15,000

const ShippingBar = memo(function ShippingBar({ subtotal }) {
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const pct       = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
  const qualified = remaining === 0;

  return (
    <div className={`ct-shipping-bar ${qualified ? "ct-shipping-bar--done" : ""}`}>
      <p className="ct-shipping-bar__text">
        {qualified
          ? "🎉 You qualify for free shipping!"
          : `Add ${fmt(remaining)} more for free shipping`}
      </p>
      <div className="ct-shipping-bar__track" role="progressbar"
           aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="ct-shipping-bar__fill"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
});

// ─── Main CartPage ────────────────────────────────────────────
export default function CartPage({ user }) {
  const navigate = useNavigate();

  const [items,        setItems]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [savedItems,   setSavedItems]   = useState([]);
  const [priceChanges, setPriceChanges] = useState(0);
  const [toast,        setToast]        = useState(null);
  const [checkingOut,  setCheckingOut]  = useState(false);
  const [retrying,     setRetrying]     = useState(false);

  // Track in-flight qty updates so checkout can await them
  const pendingUpdates = useRef(new Map());
  const isMounted      = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const notify = useCallback(
    (msg, type = "error") => setToast({ msg, type }),
    []
  );

  // ── Fetch ─────────────────────────────────────────────────
  const fetchCart = useCallback(async () => {
    if (!user) {
      setItems(loadLocal(CART_KEY));
      setLoading(false);
      return;
    }
    try {
      const { data } = await cartApi.fetch();
      if (!isMounted.current) return;
      setItems(data.data?.items ?? []);
      setPriceChanges(data.data?.priceChanges ?? 0);
    } catch {
      if (isMounted.current) setItems(loadLocal(CART_KEY));
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [user]);

  const fetchSaved = useCallback(async () => {
    if (!user) { setSavedItems(loadLocal(SAVED_KEY)); return; }
    try {
      const { data } = await cartApi.getSaved();
      if (isMounted.current) setSavedItems(data.data ?? []);
    } catch {}
  }, [user]);

  useEffect(() => {
    fetchCart();
    fetchSaved();
  }, [fetchCart, fetchSaved]);

  // Persist guest cart
  useEffect(() => {
    if (!user) { saveLocal(CART_KEY, items); syncCartEvent(); }
  }, [items, user]);

  // ── Derived state ─────────────────────────────────────────
  const activeItems = useMemo(
    () => items.filter((i) => !i.outOfStock && !i.unavailable),
    [items]
  );

  const subtotal = useMemo(
    () => activeItems.reduce((s, i) => s + Number(i.price) * i.qty, 0),
    [activeItems]
  );

  const itemCount = useMemo(
    () => activeItems.reduce((s, i) => s + i.qty, 0),
    [activeItems]
  );

  const hasOutOfStock = useMemo(
    () => items.some((i) => i.outOfStock || i.unavailable),
    [items]
  );

  const canCheckout =
    user && !hasOutOfStock && activeItems.length > 0 && !checkingOut;

  // ── Update qty ────────────────────────────────────────────
  const updateQty = useCallback((id, delta) => {
    let newQty;

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const max = Number.isFinite(item.stock) ? Math.max(item.stock, 1) : 99;
        const next = Math.max(1, Math.min(max, item.qty + delta));
        if (next === item.qty) return item; // no-op guard
        newQty = next;
        return { ...item, qty: next };
      })
    );

    if (!user || newQty == null) return;

    const promise = cartApi
      .updateQty(id, newQty)
      .catch(() =>
        cartApi.fetch().then(({ data }) => {
          if (isMounted.current) setItems(data.data?.items ?? []);
        }).catch(() => {})
      );

    pendingUpdates.current.set(id, promise);
    promise.finally(() => {
      if (pendingUpdates.current.get(id) === promise) {
        pendingUpdates.current.delete(id);
      }
    });
  }, [user]);

  // ── Remove ────────────────────────────────────────────────
  const removeItem = useCallback((id) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      if (!user) saveLocal(CART_KEY, next);
      return next;
    });
    syncCartEvent();
    if (user) cartApi.remove(id).catch(() => {});
  }, [user]);

  // ── Save for later ────────────────────────────────────────
  const saveForLater = useCallback(async (id) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    if (user) {
      try {
        await cartApi.saveItem(id);
        await fetchSaved();
      } catch {
        notify("Failed to save item. Please try again.");
        return;
      }
    } else {
      setSavedItems((prev) => {
        if (prev.find((s) => s.id === id)) return prev;
        const next = [...prev, { ...item, savedAt: Date.now() }];
        saveLocal(SAVED_KEY, next);
        return next;
      });
    }
    removeItem(id);
    notify(`"${item.name}" saved for later`, "success");
  }, [items, user, fetchSaved, removeItem, notify]);

  // ── Move to cart ──────────────────────────────────────────
  const moveToCart = useCallback(async (id) => {
    if (user) {
      try {
        await cartApi.moveItem(id);
        await Promise.all([fetchCart(), fetchSaved()]);
        setSavedItems((p) => p.filter((s) => s.id !== id));
        notify("Item moved to cart", "success");
      } catch {
        notify("Failed to move item. Please try again.");
      }
    } else {
      const item = savedItems.find((s) => s.id === id);
      if (!item) return;
      setItems((prev) =>
        prev.find((i) => i.id === id) ? prev : [...prev, { ...item, qty: 1 }]
      );
      setSavedItems((prev) => {
        const next = prev.filter((s) => s.id !== id);
        saveLocal(SAVED_KEY, next);
        return next;
      });
    }
  }, [user, savedItems, fetchCart, fetchSaved, notify]);

  // ── Remove saved ──────────────────────────────────────────
  const removeSaved = useCallback(async (id) => {
    setSavedItems((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (!user) saveLocal(SAVED_KEY, next);
      return next;
    });
    if (user) cartApi.rmSaved(id).catch(() => {});
  }, [user]);

  // ── Clear cart ────────────────────────────────────────────
  const clearCart = useCallback(() => {
    setItems([]);
    if (!user) saveLocal(CART_KEY, []);
    syncCartEvent();
    if (user) cartApi.clear().catch(() => {});
    notify("Cart cleared", "info");
  }, [user, notify]);

  // ── Add to cart ───────────────────────────────────────────
  const handleAddToCart = useCallback(async (product) => {
    if (!user) {
      navigate("/auth", { state: { from: "/shop/cart" } });
      return;
    }
    try {
      await cartApi.addItem(
        product.id ?? product.productId,
        product.variantId ?? null,
        1
      );
      await fetchCart();
      syncCartEvent();
      notify(`"${product.name ?? "Item"}" added to cart`, "success");
    } catch (err) {
      notify(err.response?.data?.message ?? "Could not add item. Try again.");
    }
  }, [user, navigate, fetchCart, notify]);

  // ── Checkout ──────────────────────────────────────────────
  const handleCheckout = useCallback(async () => {
    if (!user) {
      navigate("/auth", { state: { from: "/shop/cart" } });
      return;
    }
    if (hasOutOfStock || activeItems.length === 0) return;

    // Await any in-flight qty updates
    const pending = [...pendingUpdates.current.values()];
    if (pending.length > 0) {
      setCheckingOut(true);
      await Promise.allSettled(pending);
      if (!isMounted.current) return;
      setCheckingOut(false);
    }

    navigate("/shop/checkout");
  }, [user, hasOutOfStock, activeItems.length, navigate]);

  // ── Retry fetch ───────────────────────────────────────────
  const handleRetry = useCallback(async () => {
    setRetrying(true);
    await fetchCart();
    setRetrying(false);
  }, [fetchCart]);

  // ── Checkout button label ─────────────────────────────────
  const checkoutLabel = useMemo(() => {
    if (checkingOut)       return "Saving changes…";
    if (!user)             return "Login to Checkout";
    if (hasOutOfStock)     return "Remove unavailable items";
    if (activeItems.length === 0) return "Cart is empty";
    return "Proceed to Checkout";
  }, [checkingOut, user, hasOutOfStock, activeItems.length]);

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="ct-page">

      {/* Toast */}
      {toast && (
        <Toast
          msg={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Top bar */}
      <header className="ct-topbar">
        <button
          className="ct-back-btn"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>

        <div className="ct-topbar-center">
          <h1 className="ct-topbar-title">My Cart</h1>
          {!loading && items.length > 0 && (
            <span className="ct-topbar-count">{items.length}</span>
          )}
        </div>

        {!loading && items.length > 0 && (
          <button
            className="ct-clear-btn"
            onClick={clearCart}
            aria-label="Clear cart"
          >
            Clear all
          </button>
        )}
      </header>

      {/* Price-change banner */}
      <PriceBanner
        count={priceChanges}
        onDismiss={() => setPriceChanges(0)}
      />

      {/* Main content */}
      {loading ? (
        <CartSkeleton />
      ) : items.length === 0 ? (
        /* ── Empty state ── */
        <div className="ct-empty-state">
          <EmptyCart
            savedItems={savedItems}
            onMoveToCart={moveToCart}
            onRemoveSaved={removeSaved}
          />
          <div className="ct-empty-suggestions">
            <RecentlyViewed onAddToCart={handleAddToCart} />
            <YouMayAlsoLike
              cartItems={[]}
              onAddToCart={handleAddToCart}
            />
          </div>
        </div>
      ) : (
        /* ── Cart with items ── */
        <div className="ct-layout">

          {/* Left column */}
          <div className="ct-items-col">

            {/* Free-shipping progress */}
            <ShippingBar subtotal={subtotal} />

            {/* Item list */}
            <div className="ct-items-list" role="list" aria-label="Cart items">
              {items.map((item) => (
                <div key={item.id} role="listitem">
                  <CartItem
                    item={item}
                    onUpdateQty={updateQty}
                    onRemove={removeItem}
                    onSaveForLater={saveForLater}
                  />
                </div>
              ))}
            </div>

            {/* Saved for later */}
            {savedItems.length > 0 && (
              <section className="ct-saved-section" aria-label="Saved for later">
                <h3 className="ct-saved-title">
                  Saved for Later
                  <span className="ct-saved-badge">{savedItems.length}</span>
                </h3>
                <div className="ct-saved-list">
                  {savedItems.map((item) => (
                    <SavedRow
                      key={item.id}
                      item={item}
                      onMove={moveToCart}
                      onRemove={removeSaved}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Inline checkout (mobile) */}
            <div className="ct-inline-checkout">
              <div className="ct-inline-checkout-info">
                <span className="ct-inline-checkout-label">
                  Total ({itemCount} item{itemCount !== 1 ? "s" : ""})
                </span>
                <span className="ct-inline-checkout-price">
                  {fmt(subtotal)}
                </span>
              </div>

              {hasOutOfStock && (
                <p className="ct-inline-checkout-warn" role="alert">
                  ⚠️ Remove out-of-stock items before checkout
                </p>
              )}

              <button
                className={`ct-inline-checkout-btn${!canCheckout ? " ct-inline-checkout-btn--disabled" : ""}`}
                onClick={handleCheckout}
                disabled={!canCheckout}
                aria-disabled={!canCheckout}
              >
                {checkoutLabel}
              </button>
            </div>

            {/* Suggestions */}
            <RecentlyViewed onAddToCart={handleAddToCart} />
            <YouMayAlsoLike
              cartItems={items}
              onAddToCart={handleAddToCart}
            />
          </div>

          {/* Right column — order summary (desktop) */}
          <aside className="ct-summary-col" aria-label="Order summary">
            <OrderSummary
              itemCount={itemCount}
              subtotal={subtotal}
              grandTotal={subtotal}
              hasOutOfStock={hasOutOfStock}
              onCheckout={handleCheckout}
              user={user}
              checkingOut={checkingOut}
            />
          </aside>
        </div>
      )}

      {/* Sticky bottom bar (mobile) */}
      {!loading && items.length > 0 && (
        <div className="ct-sticky-bar" role="complementary">
          <div className="ct-sticky-info">
            <span className="ct-sticky-count">
              {itemCount} item{itemCount !== 1 ? "s" : ""}
            </span>
            <span className="ct-sticky-total">{fmt(subtotal)}</span>
          </div>
          <button
            className={`ct-checkout-btn${!canCheckout ? " ct-checkout-btn--blocked" : ""}`}
            onClick={handleCheckout}
            disabled={!canCheckout}
            aria-disabled={!canCheckout}
          >
            {checkingOut
              ? "Saving…"
              : !user
              ? "Login to Checkout"
              : hasOutOfStock
              ? "Remove unavailable items"
              : "Checkout"}
          </button>
        </div>
      )}

      <Footer />
    </div>
  );
}