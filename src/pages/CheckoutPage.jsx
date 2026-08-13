/**
 * src/pages/CheckoutPage.jsx
 * Route: /shop/checkout
 *
 * v8 — Single-page checkout (no steps)
 * ────────────────────────────────────────
 * ✓ All sections stacked on one page:
 *   1. Delivery Address (with WhatsApp notice inside)
 *   2. Review Order
 *   3. Payment
 * ✓ No step state, no step indicator, no step titles
 * ✓ WhatsApp notice scoped to AddressStep only
 * ✓ Debug panel unchanged
 * ✓ Header is just back button + title
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import CheckoutHeader      from "./Checkout/CheckoutHeader";
import AddressStep         from "./Checkout/AddressStep";
import ReviewStep          from "./Checkout/ReviewStep";
import PaymentStep         from "./Checkout/PaymentStep";
import CheckoutDebugPanel  from "./Checkout/CheckoutDebugPanel";

import "../styles/Checkout.css";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const API      = `${import.meta.env.VITE_API_BASE_URL}/api`;
const CART_KEY = "mm_cart";

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token");

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
});

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function CheckoutPage({ user }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate("/auth", { state: { from: "/shop/checkout" } });
  }, [user, navigate]);

  /* ── State ── */
  const [addresses,       setAddresses]       = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [cartItems,       setCartItems]       = useState([]);
  const [cartLoading,     setCartLoading]     = useState(true);
  const [calculation,     setCalculation]     = useState(null);
  const [paymentMethod,   setPaymentMethod]   = useState(null);
  const [couponCode,      setCouponCode]      = useState("");
  const [discount,        setDiscount]        = useState(0);
  const [notes,           setNotes]           = useState("");
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState(null);
  const [errorDebug,      setErrorDebug]      = useState(null);

  /* ── Debug state ── */
  const [lastRequest,  setLastRequest]  = useState(null);
  const [lastResponse, setLastResponse] = useState(null);
  const [lastError,    setLastError]    = useState(null);

  /* ════════════════════════════════════════════════════
     LOAD ADDRESSES
  ════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    axios
      .get(`${API}/checkout/address`, { headers: authHeaders() })
      .then(({ data }) => {
        if (cancelled) return;
        const list = data.data ?? [];
        setAddresses(list);
        const def = list.find((a) => a.is_default) ?? list[0] ?? null;
        if (def) setSelectedAddress(def);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("[Checkout] address load failed:", err.message);
      });

    return () => { cancelled = true; };
  }, [user]);

  /* ════════════════════════════════════════════════════
     LOAD CART
  ════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setCartLoading(true);

    const readLocalCart = () => {
      try { return JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }
      catch { return []; }
    };

    axios
      .get(`${API}/cart`, { headers: authHeaders() })
      .then(({ data }) => {
        if (cancelled) return;
        const serverItems = data.data?.items ?? [];
        setCartItems(serverItems.length ? serverItems : readLocalCart());
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("[Checkout] cart load failed:", err.message);
        setCartItems(readLocalCart());
      })
      .finally(() => { if (!cancelled) setCartLoading(false); });

    return () => { cancelled = true; };
  }, [user]);

  /* ════════════════════════════════════════════════════
     REDIRECT IF EMPTY
  ════════════════════════════════════════════════════ */
  useEffect(() => {
    if (cartLoading || !user) return;
    if (!cartItems.length) {
      console.warn("[Checkout] Cart is empty — redirecting");
      navigate("/shop/cart");
    }
  }, [cartLoading, cartItems.length, user, navigate]);

  /* ════════════════════════════════════════════════════
     SUBTOTAL
  ════════════════════════════════════════════════════ */
  const subtotal = useMemo(
    () => cartItems.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.qty ?? 1),
      0
    ),
    [cartItems]
  );

  /* ════════════════════════════════════════════════════
     CALCULATE
  ════════════════════════════════════════════════════ */
  useEffect(() => {
    if (subtotal <= 0) return;
    let cancelled = false;

    axios
      .post(
        `${API}/checkout/calculate`,
        { subtotal, discount },
        { headers: authHeaders() }
      )
      .then(({ data }) => {
        if (cancelled) return;
        setCalculation(data.data);
        if (data.data.paymentOptions?.length) {
          setPaymentMethod((prev) =>
            data.data.paymentOptions.some((o) => o.key === prev)
              ? prev
              : data.data.paymentOptions[0].key
          );
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("[Checkout] calculation failed:", err.message);
      });

    return () => { cancelled = true; };
  }, [subtotal, discount]);

  /* ════════════════════════════════════════════════════
     HANDLERS
  ════════════════════════════════════════════════════ */
  const handleAddAddress = useCallback((addr) => {
    setAddresses((prev) => [addr, ...prev]);
    setSelectedAddress(addr);
  }, []);

  const handleEditAddress = useCallback((id, updated) => {
    setAddresses((prev) => prev.map((a) => (a.id === id ? updated : a)));
    setSelectedAddress((prev) => (prev?.id === id ? updated : prev));
  }, []);

  const handleSelectAddress = useCallback((addr) => {
    setSelectedAddress(addr);
  }, []);

  const handleChangeNumber = useCallback(() => {
    navigate("/profile/edit");
  }, [navigate]);

  /* ════════════════════════════════════════════════════
     PLACE ORDER
  ════════════════════════════════════════════════════ */
  const handlePlaceOrder = useCallback(async () => {
    setError(null);
    setErrorDebug(null);
    setLastError(null);
    setLastResponse(null);

    if (!selectedAddress) {
      setError("Please select a delivery address.");
      /* Scroll to the address section */
      document.querySelector(".as-root")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (!paymentMethod) {
      setError("Please select a payment method.");
      return;
    }
    if (!cartItems.length) {
      setError("Your cart is empty.");
      setTimeout(() => navigate("/shop/cart"), 1500);
      return;
    }
    if (!calculation) {
      setError("Still calculating totals. Please wait.");
      return;
    }

    setLoading(true);

    const payload = {
      addressId : selectedAddress.id,
      paymentMethod,
      couponCode: couponCode || undefined,
      discount,
      notes     : notes || undefined,
    };

    const requestSnapshot = {
      url    : `${API}/checkout`,
      payload,
      time   : new Date().toISOString(),
    };
    setLastRequest(requestSnapshot);

    console.group("🛒 [Checkout] Place Order");
    console.log("URL:    ", requestSnapshot.url);
    console.log("Payload:", payload);
    console.groupEnd();

    try {
      const { data, status } = await axios.post(
        `${API}/checkout`,
        payload,
        { headers: authHeaders(), timeout: 30_000 }
      );

      setLastResponse({
        status,
        data,
        time: new Date().toISOString(),
      });

      console.log("✅ [Checkout] Response:", data);

      const orderData = data.data ?? data;

      if (orderData.requiresPayment && orderData.paymentLink) {
        localStorage.removeItem(CART_KEY);
        window.dispatchEvent(new Event("cart-updated"));
        window.location.href = orderData.paymentLink;
        return;
      }

      if (orderData.requiresPayment && !orderData.paymentLink) {
        setError("Order created but payment link failed. Visit your orders to retry.");
        setErrorDebug(orderData);
        localStorage.removeItem(CART_KEY);
        window.dispatchEvent(new Event("cart-updated"));
        setTimeout(() => navigate(`/shop/orders/${orderData.orderGroupId}`), 3000);
        return;
      }

      if (orderData.orderGroupId) {
        localStorage.removeItem(CART_KEY);
        window.dispatchEvent(new Event("cart-updated"));
        navigate(`/shop/orders/${orderData.orderGroupId}`);
        return;
      }

      throw new Error("Unexpected response from server.");

    } catch (err) {
      const errorSnapshot = {
        status      : err.response?.status,
        message     : err.response?.data?.message || err.message,
        debug       : err.response?.data?.debug,
        fullResponse: err.response?.data,
        time        : new Date().toISOString(),
      };
      setLastError(errorSnapshot);

      console.group("❌ [Checkout] Failed");
      console.log("Status:  ", errorSnapshot.status);
      console.log("Message: ", errorSnapshot.message);
      console.log("Debug:   ", errorSnapshot.debug);
      console.log("Full:    ", errorSnapshot.fullResponse);
      console.groupEnd();

      const displayMessage =
        errorSnapshot.debug?.message
          ? `${errorSnapshot.message} (${errorSnapshot.debug.message})`
          : errorSnapshot.message || "Failed to place order.";

      setError(displayMessage);
      setErrorDebug(errorSnapshot.debug ?? errorSnapshot.fullResponse);

    } finally {
      setLoading(false);
    }
  }, [
    selectedAddress, paymentMethod, cartItems, calculation,
    couponCode, discount, notes, navigate,
  ]);

  if (!user) return null;

  /* ════════════════════════════════════════════════════
     RENDER — all sections stacked
  ════════════════════════════════════════════════════ */
  return (
    <div className="ck-page">

      {/* Minimal header — back button + title */}
      <CheckoutHeader
        title="Checkout"
        onBack={() => navigate("/shop/cart")}
      />

      {/* Debug panel */}
      <CheckoutDebugPanel
        apiBase={`${API}/checkout`}
        token={getToken()}
        user={user}
        addresses={addresses}
        selectedAddress={selectedAddress}
        cartItems={cartItems}
        cartLoading={cartLoading}
        calculation={calculation}
        paymentMethod={paymentMethod}
        lastRequest={lastRequest}
        lastResponse={lastResponse}
        lastError={lastError}
        onRetry={handlePlaceOrder}
      />

      {/* Global error banner */}
      {error && (
        <div className="ck-error" role="alert">
          ⚠️ {error}
          <button
            onClick={() => { setError(null); setErrorDebug(null); }}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Stacked content — everything on one page */}
      <div className="ck-content">

        {cartLoading ? (
          <div className="ck-loading" role="status" aria-live="polite">
            <div className="ck-loading-spinner" />
            <p>Loading your cart…</p>
          </div>
        ) : (
          <>
            {/* ══ DELIVERY ADDRESS (includes WhatsApp notice) ══ */}
            <AddressStep
              addresses={addresses}
              setAddresses={setAddresses}
              selected={selectedAddress}
              onSelect={handleSelectAddress}
              onAdd={handleAddAddress}
              onEdit={handleEditAddress}
              onNext={() => {
                /* Scroll to review section instead of switching steps */
                document.querySelector("[data-checkout-review]")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              user={user}
              onChangeNumber={handleChangeNumber}
              termsHref="/terms"
            />

            {/* ══ REVIEW ══ */}
            <div data-checkout-review>
              <ReviewStep
                cartItems={cartItems}
                calculation={calculation}
                address={selectedAddress}
                couponCode={couponCode}
                onCouponChange={setCouponCode}
                discount={discount}
                onDiscountChange={setDiscount}
                notes={notes}
                onNotesChange={setNotes}
                onBack={() => {
                  document.querySelector(".as-root")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                onNext={() => {
                  document.querySelector("[data-checkout-payment]")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />
            </div>

            {/* ══ PAYMENT ══ */}
            <div data-checkout-payment>
              <PaymentStep
                calculation={calculation}
                paymentMethod={paymentMethod}
                onSelectPayment={setPaymentMethod}
                loading={loading}
                error={error}
                errorDebug={errorDebug}
                onDismissError={() => {
                  setError(null);
                  setErrorDebug(null);
                }}
                onBack={() => {
                  setError(null);
                  setErrorDebug(null);
                  document.querySelector("[data-checkout-review]")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                onPlaceOrder={handlePlaceOrder}
              />
            </div>
          </>
        )}
      </div>

    </div>
  );
}