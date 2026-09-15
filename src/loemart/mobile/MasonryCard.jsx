/**
 * src/loemart/mobile/MasonryCard.jsx
 */
import { memo, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import { Heart, ShoppingBag, Star, Zap, Plus, Minus, Check, Loader2 } from "lucide-react";
import { API, primaryImg } from "./mobileHelpers";

const CART_ITEMS_URL = `${API}/cart/items`;
const CART_KEY = "mm_cart";

const isLoggedIn = () => !!localStorage.getItem("marketplace_token");
const authHeaders = () => {
  const token = localStorage.getItem("marketplace_token");
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
};

function readGuestCart() { try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); } catch { return []; } }
function writeGuestCart(cart) { localStorage.setItem(CART_KEY, JSON.stringify(cart)); window.dispatchEvent(new Event("cart-updated")); }

function MasonryCard({ product, isWished, onWishlist, cartInfo, onCartUpdate }) {
  const navigate = useNavigate();
  const { id, title, name, price, originalPrice, original_price, old_price, discount, rating, sold, sold_count, location, isFlashDeal, is_featured, is_trending, badge, stock, slug, has_delivery, seller_verified } = product;

  const displayTitle = title || name || "Untitled Product";
  const displayImage = primaryImg(product.images, product) || "/placeholder.png";
  const displayOldPrice = originalPrice || original_price || old_price;
  const displaySold = sold ?? sold_count ?? 0;
  const maxStock = stock ?? 99;
  const inStock = maxStock > 0;
  
  const discountPct = discount || (displayOldPrice && price ? Math.round(((displayOldPrice - price) / displayOldPrice) * 100) : null);

  const [localQty, setLocalQty] = useState(cartInfo?.qty ?? 0);
  const [localItemId, setLocalItemId] = useState(cartInfo?.itemId ?? null);
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    setLocalQty(cartInfo?.qty ?? 0);
    setLocalItemId(cartInfo?.itemId ?? null);
  }, [cartInfo?.qty, cartInfo?.itemId]);

  const formatPrice = (val) => val ? `₦${Number(val).toLocaleString()}` : "₦0";

  const handleAdd = useCallback(async (e) => {
    e.stopPropagation();
    if (busy || !inStock) return;
    setBusy(true); setLocalQty(1);

    try {
      if (isLoggedIn()) {
        await axios.post(CART_ITEMS_URL, { product_id: id, variant_id: null, qty: 1 }, { headers: authHeaders() });
        onCartUpdate?.();
      } else {
        const cart = readGuestCart();
        const itemKey = `${id}__default`;
        const existing = cart.find((c) => c.id === itemKey);
        if (existing) {
          existing.qty = (existing.qty ?? 1) + 1;
        } else {
          cart.push({ id: itemKey, productId: id, name: displayTitle, image: displayImage, price, variant: null, slug: slug ?? id, qty: 1, stock: maxStock });
        }
        setLocalItemId(itemKey); // FIX: Ensure guest cart ID is set
        writeGuestCart(cart);
        onCartUpdate?.();
      }
      toast.success("Added to cart", { icon: "🛒" });
    } catch (err) {
      setLocalQty(0); toast.error("Failed to add to cart");
    } finally { setBusy(false); }
  }, [busy, inStock, id, displayTitle, displayImage, price, slug, maxStock, onCartUpdate]);

  const handleIncrease = useCallback(() => {
    if (busy || !localItemId) return;
    if (localQty >= maxStock) return toast.error(`Only ${maxStock} available`);
    const newQty = localQty + 1;
    setLocalQty(newQty);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setBusy(true);
      try {
        if (isLoggedIn()) {
          await axios.patch(`${CART_ITEMS_URL}/${localItemId}`, { qty: newQty }, { headers: authHeaders() });
          onCartUpdate?.();
        } else {
          const cart = readGuestCart();
          const idx = cart.findIndex((c) => c.id === localItemId);
          if (idx >= 0) { cart[idx].qty = newQty; writeGuestCart(cart); }
        }
      } catch { setLocalQty(localQty); } finally { setBusy(false); }
    }, 350);
  }, [busy, localItemId, localQty, maxStock, onCartUpdate]);

  const handleDecrease = useCallback(async () => {
    if (busy || !localItemId) return;
    if (localQty <= 1) {
      setBusy(true); setLocalQty(0); const prevId = localItemId; setLocalItemId(null);
      try {
        if (isLoggedIn()) { await axios.delete(`${CART_ITEMS_URL}/${prevId}`, { headers: authHeaders() }); onCartUpdate?.(); } 
        else { writeGuestCart(readGuestCart().filter((c) => c.id !== prevId)); onCartUpdate?.(); }
        toast.success("Removed", { icon: "🗑️" });
      } catch { setLocalQty(1); setLocalItemId(prevId); } finally { setBusy(false); }
      return;
    }
    const newQty = localQty - 1; setLocalQty(newQty);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setBusy(true);
      try {
        if (isLoggedIn()) { await axios.patch(`${CART_ITEMS_URL}/${localItemId}`, { qty: newQty }, { headers: authHeaders() }); onCartUpdate?.(); } 
        else { const cart = readGuestCart(); const idx = cart.findIndex((c) => c.id === localItemId); if (idx >= 0) { cart[idx].qty = newQty; writeGuestCart(cart); } }
      } catch { setLocalQty(localQty); } finally { setBusy(false); }
    }, 350);
  }, [busy, localItemId, localQty, onCartUpdate]);

  return (
    <article className="mcard" onClick={() => navigate(`/shop/${slug ?? id}`)}>
      <div className="mcard__media">
        <img src={displayImage} alt={displayTitle} className="mcard__img" loading="lazy" />
        <div className="mcard__badges">
          {discountPct > 0 && <span className="mcard__badge mcard__badge--discount">-{discountPct}%</span>}
          {isFlashDeal && <span className="mcard__badge mcard__badge--flash"><Zap size={10} /> Flash</span>}
        </div>
      </div>
      <div className="mcard__body">
        <h3 className="mcard__title">{displayTitle}</h3>
        <div className="mcard__price-row">
          <span className="mcard__price">{formatPrice(price)}</span>
          {displayOldPrice > price && <span className="mcard__price-old">{formatPrice(displayOldPrice)}</span>}
        </div>
        <div className="mcard__cta-wrap" onClick={(e) => e.stopPropagation()}>
          {localQty === 0 ? (
            <button className={`mcard__cta ${busy ? "mcard__cta--loading" : ""}`} onClick={handleAdd} disabled={busy || !inStock}>
              {busy ? <Loader2 size={13} className="mcard__spinner" /> : <><ShoppingBag size={13} /> Add to Cart</>}
            </button>
          ) : (
            <div className="mcard__stepper">
              <button onClick={handleDecrease} disabled={busy}><Minus size={12} /></button>
              <span>{localQty}</span>
              <button onClick={handleIncrease} disabled={busy || localQty >= maxStock}><Plus size={12} /></button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
export default memo(MasonryCard);