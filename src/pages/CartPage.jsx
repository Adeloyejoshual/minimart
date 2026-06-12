// pages/CartPage.jsx
// Only showing the CHANGED parts — merge with your existing file

import React, {
  useState, useEffect, useCallback,
  useMemo, useRef, memo,
} from "react";
import { useNavigate }  from "react-router-dom";
import axios            from "axios";

import CartItem          from "./Cart/CartItem";
import OrderSummary      from "./Cart/OrderSummary";
import EmptyCart         from "./Cart/EmptyCart";
import RecentlyViewed    from "./Cart/RecentlyViewed";      // ← NEW
import YouMayAlsoLike    from "./Cart/YouMayAlsoLike";      // ← NEW
import Footer            from "../components/Footer";       // ← NEW

import "../styles/Cart.css";

/* ── Constants ── */
const CART_KEY  = "mm_cart";
const SAVED_KEY = "mm_saved";
const CART_API  = "https://minimart-ivrm.onrender.com/api/cart";

/* ── localStorage helpers (guests) ── */
function loadCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
  catch { return []; }
}
function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("cart-updated"));
}

/* ── Auth headers ── */
function authHeaders() {
  const token = localStorage.getItem("marketplace_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ── API wrappers matching your actual backend routes ── */
const cartApi = {
  fetch:     ()        => axios.get(CART_API,                                { headers: authHeaders() }),
  addItem:   (body)    => axios.post(`${CART_API}`,         body,            { headers: authHeaders() }),
  updateQty: (id, qty) => axios.patch(`${CART_API}/${id}`,  { qty },         { headers: authHeaders() }),
  remove:    (id)      => axios.delete(`${CART_API}/${id}`,                  { headers: authHeaders() }),
  clear:     ()        => axios.delete(CART_API,                             { headers: authHeaders() }),
  saveItem:  (id)      => axios.post(`${CART_API}/save/${id}`,   {},         { headers: authHeaders() }),
  moveItem:  (id)      => axios.post(`${CART_API}/move/${id}`,   {},         { headers: authHeaders() }),
  getSaved:  ()        => axios.get(`${CART_API}/saved`,                     { headers: authHeaders() }),
  rmSaved:   (id)      => axios.delete(`${CART_API}/saved/${id}`,            { headers: authHeaders() }),
  coupon:    (code, subtotal) => axios.post(
    `${CART_API}/coupon`, { code, subtotal }, { headers: authHeaders() }
  ),
};

/* ── Icons ── */
const Icon = {
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
      <path d="M19 12H5M12 5l-7 7 7 7"/>
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
  ),
};

/* ── Seller group header (no seller name shown) ── */
const SellerGroupHeader = memo(function SellerGroupHeader({
  itemCount,
  index,
}) {
  return (
    <div className="ct-seller-header">
      <div className="ct-seller-avatar" aria-hidden="true">
        🏪
      </div>
      <div className="ct-seller-info">
        <span className="ct-seller-name">
          Store {index + 1}
        </span>
        <span className="ct-seller-count">
          {itemCount} item{itemCount !== 1 ? "s" : ""}
        </span>
      </div>
      <span className="ct-seller-badge">
        ✅ Verified Seller
      </span>
    </div>
  );
});

/* ── Price changed banner ── */
const PriceChangedBanner = memo(function PriceChangedBanner({
  count, onDismiss,
}) {
  if (!count) return null;
  return (
    <div className="ct-price-changed-banner" role="alert">
      <span aria-hidden="true">⚠️</span>
      <p>
        {count} item{count > 1 ? "s have" : " has"} updated pricing.
        Prices now reflect current values.
      </p>
      <button onClick={onDismiss} aria-label="Dismiss">✕</button>
    </div>
  );
});

/* ── Skeleton ── */
function CartSkeleton() {
  return (
    <div className="ct-layout">
      <div className="ct-items-col">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="ct-skeleton-item" aria-hidden="true">
            <div className="ct-skeleton-img" />
            <div className="ct-skeleton-lines">
              <div className="ct-skeleton-line ct-skeleton-line--wide" />
              <div className="ct-skeleton-line ct-skeleton-line--mid" />
              <div className="ct-skeleton-line ct-skeleton-line--short" />
            </div>
          </div>
        ))}
      </div>
      <div className="ct-summary-col">
        <div className="ct-skeleton-summary" />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN CART PAGE
════════════════════════════════════════════════════════════ */
export default function CartPage({ user }) {
  const navigate = useNavigate();

  const [items,             setItems]             = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [savedItems,        setSavedItems]        = useState([]);
  const [priceChangedCount, setPriceChangedCount] = useState(0);
  const [showCoupon,        setShowCoupon]        = useState(false);
  const [couponCode,        setCouponCode]        = useState("");
  const [couponApplied,     setCouponApplied]     = useState(null);
  const [couponError,       setCouponError]       = useState("");
  const [couponLoading,     setCouponLoading]     = useState(false);
  const [selectAll,         setSelectAll]         = useState(true);
  const [selected,          setSelected]          = useState(new Set());

  const selectionSeeded = useRef(false);

  /* ── Seed selection on item load ── */
  useEffect(() => {
    if (items.length > 0 && !selectionSeeded.current) {
      setSelected(new Set(items.map((i) => i.id)));
      selectionSeeded.current = true;
    }
  }, [items]);

  /* ── Fetch cart ── */
  useEffect(() => {
    if (!user) {
      const stored = loadCart();
      setItems(stored);
      setSelected(new Set(stored.map((i) => i.id)));
      selectionSeeded.current = stored.length > 0;
      setLoading(false);
      return;
    }

    const fetchCart = async () => {
      try {
        const { data } = await cartApi.fetch();
        const serverItems = data.data?.items ?? [];
        setItems(serverItems);
        setPriceChangedCount(data.data?.priceChanges ?? 0);
      } catch {
        const stored = loadCart();
        setItems(stored);
      } finally {
        setLoading(false);
      }
    };

    const fetchSaved = async () => {
      try {
        const { data } = await cartApi.getSaved();
        setSavedItems(data.data ?? []);
      } catch {}
    };

    fetchCart();
    fetchSaved();
  }, [user]);

  /* ── Persist (guests) ── */
  useEffect(() => {
    if (!user) saveCart(items);
  }, [items, user]);

  /* ── Derived ── */
  const sellerGroups = useMemo(() => {
    const groups = new Map();
    items.forEach((item) => {
      const key = item.sellerId ?? "unknown";
      if (!groups.has(key)) {
        groups.set(key, { sellerId: key, items: [] });
      }
      groups.get(key).items.push(item);
    });
    return [...groups.values()];
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

  const discount   = couponApplied?.discount ?? 0;
  const grandTotal = Math.max(0, subtotal - discount);

  /* ── Handlers ── */
  const updateQty = useCallback((id, delta) => {
    setItems((prev) => {
      const next = prev.map((i) => {
        if (i.id !== id) return i;
        const maxQ  = typeof i.stock === "number" ? i.stock : 99;
        const newQty = Math.max(1, Math.min(maxQ, i.qty + delta));
        return { ...i, qty: newQty };
      });
      if (user) {
        const updated = next.find((i) => i.id === id);
        if (updated) {
          cartApi.updateQty(id, updated.qty).catch(() => setItems(prev));
        }
      }
      return next;
    });
  }, [user]);

  const removeItem = useCallback((id) => {
    setItems((prev) => {
      if (user) cartApi.remove(id).catch(() => setItems(prev));
      return prev.filter((i) => i.id !== id);
    });
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [user]);

  const saveForLater = useCallback(async (id) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    if (user) {
      try {
        await cartApi.saveItem(id);
        const { data } = await cartApi.getSaved();
        setSavedItems(data.data ?? []);
      } catch {}
    } else {
      setSavedItems((prev) => {
        const exists = prev.find((s) => s.id === id);
        return exists
          ? prev
          : [...prev, { ...item, savedAt: Date.now() }];
      });
      localStorage.setItem(SAVED_KEY, JSON.stringify(savedItems));
    }
    removeItem(id);
  }, [items, user, savedItems, removeItem]);

  const moveToCart = useCallback(async (id) => {
    const item = savedItems.find((s) => s.id === id);
    if (!item) return;

    if (user) {
      try {
        await cartApi.moveItem(id);
        const { data } = await cartApi.fetch();
        setItems(data.data?.items ?? []);
        setSavedItems((prev) => prev.filter((s) => s.id !== id));
      } catch {}
    } else {
      setItems((prev) => {
        if (prev.find((i) => i.id === id)) return prev;
        return [...prev, { ...item, qty: 1 }];
      });
      setSavedItems((prev) => prev.filter((s) => s.id !== id));
      setSelected((prev) => new Set([...prev, id]));
    }
  }, [savedItems, user]);

  const removeSaved = useCallback(async (id) => {
    if (user) {
      try { await cartApi.rmSaved(id); } catch {}
    }
    setSavedItems((prev) => prev.filter((s) => s.id !== id));
  }, [user]);

  const clearCart = useCallback(() => {
    const snapshot = items;
    setItems([]);
    setSelected(new Set());
    if (user) {
      cartApi.clear().catch(() => {
        setItems(snapshot);
        setSelected(new Set(snapshot.map((i) => i.id)));
      });
    }
  }, [items, user]);

  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelected(new Set());
      setSelectAll(false);
    } else {
      setSelected(new Set(items.map((i) => i.id)));
      setSelectAll(true);
    }
  }, [selectAll, items]);

  /* ── Coupon — calls real API ── */
  const applyCoupon = useCallback(async () => {
    if (!couponCode.trim()) {
      setCouponError("Enter a coupon code");
      return;
    }
    setCouponLoading(true);
    setCouponError("");
    try {
      const { data } = await cartApi.coupon(couponCode.trim(), subtotal);
      if (data.success) {
        setCouponApplied(data.data);
        setCouponError("");
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
  }, []);

  /* ── Add to cart (for suggestion/recent cards) ── */
  const handleAddToCart = useCallback(async (product) => {
    if (!user) {
      navigate("/auth", { state: { from: "/shop/cart" } });
      return;
    }
    await cartApi.addItem({
      productId: product.id,
      qty:       1,
    });
    // Refresh cart
    const { data } = await cartApi.fetch();
    setItems(data.data?.items ?? []);
    window.dispatchEvent(new Event("cart-updated"));
  }, [user, navigate]);

  /* ── Checkout ── */
  const handleCheckout = useCallback(() => {
    if (!user) {
      navigate("/auth", { state: { from: "/shop/cart" } });
      return;
    }
    if (hasOutOfStock || selectedItems.length === 0) return;
    navigate("/shop/checkout");
  }, [user, hasOutOfStock, selectedItems.length, navigate]);

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */
  return (
    <div className="ct-page">

      {/* ── Topbar ── */}
      <div className="ct-topbar">
        <button
          className="ct-back-btn"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          {Icon.back}
        </button>
        <div className="ct-topbar-center">
          <h1 className="ct-topbar-title">My Cart</h1>
          {!loading && items.length > 0 && (
            <span className="ct-topbar-count">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {!loading && items.length > 0 && (
          <button
            className="ct-clear-btn"
            onClick={clearCart}
            aria-label="Clear cart"
          >
            {Icon.trash}
          </button>
        )}
      </div>

      {/* ── Price changed banner ── */}
      <PriceChangedBanner
        count={priceChangedCount}
        onDismiss={() => setPriceChangedCount(0)}
      />

      {/* ── Content ── */}
      {loading ? (
        <CartSkeleton />
      ) : items.length === 0 ? (
        <>
          <EmptyCart
            savedItems={savedItems}
            onMoveToCart={moveToCart}
            onRemoveSaved={removeSaved}
          />

          {/* Show suggestions even on empty cart */}
          <div className="ct-empty-suggestions">
            <RecentlyViewed onAddToCart={handleAddToCart} />
            <YouMayAlsoLike
              cartItems={[]}
              onAddToCart={handleAddToCart}
            />
          </div>
        </>
      ) : (
        <div className="ct-layout">

          {/* ── LEFT — items ── */}
          <div className="ct-items-col">

            {/* Select all */}
            <div className="ct-select-row">
              <label className="ct-checkbox-label">
                <input
                  type="checkbox"
                  className="ct-checkbox"
                  checked={
                    selectAll && selected.size === items.length
                  }
                  onChange={toggleSelectAll}
                  aria-label="Select all items"
                />
                <span className="ct-checkbox-custom" aria-hidden="true" />
                <span>Select All ({items.length})</span>
              </label>
              {selected.size > 0 && selected.size < items.length && (
                <span className="ct-partial-selected">
                  {selected.size} selected
                </span>
              )}
            </div>

            {/* Seller groups */}
            {sellerGroups.map((group, idx) => (
              <div key={group.sellerId} className="ct-seller-group">
                <SellerGroupHeader
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
              </div>
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
                    onKeyDown={(e) =>
                      e.key === "Enter" && applyCoupon()
                    }
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
                <div className="ct-coupon-applied">
                  <span>
                    🎉 <strong>{couponApplied.code}</strong>
                    {" — "}You save{" "}
                    ₦{couponApplied.discount.toLocaleString("en-NG")}
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
              <div className="ct-saved-section">
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
              </div>
            )}

            {/* ── Trust badges ── */}
            <div className="ct-trust-row">
              {[
                { icon: "🔒", text: "Secure Payment"    },
                { icon: "🚚", text: "Managed Delivery"  },
                { icon: "↩️",  text: "Easy Returns"      },
                { icon: "✅", text: "Verified Sellers"  },
              ].map((b) => (
                <div key={b.text} className="ct-trust-item">
                  <span aria-hidden="true">{b.icon}</span>
                  <span>{b.text}</span>
                </div>
              ))}
            </div>

            {/* ─────────────────────────────────────────────
                RECENTLY VIEWED + YOU MAY ALSO LIKE
                Below the cart items — full width in left col
            ───────────────────────────────────────────── */}
            <RecentlyViewed onAddToCart={handleAddToCart} />

            <YouMayAlsoLike
              cartItems={items}
              onAddToCart={handleAddToCart}
            />

          </div>

          {/* ── RIGHT — summary ── */}
          <div className="ct-summary-col">
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
          </div>
        </div>
      )}

      {/* ── Mobile sticky bar ── */}
      {!loading && items.length > 0 && selectedItems.length > 0 && (
        <div className="ct-sticky-bar">
          <div className="ct-sticky-info">
            <span className="ct-sticky-count">
              {itemCount} item{itemCount !== 1 ? "s" : ""}
            </span>
            <span className="ct-sticky-total">
              ₦{grandTotal.toLocaleString("en-NG")}
            </span>
          </div>
          <button
            className={`ct-checkout-btn ${
              hasOutOfStock ? "ct-checkout-btn--blocked" : ""
            }`}
            onClick={handleCheckout}
            disabled={hasOutOfStock}
          >
            {!user
              ? "🔒 Login to Checkout"
              : hasOutOfStock
                ? "Remove out-of-stock items"
                : "Checkout →"
            }
          </button>
        </div>
      )}

      {/* ── Footer ── */}
      <Footer />
    </div>
  );
}

/* ── Saved item row (reused in both states) ── */
const SavedItemRow = memo(function SavedItemRow({
  item, onMoveToCart, onRemoveSaved,
}) {
  const [imgErr, setImgErr] = useState(false);
  const imgSrc = !imgErr
    ? (Array.isArray(item.images) ? item.images[0] : item.image ?? null)
    : null;

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
          ₦{Number(item.price).toLocaleString("en-NG")}
        </p>
      </div>
      <div className="ct-saved-actions">
        <button
          className="ct-saved-move"
          onClick={() => onMoveToCart(item.id)}
        >
          Add to Cart
        </button>
        <button
          className="ct-saved-remove"
          onClick={() => onRemoveSaved(item.id)}
          aria-label="Remove saved item"
        >
          Remove
        </button>
      </div>
    </div>
  );
});