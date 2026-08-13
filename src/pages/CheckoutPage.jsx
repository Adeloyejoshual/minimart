/**
 * src/pages/CheckoutPage.jsx
 * Route: /shop/checkout
 *
 * v11 — Full production integration
 * ──────────────────────────────────────────────────────────────
 * ✓ Step-based navigation (Address → Review → Payment)
 * ✓ Idempotency-Key header prevents duplicate orders on retry
 * ✓ Client sends ONLY couponCode (backend calculates discount)
 * ✓ Fresh idempotency key on cart/address/coupon changes
 * ✓ Coupon picker bottom-sheet integration
 * ✓ Coupon errors at order time clear coupon + return to Review
 * ✓ Stock errors surfaced with proper message
 * ✓ In-flight guard prevents double-click order duplication
 * ✓ Cross-device address fetch
 * ✓ Fresh cart on mount
 * ✓ Auto-scroll to top on step change
 * ✓ Debug panel intact
 * ✓ All errors mapped by err.source for smart routing
 */

import {
  useState, useEffect, useCallback, useMemo, useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import CheckoutHeader      from "./Checkout/CheckoutHeader";
import AddressStep         from "./Checkout/AddressStep";
import ReviewStep          from "./Checkout/ReviewStep";
import PaymentStep         from "./Checkout/PaymentStep";
import CouponPicker        from "./Checkout/CouponPicker";
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
═══════════════════════════════════════════════════════════════ */
const STEP = {
  ADDRESS : 1,
  REVIEW  : 2,
  PAYMENT : 3,
};

/* ═══════════════════════════════════════════════════════════════
   IDEMPOTENCY KEY GENERATOR
   ─────────────────────────────────────────────────────────────
   Uses crypto.randomUUID() where available, falls back to
   timestamp+random for older browsers.
═══════════════════════════════════════════════════════════════ */
function generateIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 15)}`;
}

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

  /* ── Address state ── */
  const [addresses,       setAddresses]       = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);

  /* ── Cart + calculation state ── */
  const [cartItems,       setCartItems]       = useState([]);
  const [cartLoading,     setCartLoading]     = useState(true);
  const [calculation,     setCalculation]     = useState(null);
  const [paymentMethod,   setPaymentMethod]   = useState(null);
  const [notes,           setNotes]           = useState("");

  /* ── Coupon state ── */
  const [couponCode,       setCouponCode]       = useState("");
  const [couponDiscount,   setCouponDiscount]   = useState(0);
  const [freeShipping,     setFreeShipping]     = useState(false);
  const [couponMessage,    setCouponMessage]    = useState(null);
  const [couponPickerOpen, setCouponPickerOpen] = useState(false);

  /* ── Order flow state ── */
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [errorDebug,  setErrorDebug]  = useState(null);

  /* ── Debug state ── */
  const [lastRequest,  setLastRequest]  = useState(null);
  const [lastResponse, setLastResponse] = useState(null);
  const [lastError,    setLastError]    = useState(null);

  /*
   * ── Idempotency key ──
   * Generated fresh when cart/address/coupon changes.
   * Reused across retries of the same order attempt so backend
   * can detect duplicate submissions and return existing order.
   */
  const idempotencyKeyRef = useRef(null);

  /*
   * ── In-flight guard ──
   * Backup to prevent rapid double-clicks from triggering
   * multiple order creations. The backend also has its own
   * lock but this saves a round-trip.
   */
  const inFlightRef = useRef(false);

  /* ════════════════════════════════════════════════════
     SCROLL TO TOP ON STEP CHANGE
  ════════════════════════════════════════════════════ */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  /* ════════════════════════════════════════════════════
     LOAD ADDRESSES  (cross-device)
  ════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    axios
      .get(`${API}/checkout/address`, {
        headers: authHeaders(),
        timeout: 10_000,
      })
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
      .get(`${API}/cart`, {
        headers: authHeaders(),
        timeout: 10_000,
      })
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
     SUBTOTAL  (client-side for UI only — server recomputes)
  ════════════════════════════════════════════════════ */
  const subtotal = useMemo(
    () => cartItems.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.qty ?? 1),
      0
    ),
    [cartItems]
  );

  /* ════════════════════════════════════════════════════
     CALCULATE — recalcs when subtotal, coupon, or shipping changes
  ════════════════════════════════════════════════════ */
  useEffect(() => {
    if (subtotal <= 0) return;
    let cancelled = false;

    axios
      .post(
        `${API}/checkout/calculate`,
        {
          subtotal,
          discount    : couponDiscount,
          freeShipping,
        },
        {
          headers: authHeaders(),
          timeout: 10_000,
        }
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
  }, [subtotal, couponDiscount, freeShipping]);

  /* ════════════════════════════════════════════════════
     RESET IDEMPOTENCY KEY on inputs change
     ─────────────────────────────────────────────────
     Any change that would produce a legitimately different
     order gets a new idempotency key. Retries of the SAME
     order (same cart, same address, same coupon) reuse the
     same key so the backend can detect + reject duplicates.
  ════════════════════════════════════════════════════ */
  useEffect(() => {
    idempotencyKeyRef.current = null;
  }, [subtotal, selectedAddress?.id, couponCode]);

  /* ════════════════════════════════════════════════════
     ADDRESS HANDLERS
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
     COUPON HANDLERS
     ─────────────────────────────────────────────────
     handleCouponApply is called by BOTH the CouponPicker
     (when user picks or types a code) and returns
     { ok, message } for inline feedback.
  ════════════════════════════════════════════════════ */
  const handleCouponApply = useCallback(async (code) => {
    try {
      const { data } = await axios.post(
        `${API}/checkout/coupons/apply`,
        { code, subtotal },
        {
          headers: authHeaders(),
          timeout: 10_000,
        }
      );

      if (data.success) {
        setCouponCode(data.coupon.code);
        setCouponDiscount(Number(data.discount || 0));
        setFreeShipping(data.coupon.type === "free_shipping");
        setCouponMessage(data.message || null);
        return { ok: true, message: data.message };
      }

      return {
        ok      : false,
        message : data.message ?? "Coupon could not be applied.",
      };

    } catch (err) {
      const message =
        err.response?.data?.message ??
        err.message ??
        "Failed to apply coupon. Please try again.";
      return { ok: false, message };
    }
  }, [subtotal]);

  const handleCouponRemove = useCallback(() => {
    setCouponCode("");
    setCouponDiscount(0);
    setFreeShipping(false);
    setCouponMessage(null);
  }, []);

  /* ════════════════════════════════════════════════════
     STEP NAVIGATION
  ════════════════════════════════════════════════════ */
  const goNext = useCallback(() => {
    setError(null);
    setErrorDebug(null);

    if (step === STEP.ADDRESS && !selectedAddress) {
      setError("Please select a delivery address.");
      return;
    }
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
     ─────────────────────────────────────────────────
     Uses idempotency key from ref. If ref is null (fresh
     attempt), generates a new one. Same key is reused for
     retries of the same order.
  ════════════════════════════════════════════════════ */
  const handlePlaceOrder = useCallback(async () => {
    /* ── Prevent double-click ── */
    if (inFlightRef.current) {
      console.warn("[Checkout] Order already in flight — ignoring click");
      return;
    }

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

    inFlightRef.current = true;
    setLoading(true);

    /*
     * Generate idempotency key if not already set for this attempt.
     * The key persists across retries so backend can detect them.
     */
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = generateIdempotencyKey();
    }

    /*
     * Payload — NOTICE what's NOT here:
     *   - discount     (server recalculates from coupon)
     *   - freeShipping (server derives from coupon type)
     * Sending these would let a malicious user forge them.
     */
    const payload = {
      addressId    : selectedAddress.id,
      paymentMethod,
      couponCode   : couponCode || undefined,
      notes        : notes || undefined,
    };

    const requestSnapshot = {
      url            : `${API}/checkout`,
      payload,
      idempotencyKey : idempotencyKeyRef.current,
      time           : new Date().toISOString(),
    };
    setLastRequest(requestSnapshot);

    console.group("🛒 [Checkout] Place Order");
    console.log("URL:            ", requestSnapshot.url);
    console.log("Idempotency-Key:", requestSnapshot.idempotencyKey);
    console.log("Payload:        ", payload);
    console.groupEnd();

    try {
      const { data, status } = await axios.post(
        `${API}/checkout`,
        payload,
        {
          headers: {
            ...authHeaders(),
            "Idempotency-Key": idempotencyKeyRef.current,
          },
          timeout: 30_000,
        }
      );

      setLastResponse({
        status,
        data,
        time: new Date().toISOString(),
      });

      console.log("✅ [Checkout] Response:", data);

      const orderData = data.data ?? data;

      /* ── Success path: reset idempotency key ── */
      idempotencyKeyRef.current = null;

      /* Online payment → redirect to Flutterwave */
      if (orderData.requiresPayment && orderData.paymentLink) {
        localStorage.removeItem(CART_KEY);
        window.dispatchEvent(new Event("cart-updated"));
        window.location.href = orderData.paymentLink;
        return;
      }

      /* Online payment but Flutterwave failed */
      if (orderData.requiresPayment && !orderData.paymentLink) {
        setError(
          "Order created but payment link failed. " +
          "Visit your orders to retry."
        );
        setErrorDebug(orderData);
        localStorage.removeItem(CART_KEY);
        window.dispatchEvent(new Event("cart-updated"));
        setTimeout(
          () => navigate(`/shop/orders/${orderData.orderGroupId}`),
          3000
        );
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
        source      : err.response?.data?.debug?.source,
        fullResponse: err.response?.data,
        time        : new Date().toISOString(),
      };
      setLastError(errorSnapshot);

      console.group("❌ [Checkout] Failed");
      console.log("Status:  ", errorSnapshot.status);
      console.log("Source:  ", errorSnapshot.source);
      console.log("Message: ", errorSnapshot.message);
      console.log("Debug:   ", errorSnapshot.debug);
      console.log("Full:    ", errorSnapshot.fullResponse);
      console.groupEnd();

      /*
       * ── Duplicate request (in-flight guard tripped) ──
       * Backend detected same idempotency key mid-flight.
       * User just needs to wait.
       */
      if (errorSnapshot.status === 429) {
        setError(errorSnapshot.message);
        /* Don't reset idempotency key — same order attempt */
        return;
      }

      /*
       * ── Coupon error at order time ──
       * Backend rejected the coupon during atomic redemption.
       * Clear the coupon so user can retry without it.
       */
      if (
        errorSnapshot.status >= 400 &&
        errorSnapshot.status < 500 &&
        errorSnapshot.source === "coupon_redemption"
      ) {
        setCouponCode("");
        setCouponDiscount(0);
        setFreeShipping(false);
        setCouponMessage(null);

        /* New idempotency key since order details changed */
        idempotencyKeyRef.current = null;

        setError(
          `${errorSnapshot.message} The coupon has been removed — please try again.`
        );
        setStep(STEP.REVIEW);
        return;
      }

      /*
       * ── Stock error ──
       * Item went out of stock between validation and order.
       * Send user back to cart to remove/adjust.
       */
      if (
        errorSnapshot.status === 409 &&
        (errorSnapshot.source === "stock_insufficient" ||
         errorSnapshot.fullResponse?.data?.outOfStockIds)
      ) {
        setError(
          `${errorSnapshot.message} Please update your cart and try again.`
        );
        /* New idempotency key needed */
        idempotencyKeyRef.current = null;
        setTimeout(() => navigate("/shop/cart"), 3000);
        return;
      }

      /*
       * ── Address not found ──
       * Address was deleted between selection and checkout.
       */
      if (errorSnapshot.status === 404) {
        setError(errorSnapshot.message);
        idempotencyKeyRef.current = null;
        setStep(STEP.ADDRESS);
        return;
      }

      /* ── Generic error ── */
      const displayMessage =
        errorSnapshot.debug?.message
          ? `${errorSnapshot.message} (${errorSnapshot.debug.message})`
          : errorSnapshot.message || "Failed to place order.";

      setError(displayMessage);
      setErrorDebug(errorSnapshot.debug ?? errorSnapshot.fullResponse);

    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [
    selectedAddress, paymentMethod, cartItems, calculation,
    couponCode, notes, navigate,
  ]);

  if (!user) return null;

  /* ════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════ */
  return (
    <div className="ck-page">

      {/* ══ HEADER ══ */}
      <CheckoutHeader
        title="Checkout"
        onBack={goBack}
      />

      {/* ══ DEBUG PANEL (dev-only visibility ideally controlled inside) ══ */}
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
        couponCode={couponCode}
        couponDiscount={couponDiscount}
        freeShipping={freeShipping}
        idempotencyKey={idempotencyKeyRef.current}
        lastRequest={lastRequest}
        lastResponse={lastResponse}
        lastError={lastError}
        onRetry={handlePlaceOrder}
      />

      {/* ══ GLOBAL ERROR BANNER ══ */}
      {error && step !== STEP.PAYMENT && (
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

      {/* ══ STEP CONTENT ══ */}
      <div className="ck-content">
        {cartLoading ? (
          <div className="ck-loading" role="status" aria-live="polite">
            <div className="ck-loading-spinner" />
            <p>Loading your cart…</p>
          </div>
        ) : (
          <>
            {/* ── STEP 1: DELIVERY ADDRESS ── */}
            {step === STEP.ADDRESS && (
              <AddressStep
                addresses={addresses}
                setAddresses={setAddresses}
                selected={selectedAddress}
                onSelect={handleSelectAddress}
                onAdd={handleAddAddress}
                onEdit={handleEditAddress}
                onNext={goNext}
                user={user}
                onChangeNumber={handleChangeNumber}
                termsHref="/terms"
              />
            )}

            {/* ── STEP 2: REVIEW ── */}
            {step === STEP.REVIEW && (
              <ReviewStep
                cartItems={cartItems}
                calculation={calculation}
                address={selectedAddress}
                notes={notes}
                onNotesChange={setNotes}

                /* Coupon */
                couponCode={couponCode}
                discount={couponDiscount}
                freeShipping={freeShipping}
                couponMessage={couponMessage}
                onOpenCouponPicker={() => setCouponPickerOpen(true)}
                onCouponRemove={handleCouponRemove}

                onBack={goBack}
                onNext={goNext}
              />
            )}

            {/* ── STEP 3: PAYMENT ── */}
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
                onBack={goBack}
                onPlaceOrder={handlePlaceOrder}
              />
            )}
          </>
        )}
      </div>

      {/* ══ COUPON PICKER (bottom sheet) ══ */}
      <CouponPicker
        isOpen={couponPickerOpen}
        subtotal={subtotal}
        onClose={() => setCouponPickerOpen(false)}
        onApply={handleCouponApply}
      />

    </div>
  );
}