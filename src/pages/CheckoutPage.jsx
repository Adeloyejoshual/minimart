/**
 * src/pages/CheckoutPage.jsx
 * Route: /shop/checkout
 *
 * Multi-step checkout flow:
 *   Step 1 — Address
 *   Step 2 — Review
 *   Step 3 — Payment
 *
 * v2 — Single source of truth for order placement
 * ─────────────────────────────────────────────────
 * ✓ Parent owns loading + error state
 * ✓ Parent owns handlePlaceOrder — PaymentStep just triggers it
 * ✓ Parent guards for empty cart, missing address, missing payment
 * ✓ Server-side cart is the source of truth; localStorage is fallback
 * ✓ Redirects to /shop/cart if cart is empty at mount
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

        /* Auto-select default (or first) address */
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
     ─────────────────────────────────────────────────────
     Tries the server first (source of truth) then falls back
     to localStorage. If BOTH are empty, redirects to /shop/cart.
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
          /* Server cart empty → try localStorage */
          const local = readLocalCart();
          setCartItems(local);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("[Checkout] server cart load failed:", err.message);
        /* Fall back entirely to localStorage */
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

        /* Auto-select first payment option (or keep valid selection) */
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

  /** Called when a brand-new address is saved */
  const handleAddAddress = useCallback((addr) => {
    setAddresses((prev) => [addr, ...prev]);
    setSelectedAddress(addr);
  }, []);

  /** Called when an existing address is updated */
  const handleEditAddress = useCallback((id, updated) => {
    setAddresses((prev) =>
      prev.map((a) => (a.id === id ? updated : a))
    );
    setSelectedAddress((prev) =>
      prev?.id === id ? updated : prev
    );
  }, []);

  /** Called when user selects an address card */
  const handleSelectAddress = useCallback((addr) => {
    setSelectedAddress(addr);
  }, []);

  /* ════════════════════════════════════════════════════════
     PLACE ORDER — SINGLE SOURCE OF TRUTH
     ─────────────────────────────────────────────────────
     Guards for every failure mode with a clear message.
     PaymentStep just calls this via onPlaceOrder.
  ════════════════════════════════════════════════════════ */
  const handlePlaceOrder = useCallback(async () => {
    /* ── Guards with actionable messages ── */
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
    setError(null);

    try {
      const { data } = await axios.post(
        `${API}/checkout`,
        {
          addressId  : selectedAddress.id,
          paymentMethod,
          couponCode : couponCode || undefined,
          discount,
          notes      : notes      || undefined,
        },
        { headers: authHeaders(), timeout: 30_000 }
      );

      console.log("[Checkout] Order response:", data);

      const orderData = data.data ?? data;

      /* ── Online payment → redirect to Flutterwave ── */
      if (orderData.requiresPayment && orderData.paymentLink) {
        /* Clear local cart before redirect */
        localStorage.removeItem(CART_KEY);
        window.dispatchEvent(new Event("cart-updated"));
        window.location.href = orderData.paymentLink;
        return;
      }

      /* ── Cash on delivery → success page ── */
      if (orderData.orderGroupId) {
        localStorage.removeItem(CART_KEY);
        window.dispatchEvent(new Event("cart-updated"));
        navigate(`/shop/orders/${orderData.orderGroupId}`);
        return;
      }

      throw new Error("Unexpected response from server. Please try again.");

    } catch (err) {
      console.error("[Checkout] Place order failed:", err);

      const message =
        err.response?.data?.message ||
        err.response?.data?.error   ||
        err.message                 ||
        "Failed to place order. Please try again.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }, [
    selectedAddress, paymentMethod, cartItems, calculation,
    couponCode, discount, notes, navigate,
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
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Step Content ── */}
      <div className="ck-content">

        {/* Loading state while cart fetches */}
        {cartLoading && (
          <div className="ck-loading" role="status" aria-live="polite">
            <div className="ck-loading-spinner" />
            <p>Loading your cart…</p>
          </div>
        )}

        {/* Step 1 — Address */}
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

        {/* Step 2 — Review */}
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

        {/* Step 3 — Payment */}
        {!cartLoading && step === 3 && (
          <PaymentStep
            calculation={calculation}
            paymentMethod={paymentMethod}
            onSelectPayment={setPaymentMethod}
            loading={loading}
            error={error}
            onBack={() => { setError(null); setStep(2); }}
            onPlaceOrder={handlePlaceOrder}
          />
        )}

      </div>
    </div>
  );
}