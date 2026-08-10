/**
 * src/pages/CheckoutPage.jsx
 * v4 — With floating debug panel
 */

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import AddressStep         from "./Checkout/AddressStep";
import ReviewStep          from "./Checkout/ReviewStep";
import PaymentStep         from "./Checkout/PaymentStep";
import CheckoutDebugPanel  from "./Checkout/CheckoutDebugPanel";   /* ✅ NEW */

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

  useEffect(() => {
    if (!user) navigate("/auth", { state: { from: "/shop/checkout" } });
  }, [user, navigate]);

  /* ── State ── */
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
  const [errorDebug,      setErrorDebug]      = useState(null);

  /* ✅ NEW: Debug state */
  const [lastRequest,  setLastRequest]  = useState(null);
  const [lastResponse, setLastResponse] = useState(null);
  const [lastError,    setLastError]    = useState(null);

  /* ────── LOAD ADDRESSES ────── */
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

  /* ────── LOAD CART ────── */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setCartLoading(true);

    const readLocalCart = () => {
      try {
        return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      } catch { return []; }
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

  /* ────── REDIRECT IF EMPTY ────── */
  useEffect(() => {
    if (cartLoading || !user) return;
    if (!cartItems.length) {
      console.warn("[Checkout] Cart is empty — redirecting");
      navigate("/shop/cart");
    }
  }, [cartLoading, cartItems.length, user, navigate]);

  /* ────── SUBTOTAL ────── */
  const subtotal = useMemo(
    () => cartItems.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.qty ?? 1),
      0
    ),
    [cartItems]
  );

  /* ────── CALCULATE ────── */
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

  /* ────── ADDRESS HANDLERS ────── */
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

  /* ═══════════════════════════════════════════════════
     PLACE ORDER — with debug capture
  ═══════════════════════════════════════════════════ */
  const handlePlaceOrder = useCallback(async () => {
    setError(null);
    setErrorDebug(null);
    setLastError(null);
    setLastResponse(null);

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

    /* ✅ Capture request */
    const requestSnapshot = {
      url:     `${API}/checkout`,
      payload,
      time:    new Date().toISOString(),
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

      /* ✅ Capture success response */
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
      /* ✅ Capture full error */
      const errorSnapshot = {
        status:       err.response?.status,
        message:      err.response?.data?.message || err.message,
        debug:        err.response?.data?.debug,
        fullResponse: err.response?.data,
        time:         new Date().toISOString(),
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
            <div className={[
              "ck-step",
              step === s.id ? "ck-step--active" : "",
              step >  s.id  ? "ck-step--done"   : "",
            ].join(" ").trim()}>
              <div className="ck-step-dot">
                {step > s.id ? "✓" : s.id}
              </div>
              <span className="ck-step-label">{s.label}</span>
            </div>

            {i < STEPS.length - 1 && (
              <div className={[
                "ck-step-line",
                step > s.id ? "ck-step-line--done" : "",
              ].join(" ").trim()} />
            )}
          </Fragment>
        ))}
      </div>

      {/* ── Global Error Banner ── */}
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
            errorDebug={errorDebug}
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

      {/* ═════════════════════════════════════
          ✅ FLOATING DEBUG PANEL
      ═════════════════════════════════════ */}
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
    </div>
  );
}