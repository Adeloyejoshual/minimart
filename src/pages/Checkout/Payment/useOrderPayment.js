// src/pages/Checkout/useOrderPayment.js

import { useState, useCallback } from "react";
import axios from "axios";

// ─────────────────────────────────────────────────────────────
// Base API URL — works for both CRA and Vite
// ─────────────────────────────────────────────────────────────
const API =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  process.env.REACT_APP_API_URL ||
  "";

// ─────────────────────────────────────────────────────────────
// Auth token helper
// ─────────────────────────────────────────────────────────────
function getToken() {
  return (
    localStorage.getItem("marketplace_token") ||
    localStorage.getItem("token")             ||
    null
  );
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ═════════════════════════════════════════════════════════════
// useOrderPayment
//
// Rules:
// 1. Order is ALWAYS created on backend first
// 2. Frontend NEVER marks an order as paid
// 3. Only webhook confirms payment
// 4. COD → redirect to success directly
// 5. ONLINE → redirect to Flutterwave URL
// ═════════════════════════════════════════════════════════════
export function useOrderPayment() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [orderId, setOrderId] = useState(null);

  // ── Clear error helper ───────────────────────────────────
  const clearError = useCallback(() => setError(null), []);

  // ── Main place order function ────────────────────────────
  const placeOrder = useCallback(async ({
    cartItems,
    shippingAddress,
    paymentMethod,
    grandTotal,
    userId,
    onSuccess,
    onError,
  }) => {

    // ── Guard: cart must have items ───────────────────────
    if (!cartItems?.length) {
      const msg = "Your cart is empty.";
      setError(msg);
      onError?.(msg);
      return;
    }

    // ── Guard: address required ───────────────────────────
    if (!shippingAddress) {
      const msg = "Please add a shipping address.";
      setError(msg);
      onError?.(msg);
      return;
    }

    // ── Guard: payment method required ────────────────────
    if (!paymentMethod) {
      const msg = "Please select a payment method.";
      setError(msg);
      onError?.(msg);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // ── STEP 1: Create order on backend ──────────────────
      // Always create order BEFORE touching Flutterwave
      const orderRes = await axios.post(
        `${API}/api/orders`,
        {
          cartItems,
          shippingAddress,
          paymentMethod,
          grandTotal,
          userId,
        },
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          timeout: 30000,
        }
      );

      const order = orderRes.data;

      // Save orderId to state
      if (order.orderId) {
        setOrderId(order.orderId);
      }

      // ── STEP 2A: Cash on Delivery ─────────────────────
      if (
        order.paymentMethod === "CASH_ON_DELIVERY" ||
        paymentMethod       === "CASH_ON_DELIVERY"
      ) {
        onSuccess?.({
          orderId:       order.orderId,
          paymentMethod: "CASH_ON_DELIVERY",
        });
        return;
      }

      // ── STEP 2B: Online Payment ───────────────────────
      if (
        order.paymentMethod === "ONLINE_PAYMENT" ||
        paymentMethod       === "ONLINE_PAYMENT"
      ) {
        const paymentUrl = order.paymentUrl ?? order.payment_url;

        if (!paymentUrl) {
          throw new Error(
            "Payment URL not received from server. Please try again."
          );
        }

        // Hard redirect to Flutterwave hosted checkout
        // Payment confirmed via webhook — NOT here
        window.location.href = paymentUrl;
        return;
      }

      // ── Unknown payment method ────────────────────────
      throw new Error(
        `Unknown payment method: "${order.paymentMethod ?? paymentMethod}"`
      );

    } catch (err) {
      // ── Parse error message ───────────────────────────
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error   ||
        err?.message                 ||
        "Something went wrong. Please try again.";

      setError(message);
      onError?.(message);

    } finally {
      setLoading(false);
    }

  }, []);

  return {
    placeOrder,
    loading,
    error,
    orderId,
    clearError,
  };
}

export default useOrderPayment;