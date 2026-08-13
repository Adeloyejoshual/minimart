/**
 * src/pages/CheckoutPage.jsx
 * Route: /shop/checkout
 *
 * v9 — Step-based rendering (one section at a time)
 * ────────────────────────────────────────
 * ✓ User sees ONLY the active step:
 *     1. Delivery Address
 *     2. Review Order
 *     3. Payment
 * ✓ Continue button advances to the next step
 * ✓ Back button returns to the previous step (or cart on step 1)
 * ✓ No visual step indicator — the current section IS the context
 * ✓ WhatsApp notice scoped to AddressStep only
 * ✓ Debug panel unchanged
 * ✓ Scroll resets to top on step change
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
   STEP CONSTANTS
   ─────────────────────────────────────────────────────────────
   Numbered so we can advance/rewind with simple math.
═══════════════════════════════════════════════════════════════ */
const STEP = {
  ADDRESS : 1,
  REVIEW  : 2,
  PAYMENT : 3,
};

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function CheckoutPage({ user }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) navigate("/auth", { state: { from: "/shop/checkout" } });
  }, [user, navigate]);

  /* ── Step state ── */
  const [step, setStep] = useState(STEP.ADDRESS);

  /* ── Data state ── */
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

  /* Scroll target — the content wrapper */
  const contentRef = useRef(null);

  /* ════════════════════════════════════════════════════
     SCROLL TO TOP ON STEP CHANGE
     ─────────────────────────────────────────────────
     Whenever the step changes, scroll the window back
     to the top so the user sees the new section from
     the beginning — not stuck at the previous scroll
     position.
  ════════════════════════════════════════════════════ */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

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
     STEP NAVIGATION
     ─────────────────────────────────────────────────
     goNext  — advance to next step (validates first)
     goBack  — return to previous step (or cart if step 1)
  ════════════════════════════════════════════════════ */
  const goNext = useCallback(() => {
    setError(null);
    setErrorDebug(null);

    /* Guard: can't proceed past step 1 without an address */
    if (step === STEP.ADDRESS && !selectedAddress) {
      setError("Please select a delivery address.");
      return;
    }

    /* Guard: can't proceed past step 2 without a payment method */
    if (step === STEP.REVIEW && !paymentMethod) {
      setError("Please select a payment method.");
      return;
    }

    if (step < STEP.PAYMENT) setStep((s) => s + 1);
  }, [step, selectedAddress, paymentMethod]);

  const goBack = useCallback(() => {
    setError(null);
    setErrorDebug(null);

    if (step > STEP.ADDRESS) {
      setStep((s) => s - 1);
    } else {
      navigate("/shop/cart");
    }
  }, [step, navigate]);

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
      setStep(STEP.ADDRESS);
      return;
    }
    if (!paymentMethod) {
      setError("Please select a payment method.");
      setStep(STEP.REVIEW);
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

      /* Online payment → redirect to Flutterwave */
      if (orderData.requiresPayment && orderData.paymentLink) {
        localStorage.removeItem(CART_KEY);
        window.dispatchEvent(new Event("cart-updated"));
        window.location.href = orderData.paymentLink;
        return;
      }

      /* Online payment but Flutterwave failed */
      if (orderData.requiresPayment && !orderData.paymentLink) {
        setError("Order created but payment link failed. Visit your orders to retry.");
        setErrorDebug(orderData);
        localStorage.removeItem(CART_KEY);
        window.dispatchEvent(new Event("cart-updated"));
        setTimeout(() => navigate(`/shop/orders/${orderData.orderGroupId}`), 3000);
        return;
      }

      /* Cash on delivery → order page */
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
     RENDER — one step at a time
  ════════════════════════════════════════════════════ */
  return (
    <div className="ck-page">

      {/* Minimal header — back button always goes to previous step */}
      <CheckoutHeader
        title="Checkout"
        onBack={goBack}
      />

      {/* Debug panel — always visible */}
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

      {/* ══════════════════════════════════════════════════
          STEP CONTENT
          ────────────────────────────────────────────────
          Only ONE step is rendered at any time. Clicking
          Continue advances step state → this block swaps
          to the next component.
      ══════════════════════════════════════════════════ */}
      <div className="ck-content" ref={contentRef}>

        {cartLoading ? (
          <div className="ck-loading" role="status" aria-live="polite">
            <div className="ck-loading-spinner" />
            <p>Loading your cart…</p>
          </div>
        ) : (
          <>
            {/* ══ STEP 1: DELIVERY ADDRESS ══ */}
            {step === STEP.ADDRESS && (
              <AddressStep
                addresses={addresses}
                setAddresses={setAddresses}
                selected={selectedAddress}
                onSelect={handleSelectAddress}
                onAdd={handleAddAddress}
                onEdit={handleEditAddress}
                onNext={goNext}         /* advances to Review */
                user={user}
                onChangeNumber={handleChangeNumber}
                termsHref="/terms"
              />
            )}

            {/* ══ STEP 2: REVIEW ══ */}
            {step === STEP.REVIEW && (
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
                onBack={goBack}         /* returns to Address */
                onNext={goNext}         /* advances to Payment */
              />
            )}

            {/* ══ STEP 3: PAYMENT ══ */}
            {step === STEP.PAYMENT && (
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
                onBack={goBack}         /* returns to Review */
                onPlaceOrder={handlePlaceOrder}
              />
            )}
          </>
        )}
      </div>

    </div>
  );
}