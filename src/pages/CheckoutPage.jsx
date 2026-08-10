/**
 * src/pages/CheckoutPage.jsx
 * Route: /shop/checkout
 *
 * Multi-step checkout flow:
 *   Step 1 — Address
 *   Step 2 — Review
 *   Step 3 — Payment
 *
 * v3 — LIVE DEBUG for order placement failures
 * ─────────────────────────────────────────────
 * ✓ Full error object captured and forwarded to PaymentStep
 * ✓ Console groups for every submit attempt
 * ✓ Preserves entire err.response.data.debug (SQL details)
 * ✓ Backward compatible with all existing steps
 */

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import AddressStep from "./Checkout/AddressStep";
import ReviewStep  from "./Checkout/ReviewStep";
import PaymentStep from "./Checkout/PaymentStep";

import "../styles/Checkout.css";

/* ═══════════════════════════════════════════════════════════════
   ENV + API
═══════════════════════════════════════════════════════════════ */
const API      = `${import.meta.env.VITE_API_BASE_URL}/api`;
const CART_KEY = "mm_cart";

/* ═══════════════════════════════════════════════════════════════
   TOKEN HELPERS
═══════════════════════════════════════════════════════════════ */
const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token");

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
});

/* ═══════════════════════════════════════════════════════════════
   STEPS CONFIG
═══════════════════════════════════════════════════════════════ */
const STEPS = [
  { id: 1, label: "Address" },
  { id: 2, label: "Review"  },
  { id: 3, label: "Payment" },
];

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function CheckoutPage({ user }) {
  const navigate = useNavigate();

  /* ── Redirect if not logged in ──────────────────────────── */
  useEffect(() => {
    if (!user) navigate("/auth", { state: { from: "/shop/checkout" } });
  }, [user, navigate]);

  /* ── State ──────────────────────────────────────────────── */
  const [step,            setStep]            = useState(1);
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
  const [errorDebug,      setErrorDebug]      = useState(null);   // ✅ NEW

  /* ════════════════════════════════════════════════════════
     LOAD SAVED ADDRESSES
  ════════════════════════════════════════════════════════ */
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

  /* ════════════════════════════════════════════════════════
     LOAD CART
  ════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setCartLoading(true);

    const readLocalCart = () => {
      try {
        return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      } catch {
        return [];
      }
    };

    axios
      .get(`${API}/cart`, { headers: authHeaders() })
      .then(({ data }) => {
        if (cancelled) return;
        const serverItems = data.data?.items ?? [];

        if (serverItems.length) {
          setCartItems(serverItems);
        } else {
          const local = readLocalCart();
          setCartItems(local);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("[Checkout] server cart load failed:", err.message);
        setCartItems(readLocalCart());
      })
      .finally(() => {
        if (!cancelled) setCartLoading(false);
      });

    return () => { cancelled = true; };
  }, [user]);

  /* ════════════════════════════════════════════════════════
     REDIRECT IF CART IS EMPTY AFTER LOAD
  ════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (cartLoading) return;
    if (!user) return;

    if (!cartItems.length) {
      console.warn("[Checkout] Cart is empty — redirecting to /shop/cart");
      navigate("/shop/cart");
    }
  }, [cartLoading, cartItems.length, user, navigate]);

  /* ════════════════════════════════════════════════════════
     SUBTOTAL
  ════════════════════════════════════════════════════════ */
  const subtotal = useMemo(
    () => cartItems.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.qty ?? 1),
      0
    ),
    [cartItems]
  );

  /* ════════════════════════════════════════════════════════
     CALCULATE DELIVERY + PAYMENT OPTIONS
  ════════════════════════════════════════════════════════ */
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

  /* ════════════════════════════════════════════════════════
     ADDRESS HANDLERS
  ════════════════════════════════════════════════════════ */
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

  /* ════════════════════════════════════════════════════════
     PLACE ORDER — WITH LIVE DEBUG
  ════════════════════════════════════════════════════════ */
  const handlePlaceOrder = useCallback(async () => {
    /* ── Reset previous errors ── */
    setError(null);
    setErrorDebug(null);

    /* ── Guards ── */
    if (!selectedAddress) {
      setError("Please select a delivery address.");
      setStep(1);
      return;
    }
    if (!paymentMethod) {
      setError("Please select a payment method.");
      return;
    }
    if (!cartItems.length) {
      setError("Your cart is empty. Add items before checking out.");
      setTimeout(() => navigate("/shop/cart"), 1500);
      return;
    }
    if (!calculation) {
      setError("Still calculating totals. Please wait a moment and try again.");
      return;
    }

    setLoading(true);

    /* ═══════════════════════════════════════════════════
       LIVE DEBUG — request payload
    ═══════════════════════════════════════════════════ */
    const payload = {
      addressId : selectedAddress.id,
      paymentMethod,
      couponCode: couponCode || undefined,
      discount,
      notes     : notes || undefined,
    };

    console.group("🛒 [Checkout] Place Order Request");
    console.log("URL:      ", `${API}/checkout`);
    console.log("Payload:  ", payload);
    console.log("Address:  ", selectedAddress);
    console.log("Cart items:", cartItems.length);
    console.log("Subtotal: ", subtotal);
    console.log("Grand tot:", calculation.grandTotal);
    console.groupEnd();

    try {
      const { data } = await axios.post(
        `${API}/checkout`,
        payload,
        { headers: authHeaders(), timeout: 30_000 }
      );

      /* ═══════════════════════════════════════════════
         LIVE DEBUG — success response
      ═══════════════════════════════════════════════ */
      console.group("✅ [Checkout] Order Response");
      console.log("Full response:", data);
      console.groupEnd();

      const orderData = data.data ?? data;

      /* ── Online payment → redirect to Flutterwave ── */
      if (orderData.requiresPayment && orderData.paymentLink) {
        console.log("→ Redirecting to Flutterwave:", orderData.paymentLink);
        localStorage.removeItem(CART_KEY);
        window.dispatchEvent(new Event("cart-updated"));
        window.location.href = orderData.paymentLink;
        return;
      }

      /* ── Online payment with NO payment link (Flutterwave failed backend-side) ── */
      if (orderData.requiresPayment && !orderData.paymentLink) {
        console.warn("→ Order created but no payment link:", orderData);
        setError(
          "Order created, but payment could not be initiated. " +
          "Please visit your orders page to retry payment."
        );
        setErrorDebug(orderData);
        localStorage.removeItem(CART_KEY);
        window.dispatchEvent(new Event("cart-updated"));
        setTimeout(() => {
          navigate(`/shop/orders/${orderData.orderGroupId}`);
        }, 3000);
        return;
      }

      /* ── Cash on delivery → success page ── */
      if (orderData.orderGroupId) {
        console.log("→ COD success, navigating to order page");
        localStorage.removeItem(CART_KEY);
        window.dispatchEvent(new Event("cart-updated"));
        navigate(`/shop/orders/${orderData.orderGroupId}`);
        return;
      }

      throw new Error("Unexpected response from server. Please try again.");

    } catch (err) {
      /* ═══════════════════════════════════════════════
         LIVE DEBUG — full error dump
      ═══════════════════════════════════════════════ */
      console.group("❌ [Checkout] Order Failed");
      console.log("Status:          ", err.response?.status);
      console.log("Status text:     ", err.response?.statusText);
      console.log("Message:         ", err.response?.data?.message);
      console.log("Debug object:    ", err.response?.data?.debug);
      console.log("Full data:       ", err.response?.data);
      console.log("Request payload: ", payload);
      console.log("Error object:    ", err);
      console.groupEnd();

      /* Show the most detailed error we can find */
      const backendMessage = err.response?.data?.message;
      const sqlMessage     = err.response?.data?.debug?.message;
      const genericMessage = err.message;

      const displayMessage =
        sqlMessage
          ? `${backendMessage} (${sqlMessage})`
          : backendMessage || genericMessage || "Failed to place order. Please try again.";

      setError(displayMessage);
      setErrorDebug(err.response?.data?.debug ?? err.response?.data ?? null);

    } finally {
      setLoading(false);
    }
  }, [
    selectedAddress, paymentMethod, cartItems, calculation,
    couponCode, discount, notes, subtotal, navigate,
  ]);

  /* ════════════════════════════════════════════════════════
     GUARD
  ════════════════════════════════════════════════════════ */
  if (!user) return null;

  /* ════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════ */
  return (
    <div className="ck-page">

      {/* ── Top Bar ── */}
      <div className="ck-topbar">
        <button
          className="ck-back-btn"
          onClick={() => navigate("/shop/cart")}
          aria-label="Back to cart"
        >
          ←
        </button>
        <h1 className="ck-topbar-title">Checkout</h1>
        <div />
      </div>

      {/* ── Step Indicator ── */}
      <div className="ck-steps">
        {STEPS.map((s, i) => (
          <Fragment key={s.id}>
            <div
              className={[
                "ck-step",
                step === s.id ? "ck-step--active" : "",
                step >  s.id  ? "ck-step--done"   : "",
              ].join(" ").trim()}
            >
              <div className="ck-step-dot">
                {step > s.id ? "✓" : s.id}
              </div>
              <span className="ck-step-label">{s.label}</span>
            </div>

            {i < STEPS.length - 1 && (
              <div
                className={[
                  "ck-step-line",
                  step > s.id ? "ck-step-line--done" : "",
                ].join(" ").trim()}
              />
            )}
          </Fragment>
        ))}
      </div>

      {/* ── Global Error Banner (only shown on step 1 & 2) ── */}
      {error && step !== 3 && (
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

      {/* ── Step Content ── */}
      <div className="ck-content">

        {cartLoading && (
          <div className="ck-loading" role="status" aria-live="polite">
            <div className="ck-loading-spinner" />
            <p>Loading your cart…</p>
          </div>
        )}

        {!cartLoading && step === 1 && (
          <AddressStep
            addresses={addresses}
            selected={selectedAddress}
            onSelect={handleSelectAddress}
            onAdd={handleAddAddress}
            onEdit={handleEditAddress}
            onNext={() => setStep(2)}
            user={user}
          />
        )}

        {!cartLoading && step === 2 && (
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
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}

        {!cartLoading && step === 3 && (
          <PaymentStep
            calculation={calculation}
            paymentMethod={paymentMethod}
            onSelectPayment={setPaymentMethod}
            loading={loading}
            error={error}
            errorDebug={errorDebug}           /* ✅ NEW */
            onDismissError={() => {
              setError(null);
              setErrorDebug(null);
            }}
            onBack={() => {
              setError(null);
              setErrorDebug(null);
              setStep(2);
            }}
            onPlaceOrder={handlePlaceOrder}
          />
        )}

      </div>
    </div>
  );
}