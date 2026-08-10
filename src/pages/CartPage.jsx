/**
 * src/pages/CartPage.jsx
 * Route: /shop/cart
 *
 * WITH LIVE DEBUG PANEL — remove when working
 */

import {
  useState, useEffect, useCallback, useMemo, useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";

import {
  formatPrice,
  getProductImage,
} from "../config/marketplace";
import useWishlist from "../hooks/useWishlist";

import "../styles/CartPage.css";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const BASE           = import.meta.env.VITE_API_BASE_URL;
const API            = `${BASE}/api`;
const CART_URL       = `${API}/cart`;
const CART_ITEMS_URL = `${API}/cart/items`;

const CART_KEY = "mm_cart";

/* ═══════════════════════════════════════════════════════════════
   AUTH HELPERS
═══════════════════════════════════════════════════════════════ */
const isLoggedIn = () => !!localStorage.getItem("marketplace_token");

const authHeaders = () => {
  const token = localStorage.getItem("marketplace_token");
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
};

/* ═══════════════════════════════════════════════════════════════
   GUEST CART STORAGE
═══════════════════════════════════════════════════════════════ */
const readGuestCart = () => {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
  catch { return []; }
};

const writeGuestCart = (cart) => {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event("cart-updated"));
};

/* ═══════════════════════════════════════════════════════════════
   ICONS
═══════════════════════════════════════════════════════════════ */
const Icon = {
  minus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
      strokeLinecap="round" width={14} height={14}>
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
      strokeLinecap="round" width={14} height={14}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5"  y1="12" x2="19" y2="12" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  truck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  tag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  cart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" width={48} height={48}>
      <circle cx="9"  cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   ★ LIVE DEBUG PANEL ★
═══════════════════════════════════════════════════════════════ */
function DebugPanel({ debug, onClose, onRetry }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{
      position     : "fixed",
      bottom       : 80,
      left         : 8,
      right        : 8,
      zIndex       : 9999,
      background   : "#0f172a",
      color        : "#f1f5f9",
      borderRadius : 12,
      padding      : 12,
      fontSize     : 11,
      fontFamily   : "monospace",
      lineHeight   : 1.5,
      maxHeight    : expanded ? "70vh" : 40,
      overflow     : "auto",
      boxShadow    : "0 10px 40px rgba(0,0,0,0.5)",
      border       : "2px solid #ff5722",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: expanded ? 8 : 0,
        cursor: "pointer",
      }}
      onClick={() => setExpanded(!expanded)}>
        <strong style={{ color: "#ff5722" }}>🔍 CART DEBUG PANEL</strong>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onRetry(); }}
            style={{
              background: "#10b981", color: "#fff", border: "none",
              padding: "4px 10px", borderRadius: 4, fontSize: 10, cursor: "pointer"
            }}
          >
            🔄 Retry
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            style={{
              background: "#ef4444", color: "#fff", border: "none",
              padding: "4px 10px", borderRadius: 4, fontSize: 10, cursor: "pointer"
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {/* Config */}
          <div style={{ marginBottom: 10, padding: 8, background: "#1e293b", borderRadius: 6 }}>
            <div style={{ color: "#fbbf24", marginBottom: 4 }}>📡 CONFIG</div>
            <div>BASE: <span style={{ color: "#10b981" }}>{debug.base || "❌ MISSING"}</span></div>
            <div>URL:  <span style={{ color: "#10b981" }}>{debug.url}</span></div>
            <div>Token: <span style={{ color: debug.hasToken ? "#10b981" : "#ef4444" }}>
              {debug.hasToken ? `✓ Present (${debug.tokenPreview})` : "❌ Missing"}
            </span></div>
            <div>Logged in: <span style={{ color: debug.loggedIn ? "#10b981" : "#fbbf24" }}>
              {debug.loggedIn ? "✓ Yes" : "⚠ No (guest mode)"}
            </span></div>
          </div>

          {/* Request */}
          {debug.request && (
            <div style={{ marginBottom: 10, padding: 8, background: "#1e293b", borderRadius: 6 }}>
              <div style={{ color: "#fbbf24", marginBottom: 4 }}>📤 LAST REQUEST</div>
              <div>Method: {debug.request.method}</div>
              <div>Headers: {JSON.stringify(debug.request.headers, null, 2)}</div>
              <div>Time: {debug.request.time}</div>
            </div>
          )}

          {/* Response */}
          {debug.response && (
            <div style={{ marginBottom: 10, padding: 8, background: "#1e293b", borderRadius: 6 }}>
              <div style={{ color: "#fbbf24", marginBottom: 4 }}>
                📥 LAST RESPONSE
                <span style={{
                  marginLeft: 8,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: debug.response.status >= 200 && debug.response.status < 300
                    ? "#10b981" : "#ef4444",
                  color: "#fff",
                  fontSize: 9,
                }}>
                  {debug.response.status || "NO RESPONSE"}
                </span>
              </div>
              <pre style={{
                margin: "6px 0 0",
                background: "#0f172a",
                padding: 8,
                borderRadius: 4,
                overflow: "auto",
                maxHeight: 200,
                fontSize: 10,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}>
                {typeof debug.response.body === "string"
                  ? debug.response.body
                  : JSON.stringify(debug.response.body, null, 2)}
              </pre>
            </div>
          )}

          {/* Error */}
          {debug.error && (
            <div style={{ marginBottom: 10, padding: 8, background: "#7f1d1d", borderRadius: 6 }}>
              <div style={{ color: "#fca5a5", marginBottom: 4 }}>❌ ERROR</div>
              <div>Message: {debug.error.message}</div>
              <div>Code: {debug.error.code || "N/A"}</div>
              <div>Status: {debug.error.status || "N/A"}</div>
              {debug.error.stack && (
                <pre style={{
                  margin: "6px 0 0",
                  background: "#0f172a",
                  padding: 8,
                  borderRadius: 4,
                  overflow: "auto",
                  maxHeight: 100,
                  fontSize: 10,
                }}>
                  {debug.error.stack.split("\n").slice(0, 5).join("\n")}
                </pre>
              )}
            </div>
          )}

          {/* Cart Data */}
          {debug.items && (
            <div style={{ padding: 8, background: "#1e293b", borderRadius: 6 }}>
              <div style={{ color: "#fbbf24", marginBottom: 4 }}>
                🛒 CART ITEMS ({debug.items.length})
              </div>
              <pre style={{
                margin: 0,
                fontSize: 10,
                overflow: "auto",
                maxHeight: 150,
              }}>
                {JSON.stringify(debug.items, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SKELETON
═══════════════════════════════════════════════════════════════ */
function CartSkeleton() {
  return (
    <div className="cp-skeleton" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="cp-skel-item">
          <div className="cp-skel cp-skel-img" />
          <div className="cp-skel-body">
            <div className="cp-skel" style={{ height: 12, width: "80%", borderRadius: 4 }} />
            <div className="cp-skel" style={{ height: 12, width: "50%", borderRadius: 4, marginTop: 8 }} />
            <div className="cp-skel" style={{ height: 18, width: "35%", borderRadius: 5, marginTop: 12 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EMPTY STATE
═══════════════════════════════════════════════════════════════ */
function EmptyCart({ onShop }) {
  return (
    <div className="cp-empty">
      <div className="cp-empty__illustration" aria-hidden="true">
        <div className="cp-empty__circle">{Icon.cart}</div>
      </div>
      <h2 className="cp-empty__title">Your cart is empty</h2>
      <p className="cp-empty__text">
        Looks like you haven't added anything yet.<br />
        Discover thousands of products at great prices.
      </p>
      <button className="cp-empty__btn" onClick={onShop}>
        Start Shopping {Icon.arrow}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ERROR STATE
═══════════════════════════════════════════════════════════════ */
function ErrorState({ message, onRetry, onShowDebug }) {
  return (
    <div className="cp-empty">
      <div className="cp-empty__illustration" aria-hidden="true">
        <div className="cp-empty__circle" style={{ color: "#ef4444" }}>⚠️</div>
      </div>
      <h2 className="cp-empty__title">Failed to load your cart</h2>
      <p className="cp-empty__text">{message}</p>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button className="cp-empty__btn" onClick={onRetry}>
          Try again
        </button>
        <button
          className="cp-empty__btn"
          onClick={onShowDebug}
          style={{ background: "#0f172a" }}
        >
          🔍 Show Debug
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CART ITEM
═══════════════════════════════════════════════════════════════ */
function CartItem({
  item, onQtyChange, onRemove, onMoveToWishlist, onClick,
}) {
  const [localQty, setLocalQty] = useState(item.qty ?? 1);
  const debounceRef = useRef(null);

  useEffect(() => {
    setLocalQty(item.qty ?? 1);
  }, [item.qty]);

  const stock = item.stock ?? 99;
  const price = Number(item.price ?? 0);
  const orig  = Number(item.originalPrice ?? item.original_price ?? 0);
  const hasDiscount = orig > price;
  const savings     = hasDiscount ? (orig - price) * localQty : 0;
  const subtotal    = price * localQty;

  const handleDec = () => {
    if (localQty <= 1) return;
    const newQty = localQty - 1;
    setLocalQty(newQty);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onQtyChange(item.id, newQty), 300);
    window.navigator?.vibrate?.(8);
  };

  const handleInc = () => {
    if (localQty >= stock) {
      toast.error(`Only ${stock} in stock`);
      return;
    }
    const newQty = localQty + 1;
    setLocalQty(newQty);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onQtyChange(item.id, newQty), 300);
    window.navigator?.vibrate?.(8);
  };

  return (
    <article className="cp-item">
      <div
        className="cp-item__img-wrap"
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onClick()}
        aria-label={`View ${item.name}`}
      >
        {item.image ? (
          <img src={item.image} alt={item.name} className="cp-item__img" loading="lazy" />
        ) : (
          <div className="cp-item__ph">📦</div>
        )}
        {hasDiscount && (
          <span className="cp-item__discount">
            -{Math.round(((orig - price) / orig) * 100)}%
          </span>
        )}
      </div>

      <div className="cp-item__body">
        <h3 className="cp-item__name" onClick={onClick}>{item.name}</h3>

        {item.variant?.name && (
          <p className="cp-item__variant">{item.variant.name}</p>
        )}
        {item.variant_name && !item.variant?.name && (
          <p className="cp-item__variant">{item.variant_name}</p>
        )}

        {stock <= 5 && stock > 0 && (
          <p className="cp-item__stock-alert">
            ⚠️ Only {stock} left in stock
          </p>
        )}

        <div className="cp-item__price-row">
          <span className="cp-item__price">{formatPrice(price)}</span>
          {hasDiscount && (
            <span className="cp-item__original">{formatPrice(orig)}</span>
          )}
        </div>

        {savings > 0 && (
          <p className="cp-item__savings">
            You save {formatPrice(savings)}
          </p>
        )}

        <div className="cp-item__actions">
          <div className="cp-qty">
            <button
              type="button"
              className="cp-qty__btn"
              onClick={handleDec}
              disabled={localQty <= 1}
              aria-label="Decrease quantity"
            >
              {Icon.minus}
            </button>
            <span className="cp-qty__val">{localQty}</span>
            <button
              type="button"
              className="cp-qty__btn cp-qty__btn--plus"
              onClick={handleInc}
              disabled={localQty >= stock}
              aria-label="Increase quantity"
            >
              {Icon.plus}
            </button>
          </div>

          <span className="cp-item__subtotal">{formatPrice(subtotal)}</span>
        </div>

        <div className="cp-item__icons">
          <button
            type="button"
            className="cp-item__icon-btn"
            onClick={() => onMoveToWishlist(item)}
          >
            {Icon.heart} <span>Save for later</span>
          </button>
          <button
            type="button"
            className="cp-item__icon-btn cp-item__icon-btn--danger"
            onClick={() => onRemove(item)}
          >
            {Icon.trash} <span>Remove</span>
          </button>
        </div>
      </div>
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function CartPage({ user }) {
  const navigate = useNavigate();
  const { toggle: toggleWishlist } = useWishlist();

  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [checking,   setChecking]   = useState(false);
  const [errorMsg,   setErrorMsg]   = useState(null);

  /* ── DEBUG STATE ── */
  const [debug,          setDebug]          = useState({});
  const [showDebug,      setShowDebug]      = useState(true); // Show by default
  const [debugCollapsed, setDebugCollapsed] = useState(false);

  const loggedIn = isLoggedIn();

  /* ════════════════════════════════════════════════════════
     LOAD CART — with full debug tracing
  ════════════════════════════════════════════════════════ */
  const loadCart = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    const token         = localStorage.getItem("marketplace_token");
    const tokenPreview  = token ? `${token.slice(0, 20)}…` : null;
    const requestTime   = new Date().toISOString();

    /* Initial debug snapshot */
    const debugData = {
      base         : BASE,
      url          : CART_URL,
      hasToken     : !!token,
      tokenPreview,
      loggedIn,
      request: {
        method  : "GET",
        headers : loggedIn ? { Authorization: `Bearer ${tokenPreview}` } : {},
        time    : requestTime,
      },
      response : null,
      error    : null,
      items    : null,
    };
    setDebug(debugData);

    console.log("═══════════════════════════════════════════");
    console.log("🛒 [CartPage] LOAD CART");
    console.log("URL:", CART_URL);
    console.log("Token:", token ? "✓ Present" : "❌ Missing");
    console.log("Logged in:", loggedIn);
    console.log("═══════════════════════════════════════════");

    try {
      if (loggedIn) {
        /* ═══════════════════════════════════════
           LOGGED IN — fetch from server
        ═══════════════════════════════════════ */
        if (!BASE) {
          throw new Error("VITE_API_BASE_URL is not set! Check your .env file.");
        }

        const res = await axios.get(CART_URL, {
          headers : authHeaders(),
          timeout : 15_000,
        });

        console.log("✅ [CartPage] Response:", res.status, res.data);

        /* Update debug with response */
        setDebug((prev) => ({
          ...prev,
          response: {
            status : res.status,
            body   : res.data,
          },
        }));

        const serverItems = res.data?.data?.items ?? [];

        const normalized = serverItems.map((s) => ({
          id            : s.id,
          productId     : s.product_id,
          name          : s.product_name ?? s.name,
          image         : s.image_url ?? s.image,
          price         : Number(s.price),
          originalPrice : Number(s.original_price ?? 0),
          qty           : s.qty ?? 1,
          stock         : s.stock ?? 99,
          variant       : s.variant_id ? {
            id  : s.variant_id,
            name: s.variant_name,
            sku : s.variant_sku,
          } : null,
          slug          : s.slug ?? s.product_id,
        }));

        setItems(normalized);
        setDebug((prev) => ({ ...prev, items: normalized }));

      } else {
        /* ═══════════════════════════════════════
           GUEST — read from localStorage
        ═══════════════════════════════════════ */
        const guestItems = readGuestCart();
        console.log("👤 [CartPage] Guest cart:", guestItems);

        setItems(guestItems);
        setDebug((prev) => ({
          ...prev,
          response: { status: "guest", body: "localStorage" },
          items   : guestItems,
        }));
      }

    } catch (err) {
      console.error("❌ [CartPage] Load failed:", err);

      const errorInfo = {
        message : err.message,
        code    : err.code,
        status  : err.response?.status,
        stack   : err.stack,
      };

      /* Update debug with error */
      setDebug((prev) => ({
        ...prev,
        response: err.response ? {
          status : err.response.status,
          body   : err.response.data,
        } : null,
        error: errorInfo,
      }));

      /* Extract user-friendly message */
      const friendlyMsg =
        err.response?.data?.message ??
        err.response?.data?.error ??
        (err.code === "ERR_NETWORK"
          ? "Cannot reach server. Check your internet connection."
          : err.code === "ECONNABORTED"
          ? "Request timed out. Please try again."
          : err.message);

      setErrorMsg(friendlyMsg);
      toast.error(friendlyMsg);

      /* Show debug automatically on error */
      setShowDebug(true);

      /* Fallback to guest cart if server fails */
      if (!loggedIn) {
        setItems(readGuestCart());
      } else {
        setItems([]);
      }
    } finally {
      setLoading(false);
    }
  }, [loggedIn]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  /* ════════════════════════════════════════════════════════
     QUANTITY UPDATE
  ════════════════════════════════════════════════════════ */
  const handleQtyChange = useCallback(async (itemId, newQty) => {
    if (loggedIn) {
      try {
        const res = await axios.patch(
          `${CART_ITEMS_URL}/${itemId}`,
          { qty: newQty },
          { headers: authHeaders() }
        );
        console.log("✓ Qty updated:", res.data);
        setItems((prev) =>
          prev.map((i) => i.id === itemId ? { ...i, qty: newQty } : i)
        );
        window.dispatchEvent(new Event("cart-updated"));
      } catch (err) {
        console.error("❌ Qty update failed:", err);
        toast.error(err.response?.data?.message ?? "Failed to update quantity");
      }
    } else {
      const cart = readGuestCart();
      const idx  = cart.findIndex((c) => c.id === itemId);
      if (idx >= 0) {
        cart[idx].qty = newQty;
        writeGuestCart(cart);
        setItems(cart);
      }
    }
  }, [loggedIn]);

  /* ════════════════════════════════════════════════════════
     REMOVE (with undo)
  ════════════════════════════════════════════════════════ */
  const handleRemove = useCallback(async (item) => {
    const removed = { ...item };
    setItems((prev) => prev.filter((i) => i.id !== item.id));

    if (loggedIn) {
      try {
        await axios.delete(`${CART_ITEMS_URL}/${item.id}`, {
          headers: authHeaders(),
        });
        window.dispatchEvent(new Event("cart-updated"));
      } catch (err) {
        console.error("❌ Remove failed:", err);
        setItems((prev) => [...prev, removed]);
        toast.error("Failed to remove item");
        return;
      }
    } else {
      const cart = readGuestCart().filter((c) => c.id !== item.id);
      writeGuestCart(cart);
    }

    toast(
      (t) => (
        <div className="cp-undo-toast">
          <span>
            <strong>Removed</strong> {item.name.slice(0, 30)}
            {item.name.length > 30 ? "…" : ""}
          </span>
          <button
            className="cp-undo-toast__btn"
            onClick={() => {
              if (loggedIn) {
                axios.post(
                  CART_ITEMS_URL,
                  {
                    product_id: item.productId,
                    variant_id: item.variant?.id ?? null,
                    qty       : item.qty,
                  },
                  { headers: authHeaders() }
                ).then(() => {
                  window.dispatchEvent(new Event("cart-updated"));
                  loadCart();
                }).catch((e) => {
                  console.error("❌ Restore failed:", e);
                  toast.error("Could not restore item");
                });
              } else {
                const cart = readGuestCart();
                cart.push(removed);
                writeGuestCart(cart);
                setItems(cart);
              }
              toast.dismiss(t.id);
            }}
          >
            Undo
          </button>
        </div>
      ),
      { duration: 5000, position: "bottom-center" }
    );
  }, [loggedIn, loadCart]);

  /* ════════════════════════════════════════════════════════
     MOVE TO WISHLIST
  ════════════════════════════════════════════════════════ */
  const handleMoveToWishlist = useCallback(async (item) => {
    toggleWishlist(item.productId);
    await handleRemove(item);
    toast.success("Moved to wishlist ❤️");
  }, [toggleWishlist, handleRemove]);

  /* ════════════════════════════════════════════════════════
     CALCULATIONS
  ════════════════════════════════════════════════════════ */
  const {
    subtotal,
    totalSavings,
    itemCount,
    total,
    deliveryFee,
    hasFreeDelivery,
  } = useMemo(() => {
    const sub = items.reduce((s, i) => s + (Number(i.price) * i.qty), 0);
    const sav = items.reduce((s, i) => {
      const orig  = Number(i.originalPrice ?? i.original_price ?? 0);
      const price = Number(i.price);
      return s + (orig > price ? (orig - price) * i.qty : 0);
    }, 0);
    const count = items.reduce((s, i) => s + i.qty, 0);

    const freeDeliveryThreshold = 50_000;
    const free  = sub >= freeDeliveryThreshold;
    const fee   = free ? 0 : 1_500;
    const grand = sub + fee;

    return {
      subtotal        : sub,
      totalSavings    : sav,
      itemCount       : count,
      total           : grand,
      deliveryFee     : fee,
      hasFreeDelivery : free,
    };
  }, [items]);

  /* ════════════════════════════════════════════════════════
     CHECKOUT
  ════════════════════════════════════════════════════════ */
  const handleCheckout = useCallback(async () => {
    if (!loggedIn) {
      localStorage.setItem("post_auth_redirect", "/shop/checkout");
      toast("Please sign in to checkout", { icon: "🔒" });
      navigate("/auth");
      return;
    }
    setChecking(true);
    setTimeout(() => {
      navigate("/shop/checkout");
      setChecking(false);
    }, 400);
  }, [loggedIn, navigate]);

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div className="cp-page">

      {/* ★ DEBUG PANEL ★ */}
      {showDebug && (
        <DebugPanel
          debug={debug}
          onClose={() => setShowDebug(false)}
          onRetry={loadCart}
        />
      )}

      {/* Header */}
      <header className="cp-header">
        <button
          type="button"
          className="cp-header__back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          {Icon.back}
        </button>
        <h1 className="cp-header__title">
          Your Cart
          {items.length > 0 && (
            <span className="cp-header__count">({itemCount})</span>
          )}
        </h1>
        {!showDebug && (
          <button
            onClick={() => setShowDebug(true)}
            style={{
              marginLeft: "auto",
              background: "#0f172a",
              color: "#fff",
              border: "none",
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            🔍 Debug
          </button>
        )}
      </header>

      {/* Loading */}
      {loading && <CartSkeleton />}

      {/* Error */}
      {!loading && errorMsg && items.length === 0 && (
        <ErrorState
          message={errorMsg}
          onRetry={loadCart}
          onShowDebug={() => setShowDebug(true)}
        />
      )}

      {/* Empty (no error) */}
      {!loading && !errorMsg && items.length === 0 && (
        <EmptyCart onShop={() => navigate("/loemart")} />
      )}

      {/* Items */}
      {!loading && items.length > 0 && (
        <>
          {!hasFreeDelivery && (
            <div className="cp-free-shipping-banner">
              <span className="cp-free-shipping-banner__icon">{Icon.truck}</span>
              <div className="cp-free-shipping-banner__body">
                <p className="cp-free-shipping-banner__title">
                  Add <strong>{formatPrice(50_000 - subtotal)}</strong> more for FREE delivery
                </p>
                <div className="cp-free-shipping-bar">
                  <div
                    className="cp-free-shipping-bar__fill"
                    style={{ width: `${Math.min(100, (subtotal / 50_000) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {hasFreeDelivery && (
            <div className="cp-free-shipping-banner cp-free-shipping-banner--achieved">
              <span className="cp-free-shipping-banner__icon">🎉</span>
              <div className="cp-free-shipping-banner__body">
                <p className="cp-free-shipping-banner__title">
                  <strong>You qualify for FREE delivery!</strong>
                </p>
              </div>
            </div>
          )}

          <div className="cp-items">
            {items.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                onQtyChange={handleQtyChange}
                onRemove={handleRemove}
                onMoveToWishlist={handleMoveToWishlist}
                onClick={() => navigate(`/shop/${item.slug}`)}
              />
            ))}
          </div>

          {totalSavings > 0 && (
            <div className="cp-savings-badge">
              <span aria-hidden="true">💰</span>
              You're saving <strong>{formatPrice(totalSavings)}</strong> on this order
            </div>
          )}

          <section className="cp-summary" aria-label="Order summary">
            <h3 className="cp-summary__title">Order Summary</h3>

            <div className="cp-summary__row">
              <span>Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})</span>
              <span>{formatPrice(subtotal)}</span>
            </div>

            {totalSavings > 0 && (
              <div className="cp-summary__row cp-summary__row--savings">
                <span>Discount savings</span>
                <span>−{formatPrice(totalSavings)}</span>
              </div>
            )}

            <div className="cp-summary__row">
              <span>Delivery fee</span>
              <span className={hasFreeDelivery ? "cp-summary__free" : ""}>
                {hasFreeDelivery ? "FREE" : formatPrice(deliveryFee)}
              </span>
            </div>

            <div className="cp-summary__divider" />

            <div className="cp-summary__row cp-summary__row--total">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>

            {totalSavings > 0 && (
              <p className="cp-summary__savings-note">
                You saved {formatPrice(totalSavings)} today 🎉
              </p>
            )}
          </section>

          <div className="cp-trust-row">
            <div className="cp-trust-item">
              <span className="cp-trust-item__icon">{Icon.shield}</span>
              <span>Secure Checkout</span>
            </div>
            <div className="cp-trust-item">
              <span className="cp-trust-item__icon">{Icon.truck}</span>
              <span>Fast Delivery</span>
            </div>
            <div className="cp-trust-item">
              <span className="cp-trust-item__icon">{Icon.tag}</span>
              <span>Best Prices</span>
            </div>
          </div>

          <div style={{ height: 110 }} aria-hidden="true" />
        </>
      )}

      {/* Sticky checkout bar */}
      {!loading && items.length > 0 && (
        <div className="cp-sticky-bar" role="region" aria-label="Checkout">
          <div className="cp-sticky-bar__left">
            <span className="cp-sticky-bar__label">Total</span>
            <span className="cp-sticky-bar__total">{formatPrice(total)}</span>
            {totalSavings > 0 && (
              <span className="cp-sticky-bar__savings">
                Save {formatPrice(totalSavings)}
              </span>
            )}
          </div>

          <button
            type="button"
            className="cp-sticky-bar__cta"
            onClick={handleCheckout}
            disabled={checking}
          >
            {checking ? (
              <>
                <span className="cp-spinner" /> Processing…
              </>
            ) : (
              <>
                Checkout ({itemCount}) {Icon.arrow}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}