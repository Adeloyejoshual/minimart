/**
 * src/loemart/mobile/MasonryCard.jsx
 */
import { memo, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import {
  Heart,
  ShoppingBag,
  Star,
  Zap,
  Plus,
  Minus,
  Check,
  Loader2,
  Sliders,
} from "lucide-react";

import { API, primaryImg } from "./mobileHelpers";
import "./styles/MasonryCard.css";

const CART_ITEMS_URL = `${API}/cart/items`;
const CART_KEY       = "mm_cart";

const isLoggedIn = () => {
  const t = localStorage.getItem("marketplace_token");
  return !!(t && t !== "null" && t !== "undefined");
};

const authHeaders = () => {
  const token = localStorage.getItem("marketplace_token");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
};

function readGuestCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
  catch { return []; }
}

function writeGuestCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event("cart-updated"));
}

function MasonryCard({
  product,
  isWished,
  onWishlist,
  cartInfo,        // { itemId, qty }
  onCartUpdate,    // Callback to sync parent state
}) {
  const navigate = useNavigate();

  const {
    id,
    product_id,
    _id,
    title,
    name,
    price,
    selling_price,
    originalPrice,
    original_price,
    old_price,
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
    variants,
    has_variants,
  } = product || {};

  /* ── Derived display values ── */
  const realId          = String(id || product_id || _id || "");
  const displayTitle   = title || name || "Untitled Product";
  const displayImage   = primaryImg(product?.images, product) || "/placeholder.png";
  const realPrice      = price || selling_price || 0;
  const displayOldPrice = originalPrice || original_price || old_price;
  const displaySold     = sold ?? sold_count ?? 0;
  const maxStock        = stock ?? 99;
  const inStock         = maxStock > 0;
  const lowStock        = inStock && maxStock < 10;

  // Check if product has sizes/colors/variants
  const hasVariants = Boolean(
    (Array.isArray(variants) && variants.length > 0) ||
    has_variants ||
    product?.options?.length > 0
  );

  const discountPct =
    discount ||
    (displayOldPrice && realPrice
      ? Math.round(((displayOldPrice - realPrice) / displayOldPrice) * 100)
      : null);

  /* ── Local cart state ── */
  const [localQty, setLocalQty]       = useState(cartInfo?.qty ?? 0);
  const [localItemId, setLocalItemId] = useState(cartInfo?.itemId ?? null);
  const [busy, setBusy]               = useState(false);
  const debounceRef                   = useRef(null);

  /* Sync with parent when cart changes */
  useEffect(() => {
    setLocalQty(cartInfo?.qty ?? 0);
    setLocalItemId(cartInfo?.itemId ?? null);
  }, [cartInfo?.qty, cartInfo?.itemId]);

  const formatPrice = (val) =>
    val ? `₦${Number(val).toLocaleString()}` : "₦0";

  /* ═══════════════════════════════════════════
     NAVIGATION
  ═══════════════════════════════════════════ */
  const handleOpen = useCallback(() => {
    if (realId || slug) {
      navigate(`/shop/${slug || realId}`);
    }
  }, [navigate, slug, realId]);

  const handleWish = useCallback((e) => {
    e.stopPropagation();
    onWishlist?.();
  }, [onWishlist]);

  /* ═══════════════════════════════════════════
     ADD TO CART
  ═══════════════════════════════════════════ */
  const handleAdd = useCallback(async (e) => {
    e.stopPropagation();
    if (busy || !inStock) return;

    // IF HAS VARIANTS: Direct user to Product Detail page to choose Size/Color
    if (hasVariants) {
      toast("Please select an option", { icon: "⚙️", duration: 2500 });
      navigate(`/shop/${slug || realId}`);
      return;
    }

    setBusy(true);
    setLocalQty(1); // Optimistic UI

    const addGuestItem = () => {
      const cart    = readGuestCart();
      const itemKey = `${realId}__default`;
      const idx     = cart.findIndex((c) => String(c.productId || c.product_id) === realId);

      if (idx >= 0) {
        cart[idx].qty = (Number(cart[idx].qty) || 1) + 1;
        setLocalQty(cart[idx].qty);
      } else {
        cart.push({
          id            : itemKey,
          productId     : realId,
          product_id    : realId,
          name          : displayTitle,
          image         : displayImage,
          price         : Number(realPrice),
          originalPrice : displayOldPrice ? Number(displayOldPrice) : null,
          variant       : null,
          slug          : slug || realId,
          qty           : 1,
          stock         : maxStock,
          addedAt       : Date.now(),
        });
        setLocalItemId(itemKey);
      }
      writeGuestCart(cart);
      onCartUpdate?.();
    };

    try {
      if (isLoggedIn()) {
        try {
          await axios.post(
            CART_ITEMS_URL,
            { product_id: realId, variant_id: null, qty: 1 },
            { headers: authHeaders(), timeout: 10000 }
          );
          onCartUpdate?.();
        } catch (apiErr) {
          const status = apiErr?.response?.status;
          if (status === 401 || status === 403) {
            localStorage.removeItem("marketplace_token");
            addGuestItem();
          } else {
            throw apiErr;
          }
        }
      } else {
        addGuestItem();
      }

      toast.success("Added to cart", { duration: 2000, icon: "🛒" });
    } catch (err) {
      console.error("Add to cart failed:", err);
      const msg = err.response?.data?.message ?? "Failed to add to cart";
      toast.error(msg, { duration: 3000 });
      setLocalQty(0); // Rollback
    } finally {
      setBusy(false);
    }
  }, [
    busy, inStock, hasVariants, navigate, slug, realId,
    displayTitle, displayImage, realPrice, displayOldPrice,
    maxStock, onCartUpdate,
  ]);

  /* ═══════════════════════════════════════════
     INCREASE QUANTITY
  ═══════════════════════════════════════════ */
  const handleIncrease = useCallback(() => {
    if (busy) return;
    if (localQty >= maxStock) {
      toast.error(`Only ${maxStock} available`, { duration: 2000 });
      return;
    }

    const newQty = localQty + 1;
    setLocalQty(newQty); // Optimistic

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setBusy(true);
      try {
        if (isLoggedIn() && localItemId) {
          await axios.patch(
            `${CART_ITEMS_URL}/${localItemId}`,
            { qty: newQty },
            { headers: authHeaders(), timeout: 8000 }
          );
          onCartUpdate?.();
        } else {
          const cart = readGuestCart();
          const idx  = cart.findIndex((c) => String(c.id) === String(localItemId) || String(c.productId) === realId);
          if (idx >= 0) {
            cart[idx].qty = newQty;
            writeGuestCart(cart);
            onCartUpdate?.();
          }
        }
      } catch (err) {
        toast.error("Failed to update quantity");
        setLocalQty(localQty); // Rollback
      } finally {
        setBusy(false);
      }
    }, 300);
  }, [busy, localQty, maxStock, localItemId, realId, onCartUpdate]);

  /* ═══════════════════════════════════════════
     DECREASE / REMOVE QUANTITY
  ═══════════════════════════════════════════ */
  const handleDecrease = useCallback(async () => {
    if (busy) return;

    if (localQty <= 1) {
      setBusy(true);
      setLocalQty(0);
      const prevItemId = localItemId;
      setLocalItemId(null);

      try {
        if (isLoggedIn() && prevItemId) {
          await axios.delete(`${CART_ITEMS_URL}/${prevItemId}`, {
            headers: authHeaders(),
            timeout: 8000,
          });
          onCartUpdate?.();
        } else {
          const cart = readGuestCart().filter((c) => String(c.id) !== String(prevItemId) && String(c.productId) !== realId);
          writeGuestCart(cart);
          onCartUpdate?.();
        }
        toast.success("Removed from cart", { duration: 2000, icon: "🗑️" });
      } catch (err) {
        toast.error("Failed to remove");
        setLocalQty(1);
        setLocalItemId(prevItemId);
      } finally {
        setBusy(false);
      }
      return;
    }

    const newQty = localQty - 1;
    setLocalQty(newQty); // Optimistic

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setBusy(true);
      try {
        if (isLoggedIn() && localItemId) {
          await axios.patch(
            `${CART_ITEMS_URL}/${localItemId}`,
            { qty: newQty },
            { headers: authHeaders(), timeout: 8000 }
          );
          onCartUpdate?.();
        } else {
          const cart = readGuestCart();
          const idx  = cart.findIndex((c) => String(c.id) === String(localItemId) || String(c.productId) === realId);
          if (idx >= 0) {
            cart[idx].qty = newQty;
            writeGuestCart(cart);
            onCartUpdate?.();
          }
        }
      } catch (err) {
        toast.error("Failed to update");
        setLocalQty(localQty); // Rollback
      } finally {
        setBusy(false);
      }
    }, 300);
  }, [busy, localQty, localItemId, realId, onCartUpdate]);

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

        {/* Top Badges */}
        <div className="mcard__badges">
          {discountPct > 0 && (
            <span className="mcard__badge mcard__badge--discount">
              -{discountPct}%
            </span>
          )}
          {isFlashDeal && (
            <span className="mcard__badge mcard__badge--flash">
              <Zap size={10} strokeWidth={2.5} fill="currentColor" />
              Flash
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

        {/* Wishlist button */}
        <button
          type="button"
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

        {/* Delivery badge */}
        {has_delivery && <div className="mcard__delivery">Free delivery</div>}

        {/* Low stock alert */}
        {lowStock && <div className="mcard__stock-alert">Only {maxStock} left</div>}

        {/* Out of stock overlay */}
        {!inStock && (
          <div className="mcard__oos">
            <span>Out of Stock</span>
          </div>
        )}

        {/* In-cart badge indicator */}
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
          <span className="mcard__price">{formatPrice(realPrice)}</span>
          {displayOldPrice > realPrice && (
            <span className="mcard__price-old">
              {formatPrice(displayOldPrice)}
            </span>
          )}
        </div>

        {/* Savings badge */}
        {discountPct > 0 && displayOldPrice && (
          <p className="mcard__savings">
            You save {formatPrice(displayOldPrice - realPrice)}
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

        {location && <p className="mcard__location">📍 {location}</p>}

        {seller_verified && (
          <p className="mcard__verified">
            <Check size={9} strokeWidth={3} /> Verified Seller
          </p>
        )}

        {/* CTA — Add to Cart OR Select Options OR Stepper */}
        <div className="mcard__cta-wrap" onClick={(e) => e.stopPropagation()}>
          {localQty === 0 ? (
            <button
              type="button"
              className={`mcard__cta ${busy ? "mcard__cta--loading" : ""}`}
              onClick={handleAdd}
              disabled={busy || !inStock}
              aria-label={`Add ${displayTitle} to cart`}
            >
              {busy ? (
                <>
                  <Loader2 size={13} className="mcard__spinner" />
                  Adding…
                </>
              ) : !inStock ? (
                "Sold Out"
              ) : hasVariants ? (
                <>
                  <Sliders size={13} strokeWidth={2.2} />
                  Select Options
                </>
              ) : (
                <>
                  <ShoppingBag size={13} strokeWidth={2.2} />
                  Add to Cart
                </>
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