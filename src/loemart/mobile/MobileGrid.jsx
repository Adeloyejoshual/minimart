/**
 * src/loemart/mobile/MobileGrid.jsx
 *
 * Professional, High-Performance Mobile Grid & Card System
 * ──────────────────────────────────────────────────────────
 * ✓ 100% Real Ratings: Uses real database reviews, or falls back to elegant "New Listing" badge
 * ✓ Memory Safe: Automatic cleanup of debounced API updates on unmount
 * ✓ Optimistic State Engine: Flawless layout updates with instantaneous rollback on network failure
 * ✓ Touch-Target Optimized: Precision interactive click spaces engineered for high-density layouts
 */

import { memo, useCallback, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  FiSearch, FiPackage, FiHeart, FiShoppingCart,
  FiCheckCircle, FiShield, FiMapPin,
  FiAlertCircle, FiRefreshCw, FiChevronRight, FiTruck,
  FiPlus, FiMinus,
} from "react-icons/fi";

import {
  fmtPrice, calcDiscount, primaryImg, addToRecentlyViewed,
  useFadeIn, haptic, TRENDING_SEARCHES, getDeliveryEstimate,
  API,
} from "./mobileHelpers";

/* ═══════════════════════════════════════════════════════════════
   DATA SEED & CONFIGURATION
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

/* ── Fetch Real Server-Side Cart Mapping ── */
async function fetchServerCartMap() {
  try {
    if (!isLoggedIn()) return new Map();
    const res = await axios.get(CART_URL, {
      headers: authHeaders(),
      timeout: 8000,
    });
    const items = res.data?.data?.items ?? [];
    const map = new Map();
    items.forEach((item) => {
      if (item.product_id) {
        map.set(item.product_id, {
          itemId: item.id,
          qty: item.qty,
        });
      }
    });
    return map;
  } catch (err) {
    console.warn("[MobileGrid] Failed to fetch server cart data:", err.message);
    return new Map();
  }
}

/* ── Guest Cart Storage Parsing ── */
function readGuestCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeGuestCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event("cart-updated"));
}

function getGuestCartMap() {
  const cart = readGuestCart();
  const map = new Map();
  cart.forEach((item) => {
    if (item.productId) {
      map.set(item.productId, {
        itemId: item.id,
        qty: item.qty ?? 1,
      });
    }
  });
  return map;
}

/* ═══════════════════════════════════════════════════════════════
   1. REAL STAR RATINGS (NO FAKES)
═══════════════════════════════════════════════════════════════ */
const Stars = memo(function Stars({ rating }) {
  const cleanRating = Math.max(0, Math.min(5, Number(rating || 0)));
  return (
    <div className="lmm-stars" title={`${cleanRating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.min(1, Math.max(0, cleanRating - i));
        return (
          <span key={i} className="lmm-star-wrap">
            <svg width="10" height="10" viewBox="0 0 24 24" className="lmm-star-bg">
              <polygon
                points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                fill="currentColor"
              />
            </svg>
            <svg
              width="10" height="10" viewBox="0 0 24 24"
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
   2. POLISHED STEPPER ELEMENT
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
        aria-label="Decrease item count"
      >
        <FiMinus size={11} strokeWidth={3} />
      </button>
      <span className="lmm-qty__val" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        className="lmm-qty__btn"
        onClick={onIncrease}
        disabled={busy}
        aria-label="Increase item count"
      >
        <FiPlus size={11} strokeWidth={3} />
      </button>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   3. REAL-TIME SYNCHRONIZED CARD
═══════════════════════════════════════════════════════════════ */
const MobileCard = memo(function MobileCard({
  product, wishlisted, onWishlist,
  cartInfo,
  onCartUpdate,
  index = 0,
}) {
  const navigate = useNavigate();
  const [hearted, setHearted]         = useState(wishlisted);
  const [localQty, setLocalQty]       = useState(cartInfo?.qty ?? 0);
  const [localItemId, setLocalItemId] = useState(cartInfo?.itemId ?? null);
  const [busy, setBusy]               = useState(false);
  const [pulsing, setPulsing]         = useState(false);
  const { ref, visible }              = useFadeIn();
  const debounceRef                   = useRef(null);

  // Sync internal state with external context refreshes
  useEffect(() => {
    setLocalQty(cartInfo?.qty ?? 0);
    setLocalItemId(cartInfo?.itemId ?? null);
  }, [cartInfo]);

  useEffect(() => {
    setHearted(wishlisted);
  }, [wishlisted]);

  // Clean timeouts on unmount to safeguard against leaks
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const discount    = calcDiscount(product);
  const imgSrc      = primaryImg(product.images);
  const condition   = product.condition ?? "Used";
  const rating      = product.rating ? Number(product.rating) : null;
  const reviewCount = product.review_count ? Number(product.review_count) : 0;
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
    setHearted((prev) => !prev);
    onWishlist(product.id);
    haptic(10);
  }, [onWishlist, product.id]);

  /* ── Add to Cart (Real Database Call / Guest Storage fallback) ── */
  const handleAdd = useCallback(async (e) => {
    e.stopPropagation();
    if (busy) return;

    setBusy(true);
    setPulsing(true);
    haptic(15);

    setLocalQty(1); // Optimistic UI Paint

    try {
      if (isLoggedIn()) {
        await axios.post(
          CART_ITEMS_URL,
          { product_id: product.id, variant_id: null, qty: 1 },
          { headers: authHeaders(), timeout: 10000 }
        );
        onCartUpdate?.();
      } else {
        const cart      = readGuestCart();
        const itemKey   = `${product.id}__default`;
        const existing  = cart.find((c) => c.id === itemKey);

        if (existing) {
          existing.qty = (existing.qty ?? 1) + 1;
        } else {
          cart.push({
            id: itemKey,
            productId: product.id,
            name: product.name,
            image: imgSrc,
            price: product.price,
            originalPrice: product.original_price,
            variant: null,
            slug: product.slug ?? product.id,
            qty: 1,
            stock: maxStock,
            addedAt: Date.now(),
          });
          setLocalItemId(itemKey);
        }
        writeGuestCart(cart);
        onCartUpdate?.();
      }

      toast.success("Added to cart", { icon: "🛒" });
    } catch (err) {
      setLocalQty(0); // Rollback state immediately
      const msg = err.response?.data?.message ?? "Failed to add to cart";
      toast.error(msg);
    } finally {
      setBusy(false);
      setTimeout(() => setPulsing(false), 500);
    }
  }, [product, busy, imgSrc, maxStock, onCartUpdate]);

  /* ── Increment Item Quantity (Real Debounced Sync) ── */
  const handleIncrease = useCallback(() => {
    if (busy || !localItemId) return;
    if (localQty >= maxStock) {
      toast.error(`Only ${maxStock} available`);
      return;
    }

    const nextQty = localQty + 1;
    setLocalQty(nextQty); // Optimistic paint
    haptic(8);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setBusy(true);
      try {
        if (isLoggedIn()) {
          await axios.patch(
            `${CART_ITEMS_URL}/${localItemId}`,
            { qty: nextQty },
            { headers: authHeaders(), timeout: 8000 }
          );
          onCartUpdate?.();
        } else {
          const cart = readGuestCart();
          const match = cart.find((c) => c.id === localItemId);
          if (match) {
            match.qty = nextQty;
            writeGuestCart(cart);
          }
        }
      } catch (err) {
        setLocalQty(localQty); // Rollback
        toast.error("Could not update item quantity");
      } finally {
        setBusy(false);
      }
    }, 400);
  }, [busy, localItemId, localQty, maxStock, onCartUpdate]);

  /* ── Decrement Item / Remove From Cart ── */
  const handleDecrease = useCallback(async () => {
    if (busy || !localItemId) return;
    haptic(8);

    // If item hits 0 -> DELETE request
    if (localQty <= 1) {
      setBusy(true);
      setLocalQty(0); // Optimistic Paint
      const stashId = localItemId;
      setLocalItemId(null);

      try {
        if (isLoggedIn()) {
          await axios.delete(`${CART_ITEMS_URL}/${stashId}`, {
            headers: authHeaders(),
            timeout: 8000,
          });
          onCartUpdate?.();
        } else {
          const updated = readGuestCart().filter((c) => c.id !== stashId);
          writeGuestCart(updated);
          onCartUpdate?.();
        }
        toast.success("Removed from cart", { icon: "🗑️" });
      } catch (err) {
        setLocalQty(1); // Rollback
        setLocalItemId(stashId);
        toast.error("Could not remove item");
      } finally {
        setBusy(false);
      }
      return;
    }

    const nextQty = localQty - 1;
    setLocalQty(nextQty); // Optimistic Paint

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setBusy(true);
      try {
        if (isLoggedIn()) {
          await axios.patch(
            `${CART_ITEMS_URL}/${localItemId}`,
            { qty: nextQty },
            { headers: authHeaders(), timeout: 8000 }
          );
          onCartUpdate?.();
        } else {
          const cart = readGuestCart();
          const match = cart.find((c) => c.id === localItemId);
          if (match) {
            match.qty = nextQty;
            writeGuestCart(cart);
          }
        }
      } catch (err) {
        setLocalQty(localQty); // Rollback
        toast.error("Could not adjust quantity");
      } finally {
        setBusy(false);
      }
    }, 400);
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
    >
      {/* Visual media container */}
      <div className="lmm-card__img-wrap">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            className="lmm-card__img"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="lmm-card__placeholder">
            <FiPackage size={24} />
          </div>
        )}

        <div className="lmm-card__gradient" aria-hidden="true" />

        {/* Dynamic Badges */}
        <div className="lmm-card__badges">
          {discount > 0 && (
            <span className="lmm-card__badge lmm-card__badge--sale">-{discount}%</span>
          )}
          {product.is_featured && (
            <span className="lmm-card__badge lmm-card__badge--feat">Featured</span>
          )}
          {condition === "New" && (
            <span className="lmm-card__badge lmm-card__badge--new">New</span>
          )}
        </div>

        {/* Wishlist triggers */}
        <button
          type="button"
          className={`lmm-card__wish ${hearted ? "lmm-card__wish--on" : ""}`}
          onClick={handleWish}
          aria-label={hearted ? "Remove from saved items" : "Save item"}
        >
          <FiHeart
            size={14}
            fill={hearted ? "currentColor" : "none"}
          />
        </button>

        {hasDelivery && (
          <div className="lmm-card__delivery" aria-label="Free delivery eligible">
            <FiTruck size={10} /> Free
          </div>
        )}

        {lowStock && (
          <div className="lmm-card__stock-alert">
            Only {product.stock} Left
          </div>
        )}

        {!inStock && (
          <div className="lmm-card__oos">
            <span>Sold Out</span>
          </div>
        )}
      </div>

      {/* Card Metadata Details */}
      <div className="lmm-card__body">
        <p className="lmm-card__name">{product.name}</p>

        {/* Real Review Block */}
        <div className="lmm-card__rating">
          {rating !== null ? (
            <>
              <Stars rating={rating} />
              <span className="lmm-card__reviews">({reviewCount})</span>
            </>
          ) : (
            <span className="lmm-card__no-reviews">New Listing</span>
          )}
        </div>

        <div className="lmm-card__price-row">
          <span className="lmm-card__price">{fmtPrice(product.price)}</span>
          {discount > 0 && (
            <span className="lmm-card__original">{fmtPrice(product.original_price)}</span>
          )}
        </div>

        <div className="lmm-card__meta">
          <span className={`lmm-card__cond lmm-card__cond--${condition.toLowerCase()}`}>
            {condition}
          </span>
          {product.location && (
            <span className="lmm-card__loc">
              <FiMapPin size={9} /> {product.location.split(",")[0]}
            </span>
          )}
        </div>

        {product.seller_verified && (
          <div className="lmm-card__verified">
            <FiShield size={10} /> Verified Listing
          </div>
        )}

        {/* Add Actions (Normal vs Stepper state) */}
        <div className="lmm-card__cart-wrap">
          {localQty === 0 ? (
            <button
              type="button"
              className={`lmm-card__cart ${pulsing ? "lmm-card__cart--pulse" : ""} ${
                busy ? "lmm-card__cart--loading" : ""
              }`}
              onClick={handleAdd}
              disabled={busy || !inStock}
            >
              {busy ? (
                <div className="lmm-mini-spinner" />
              ) : inStock ? (
                <>
                  <FiShoppingCart size={13} />
                  <span>Add to Cart</span>
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
                <FiCheckCircle size={12} /> Active
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
});

/* ═══════════════════════════════════════════════════════════════
   4. POLISHED SKELETON PLACEHOLDER
═══════════════════════════════════════════════════════════════ */
function Skeleton() {
  return (
    <div className="lmm-card lmm-card--skel" aria-hidden="true">
      <div className="lmm-skel lmm-skel-img" />
      <div className="lmm-card__body">
        <div className="lmm-skel" style={{ height: "12px", width: "85%", borderRadius: "4px" }} />
        <div className="lmm-skel" style={{ height: "12px", width: "50%", borderRadius: "4px" }} />
        <div className="lmm-skel" style={{ height: "10px", width: "30%", borderRadius: "4px" }} />
        <div className="lmm-skel" style={{ height: "34px", borderRadius: "8px", marginTop: "6px" }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   5. COMPLETE GRID SEGMENT
═══════════════════════════════════════════════════════════════ */
const MobileGrid = memo(function MobileGrid({
  products, pagination, loading, loadingMore, fetchError,
  hasMore, hasFilters, wishlist, onWishlist,
  onRetry, onLoadMore, onClearFilters, onSearchSelect,
}) {
  const deliveryDate = getDeliveryEstimate();
  const [cartMap, setCartMap] = useState(new Map());

  const refreshCartMap = useCallback(async () => {
    const map = isLoggedIn() ? await fetchServerCartMap() : getGuestCartMap();
    setCartMap(map);
  }, []);

  useEffect(() => {
    refreshCartMap();
  }, [refreshCartMap]);

  // Synchronize cart state on changes across views
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
      <div className="lmm-listings-header">
        <div>
          <h2 className="lmm-listings-title">Browse Marketplace</h2>
          {!loading && (
            <p className="lmm-listings-count">
              {pagination
                ? `${pagination.total.toLocaleString()} listings`
                : `${products.length} shown`}
              {" · "}
              <span className="lmm-listings-delivery">
                <FiTruck size={12} /> Delivery by {deliveryDate}
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

      <main
        id="lmm-listings"
        className="lmm-grid"
        aria-busy={loading}
      >
        {loading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}

        {!loading && fetchError && (
          <div className="lmm-error-card">
            <FiAlertCircle size={32} className="lmm-error-icon" />
            <p className="lmm-error-title">Database link disrupted</p>
            <p className="lmm-error-sub">{fetchError}</p>
            <button type="button" className="lmm-retry-btn" onClick={onRetry}>
              <FiRefreshCw size={12} /> Retry Connection
            </button>
          </div>
        )}

        {!loading && !fetchError && !products.length && (
          <div className="lmm-empty-card">
            <div className="lmm-empty-illustration">
              <FiSearch size={28} />
            </div>
            <p className="lmm-empty-title">No matches found</p>
            <p className="lmm-empty-sub">Refine terms, tags, or browse trend keywords</p>
            <div className="lmm-empty-chips">
              {TRENDING_SEARCHES.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="lmm-empty-chip"
                  onClick={() => onSearchSelect(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="lmm-empty-clear-btn"
              onClick={onClearFilters}
            >
              Reset Filters
            </button>
          </div>
        )}

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
            <div className="lmm-spinner" />
          </div>
        )}

        {!loading && !loadingMore && hasMore && (
          <div className="lmm-loadmore-row">
            <button type="button" className="lmm-loadmore-btn" onClick={onLoadMore}>
              View More Items <FiChevronRight size={14} />
            </button>
          </div>
        )}

        {!loading && !hasMore && products.length > 0 && (
          <p className="lmm-end">✓ Fully up to date</p>
        )}
      </main>
    </>
  );
});

export default MobileGrid;