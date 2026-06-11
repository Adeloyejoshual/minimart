import React, {
  useState, useEffect, useCallback, useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import AddressStep from "./Checkout/AddressStep";
import ReviewStep  from "./Checkout/ReviewStep";
import PaymentStep from "./Checkout/PaymentStep";

import "../styles/Checkout.css";

const API      = "https://minimart-ivrm.onrender.com/api";
const CART_KEY = "mm_cart";

function getToken() {
  return (
    localStorage.getItem("marketplace_token") ||
    localStorage.getItem("token")
  );
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

const STEPS = [
  { id: 1, label: "Address" },
  { id: 2, label: "Review"  },
  { id: 3, label: "Payment" },
];

export default function CheckoutPage({ user }) {
  const navigate = useNavigate();

  /* ── Redirect if not logged in ── */
  useEffect(() => {
    if (!user) navigate("/auth", { state: { from: "/shop/checkout" } });
  }, [user, navigate]);

  const [step,            setStep]            = useState(1);
  const [addresses,       setAddresses]       = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [cartItems,       setCartItems]       = useState([]);
  const [calculation,     setCalculation]     = useState(null);
  const [paymentMethod,   setPaymentMethod]   = useState(null);
  const [couponCode,      setCouponCode]      = useState("");
  const [discount,        setDiscount]        = useState(0);
  const [notes,           setNotes]           = useState("");
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState(null);

  /* ── Load saved addresses ── */
  useEffect(() => {
    if (!user) return;

    axios
      .get(`${API}/checkout/address`, { headers: authHeaders() })
      .then(({ data }) => {
        const list = data.data ?? [];
        setAddresses(list);

        /* Auto-select default address */
        const def = list.find((a) => a.is_default) ?? list[0] ?? null;
        if (def) setSelectedAddress(def);
      })
      .catch(() => {});
  }, [user]);

  /* ── Load cart ── */
  useEffect(() => {
    if (!user) return;

    axios
      .get(`${API}/cart`, { headers: authHeaders() })
      .then(({ data }) => {
        setCartItems(data.data?.items ?? []);
      })
      .catch(() => {
        try {
          setCartItems(
            JSON.parse(localStorage.getItem(CART_KEY) || "[]")
          );
        } catch {}
      });
  }, [user]);

  /* ── Subtotal ── */
  const subtotal = useMemo(
    () => cartItems.reduce((s, i) => s + Number(i.price) * i.qty, 0),
    [cartItems]
  );

  /* ── Calculate delivery + payment options ── */
  useEffect(() => {
    if (subtotal <= 0) return;

    axios
      .post(
        `${API}/checkout/calculate`,
        { subtotal, discount },
        { headers: authHeaders() }
      )
      .then(({ data }) => {
        setCalculation(data.data);
        /* Auto-select first payment option */
        if (data.data.paymentOptions?.length) {
          setPaymentMethod((prev) =>
            /* Keep existing selection if still valid */
            data.data.paymentOptions.some((o) => o.key === prev)
              ? prev
              : data.data.paymentOptions[0].key
          );
        }
      })
      .catch(() => {});
  }, [subtotal, discount]);

  /* ── Address handlers ── */

  /** Called when a brand-new address is saved */
  const handleAddAddress = useCallback((addr) => {
    setAddresses((prev) => [addr, ...prev]);
  }, []);

  /** Called when an existing address is updated */
  const handleEditAddress = useCallback((id, updated) => {
    setAddresses((prev) =>
      prev.map((a) => (a.id === id ? updated : a))
    );
    /* If the edited address was selected, keep it fresh */
    setSelectedAddress((prev) =>
      prev?.id === id ? updated : prev
    );
  }, []);

  /** Called when user clicks a card / saves a new address */
  const handleSelectAddress = useCallback((addr) => {
    setSelectedAddress(addr);
  }, []);

  /* ── Place order ── */
  const handlePlaceOrder = useCallback(async () => {
    if (!selectedAddress || !paymentMethod) return;

    setLoading(true);
    setError(null);

    try {
      const { data } = await axios.post(
        `${API}/checkout`,
        {
          addressId:     selectedAddress.id,
          paymentMethod,
          couponCode:    couponCode || undefined,
          discount,
          notes:         notes     || undefined,
        },
        { headers: authHeaders() }
      );

      if (data.data.requiresPayment && data.data.paymentLink) {
        /* Online payment → redirect to Flutterwave */
        window.location.href = data.data.paymentLink;
      } else {
        /* Cash on delivery → success page */
        navigate(`/shop/orders/${data.data.orderGroupId}`);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Failed to place order. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [selectedAddress, paymentMethod, couponCode, discount, notes, navigate]);

  if (!user) return null;

  return (
    <div className="ck-page">

      {/* ── Top bar ── */}
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

      {/* ── Step indicator ── */}
      <div className="ck-steps">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <div
              className={[
                "ck-step",
                step === s.id ? "ck-step--active" : "",
                step >  s.id ? "ck-step--done"   : "",
              ].join(" ")}
            >
              <div className="ck-step-dot">
                {step > s.id ? "✓" : s.id}
              </div>
              <span className="ck-step-label">{s.label}</span>
            </div>

            {i < STEPS.length - 1 && (
              <div
                className={`ck-step-line ${
                  step > s.id ? "ck-step-line--done" : ""
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── Global error banner ── */}
      {error && (
        <div className="ck-error" role="alert">
          ⚠️ {error}
          <button onClick={() => setError(null)} aria-label="Dismiss error">
            ✕
          </button>
        </div>
      )}

      {/* ── Step content ── */}
      <div className="ck-content">

        {/* Step 1 — Address */}
        {step === 1 && (
          <AddressStep
            addresses={addresses}
            selected={selectedAddress}
            onSelect={handleSelectAddress}   /* select a card            */
            onAdd={handleAddAddress}          /* new address saved        */
            onEdit={handleEditAddress}        /* existing address updated */
            onNext={() => setStep(2)}
            user={user}                       /* for auto-fill            */
          />
        )}

        {/* Step 2 — Review */}
        {step === 2 && (
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
        {step === 3 && (
          <PaymentStep
            calculation={calculation}
            paymentMethod={paymentMethod}
            onSelectPayment={setPaymentMethod}
            loading={loading}
            onBack={() => setStep(2)}
            onPlaceOrder={handlePlaceOrder}
          />
        )}

      </div>
    </div>
  );
}