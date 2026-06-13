// pages/CartPage.jsx

import React, {
  useState, useEffect, useCallback,
  useMemo, useRef, memo,
} from "react";
import { useNavigate }   from "react-router-dom";
import axios             from "axios";

import CartItem          from "./Cart/CartItem";
import OrderSummary      from "./Cart/OrderSummary";
import EmptyCart         from "./Cart/EmptyCart";
import RecentlyViewed    from "./Cart/RecentlyViewed";
import YouMayAlsoLike    from "./Cart/YouMayAlsoLike";
import Footer            from "../components/Footer";

import "../styles/Cart.css";

// ── Constants ─────────────────────────────────────────────
const CART_KEY  = "mm_cart";
const SAVED_KEY = "mm_saved";
const API_BASE  = "https://minimart-ivrm.onrender.com/api";
const CART_API  = `${API_BASE}/cart`;

// ── Helpers ───────────────────────────────────────────────
const fmt = (n) =>
  `₦${Number(n ?? 0).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

function authHeaders() {
  const token = localStorage.getItem("marketplace_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function loadLocalCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
  catch { return []; }
}

function saveLocalCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("cart-updated"));
}

function loadLocalSaved() {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); }
  catch { return []; }
}

// ── API client ────────────────────────────────────────────
const cartApi = {
  fetch: () =>
    axios.get(CART_API, { headers: authHeaders() }),

  addItem: ({ productId, variantId = null, qty = 1 }) =>
    axios.post(
      CART_API,
      {
        productId,
        variantId: variantId ?? null,
        qty:       Math.max(1, parseInt(qty, 10) || 1),
      },
      { headers: authHeaders() }
    ),

  updateQty: (id, qty) => {
    if (!Number.isFinite(qty) || qty < 1) {
      return Promise.reject(new Error(`Invalid qty: ${qty}`));
    }
    return axios.patch(
      `${CART_API}/${id}`,
      { qty: Math.round(qty) },
      { headers: authHeaders() }
    );
  },

  remove:   (id) => axios.delete(`${CART_API}/${id}`,            { headers: authHeaders() }),
  clear:    ()   => axios.delete(CART_API,                        { headers: authHeaders() }),
  saveItem: (id) => axios.post(`${CART_API}/save/${id}`, {},      { headers: authHeaders() }),
  moveItem: (id) => axios.post(`${CART_API}/move/${id}`, {},      { headers: authHeaders() }),
  getSaved: ()   => axios.get(`${CART_API}/saved`,                { headers: authHeaders() }),
  rmSaved:  (id) => axios.delete(`${CART_API}/saved/${id}`,       { headers: authHeaders() }),
  coupon:   (code, subtotal) =>
    axios.post(`${CART_API}/coupon`, { code, subtotal },          { headers: authHeaders() }),
};

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

// ── Icons ────────────────────────────────────────────────
const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
    <path d="M19 12H5M12 5l-7 7 7 7" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </svg>
);

// ── Seller group header ──────────────────────────────────
const SellerGroupHeader = memo(function SellerGroupHeader({
  sellerName, itemCount, index,
}) {
  return (
    <div className="ct-seller-header">
      <div className="ct-seller-avatar" aria-hidden="true">🏪</div>
      <div className="ct-seller-info">
        <span className="ct-seller-name">
          {sellerName ?? `Store ${index + 1}`}
        </span>
        <span className="ct-seller-count">
          {itemCount} item{itemCount !== 1 ? "s" : ""}
        </span>
      </div>
      <span className="ct-seller-badge">✅ Verified Seller</span>
    </div>
  );
});

// ── Price changed banner ─────────────────────────────────
const PriceChangedBanner = memo(function PriceChangedBanner({
  count, onDismiss,
}) {
  if (!count) return null;
  return (
    <div className="ct-price-changed-banner" role="alert" aria-live="polite">
      <span aria-hidden="true">⚠️</span>
      <p>
        {count} item{count > 1 ? "s have" : " has"} updated pricing.
        Prices now reflect current values.
      </p>
      <button onClick={onDismiss} aria-label="Dismiss price change notice">
        ✕
      </button>
    </div>
  );
});

// ── Toast notification ───────────────────────────────────
const Toast = memo(function Toast({ message, type = "error", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`ct-toast ct-toast--${type}`}
      role="alert"
      aria-live="assertive"
    >
      <span>{message}</span>
      <button onClick={onClose} aria-label="Dismiss">✕</button>
    </div>
  );
});

// ── Saved item row ───────────────────────────────────────
const SavedItemRow = memo(function SavedItemRow({
  item, onMoveToCart, onRemoveSaved,
}) {
  const [imgErr,  setImgErr]  = useState(false);
  const [moving,  setMoving]  = useState(false);
  const [removing, setRemoving] = useState(false);

  const imgSrc = !imgErr
    ? (Array.isArray(item.images) ? item.images[0] : item.image ?? null)
    : null;

  const handleMove = useCallback(async () => {
    setMoving(true);
    try { await onMoveToCart(item.id); }
    finally { setMoving(false); }
  }, [item.id, onMoveToCart]);

  const handleRemove = useCallback(async () => {
    setRemoving(true);
    try { await onRemoveSaved(item.id); }
    finally { setRemoving(false); }
  }, [item.id, onRemoveSaved]);

  return (
    <div className="ct-saved-item">
      <div className="ct-saved-img-wrap">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={item.name}
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <span aria-hidden="true">📦</span>
        )}
      </div>
      <div className="ct-saved-info">
        <p className="ct-saved-name">{item.name}</p>
        {item.variant && (
          <p className="ct-saved-variant">{item.variant.name}</p>
        )}
        <p className="ct-saved-price">
          {fmt(item.price)}
        </p>
      </div>
      <div className="ct-saved-actions">
        <button
          className="ct-saved-move"
          onClick={handleMove}
          disabled={moving || removing}
          aria-label={`Move ${item.name} to cart`}
        >
          {moving
            ? <span className="ct-btn-spinner" aria-hidden="true" />
            : "Add to Cart"
          }
        </button>
        <button
          className="ct-saved-remove"
          onClick={handleRemove}
          disabled={moving || removing}
          aria-label={`Remove ${item.name} from saved`}
        >
          {removing
            ? <span className="ct-btn-spinner" aria-hidden="true" />
            : "Remove"
          }
        </button>
      </div>
    </div>
  );
});

// ── Skeleton ─────────────────────────────────────────────
function CartSkeleton() {
  return (
    <div className="ct-layout" aria-busy="true" aria-label="Loading cart">
      <div className="ct-items-col">
        {[1, 2, 3].map((i) => (
          <div key={i} className="ct-skeleton-item" aria-hidden="true">
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
        <div className="ct-skeleton-summary ct-shimmer" aria-hidden="true" />
      </div>
    </div>
  );
}

// ── Trust badges ─────────────────────────────────────────
const TRUST_BADGES = [
  { icon: "🔒", text: "Secure Payment"   },
  { icon: "🚚", text: "Managed Delivery" },
  { icon: "↩️",  text: "Easy Returns"    },
  { icon: "✅", text: "Verified Sellers" },
];

// ═══════════════════════════════════════════════════════════
// MAIN CART PAGE
// ═══════════════════════════════════════════════════════════
export default function CartPage({ user }) {
  const navigate = useNavigate();

  // ── Core state ─────────────────────────────────────────
  const [items,             setItems]             = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [savedItems,        setSavedItems]        = useState([]);
  const [selected,          setSelected]          = useState(new Set());
  const [priceChangedCount, setPriceChangedCount] = useState(0);
  const [toast,             setToast]             = useState(null); // { message, type }

  // ── Coupon state ───────────────────────────────────────
  const [showCoupon,    setShowCoupon]    = useState(false);
  const [couponCode,    setCouponCode]    = useState("");
  const [couponApplied, setCouponApplied] = useState(null);
  const [couponError,   setCouponError]   = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  // ── Add to cart state ──────────────────────────────────
  const [addingId, setAddingId] = useState(null);

  // ── Refs ───────────────────────────────────────────────
  const qtyTimers      = useRef({});
  const selectionReady = useRef(false);

  // ── Toast helpers ──────────────────────────────────────
  const showToast = useCallback((message, type = "error") => {
    setToast({ message, type });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  // ── Fetch cart ─────────────────────────────────────────
  const fetchCart = useCallback(async () => {
    if (!user) {
      const stored = loadLocalCart();
      setItems(stored);
      if (!selectionReady.current) {
        setSelected(new Set(stored.map((i) => i.id)));
        selectionReady.current = true;
      }
      setLoading(false);
      return;
    }

    try {
      const { data } = await cartApi.fetch();
      const serverItems = data.data?.items ?? [];
      setItems(serverItems);
      setPriceChangedCount(data.data?.priceChanges ?? 0);

      if (!selectionReady.current) {
        setSelected(new Set(serverItems.map((i) => i.id)));
        selectionReady.current = true;
      }
    } catch (err) {
      console.error("[CartPage] fetch cart:", err);
      const stored = loadLocalCart();
      setItems(stored);
      showToast("Could not load cart from server. Showing local cart.", "warning");
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  const fetchSaved = useCallback(async () => {
    if (!user) {
      setSavedItems(loadLocalSaved());
      return;
    }
    try {
      const { data } = await cartApi.getSaved();
      setSavedItems(data.data ?? []);
    } catch {
      // non-critical — silently fail
    }
  }, [user]);

  useEffect(() => {
    fetchCart();
    fetchSaved();
  }, [fetchCart, fetchSaved]);

  // ── Persist guests ─────────────────────────────────────
  useEffect(() => {
    if (!user) saveLocalCart(items);
  }, [items, user]);

  // ── Derived values ─────────────────────────────────────
  const sellerGroups = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const key = item.sellerId ?? "unknown";
      if (!map.has(key)) {
        map.set(key, {
          sellerId:   key,
          sellerName: item.sellerName ?? null,
          items:      [],
        });
      }
      map.get(key).items.push(item);
    });
    return [...map.values()];
  }, [items]);

  const selectedItems = useMemo(
    () => items.filter((i) => selected.has(i.id)),
    [items, selected]
  );

  const subtotal = useMemo(
    () => selectedItems.reduce(
      (sum, i) => sum + Number(i.price) * i.qty, 0
    ),
    [selectedItems]
  );

  const itemCount = useMemo(
    () => selectedItems.reduce((sum, i) => sum + i.qty, 0),
    [selectedItems]
  );

  const hasOutOfStock = useMemo(
    () => selectedItems.some((i) => i.outOfStock || i.unavailable),
    [selectedItems]
  );

  const allSelected = selected.size === items.length && items.length > 0;

  const discount   = couponApplied?.discount ?? 0;
  const grandTotal = Math.max(0, subtotal - discount);

  // ── updateQty — debounced ─────────────────────────────
  const updateQty = useCallback((id, delta) => {
    setItems((prev) => {
      const next = prev.map((item) => {
        if (item.id !== id) return item;
        const maxQ   = Number.isFinite(item.stock) && item.stock > 0
          ? item.stock
          : 99;
        const newQty = Math.max(1, Math.min(maxQ, item.qty + delta));
        return { ...item, qty: newQty };
      });

      if (user) {
        const updated = next.find((i) => i.id === id);
        if (updated) {
          clearTimeout(qtyTimers.current[id]);
          qtyTimers.current[id] = setTimeout(async () => {
            try {
              const res = await cartApi.updateQty(id, updated.qty);
              if (res.data?.data?.capped) {
                setItems((cur) =>
                  cur.map((i) =>
                    i.id === id
                      ? { ...i, qty: res.data.data.qty, stock: res.data.data.maxQty }
                      : i
                  )
                );
              }
            } catch {
              setItems(prev); // rollback
              showToast("Failed to update quantity. Please try again.");
            }
          }, 600);
        }
      }
      return next;
    });
  }, [user, showToast]);

  // ── removeItem ─────────────────────────────────────────
  const removeItem = useCallback((id) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      if (user) {
        cartApi.remove(id).catch(() => {
          setItems(prev);
          showToast("Failed to remove item.");
        });
      }
      return next;
    });
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [user, showToast]);

  // ── saveForLater ──────────────────────────────────────
  const saveForLater = useCallback(async (id) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    if (user) {
      try {
        await cartApi.saveItem(id);
        await fetchSaved();
      } catch {
        showToast("Failed to save item for later.");
        return;
      }
    } else {
      setSavedItems((prev) => {
        if (prev.find((s) => s.id === id)) return prev;
        const updated = [...prev, { ...item, savedAt: Date.now() }];
        localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
        return updated;
      });
    }
    removeItem(id);
  }, [items, user, fetchSaved, removeItem, showToast]);

  // ── moveToCart ─────────────────────────────────────────
  const moveToCart = useCallback(async (id) => {
    const item = savedItems.find((s) => s.id === id);
    if (!item) return;

    if (user) {
      try {
        await cartApi.moveItem(id);
        await fetchCart();
        setSavedItems((prev) => prev.filter((s) => s.id !== id));
      } catch {
        showToast("Failed to move item to cart.");
      }
    } else {
      setItems((prev) => {
        if (prev.find((i) => i.id === id)) return prev;
        return [...prev, { ...item, qty: 1 }];
      });
      setSavedItems((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
        return updated;
      });
      setSelected((prev) => new Set([...prev, id]));
    }
  }, [savedItems, user, fetchCart, showToast]);

  // ── removeSaved ────────────────────────────────────────
  const removeSaved = useCallback(async (id) => {
    setSavedItems((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      if (!user) localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
      return updated;
    });
    if (user) {
      try { await cartApi.rmSaved(id); }
      catch { showToast("Failed to remove saved item."); }
    }
  }, [user, showToast]);

  // ── clearCart ──────────────────────────────────────────
  const clearCart = useCallback(() => {
    const snapshot = items;
    setItems([]);
    setSelected(new Set());
    selectionReady.current = false;

    if (user) {
      cartApi.clear().catch(() => {
        setItems(snapshot);
        setSelected(new Set(snapshot.map((i) => i.id)));
        showToast("Failed to clear cart.");
      });
    }
  }, [items, user, showToast]);

  // ── selection ──────────────────────────────────────────
  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelected(
      allSelected
        ? new Set()
        : new Set(items.map((i) => i.id))
    );
  }, [allSelected, items]);

  // ── coupon ─────────────────────────────────────────────
  const applyCoupon = useCallback(async () => {
    const code = couponCode.trim();
    if (!code) { setCouponError("Enter a coupon code"); return; }

    setCouponLoading(true);
    setCouponError("");
    try {
      const { data } = await cartApi.coupon(code, subtotal);
      if (data.success) {
        setCouponApplied(data.data);
      } else {
        setCouponError(data.message ?? "Invalid coupon");
        setCouponApplied(null);
      }
    } catch (err) {
      setCouponError(
        err.response?.data?.message ?? "Invalid or expired coupon"
      );
      setCouponApplied(null);
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

  // Invalidate coupon if subtotal changes drastically
  useEffect(() => {
    if (couponApplied && subtotal === 0) removeCoupon();
  }, [subtotal, couponApplied, removeCoupon]);

  // ── handleAddToCart (for suggestions + recently viewed) ─
  const handleAddToCart = useCallback(async (product) => {
    if (!user) {
      navigate("/auth", { state: { from: "/shop/cart" } });
      return;
    }

    const productId = product.id ?? product.productId;
    const variantId = product.variantId ?? null;

    if (!productId || addingId === productId) return;

    setAddingId(productId);
    try {
      await cartApi.addItem({ productId, variantId, qty: 1 });
      await fetchCart();
      window.dispatchEvent(new Event("cart-updated"));
      showToast(`${product.name ?? "Item"} added to cart!`, "success");
    } catch (err) {
      showToast(
        err.response?.data?.message ?? "Could not add item. Try again."
      );
    } finally {
      setAddingId(null);
    }
  }, [user, navigate, addingId, fetchCart, showToast]);

  // ── checkout ───────────────────────────────────────────
  const handleCheckout = useCallback(() => {
    if (!user) {
      navigate("/auth", { state: { from: "/shop/cart" } });
      return;
    }
    if (hasOutOfStock || selectedItems.length === 0) return;
    navigate("/shop/checkout");
  }, [user, hasOutOfStock, selectedItems.length, navigate]);

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════
  return (
    <div className="ct-page">

      {/* ── Toast ── */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={dismissToast}
        />
      )}

      {/* ── Top bar ── */}
      <header className="ct-topbar">
        <button
          className="ct-back-btn"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <BackIcon />
        </button>

        <div className="ct-topbar-center">
          <h1 className="ct-topbar-title">My Cart</h1>
          {!loading && items.length > 0 && (
            <span className="ct-topbar-count" aria-live="polite">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {!loading && items.length > 0 && (
          <button
            className="ct-clear-btn"
            onClick={clearCart}
            aria-label="Clear all cart items"
            title="Clear cart"
          >
            <TrashIcon />
          </button>
        )}
      </header>

      {/* ── Price changed banner ── */}
      <PriceChangedBanner
        count={priceChangedCount}
        onDismiss={() => setPriceChangedCount(0)}
      />

      {/* ══════════════════════════════════════════════════
          LOADING
      ══════════════════════════════════════════════════ */}
      {loading ? (
        <CartSkeleton />

      /* ══════════════════════════════════════════════════
          EMPTY CART
      ══════════════════════════════════════════════════ */
      ) : items.length === 0 ? (
        <main className="ct-empty-state">
          <EmptyCart
            savedItems={savedItems}
            onMoveToCart={moveToCart}
            onRemoveSaved={removeSaved}
          />

          {/* ── Suggestions on empty cart ── */}
          <div className="ct-empty-suggestions">
            <RecentlyViewed onAddToCart={handleAddToCart} />
            <YouMayAlsoLike
              cartItems={[]}
              onAddToCart={handleAddToCart}
            />
          </div>
        </main>

      /* ══════════════════════════════════════════════════
          CART WITH ITEMS
      ══════════════════════════════════════════════════ */
      ) : (
        <main className="ct-layout">

          {/* ── LEFT — items column ── */}
          <div className="ct-items-col">

            {/* Select all row */}
            <div className="ct-select-row">
              <label className="ct-checkbox-label">
                <input
                  type="checkbox"
                  className="ct-checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label={
                    allSelected ? "Deselect all items" : "Select all items"
                  }
                />
                <span className="ct-checkbox-custom" aria-hidden="true" />
                <span>Select All ({items.length})</span>
              </label>

              {selected.size > 0 && selected.size < items.length && (
                <span className="ct-partial-selected" aria-live="polite">
                  {selected.size} of {items.length} selected
                </span>
              )}
            </div>

            {/* Seller groups */}
            {sellerGroups.map((group, idx) => (
              <section
                key={group.sellerId}
                className="ct-seller-group"
                aria-label={`Store ${idx + 1}`}
              >
                <SellerGroupHeader
                  sellerName={group.sellerName}
                  itemCount={group.items.length}
                  index={idx}
                />
                <div className="ct-group-items">
                  {group.items.map((item) => (
                    <CartItem
                      key={item.id}
                      item={item}
                      isSelected={selected.has(item.id)}
                      onToggleSelect={() => toggleSelect(item.id)}
                      onUpdateQty={updateQty}
                      onRemove={removeItem}
                      onSaveForLater={saveForLater}
                    />
                  ))}
                </div>
              </section>
            ))}

            {/* ── Coupon section ── */}
            <div className="ct-coupon-section">
              {!showCoupon && !couponApplied && (
                <button
                  className="ct-coupon-toggle"
                  onClick={() => setShowCoupon(true)}
                >
                  🏷️ Have a coupon code?
                </button>
              )}

              {showCoupon && !couponApplied && (
                <div className="ct-coupon-input-wrap">
                  <input
                    className="ct-coupon-input"
                    type="text"
                    placeholder="ENTER CODE"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      setCouponError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                    autoFocus
                    disabled={couponLoading}
                    aria-label="Coupon code"
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
                    onClick={() => {
                      setShowCoupon(false);
                      setCouponError("");
                    }}
                    aria-label="Cancel coupon"
                  >
                    ✕
                  </button>
                </div>
              )}

              {couponError && (
                <p className="ct-coupon-error" role="alert">
                  ⚠️ {couponError}
                </p>
              )}

              {couponApplied && (
                <div className="ct-coupon-applied" role="status">
                  <span>
                    🎉 <strong>{couponApplied.code}</strong>
                    {" — "}You save {fmt(couponApplied.discount)}
                  </span>
                  <button
                    onClick={removeCoupon}
                    aria-label="Remove coupon"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* ── Saved for later ── */}
            {savedItems.length > 0 && (
              <section
                className="ct-saved-section"
                aria-label="Saved for later"
              >
                <h3 className="ct-saved-title">
                  💾 Saved for Later ({savedItems.length})
                </h3>
                <div className="ct-saved-list">
                  {savedItems.map((item) => (
                    <SavedItemRow
                      key={item.id}
                      item={item}
                      onMoveToCart={moveToCart}
                      onRemoveSaved={removeSaved}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── Trust badges ── */}
            <div className="ct-trust-row" aria-label="Shopping guarantees">
              {TRUST_BADGES.map((b) => (
                <div key={b.text} className="ct-trust-item">
                  <span aria-hidden="true">{b.icon}</span>
                  <span>{b.text}</span>
                </div>
              ))}
            </div>

            {/* ════════════════════════════════════════════
                RECENTLY VIEWED + YOU MAY ALSO LIKE
                Full width below cart items
            ════════════════════════════════════════════ */}
            <RecentlyViewed onAddToCart={handleAddToCart} />

            <YouMayAlsoLike
              cartItems={items}
              onAddToCart={handleAddToCart}
            />

          </div>{/* end ct-items-col */}

          {/* ── RIGHT — order summary ── */}
          <aside className="ct-summary-col" aria-label="Order summary">
            <OrderSummary
              itemCount={itemCount}
              subtotal={subtotal}
              discount={discount}
              grandTotal={grandTotal}
              couponApplied={couponApplied}
              hasOutOfStock={hasOutOfStock}
              selectedCount={selectedItems.length}
              onCheckout={handleCheckout}
              user={user}
            />
          </aside>

        </main>
      )}

      {/* ── Mobile sticky checkout bar ── */}
      {!loading && items.length > 0 && selectedItems.length > 0 && (
        <div className="ct-sticky-bar" role="region" aria-label="Checkout">
          <div className="ct-sticky-info">
            <span className="ct-sticky-count">
              {itemCount} item{itemCount !== 1 ? "s" : ""}
            </span>
            <span className="ct-sticky-total">
              {fmt(grandTotal)}
            </span>
          </div>
          <button
            className={[
              "ct-checkout-btn",
              hasOutOfStock ? "ct-checkout-btn--blocked" : "",
            ].filter(Boolean).join(" ")}
            onClick={handleCheckout}
            disabled={hasOutOfStock}
            aria-label={
              !user
                ? "Login to checkout"
                : hasOutOfStock
                  ? "Remove out-of-stock items to proceed"
                  : `Checkout — ${fmt(grandTotal)}`
            }
          >
            {!user
              ? "🔒 Login to Checkout"
              : hasOutOfStock
                ? "⚠️ Remove out-of-stock items"
                : `Checkout →`
            }
          </button>
        </div>
      )}

      <Footer />
    </div>
  );
}