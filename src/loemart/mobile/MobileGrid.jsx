/**
 * src/loemart/mobile/MobileGrid.jsx
 *
 * v3 — REAL cart sync
 * ─────────────────────────
 * ✓ Add to Cart hits /api/cart/items (POST) for logged-in
 * ✓ Increase/Decrease hits /api/cart/items/:id (PATCH)
 * ✓ Remove hits /api/cart/items/:id (DELETE)
 * ✓ Loads existing cart items on mount → shows correct qty per card
 * ✓ Guest users get localStorage fallback
 * ✓ Optimistic UI + rollback on error
 * ✓ Full loading/pulsing/success states
 */

import { memo, useCallback, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  FiSearch, FiPackage, FiHeart, FiShoppingCart,
  FiCheckCircle, FiShield, FiEye, FiMapPin,
  FiAlertCircle, FiRefreshCw, FiChevronRight, FiTruck,
  FiPlus, FiMinus,
} from "react-icons/fi";

import {
  fmtPrice, calcDiscount, primaryImg, fakeRating,
  fakeReviewCount, addToRecentlyViewed, useFadeIn,
  haptic, TRENDING_SEARCHES, getDeliveryEstimate,
  API,
} from "./mobileHelpers";

/* ═══════════════════════════════════════════════════════════════
   CART API HELPERS
═══════════════════════════════════════════════════════════════ */
const CART_URL       = `${API}/cart`;
const CART_ITEMS_URL = `${API}/cart/items`;
const CART_KEY       = "mm_cart";

const isLoggedIn = () => !!localStorage.getItem("marketplace_token");

const authHeaders = () => {
  const token = localStorage.getItem("marketplace_token");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
};

/* ── Fetch server cart → returns Map of product_id → {itemId, qty} ── */
async function fetchServerCartMap() {
  try {
    if (!isLoggedIn()) return new Map();
    const res = await axios.get(CART_URL, {
      headers: authHeaders(),
      timeout: 8_000,
    });
    const items = res.data?.data?.items ?? [];
    const map = new Map();
    items.forEach((item) => {
      map.set(item.product_id, {
        itemId: item.id,
        qty   : item.qty,
      });
    });
    return map;
  } catch (err) {
    console.warn("[MobileGrid] Cart map fetch failed:", err.message);
    return new Map();
  }
}

/* ── Guest cart helpers ── */
function readGuestCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
  catch { return []; }
}

function writeGuestCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event("cart-updated"));
}

function getGuestCartMap() {
  const cart = readGuestCart();
  const map = new Map();
  cart.forEach((item) => {
    map.set(item.productId, {
      itemId: item.id,
      qty   : item.qty ?? 1,
    });
  });
  return map;
}

/* ═══════════════════════════════════════════════════════════════
   STAR RATING
═══════════════════════════════════════════════════════════════ */
const Stars = memo(function Stars({ rating }) {
  return (
    <div className="lmm-stars">
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.min(1, Math.max(0, rating - i));
        return (
          <span key={i} className="lmm-star-wrap">
            <svg width="9" height="9" viewBox="0 0 24 24" className="lmm-star-bg">
              <polygon
                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                fill="currentColor"
              />
            </svg>
            <svg
              width="9"
              height="9"
              viewBox="0 0 24 24"
              className="lmm-star-fg"
              style={{ clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)` }}
            >
              <polygon
                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                fill="currentColor"
              />
            </svg>
          </span>
        );
      })}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   QUANTITY STEPPER
═══════════════════════════════════════════════════════════════ */
const QuantityStepper = memo(function QuantityStepper({
  qty, onIncrease, onDecrease, busy,
}) {
  return (
    <div
      className={`lmm-qty ${busy ? "lmm-qty--busy" : ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="lmm-qty__btn"
        onClick={onDecrease}
        disabled={busy}
        aria-label={qty === 1 ? "Remove from cart" : "Decrease quantity"}
      >
        <FiMinus size={12} strokeWidth={2.5} />
      </button>
      <span className="lmm-qty__val" aria-live="polite">
        {busy ? "…" : qty}
      </span>
      <button
        type="button"
        className="lmm-qty__btn lmm-qty__btn--plus"
        onClick={onIncrease}
        disabled={busy}
        aria-label="Increase quantity"
      >
        <FiPlus size={12} strokeWidth={2.5} />
      </button>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   PRODUCT CARD — REAL CART SYNC
═══════════════════════════════════════════════════════════════ */
const MobileCard = memo(function MobileCard({
  product, wishlisted, onWishlist,
  cartInfo,          // { itemId, qty } | null
  onCartUpdate,      // callback to refresh parent
  index = 0,
}) {
  const navigate = useNavigate();
  const [hearted,  setHearted]  = useState(wishlisted);
  const [localQty, setLocalQty] = useState(cartInfo?.qty ?? 0);
  const [localItemId, setLocalItemId] = useState(cartInfo?.itemId ?? null);
  const [busy,     setBusy]     = useState(false);
  const [pulsing,  setPulsing]  = useState(false);
  const { ref, visible } = useFadeIn();
  const debounceRef = useRef(null);

  /* Sync local state with parent when cart refreshes */
  useEffect(() => {
    setLocalQty(cartInfo?.qty ?? 0);
    setLocalItemId(cartInfo?.itemId ?? null);
  }, [cartInfo?.qty, cartInfo?.itemId]);

  useEffect(() => { setHearted(wishlisted); }, [wishlisted]);

  const discount    = calcDiscount(product);
  const imgSrc      = primaryImg(product.images);
  const condition   = product.condition ?? "Used";
  const rating      = fakeRating(product);
  const reviewCount = fakeReviewCount(product);
  const hasDelivery = product.has_delivery;
  const inStock     = (product.stock ?? 99) > 0;
  const lowStock    = inStock && (product.stock ?? 99) < 10;
  const maxStock    = product.stock ?? 99;
  const dest        = `/shop/${product.slug ?? product.id}`;

  const go = useCallback(() => {
    addToRecentlyViewed(product);
    navigate(dest);
  }, [navigate, dest, product]);

  const handleWish = useCallback((e) => {
    e.stopPropagation();
    setHearted((v) => !v);
    onWishlist(product.id);
    haptic(10);
  }, [onWishlist, product.id]);

  /* ═══════════════════════════════════════════
     ADD TO CART (first time)
  ═══════════════════════════════════════════ */
  const handleAdd = useCallback(async (e) => {
    e.stopPropagation();
    if (busy) return;

    setBusy(true);
    setPulsing(true);
    haptic(15);
    console.log("🛒 [Card] ADD:", product.id, product.name);

    /* Optimistic UI */
    setLocalQty(1);

    try {
      if (isLoggedIn()) {
        const res = await axios.post(
          CART_ITEMS_URL,
          { product_id: product.id, variant_id: null, qty: 1 },
          { headers: authHeaders(), timeout: 10_000 }
        );
        console.log("✅ [Card] Added:", res.data);

        /* Trigger parent to refresh cart map */
        onCartUpdate?.();

      } else {
        /* Guest mode — localStorage */
        const cart      = readGuestCart();
        const itemKey   = `${product.id}__default`;
        const existing  = cart.find((c) => c.id === itemKey);

        if (existing) {
          existing.qty = (existing.qty ?? 1) + 1;
        } else {
          cart.push({
            id            : itemKey,
            productId     : product.id,
            name          : product.name,
            image         : imgSrc,
            price         : product.price,
            originalPrice : product.original_price,
            variant       : null,
            slug          : product.slug ?? product.id,
            qty           : 1,
            stock         : maxStock,
            addedAt       : Date.now(),
          });
          setLocalItemId(itemKey);
        }
        writeGuestCart(cart);
        onCartUpdate?.();
      }

      toast.success("Added to cart", {
        duration: 2000,
        icon    : "🛒",
      });

    } catch (err) {
      console.error("❌ [Card] Add failed:", err);
      const msg = err.response?.data?.message ?? "Failed to add to cart";
      toast.error(msg, { duration: 3500 });
      setLocalQty(0); // Rollback
    } finally {
      setBusy(false);
      setTimeout(() => setPulsing(false), 600);
    }
  }, [product, busy, imgSrc, maxStock, onCartUpdate]);

  /* ═══════════════════════════════════════════
     INCREASE QUANTITY (debounced)
  ═══════════════════════════════════════════ */
  const handleIncrease = useCallback(() => {
    if (busy || !localItemId) return;
    if (localQty >= maxStock) {
      toast.error(`Only ${maxStock} available`, { duration: 2000 });
      return;
    }

    const newQty = localQty + 1;
    setLocalQty(newQty); // Optimistic
    haptic(8);

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setBusy(true);
      try {
        if (isLoggedIn()) {
          await axios.patch(
            `${CART_ITEMS_URL}/${localItemId}`,
            { qty: newQty },
            { headers: authHeaders() }
          );
          console.log("✅ [Card] Qty updated to", newQty);
          onCartUpdate?.();
        } else {
          const cart = readGuestCart();
          const idx  = cart.findIndex((c) => c.id === localItemId);
          if (idx >= 0) {
            cart[idx].qty = newQty;
            writeGuestCart(cart);
          }
        }
      } catch (err) {
        console.error("❌ [Card] Increase failed:", err);
        const msg = err.response?.data?.message ?? "Failed to update";
        toast.error(msg, { duration: 2500 });
        setLocalQty(localQty); // Rollback
      } finally {
        setBusy(false);
      }
    }, 350);
  }, [busy, localItemId, localQty, maxStock, onCartUpdate]);

  /* ═══════════════════════════════════════════
     DECREASE QUANTITY / REMOVE
  ═══════════════════════════════════════════ */
  const handleDecrease = useCallback(async () => {
    if (busy || !localItemId) return;

    haptic(8);

    /* If qty is 1 → REMOVE from cart */
    if (localQty <= 1) {
      setBusy(true);
      setLocalQty(0); // Optimistic
      const prevItemId = localItemId;
      setLocalItemId(null);

      try {
        if (isLoggedIn()) {
          await axios.delete(`${CART_ITEMS_URL}/${prevItemId}`, {
            headers: authHeaders(),
          });
          console.log("✅ [Card] Removed from cart");
          onCartUpdate?.();
        } else {
          const cart = readGuestCart().filter((c) => c.id !== prevItemId);
          writeGuestCart(cart);
          onCartUpdate?.();
        }

        toast.success("Removed from cart", {
          duration: 2000,
          icon    : "🗑️",
        });

      } catch (err) {
        console.error("❌ [Card] Remove failed:", err);
        toast.error("Failed to remove");
        setLocalQty(1); // Rollback
        setLocalItemId(prevItemId);
      } finally {
        setBusy(false);
      }
      return;
    }

    /* Otherwise → decrement */
    const newQty = localQty - 1;
    setLocalQty(newQty); // Optimistic

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setBusy(true);
      try {
        if (isLoggedIn()) {
          await axios.patch(
            `${CART_ITEMS_URL}/${localItemId}`,
            { qty: newQty },
            { headers: authHeaders() }
          );
          console.log("✅ [Card] Qty decreased to", newQty);
          onCartUpdate?.();
        } else {
          const cart = readGuestCart();
          const idx  = cart.findIndex((c) => c.id === localItemId);
          if (idx >= 0) {
            cart[idx].qty = newQty;
            writeGuestCart(cart);
          }
        }
      } catch (err) {
        console.error("❌ [Card] Decrease failed:", err);
        toast.error("Failed to update");
        setLocalQty(localQty); // Rollback
      } finally {
        setBusy(false);
      }
    }, 350);
  }, [busy, localItemId, localQty, onCartUpdate]);

  return (
    <article
      ref={ref}
      className={`lmm-card ${visible ? "lmm-card--visible" : ""}`}
      style={{ animationDelay: `${Math.min(index * 40, 300)}ms` }}
      onClick={go}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && go()}
      aria-label={`View ${product.name}`}
    >
      {/* Image */}
      <div className="lmm-card__img-wrap">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            className="lmm-card__img"
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : (
          <div className="lmm-card__placeholder">
            <FiPackage size={26} />
          </div>
        )}

        <div className="lmm-card__gradient" aria-hidden="true" />

        {/* Badges */}
        <div className="lmm-card__badges">
          {discount > 0 && (
            <span className="lmm-card__badge lmm-card__badge--sale">-{discount}%</span>
          )}
          {product.is_featured && (
            <span className="lmm-card__badge lmm-card__badge--feat">⚡</span>
          )}
          {product.is_trending && (
            <span className="lmm-card__badge lmm-card__badge--hot">🔥</span>
          )}
          {condition === "New" && (
            <span className="lmm-card__badge lmm-card__badge--new">New</span>
          )}
        </div>

        {/* Wishlist */}
        <button
          type="button"
          className={`lmm-card__wish ${hearted ? "lmm-card__wish--on" : ""}`}
          onClick={handleWish}
          aria-label={hearted ? "Remove from wishlist" : "Save"}
        >
          <FiHeart
            size={13}
            fill={hearted ? "currentColor" : "none"}
            className={hearted ? "lmm-heart-beat" : ""}
          />
        </button>

        {/* Free delivery badge */}
        {hasDelivery && (
          <div className="lmm-card__delivery" aria-label="Free delivery">
            <FiTruck size={9} /> Free
          </div>
        )}

        {/* Low stock alert */}
        {lowStock && (
          <div className="lmm-card__stock-alert">
            Only {product.stock} left
          </div>
        )}

        {/* Out of stock overlay */}
        {!inStock && (
          <div className="lmm-card__oos">
            <span>Out of Stock</span>
          </div>
        )}

        {/* ★ In-cart badge (when qty > 0) ★ */}
        {localQty > 0 && (
          <div className="lmm-card__in-cart-badge">
            {localQty} in cart
          </div>
        )}
      </div>

      {/* Body */}
      <div className="lmm-card__body">
        <p className="lmm-card__name">{product.name}</p>

        <div className="lmm-card__rating">
          <Stars rating={rating} />
          <span className="lmm-card__reviews">({reviewCount})</span>
        </div>

        <div className="lmm-card__price-row">
          <span className="lmm-card__price">{fmtPrice(product.price)}</span>
          {discount > 0 && (
            <span className="lmm-card__original">{fmtPrice(product.original_price)}</span>
          )}
        </div>

        {discount > 0 && product.original_price && (
          <p className="lmm-card__savings">
            You save {fmtPrice(product.original_price - product.price)}
          </p>
        )}

        <div className="lmm-card__meta">
          <span className={`lmm-card__cond lmm-card__cond--${condition.toLowerCase()}`}>
            {condition}
          </span>
          {product.location && (
            <span className="lmm-card__loc">
              <FiMapPin size={8} /> {product.location}
            </span>
          )}
        </div>

        {product.seller_verified && (
          <div className="lmm-card__verified">
            <FiShield size={9} /> Verified Seller
          </div>
        )}

        {/* Add to cart OR quantity stepper */}
        <div className="lmm-card__cart-wrap">
          {localQty === 0 ? (
            <button
              type="button"
              className={`lmm-card__cart ${pulsing ? "lmm-card__cart--pulse" : ""} ${busy ? "lmm-card__cart--loading" : ""}`}
              onClick={handleAdd}
              disabled={busy || !inStock}
              aria-label={`Add ${product.name} to cart`}
            >
              {busy ? (
                <>
                  <span className="lmm-mini-spinner" />
                  Adding…
                </>
              ) : inStock ? (
                <>
                  <FiShoppingCart size={12} strokeWidth={2.2} />
                  Add to Cart
                </>
              ) : (
                "Sold Out"
              )}
            </button>
          ) : (
            <div className="lmm-card__added-wrap">
              <QuantityStepper
                qty={localQty}
                onIncrease={handleIncrease}
                onDecrease={handleDecrease}
                busy={busy}
              />
              <span className="lmm-card__added-label">
                <FiCheckCircle size={11} strokeWidth={2.5} /> In cart
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
});

/* ═══════════════════════════════════════════════════════════════
   SKELETON
═══════════════════════════════════════════════════════════════ */
function Skeleton() {
  return (
    <div className="lmm-card lmm-card--skel" aria-hidden="true">
      <div className="lmm-skel lmm-skel-img" />
      <div className="lmm-card__body" style={{ gap: 7 }}>
        <div className="lmm-skel" style={{ height: 11, borderRadius: 4 }} />
        <div className="lmm-skel" style={{ height: 11, width: "70%", borderRadius: 4 }} />
        <div className="lmm-skel" style={{ height: 9,  width: "45%", borderRadius: 4 }} />
        <div className="lmm-skel" style={{ height: 14, width: "55%", borderRadius: 4 }} />
        <div className="lmm-skel" style={{ height: 30, borderRadius: 8, marginTop: 4 }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN GRID
═══════════════════════════════════════════════════════════════ */
const MobileGrid = memo(function MobileGrid({
  products, pagination, loading, loadingMore, fetchError,
  hasMore, hasFilters, wishlist, onWishlist,
  onRetry, onLoadMore, onClearFilters, onSearchSelect,
}) {
  const deliveryDate = getDeliveryEstimate();

  /* ═══════════════════════════════════════════
     LIVE CART MAP — product_id → {itemId, qty}
  ═══════════════════════════════════════════ */
  const [cartMap, setCartMap] = useState(new Map());

  const refreshCartMap = useCallback(async () => {
    const map = isLoggedIn() ? await fetchServerCartMap() : getGuestCartMap();
    setCartMap(map);
  }, []);

  /* Load cart on mount */
  useEffect(() => {
    refreshCartMap();
  }, [refreshCartMap]);

  /* Listen for cart-updated events (from other components) */
  useEffect(() => {
    const sync = () => refreshCartMap();
    window.addEventListener("cart-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("cart-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, [refreshCartMap]);

  return (
    <>
      {/* Header */}
      <div className="lmm-listings-header">
        <div>
          <h2 className="lmm-listings-title">Browse All Products</h2>
          {!loading && (
            <p className="lmm-listings-count">
              {pagination
                ? `${pagination.total.toLocaleString()} products`
                : `${products.length} shown`}
              {" · "}
              <span className="lmm-listings-delivery">
                <FiTruck size={10} /> Delivery by {deliveryDate}
              </span>
            </p>
          )}
        </div>
        {hasFilters && (
          <button type="button" className="lmm-clear-btn" onClick={onClearFilters}>
            Clear
          </button>
        )}
      </div>

      {/* Grid */}
      <main
        id="lmm-listings"
        className="lmm-grid"
        aria-label="Products"
        aria-busy={loading}
        aria-live="polite"
      >
        {loading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}

        {!loading && fetchError && (
          <div className="lmm-error">
            <div className="lmm-error__icon" aria-hidden="true">
              <FiAlertCircle size={32} />
            </div>
            <p className="lmm-error__title">Oops, something went wrong</p>
            <p className="lmm-error__sub">{fetchError}</p>
            <button type="button" className="lmm-retry" onClick={onRetry}>
              <FiRefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {!loading && !fetchError && !products.length && (
          <div className="lmm-empty">
            <div className="lmm-empty__illustration" aria-hidden="true">
              <div className="lmm-empty__circle">
                <FiSearch size={32} />
              </div>
              <div className="lmm-empty__dots"><div /><div /><div /></div>
            </div>
            <p className="lmm-empty__title">No results found</p>
            <p className="lmm-empty__sub">
              Try different keywords or browse popular searches
            </p>
            <div className="lmm-empty__suggestions">
              {TRENDING_SEARCHES.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="lmm-empty__chip"
                  onClick={() => onSearchSelect(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="lmm-empty__clear"
              onClick={onClearFilters}
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Products — pass cartInfo from map */}
        {!loading && !fetchError && products.map((p, i) => (
          <MobileCard
            key={p.id}
            product={p}
            wishlisted={wishlist.includes(p.id)}
            onWishlist={onWishlist}
            cartInfo={cartMap.get(p.id) ?? null}
            onCartUpdate={refreshCartMap}
            index={i}
          />
        ))}

        {loadingMore && (
          <div className="lmm-loadmore-row">
            <div className="lmm-spinner" aria-label="Loading more" />
          </div>
        )}

        {!loading && !loadingMore && hasMore && (
          <div className="lmm-loadmore-row">
            <button type="button" className="lmm-loadmore-btn" onClick={onLoadMore}>
              Load More Products <FiChevronRight size={13} />
            </button>
          </div>
        )}

        {!loading && !hasMore && products.length > 0 && (
          <p className="lmm-end">✓ You've reached the end</p>
        )}
      </main>
    </>
  );
});

export default MobileGrid;