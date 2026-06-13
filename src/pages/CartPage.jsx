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

const CART_KEY = "mm_cart";
const SAVED_KEY = "mm_saved";
const CART_API = "https://minimart-ivrm.onrender.com/api/cart";

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
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function saveLocal(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function syncCartEvent() {
  window.dispatchEvent(new Event("cart-updated"));
}

const cartApi = {
  fetch: () => axios.get(CART_API, { headers: authHeaders() }),
  addItem: (productId, variantId, qty) =>
    axios.post(
      CART_API,
      { productId, variantId: variantId ?? null, qty: qty ?? 1 },
      { headers: authHeaders() }
    ),
  updateQty: (id, qty) =>
    axios.patch(`${CART_API}/${id}`, { qty }, { headers: authHeaders() }),
  remove: (id) =>
    axios.delete(`${CART_API}/${id}`, { headers: authHeaders() }),
  clear: () => axios.delete(CART_API, { headers: authHeaders() }),
  saveItem: (id) =>
    axios.post(`${CART_API}/save/${id}`, {}, { headers: authHeaders() }),
  moveItem: (id) =>
    axios.post(`${CART_API}/move/${id}`, {}, { headers: authHeaders() }),
  getSaved: () =>
    axios.get(`${CART_API}/saved`, { headers: authHeaders() }),
  rmSaved: (id) =>
    axios.delete(`${CART_API}/saved/${id}`, { headers: authHeaders() }),
};

const Toast = memo(function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={"ct-toast ct-toast--" + type} role="alert">
      <span>{msg}</span>
      <button onClick={onClose} aria-label="Dismiss">✕</button>
    </div>
  );
});

const PriceBanner = memo(function PriceBanner({ count, onDismiss }) {
  if (!count) return null;
  return (
    <div className="ct-price-changed-banner" role="alert">
      <p>{count} item{count > 1 ? "s" : ""} updated to current pricing.</p>
      <button onClick={onDismiss} aria-label="Dismiss">✕</button>
    </div>
  );
});

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
          <div className="ct-saved-img-empty" />
        )}
      </div>
      <div className="ct-saved-info">
        <p className="ct-saved-name">{item.name}</p>
        <p className="ct-saved-price">{fmt(item.price)}</p>
      </div>
      <div className="ct-saved-actions">
        <button className="ct-saved-move" onClick={() => onMove(item.id)}>Move to Cart</button>
        <button className="ct-saved-remove" onClick={() => onRemove(item.id)}>Remove</button>
      </div>
    </div>
  );
});

function CartSkeleton() {
  return (
    <div className="ct-layout" aria-busy="true">
      <div className="ct-items-col">
        {[1, 2, 3].map((i) => (
          <div key={i} className="ct-skeleton-item">
            <div className="ct-skeleton-img ct-shimmer" />
            <div className="ct-skeleton-lines">
              <div className="ct-skeleton-line ct-skeleton-line--wide ct-shimmer" />
              <div className="ct-skeleton-line ct-skeleton-line--mid ct-shimmer" />
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

export default function CartPage({ user }) {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedItems, setSavedItems] = useState([]);
  const [priceChanges, setPriceChanges] = useState(0);
  const [toast, setToast] = useState(null);
  const [checkingOut, setCheckingOut] = useState(false);

  // Track every in-flight qty update so checkout can wait for them
  const pendingUpdates = useRef(new Map());

  const notify = useCallback((msg, type = "error") => setToast({ msg, type }), []);

  const fetchCart = useCallback(async () => {
    if (!user) { setItems(loadLocal(CART_KEY)); setLoading(false); return; }
    try {
      const { data } = await cartApi.fetch();
      setItems(data.data?.items ?? []);
      setPriceChanges(data.data?.priceChanges ?? 0);
    } catch { setItems(loadLocal(CART_KEY)); }
    finally { setLoading(false); }
  }, [user]);

  const fetchSaved = useCallback(async () => {
    if (!user) { setSavedItems(loadLocal(SAVED_KEY)); return; }
    try { const { data } = await cartApi.getSaved(); setSavedItems(data.data ?? []); }
    catch {}
  }, [user]);

  useEffect(() => { fetchCart(); fetchSaved(); }, [fetchCart, fetchSaved]);

  useEffect(() => {
    if (!user) { saveLocal(CART_KEY, items); syncCartEvent(); }
  }, [items, user]);

  const activeItems = useMemo(
    () => items.filter((i) => !i.outOfStock && !i.unavailable), [items]
  );
  const subtotal = useMemo(
    () => activeItems.reduce((s, i) => s + Number(i.price) * i.qty, 0), [activeItems]
  );
  const itemCount = useMemo(
    () => activeItems.reduce((s, i) => s + i.qty, 0), [activeItems]
  );
  const hasOutOfStock = useMemo(
    () => items.some((i) => i.outOfStock || i.unavailable), [items]
  );
  const grandTotal = subtotal;

  // ── UPDATE QTY — fires API immediately, no debounce ──
  // Each click sends the absolute qty to the server right away.
  // We track in-flight requests so checkout can wait for them.
  const updateQty = useCallback((id, delta) => {
    let newQty;

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const hasTracking =
          item.stock !== null &&
          item.stock !== undefined &&
          Number.isFinite(item.stock);
        const max = hasTracking ? Math.max(item.stock, 1) : 99;
        newQty = Math.max(1, Math.min(max, item.qty + delta));
        return { ...item, qty: newQty };
      })
    );

    if (!user || newQty == null) return;

    // Fire API immediately — no debounce
    const promise = cartApi.updateQty(id, newQty).catch(() => {
      // If it fails, silently refetch to get correct state
      return cartApi.fetch().then(({ data }) => {
        setItems(data.data?.items ?? []);
      }).catch(() => {});
    });

    // Track this request so checkout can wait for it
    pendingUpdates.current.set(id, promise);
    promise.finally(() => {
      // Only clear if this is still the latest request for this item
      if (pendingUpdates.current.get(id) === promise) {
        pendingUpdates.current.delete(id);
      }
    });
  }, [user]);

  // ── REMOVE — instant ──
  const removeItem = useCallback((id) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      if (!user) saveLocal(CART_KEY, next);
      return next;
    });
    syncCartEvent();
    if (user) {
      cartApi.remove(id).catch(() => {});
    }
  }, [user]);

  const saveForLater = useCallback(async (id) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    if (user) {
      try { await cartApi.saveItem(id); await fetchSaved(); }
      catch { notify("Failed to save item"); return; }
    } else {
      setSavedItems((prev) => {
        if (prev.find((s) => s.id === id)) return prev;
        const next = [...prev, { ...item, savedAt: Date.now() }];
        saveLocal(SAVED_KEY, next);
        return next;
      });
    }
    removeItem(id);
  }, [items, user, fetchSaved, removeItem, notify]);

  const moveToCart = useCallback(async (id) => {
    if (user) {
      try {
        await cartApi.moveItem(id);
        await fetchCart();
        setSavedItems((p) => p.filter((s) => s.id !== id));
      } catch { notify("Failed to move item"); }
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
  }, [user, savedItems, fetchCart, notify]);

  const removeSaved = useCallback(async (id) => {
    setSavedItems((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (!user) saveLocal(SAVED_KEY, next);
      return next;
    });
    if (user) cartApi.rmSaved(id).catch(() => {});
  }, [user]);

  const clearCart = useCallback(() => {
    setItems([]);
    if (!user) saveLocal(CART_KEY, []);
    syncCartEvent();
    if (user) cartApi.clear().catch(() => {});
  }, [user]);

  const handleAddToCart = useCallback(async (product) => {
    if (!user) { navigate("/auth", { state: { from: "/shop/cart" } }); return; }
    try {
      await cartApi.addItem(product.id ?? product.productId, product.variantId ?? null, 1);
      await fetchCart();
      syncCartEvent();
      notify((product.name ?? "Item") + " added to cart", "success");
    } catch (err) {
      notify(err.response?.data?.message ?? "Could not add item");
    }
  }, [user, navigate, fetchCart, notify]);

  // ── CHECKOUT — waits for all pending qty updates ──
  const handleCheckout = useCallback(async () => {
    if (!user) { navigate("/auth", { state: { from: "/shop/cart" } }); return; }
    if (hasOutOfStock || activeItems.length === 0) return;

    // Wait for any in-flight qty updates to finish
    const pending = [...pendingUpdates.current.values()];
    if (pending.length > 0) {
      setCheckingOut(true);
      await Promise.allSettled(pending);
      setCheckingOut(false);
    }

    navigate("/shop/checkout");
  }, [user, hasOutOfStock, activeItems.length, navigate]);

  const checkoutLabel = () => {
    if (checkingOut) return "Saving changes…";
    if (!user) return "Login to Checkout";
    if (hasOutOfStock) return "Remove unavailable items";
    return "Proceed to Checkout";
  };

  const canCheckout = user && !hasOutOfStock && activeItems.length > 0 && !checkingOut;

  return (
    <div className="ct-page">
      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      <header className="ct-topbar">
        <button className="ct-back-btn" onClick={() => navigate(-1)} aria-label="Go back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="ct-topbar-center">
          <h1 className="ct-topbar-title">Cart</h1>
          {!loading && items.length > 0 && (
            <span className="ct-topbar-count">{items.length}</span>
          )}
        </div>
        {!loading && items.length > 0 && (
          <button className="ct-clear-btn" onClick={clearCart} aria-label="Clear cart">
            Clear
          </button>
        )}
      </header>

      <PriceBanner count={priceChanges} onDismiss={() => setPriceChanges(0)} />

      {loading ? (
        <CartSkeleton />
      ) : items.length === 0 ? (
        <div className="ct-empty-state">
          <EmptyCart savedItems={savedItems} onMoveToCart={moveToCart} onRemoveSaved={removeSaved} />
          <div className="ct-empty-suggestions">
            <RecentlyViewed onAddToCart={handleAddToCart} />
            <YouMayAlsoLike cartItems={[]} onAddToCart={handleAddToCart} />
          </div>
        </div>
      ) : (
        <div className="ct-layout">
          <div className="ct-items-col">
            <div className="ct-items-list">
              {items.map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  onUpdateQty={updateQty}
                  onRemove={removeItem}
                  onSaveForLater={saveForLater}
                />
              ))}
            </div>

            {savedItems.length > 0 && (
              <section className="ct-saved-section">
                <h3 className="ct-saved-title">Saved for Later ({savedItems.length})</h3>
                <div className="ct-saved-list">
                  {savedItems.map((item) => (
                    <SavedRow key={item.id} item={item} onMove={moveToCart} onRemove={removeSaved} />
                  ))}
                </div>
              </section>
            )}

            <div className="ct-inline-checkout">
              <div className="ct-inline-checkout-info">
                <span className="ct-inline-checkout-label">
                  Total ({itemCount} item{itemCount !== 1 ? "s" : ""})
                </span>
                <span className="ct-inline-checkout-price">{fmt(grandTotal)}</span>
              </div>
              {hasOutOfStock && (
                <p className="ct-inline-checkout-warn">
                  Remove out-of-stock items before checkout
                </p>
              )}
              <button
                className={"ct-inline-checkout-btn" + (!canCheckout ? " ct-inline-checkout-btn--disabled" : "")}
                onClick={handleCheckout}
                disabled={!canCheckout}
              >
                {checkoutLabel()}
              </button>
            </div>

            <RecentlyViewed onAddToCart={handleAddToCart} />
            <YouMayAlsoLike cartItems={items} onAddToCart={handleAddToCart} />
          </div>

          <aside className="ct-summary-col">
            <OrderSummary
              itemCount={itemCount}
              subtotal={subtotal}
              grandTotal={grandTotal}
              hasOutOfStock={hasOutOfStock}
              onCheckout={handleCheckout}
              user={user}
            />
          </aside>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="ct-sticky-bar">
          <div className="ct-sticky-info">
            <span className="ct-sticky-count">
              {itemCount} item{itemCount !== 1 ? "s" : ""}
            </span>
            <span className="ct-sticky-total">{fmt(grandTotal)}</span>
          </div>
          <button
            className={"ct-checkout-btn" + (!canCheckout ? " ct-checkout-btn--blocked" : "")}
            onClick={handleCheckout}
            disabled={!canCheckout}
          >
            {checkingOut ? "Saving…" : !user ? "Login to Checkout" : hasOutOfStock ? "Remove unavailable items" : "Checkout"}
          </button>
        </div>
      )}

      <Footer />
    </div>
  );
}