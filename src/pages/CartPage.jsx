// pages/CartPage.jsx

import React, {
  useState, useEffect, useCallback,
  useMemo, useRef, memo,
} from "react";
import { useNavigate } from "react-router-dom";
import axios            from "axios";

import CartItem       from "./Cart/CartItem";
import OrderSummary   from "./Cart/OrderSummary";
import EmptyCart      from "./Cart/EmptyCart";
import RecentlyViewed from "./Cart/RecentlyViewed";
import YouMayAlsoLike from "./Cart/YouMayAlsoLike";
import Footer         from "../components/Footer";

import "../styles/Cart.css";

/* ── Constants ── */
const CART_KEY  = "mm_cart";
const SAVED_KEY = "mm_saved";
const CART_API  = "https://minimart-ivrm.onrender.com/api/cart";

const fmt = (n) =>
  `₦${Number(n ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

/* ── Helpers ── */
function authHeaders() {
  const token = localStorage.getItem("marketplace_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function loadLocal(key) {
  try   { return JSON.parse(localStorage.getItem(key) || "[]"); }
  catch { return []; }
}

function saveLocal(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

/* ── API ── */
const api = {
  fetch:     ()                        => axios.get(CART_API,                        { headers: authHeaders() }),
  addItem:   (productId, variantId, q) => axios.post(CART_API, { productId, variantId: variantId ?? null, qty: q ?? 1 }, { headers: authHeaders() }),
  updateQty: (id, qty)                 => axios.patch(`${CART_API}/${id}`, { qty },  { headers: authHeaders() }),
  remove:    (id)                      => axios.delete(`${CART_API}/${id}`,          { headers: authHeaders() }),
  clear:     ()                        => axios.delete(CART_API,                     { headers: authHeaders() }),
  saveItem:  (id)                      => axios.post(`${CART_API}/save/${id}`, {},   { headers: authHeaders() }),
  moveItem:  (id)                      => axios.post(`${CART_API}/move/${id}`, {},   { headers: authHeaders() }),
  getSaved:  ()                        => axios.get(`${CART_API}/saved`,             { headers: authHeaders() }),
  rmSaved:   (id)                      => axios.delete(`${CART_API}/saved/${id}`,    { headers: authHeaders() }),
  coupon:    (code, sub)               => axios.post(`${CART_API}/coupon`, { code, subtotal: sub }, { headers: authHeaders() }),
};

/* ── Toast ── */
const Toast = memo(function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`ct-toast ct-toast--${type}`} role="alert">
      <span>{msg}</span>
      <button onClick={onClose} aria-label="Dismiss">✕</button>
    </div>
  );
});

/* ── Saved Item Row ── */
const SavedRow = memo(function SavedRow({ item, onMove, onRemove }) {
  const [imgErr, setImgErr] = useState(false);
  const src = !imgErr
    ? (Array.isArray(item.images) ? item.images[0] : item.image ?? null)
    : null;

  return (
    <div className="ct-saved-item">
      <div className="ct-saved-img-wrap">
        {src
          ? <img src={src} alt={item.name} loading="lazy" onError={() => setImgErr(true)} />
          : <span>📦</span>}
      </div>
      <div className="ct-saved-info">
        <p className="ct-saved-name">{item.name}</p>
        <p className="ct-saved-price">{fmt(item.price)}</p>
      </div>
      <div className="ct-saved-actions">
        <button className="ct-saved-move" onClick={() => onMove(item.id)}>
          Move to Cart
        </button>
        <button className="ct-saved-remove" onClick={() => onRemove(item.id)}>
          Remove
        </button>
      </div>
    </div>
  );
});

/* ── Skeleton ── */
function Skeleton() {
  return (
    <div className="ct-layout" aria-busy="true">
      <div className="ct-items-col">
        {[1, 2, 3].map((i) => (
          <div key={i} className="ct-skeleton-item">
            <div className="ct-skeleton-img ct-shimmer" />
            <div className="ct-skeleton-lines">
              <div className="ct-skeleton-line ct-skeleton-line--wide ct-shimmer" />
              <div className="ct-skeleton-line ct-skeleton-line--mid  ct-shimmer" />
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

/* ── Price Changed Banner ── */
const PriceBanner = memo(function PriceBanner({ count, onDismiss }) {
  if (!count) return null;
  return (
    <div className="ct-price-changed-banner" role="alert">
      <p>{count} item{count > 1 ? "s" : ""} updated to current pricing.</p>
      <button onClick={onDismiss} aria-label="Dismiss">✕</button>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   CART PAGE
════════════════════════════════════════════════════════════ */
export default function CartPage({ user }) {
  const navigate = useNavigate();

  /* ── State ── */
  const [items,         setItems]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [savedItems,    setSavedItems]    = useState([]);
  const [priceChanges,  setPriceChanges]  = useState(0);
  const [toast,         setToast]         = useState(null);

  // Coupon
  const [showCoupon,    setShowCoupon]    = useState(false);
  const [couponCode,    setCouponCode]    = useState("");
  const [couponApplied, setCouponApplied] = useState(null);
  const [couponError,   setCouponError]   = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  /* ── Refs ── */
  const qtyTimers = useRef({});

  /* ── Toast helper ── */
  const notify = useCallback((msg, type = "error") => setToast({ msg, type }), []);

  /* ── Fetch ── */
  const fetchCart = useCallback(async () => {
    if (!user) {
      setItems(loadLocal(CART_KEY));
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.fetch();
      setItems(data.data?.items ?? []);
      setPriceChanges(data.data?.priceChanges ?? 0);
    } catch {
      setItems(loadLocal(CART_KEY));
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchSaved = useCallback(async () => {
    if (!user) { setSavedItems(loadLocal(SAVED_KEY)); return; }
    try {
      const { data } = await api.getSaved();
      setSavedItems(data.data ?? []);
    } catch { /* non-critical */ }
  }, [user]);

  useEffect(() => { fetchCart(); fetchSaved(); }, [fetchCart, fetchSaved]);

  /* ── Guest persistence ── */
  useEffect(() => {
    if (!user) {
      saveLocal(CART_KEY, items);
      window.dispatchEvent(new Event("cart-updated"));
    }
  }, [items, user]);

  /* ── Derived ── */
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

  const discount   = couponApplied?.discount ?? 0;
  const grandTotal = Math.max(0, subtotal - discount);

  /* ══════════════════════════════════════════════════════
     updateQty — FIXED: no stale closure rollback
  ══════════════════════════════════════════════════════ */
  const updateQty = useCallback((id, delta) => {
    let newQty;

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const max = Number.isFinite(item.stock) && item.stock > 0
          ? item.stock : 99;
        newQty = Math.max(1, Math.min(max, item.qty + delta));
        return { ...item, qty: newQty };
      })
    );

    if (!user || newQty == null) return;

    // Debounce API call — only fires after user stops clicking
    clearTimeout(qtyTimers.current[id]);
    qtyTimers.current[id] = setTimeout(async () => {
      try {
        await api.updateQty(id, newQty);
      } catch {
        // On failure: refetch server state (not stale closure)
        try {
          const { data } = await api.fetch();
          setItems(data.data?.items ?? []);
        } catch {
          notify("Failed to update quantity");
        }
      }
    }, 500);
  }, [user, notify]);

  /* ── removeItem ── */
  const removeItem = useCallback(async (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (user) {
      try { await api.remove(id); }
      catch { fetchCart(); notify("Failed to remove item"); }
    }
    window.dispatchEvent(new Event("cart-updated"));
  }, [user, fetchCart, notify]);

  /* ── saveForLater ── */
  const saveForLater = useCallback(async (id) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    if (user) {
      try {
        await api.saveItem(id);
        await fetchSaved();
      } catch {
        notify("Failed to save item");
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
  }, [items, user, fetchSaved, removeItem, notify]);

  /* ── moveToCart ── */
  const moveToCart = useCallback(async (id) => {
    if (user) {
      try {
        await api.moveItem(id);
        await fetchCart();
        setSavedItems((prev) => prev.filter((s) => s.id !== id));
      } catch { notify("Failed to move item"); }
    } else {
      const item = savedItems.find((s) => s.id === id);
      if (!item) return;
      setItems((prev) => prev.find((i) => i.id === id) ? prev : [...prev, { ...item, qty: 1 }]);
      setSavedItems((prev) => {
        const next = prev.filter((s) => s.id !== id);
        saveLocal(SAVED_KEY, next);
        return next;
      });
    }
  }, [user, savedItems, fetchCart, notify]);

  /* ── removeSaved ── */
  const removeSaved = useCallback(async (id) => {
    setSavedItems((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (!user) saveLocal(SAVED_KEY, next);
      return next;
    });
    if (user) {
      try { await api.rmSaved(id); } catch {}
    }
  }, [user]);

  /* ── clearCart ── */
  const clearCart = useCallback(() => {
    const backup = items;
    setItems([]);
    if (user) {
      api.clear().catch(() => {
        setItems(backup);
        notify("Failed to clear cart");
      });
    }
    window.dispatchEvent(new Event("cart-updated"));
  }, [items, user, notify]);

  /* ── Coupon ── */
  const applyCoupon = useCallback(async () => {
    const code = couponCode.trim();
    if (!code) { setCouponError("Enter a code"); return; }
    setCouponLoading(true);
    setCouponError("");
    try {
      const { data } = await api.coupon(code, subtotal);
      if (data.success) {
        setCouponApplied(data.data);
      } else {
        setCouponError(data.message ?? "Invalid coupon");
      }
    } catch (err) {
      setCouponError(err.response?.data?.message ?? "Invalid coupon");
    } finally {
      setCouponLoading(false);
    }
  }, [couponCode, subtotal]);

  const removeCoupon = useCallback(() => {
    setCouponApplied(null);
    setCouponCode("");
    setCouponError("");
    setShowCoupon(false);
  }, []);

  // Clear coupon if cart empties
  useEffect(() => {
    if (couponApplied && subtotal === 0) removeCoupon();
  }, [subtotal, couponApplied, removeCoupon]);

  /* ── Add to cart (from suggestion/recent cards) ── */
  const handleAddToCart = useCallback(async (product) => {
    if (!user) {
      navigate("/auth", { state: { from: "/shop/cart" } });
      return;
    }
    try {
      await api.addItem(product.id ?? product.productId, product.variantId ?? null, 1);
      await fetchCart();
      window.dispatchEvent(new Event("cart-updated"));
      notify(`${product.name ?? "Item"} added`, "success");
    } catch (err) {
      notify(err.response?.data?.message ?? "Could not add item");
    }
  }, [user, navigate, fetchCart, notify]);

  /* ── Checkout ── */
  const handleCheckout = useCallback(() => {
    if (!user) { navigate("/auth", { state: { from: "/shop/cart" } }); return; }
    if (hasOutOfStock || activeItems.length === 0) return;
    navigate("/shop/checkout");
  }, [user, hasOutOfStock, activeItems.length, navigate]);

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */
  return (
    <div className="ct-page">

      {/* ── Toast ── */}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Header ── */}
      <header className="ct-topbar">
        <button className="ct-back-btn" onClick={() => navigate(-1)} aria-label="Go back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
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

      {/* ── Loading ── */}
      {loading ? (
        <Skeleton />

      /* ── Empty ── */}
      ) : items.length === 0 ? (
        <div className="ct-empty-state">
          <EmptyCart
            savedItems={savedItems}
            onMoveToCart={moveToCart}
            onRemoveSaved={removeSaved}
          />
          <div className="ct-empty-suggestions">
            <RecentlyViewed onAddToCart={handleAddToCart} />
            <YouMayAlsoLike cartItems={[]} onAddToCart={handleAddToCart} />
          </div>
        </div>

      /* ── Cart with items ── */
      ) : (
        <div className="ct-layout">

          {/* ── Left column ── */}
          <div className="ct-items-col">

            {/* Items */}
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

            {/* ── Coupon ── */}
            <div className="ct-coupon-section">
              {!showCoupon && !couponApplied && (
                <button className="ct-coupon-toggle" onClick={() => setShowCoupon(true)}>
                  Have a coupon code?
                </button>
              )}

              {showCoupon && !couponApplied && (
                <div className="ct-coupon-input-wrap">
                  <input
                    className="ct-coupon-input"
                    type="text"
                    placeholder="Enter code"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      setCouponError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                    autoFocus
                    disabled={couponLoading}
                  />
                  <button
                    className="ct-coupon-apply"
                    onClick={applyCoupon}
                    disabled={couponLoading}
                  >
                    {couponLoading ? "…" : "Apply"}
                  </button>
                  <button
                    className="ct-coupon-cancel"
                    onClick={() => { setShowCoupon(false); setCouponError(""); }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {couponError && <p className="ct-coupon-error">{couponError}</p>}

              {couponApplied && (
                <div className="ct-coupon-applied">
                  <span>
                    <strong>{couponApplied.code}</strong> — You save {fmt(couponApplied.discount)}
                  </span>
                  <button onClick={removeCoupon} aria-label="Remove coupon">✕</button>
                </div>
              )}
            </div>

            {/* ── Saved for later ── */}
            {savedItems.length > 0 && (
              <section className="ct-saved-section">
                <h3 className="ct-saved-title">
                  Saved for Later ({savedItems.length})
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

            {/* ── Suggestions ── */}
            <RecentlyViewed onAddToCart={handleAddToCart} />
            <YouMayAlsoLike cartItems={items} onAddToCart={handleAddToCart} />

          </div>

          {/* ── Right column ── */}
          <aside className="ct-summary-col">
            <OrderSummary
              itemCount={itemCount}
              subtotal={subtotal}
              discount={discount}
              grandTotal={grandTotal}
              couponApplied={couponApplied}
              hasOutOfStock={hasOutOfStock}
              onCheckout={handleCheckout}
              user={user}
            />
          </aside>
        </div>
      )}

      {/* ── Mobile sticky bar ── */}
      {!loading && items.length > 0 && (
        <div className="ct-sticky-bar">
          <div className="ct-sticky-info">
            <span className="ct-sticky-count">
              {itemCount} item{itemCount !== 1 ? "s" : ""}
            </span>
            <span className="ct-sticky-total">{fmt(grandTotal)}</span>
          </div>
          <button
            className={`ct-checkout-btn ${hasOutOfStock ? "ct-checkout-btn--blocked" : ""}`}
            onClick={handleCheckout}
            disabled={hasOutOfStock || !user}
          >
            {!user
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