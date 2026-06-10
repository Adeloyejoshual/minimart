import React, {
  useState, useEffect, useCallback, useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import AddressStep from "./Checkout/AddressStep";
import ReviewStep  from "./Checkout/ReviewStep";
import PaymentStep from "./Checkout/PaymentStep";

import "../styles/Checkout.css";

const API        = "https://minimart-ivrm.onrender.com/api";
const CART_KEY   = "mm_cart";

function getToken() {
  return localStorage.getItem("marketplace_token") || localStorage.getItem("token");
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

const STEPS = [
  { id: 1, label: "Address"  },
  { id: 2, label: "Review"   },
  { id: 3, label: "Payment"  },
];

export default function CheckoutPage({ user }) {
  const navigate = useNavigate();

  /* Redirect if not logged in */
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

  /* Load addresses */
  useEffect(() => {
    axios
      .get(`${API}/checkout/address`, { headers: authHeaders() })
      .then(({ data }) => {
        setAddresses(data.data ?? []);
        const def = data.data?.find((a) => a.is_default);
        if (def) setSelectedAddress(def);
      })
      .catch(() => {});
  }, []);

  /* Load cart */
  useEffect(() => {
    axios
      .get(`${API}/cart`, { headers: authHeaders() })
      .then(({ data }) => {
        setCartItems(data.data?.items ?? []);
      })
      .catch(() => {
        /* Fallback to localStorage */
        try {
          setCartItems(JSON.parse(localStorage.getItem(CART_KEY) || "[]"));
        } catch {}
      });
  }, []);

  const subtotal = useMemo(() =>
    cartItems.reduce((s, i) => s + (Number(i.price) * i.qty), 0),
    [cartItems]
  );

  /* Calculate delivery + payment options */
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
          setPaymentMethod(data.data.paymentOptions[0].key);
        }
      })
      .catch(() => {});
  }, [subtotal, discount]);

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
          notes:         notes || undefined,
        },
        { headers: authHeaders() }
      );

      if (data.data.requiresPayment && data.data.paymentLink) {
        /* Redirect to Flutterwave */
        window.location.href = data.data.paymentLink;
      } else {
        /* COD — go to success page */
        navigate(`/shop/orders/${data.data.orderGroupId}`);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to place order. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [selectedAddress, paymentMethod, couponCode, discount, notes, navigate]);

  if (!user) return null;

  return (
    <div className="ck-page">

      {/* Topbar */}
      <div className="ck-topbar">
        <button className="ck-back-btn" onClick={() => navigate("/shop/cart")}>
          ←
        </button>
        <h1 className="ck-topbar-title">Checkout</h1>
        <div />
      </div>

      {/* Step indicator */}
      <div className="ck-steps">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className={`ck-step ${step === s.id ? "ck-step--active" : ""} ${step > s.id ? "ck-step--done" : ""}`}>
              <div className="ck-step-dot">
                {step > s.id ? "✓" : s.id}
              </div>
              <span className="ck-step-label">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`ck-step-line ${step > s.id ? "ck-step-line--done" : ""}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="ck-error" role="alert">
          ⚠️ {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Steps */}
      <div className="ck-content">
        {step === 1 && (
          <AddressStep
            addresses={addresses}
            selected={selectedAddress}
            onSelect={setSelectedAddress}
            onAdd={(addr) => setAddresses((p) => [addr, ...p])}
            onNext={() => setStep(2)}
          />
        )}

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