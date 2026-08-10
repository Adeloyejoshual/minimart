/**
 * src/loemart/mobile/MasonryCard.jsx
 *
 * v2 — REAL cart sync
 * ─────────────────────────
 * ✓ Add to Cart hits /api/cart/items (POST) for logged-in
 * ✓ Increase/Decrease hits /api/cart/items/:id (PATCH)
 * ✓ Remove hits /api/cart/items/:id (DELETE) when qty → 0
 * ✓ Shows qty stepper when item is in cart
 * ✓ Loading + success states with real feedback
 * ✓ Guest fallback to localStorage
 * ✓ Debounced qty updates (350ms)
 */

import { memo, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  Heart, ShoppingBag, Star, Zap, Plus, Minus,
  Check, Loader2,
} from "lucide-react";

import { API } from "./mobileHelpers";

/* ═══════════════════════════════════════════════════════════════
   CART API HELPERS
═══════════════════════════════════════════════════════════════ */
const CART_ITEMS_URL = `${API}/cart/items`;
const CART_KEY       = "mm_cart";

const isLoggedIn = () => !!localStorage.getItem("marketplace_token");

const authHeaders = () => {
  const token = localStorage.getItem("marketplace_token");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
};

/* Guest cart helpers */
function readGuestCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
  catch { return []; }
}

function writeGuestCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event("cart-updated"));
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
function MasonryCard({
  product,
  isWished,
  onWishlist,
  cartInfo,        // { itemId, qty } | null — passed from parent
  onCartUpdate,    // callback to refresh parent's cart map
}) {
  const navigate = useNavigate();

  const {
    id,
    title,
    name,
    price,
    originalPrice,
    original_price,
    old_price,
    image,
    thumbnail,
    images,
    discount,
    rating,
    sold,
    sold_count,
    location,
    isFlashDeal,
    is_featured,
    is_trending,
    badge,
    stock,
    slug,
    has_delivery,
    seller_verified,
  } = product;

  /* ── Derived display values ── */
  const displayTitle = title || name || "Untitled Product";
  const displayImage =
    thumbnail ||
    image ||
    (Array.isArray(images) && (images[0]?.url ?? images[0])) ||
    "/placeholder.png";
  const displayOldPrice = originalPrice || original_price || old_price;
  const displaySold     = sold ?? sold_count ?? 0;
  const maxStock        = stock ?? 99;
  const inStock         = maxStock > 0;
  const lowStock        = inStock && maxStock < 10;

  const discountPct =
    discount ||
    (displayOldPrice && price
      ? Math.round(((displayOldPrice - price) / displayOldPrice) * 100)
      : null);

  /* ── Local state ── */
  const [localQty,    setLocalQty]    = useState(cartInfo?.qty ?? 0);
  const [localItemId, setLocalItemId] = useState(cartInfo?.itemId ?? null);
  const [busy,        setBusy]        = useState(false);
  const [pulsing,     setPulsing]     = useState(false);
  const debounceRef = useRef(null);

  /* Sync with parent when cart map refreshes */
  useEffect(() => {
    setLocalQty(cartInfo?.qty ?? 0);
    setLocalItemId(cartInfo?.itemId ?? null);
  }, [cartInfo?.qty, cartInfo?.itemId]);

  /* ── Utils ── */
  const formatPrice = (val) =>
    val ? `₦${Number(val).toLocaleString()}` : "₦0";

  const haptic = (ms) => {
    try { window.navigator?.vibrate?.(ms); } catch {}
  };

  /* ═══════════════════════════════════════════
     NAVIGATION
  ═══════════════════════════════════════════ */
  const handleOpen = useCallback(() => {
    navigate(`/shop/${slug ?? id}`);
  }, [navigate, slug, id]);

  const handleWish = useCallback((e) => {
    e.stopPropagation();
    onWishlist?.();
    haptic(10);
  }, [onWishlist]);

  /* ═══════════════════════════════════════════
     ADD TO CART (first time)
  ═══════════════════════════════════════════ */
  const handleAdd = useCallback(async (e) => {
    e.stopPropagation();
    if (busy || !inStock) return;

    setBusy(true);
    setPulsing(true);
    haptic(15);
    console.log("🛒 [Masonry] ADD:", id, displayTitle);

    /* Optimistic UI */
    setLocalQty(1);

    try {
      if (isLoggedIn()) {
        const res = await axios.post(
          CART_ITEMS_URL,
          { product_id: id, variant_id: null, qty: 1 },
          { headers: authHeaders(), timeout: 10_000 }
        );
        console.log("✅ [Masonry] Added:", res.data);
        onCartUpdate?.();

      } else {
        /* Guest mode */
        const cart      = readGuestCart();
        const itemKey   = `${id}__default`;
        const existing  = cart.find((c) => c.id === itemKey);

        if (existing) {
          existing.qty = (existing.qty ?? 1) + 1;
        } else {
          cart.push({
            id            : itemKey,
            productId     : id,
            name          : displayTitle,
            image         : displayImage,
            price         : price,
            originalPrice : displayOldPrice,
            variant       : null,
            slug          : slug ?? id,
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
      console.error("❌ [Masonry] Add failed:", err);
      const msg = err.response?.data?.message ?? "Failed to add to cart";
      toast.error(msg, { duration: 3500 });
      setLocalQty(0); // Rollback
    } finally {
      setBusy(false);
      setTimeout(() => setPulsing(false), 600);
    }
  }, [
    busy, inStock, id, displayTitle, displayImage, displayOldPrice,
    price, slug, maxStock, onCartUpdate,
  ]);

  /* ═══════════════════════════════════════════
     INCREASE QUANTITY
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
          console.log("✅ [Masonry] Qty +", newQty);
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
        console.error("❌ [Masonry] Increase failed:", err);
        const msg = err.response?.data?.message ?? "Failed to update";
        toast.error(msg, { duration: 2500 });
        setLocalQty(localQty); // Rollback
      } finally {
        setBusy(false);
      }
    }, 350);
  }, [busy, localItemId, localQty, maxStock, onCartUpdate]);

  /* ═══════════════════════════════════════════
     DECREASE / REMOVE
  ═══════════════════════════════════════════ */
  const handleDecrease = useCallback(async () => {
    if (busy || !localItemId) return;
    haptic(8);

    /* If qty is 1 → REMOVE */
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
          console.log("✅ [Masonry] Removed");
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
        console.error("❌ [Masonry] Remove failed:", err);
        toast.error("Failed to remove");
        setLocalQty(1);
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
          console.log("✅ [Masonry] Qty -", newQty);
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
        console.error("❌ [Masonry] Decrease failed:", err);
        toast.error("Failed to update");
        setLocalQty(localQty);
      } finally {
        setBusy(false);
      }
    }, 350);
  }, [busy, localItemId, localQty, onCartUpdate]);

  /* ═══════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════ */
  return (
    <article className="mcard" onClick={handleOpen}>
      {/* Media */}
      <div className="mcard__media">
        <img
          src={displayImage}
          alt={displayTitle}
          className="mcard__img"
          loading="lazy"
          onError={(e) => (e.currentTarget.src = "/placeholder.png")}
        />

        {/* Top-left badges */}
        <div className="mcard__badges">
          {isFlashDeal && (
            <span className="mcard__badge mcard__badge--flash">
              <Zap size={10} strokeWidth={2.5} fill="currentColor" />
              Flash
            </span>
          )}
          {discountPct > 0 && (
            <span className="mcard__badge mcard__badge--discount">
              -{discountPct}%
            </span>
          )}
          {is_featured && !isFlashDeal && (
            <span className="mcard__badge mcard__badge--feat">⭐</span>
          )}
          {is_trending && !isFlashDeal && (
            <span className="mcard__badge mcard__badge--hot">🔥</span>
          )}
          {badge && !isFlashDeal && !discountPct && (
            <span className="mcard__badge mcard__badge--new">{badge}</span>
          )}
        </div>

        {/* Wishlist */}
        <button
          className={`mcard__wish ${isWished ? "mcard__wish--active" : ""}`}
          onClick={handleWish}
          aria-label={isWished ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart
            size={16}
            strokeWidth={2.2}
            fill={isWished ? "currentColor" : "none"}
          />
        </button>

        {/* Free delivery badge */}
        {has_delivery && (
          <div className="mcard__delivery">Free delivery</div>
        )}

        {/* Low stock alert */}
        {lowStock && (
          <div className="mcard__stock-alert">
            Only {maxStock} left
          </div>
        )}

        {/* Out of stock overlay */}
        {!inStock && (
          <div className="mcard__oos">
            <span>Out of Stock</span>
          </div>
        )}

        {/* In-cart badge */}
        {localQty > 0 && (
          <div className="mcard__in-cart-badge">
            <Check size={9} strokeWidth={3} />
            {localQty} in cart
          </div>
        )}
      </div>

      {/* Body */}
      <div className="mcard__body">
        <h3 className="mcard__title">{displayTitle}</h3>

        <div className="mcard__price-row">
          <span className="mcard__price">{formatPrice(price)}</span>
          {displayOldPrice > price && (
            <span className="mcard__price-old">
              {formatPrice(displayOldPrice)}
            </span>
          )}
        </div>

        {/* Savings badge */}
        {discountPct > 0 && displayOldPrice && (
          <p className="mcard__savings">
            You save {formatPrice(displayOldPrice - price)}
          </p>
        )}

        {/* Meta info */}
        <div className="mcard__meta">
          {rating > 0 && (
            <span className="mcard__rating">
              <Star size={11} fill="currentColor" strokeWidth={0} />
              {Number(rating).toFixed(1)}
            </span>
          )}
          {displaySold > 0 && (
            <span className="mcard__sold">
              {displaySold >= 1000
                ? `${(displaySold / 1000).toFixed(1)}k sold`
                : `${displaySold} sold`}
            </span>
          )}
        </div>

        {location && (
          <p className="mcard__location">📍 {location}</p>
        )}

        {/* Verified seller */}
        {seller_verified && (
          <p className="mcard__verified">
            <Check size={9} strokeWidth={3} /> Verified Seller
          </p>
        )}

        {/* CTA — Add to Cart OR Quantity Stepper */}
        <div className="mcard__cta-wrap" onClick={(e) => e.stopPropagation()}>
          {localQty === 0 ? (
            <button
              className={`mcard__cta ${pulsing ? "mcard__cta--pulse" : ""} ${busy ? "mcard__cta--loading" : ""}`}
              onClick={handleAdd}
              disabled={busy || !inStock}
              aria-label={`Add ${displayTitle} to cart`}
            >
              {busy ? (
                <>
                  <Loader2 size={13} className="mcard__spinner" />
                  Adding…
                </>
              ) : inStock ? (
                <>
                  <ShoppingBag size={13} strokeWidth={2.2} />
                  Add to Cart
                </>
              ) : (
                "Sold Out"
              )}
            </button>
          ) : (
            <div className="mcard__stepper-wrap">
              <div className={`mcard__stepper ${busy ? "mcard__stepper--busy" : ""}`}>
                <button
                  type="button"
                  className="mcard__stepper-btn"
                  onClick={handleDecrease}
                  disabled={busy}
                  aria-label={localQty === 1 ? "Remove from cart" : "Decrease quantity"}
                >
                  <Minus size={12} strokeWidth={2.5} />
                </button>
                <span className="mcard__stepper-val">
                  {busy ? "…" : localQty}
                </span>
                <button
                  type="button"
                  className="mcard__stepper-btn mcard__stepper-btn--plus"
                  onClick={handleIncrease}
                  disabled={busy || localQty >= maxStock}
                  aria-label="Increase quantity"
                >
                  <Plus size={12} strokeWidth={2.5} />
                </button>
              </div>
              <span className="mcard__stepper-label">
                <Check size={10} strokeWidth={3} /> In your cart
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default memo(MasonryCard);