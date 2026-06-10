import React, {
  useState, useEffect, useCallback, useMemo, memo,
} from "react";
import { useNavigate } from "react-router-dom";

import CartItem    from "./Cart/CartItem";
import OrderSummary from "./Cart/OrderSummary";
import EmptyCart   from "./Cart/EmptyCart";

import "../styles/Cart.css";

/* ── Constants ── */
const CART_KEY = "mm_cart";

/* ── Helpers ── */
function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("cart-updated"));
}

/* ── Icons ── */
const Icon = {
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <path d="M19 12H5M12 5l-7 7 7 7"/>
    </svg>
  ),
  bag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
  ),
};

/* ════════════════════════════════════════════════════════════
   SELLER GROUP HEADER
════════════════════════════════════════════════════════════ */
const SellerGroupHeader = memo(function SellerGroupHeader({ sellerName, itemCount }) {
  return (
    <div className="ct-seller-header">
      <div className="ct-seller-avatar">
        {sellerName?.[0]?.toUpperCase() ?? "S"}
      </div>
      <div className="ct-seller-info">
        <span className="ct-seller-name">{sellerName ?? "Unknown Seller"}</span>
        <span className="ct-seller-count">
          {itemCount} item{itemCount !== 1 ? "s" : ""}
        </span>
      </div>
      <span className="ct-seller-badge">🏪 Minimart Managed</span>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   PRICE CHANGED BANNER
════════════════════════════════════════════════════════════ */
const PriceChangedBanner = memo(function PriceChangedBanner({ count, onDismiss }) {
  if (!count) return null;

  return (
    <div className="ct-price-changed-banner" role="alert">
      <span>⚠️</span>
      <p>
        {count} item{count > 1 ? "s" : ""} in your cart
        {count > 1 ? " have" : " has"} updated pricing.
        Prices reflect current values.
      </p>
      <button onClick={onDismiss} aria-label="Dismiss">✕</button>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   MAIN CART PAGE
════════════════════════════════════════════════════════════ */
export default function CartPage({ user }) {
  const navigate = useNavigate();

  const [items,            setItems]            = useState(loadCart);
  const [savedItems,       setSavedItems]       = useState(() => {
    try { return JSON.parse(localStorage.getItem("mm_saved") || "[]"); }
    catch { return []; }
  });
  const [priceChangedCount, setPriceChangedCount] = useState(0);
  const [showCoupon,        setShowCoupon]        = useState(false);
  const [couponCode,        setCouponCode]         = useState("");
  const [couponApplied,     setCouponApplied]      = useState(null);
  const [couponError,       setCouponError]        = useState("");
  const [selectAll,         setSelectAll]          = useState(true);
  const [selected,          setSelected]           = useState(() => {
    const cart = loadCart();
    return new Set(cart.map((i) => i.id));
  });

  /* ── Persist items ── */
  useEffect(() => {
    saveCart(items);
  }, [items]);

  useEffect(() => {
    localStorage.setItem("mm_saved", JSON.stringify(savedItems));
  }, [savedItems]);

  /* ── Group items by seller ── */
  const sellerGroups = useMemo(() => {
    const groups = new Map();
    items.forEach((item) => {
      const key = item.sellerId ?? item.sellerName ?? "unknown";
      if (!groups.has(key)) {
        groups.set(key, {
          sellerName: item.sellerName ?? "Unknown Seller",
          sellerId:   item.sellerId   ?? null,
          items:      [],
        });
      }
      groups.get(key).items.push(item);
    });
    return [...groups.values()];
  }, [items]);

  /* ── Selected items only ── */
  const selectedItems = useMemo(() =>
    items.filter((i) => selected.has(i.id)),
    [items, selected]
  );

  /* ── Totals ── */
  const subtotal = useMemo(() =>
    selectedItems.reduce((sum, i) => sum + (Number(i.price) * i.qty), 0),
    [selectedItems]
  );

  const itemCount = useMemo(() =>
    selectedItems.reduce((sum, i) => sum + i.qty, 0),
    [selectedItems]
  );

  const hasOutOfStock = useMemo(() =>
    selectedItems.some((i) => i.outOfStock),
    [selectedItems]
  );

  const discount = couponApplied?.amount ?? 0;
  const grandTotal = Math.max(0, subtotal - discount);

  /* ── Handlers ── */
  const updateQty = useCallback((id, delta) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, qty: Math.max(1, Math.min(99, i.qty + delta)) }
          : i
      )
    );
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const saveForLater = useCallback((id) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setSavedItems((prev) => {
      const exists = prev.find((s) => s.id === id);
      return exists ? prev : [...prev, { ...item, savedAt: Date.now() }];
    });
    removeItem(id);
  }, [items, removeItem]);

  const moveToCart = useCallback((id) => {
    const item = savedItems.find((s) => s.id === id);
    if (!item) return;
    setItems((prev) => {
      const exists = prev.find((i) => i.id === id);
      return exists ? prev : [...prev, { ...item, qty: 1 }];
    });
    setSavedItems((prev) => prev.filter((s) => s.id !== id));
    setSelected((prev) => new Set([...prev, id]));
  }, [savedItems]);

  const removeSaved = useCallback((id) => {
    setSavedItems((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setSelected(new Set());
  }, []);

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

  /* Coupon */
  const applyCoupon = useCallback(() => {
    if (!couponCode.trim()) {
      setCouponError("Enter a coupon code");
      return;
    }
    /* Demo logic — replace with real API call */
    if (couponCode.toUpperCase() === "SAVE10") {
      setCouponApplied({ code: "SAVE10", amount: Math.round(subtotal * 0.1) });
      setCouponError("");
    } else {
      setCouponError("Invalid or expired coupon code");
      setCouponApplied(null);
    }
  }, [couponCode, subtotal]);

  const removeCoupon = useCallback(() => {
    setCouponApplied(null);
    setCouponCode("");
    setCouponError("");
  }, []);

  /* Checkout guard */
  const handleCheckout = useCallback(() => {
    if (!user) {
      navigate("/auth", { state: { from: "/shop/cart" } });
      return;
    }
    if (hasOutOfStock) return;
    if (selectedItems.length === 0) return;
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
          {items.length > 0 && (
            <span className="ct-topbar-count">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {items.length > 0 && (
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

      {/* ── Empty cart ── */}
      {items.length === 0 ? (
        <EmptyCart
          savedItems={savedItems}
          onMoveToCart={moveToCart}
          onRemoveSaved={removeSaved}
        />
      ) : (
        <div className="ct-layout">

          {/* ── LEFT — cart items ── */}
          <div className="ct-items-col">

            {/* Select all row */}
            <div className="ct-select-row">
              <label className="ct-checkbox-label">
                <input
                  type="checkbox"
                  className="ct-checkbox"
                  checked={selectAll && selected.size === items.length}
                  onChange={toggleSelectAll}
                />
                <span>Select All ({items.length})</span>
              </label>
              {selected.size > 0 && selected.size < items.length && (
                <span className="ct-partial-selected">
                  {selected.size} selected
                </span>
              )}
            </div>

            {/* Seller groups */}
            {sellerGroups.map((group) => (
              <div key={group.sellerName} className="ct-seller-group">
                <SellerGroupHeader
                  sellerName={group.sellerName}
                  itemCount={group.items.length}
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

            {/* ── Coupon code ── */}
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
                    placeholder="Enter coupon code"
                    value={couponCode}
                    onChange={(e) => {
                      setCouponCode(e.target.value.toUpperCase());
                      setCouponError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                    autoFocus
                  />
                  <button className="ct-coupon-apply" onClick={applyCoupon}>
                    Apply
                  </button>
                  <button
                    className="ct-coupon-cancel"
                    onClick={() => { setShowCoupon(false); setCouponError(""); }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {couponError && (
                <p className="ct-coupon-error">⚠️ {couponError}</p>
              )}

              {couponApplied && (
                <div className="ct-coupon-applied">
                  <span>🎉 <strong>{couponApplied.code}</strong> — You save ₦{couponApplied.amount.toLocaleString("en-NG")}</span>
                  <button onClick={removeCoupon} aria-label="Remove coupon">✕</button>
                </div>
              )}
            </div>

            {/* ── Saved for later ── */}
            {savedItems.length > 0 && (
              <div className="ct-saved-section">
                <h3 className="ct-saved-title">
                  Saved for Later ({savedItems.length})
                </h3>
                <div className="ct-saved-list">
                  {savedItems.map((item) => (
                    <div key={item.id} className="ct-saved-item">
                      <div className="ct-saved-img-wrap">
                        {item.image ? (
                          <img src={item.image} alt={item.name} loading="lazy" />
                        ) : (
                          <span>📦</span>
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
                          onClick={() => moveToCart(item.id)}
                        >
                          Move to Cart
                        </button>
                        <button
                          className="ct-saved-remove"
                          onClick={() => removeSaved(item.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trust badges */}
            <div className="ct-trust-row">
              {[
                { icon:"🔒", text:"Secure Payment"    },
                { icon:"🚚", text:"Managed Delivery"  },
                { icon:"↩️",  text:"Easy Returns"      },
                { icon:"✅", text:"Verified Sellers"  },
              ].map((b) => (
                <div key={b.text} className="ct-trust-item">
                  <span>{b.icon}</span>
                  <span>{b.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT — order summary ── */}
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

      {/* ── Mobile sticky checkout bar ── */}
      {items.length > 0 && selectedItems.length > 0 && (
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
            className={`ct-checkout-btn ${hasOutOfStock ? "ct-checkout-btn--blocked" : ""}`}
            onClick={handleCheckout}
            disabled={hasOutOfStock}
          >
            {!user ? (
              <>{Icon.lock} Login to Checkout</>
            ) : hasOutOfStock ? (
              "Remove out-of-stock items"
            ) : (
              "Proceed to Checkout →"
            )}
          </button>
        </div>
      )}
    </div>
  );
}