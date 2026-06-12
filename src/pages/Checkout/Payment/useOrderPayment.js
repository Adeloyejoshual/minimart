// src/pages/Checkout/Payment/useOrderPayment.js

import { useState, useCallback } from "react";
import axios from "axios";

/**
 * RULES:
 * 1. Order is created FIRST (before any payment)
 * 2. Frontend NEVER marks order as paid
 * 3. Only webhook confirms payment
 * 4. COD → redirect to success directly
 * 5. ONLINE → redirect to Flutterwave URL
 */

const API = process.env.REACT_APP_API_URL || "";

export function useOrderPayment() {
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [orderId, setOrderId]   = useState(null);

  /**
   * Main function called when user clicks "Place Order"
   *
   * @param {Object} params
   * @param {Array}  params.cartItems
   * @param {Object} params.shippingAddress
   * @param {string} params.paymentMethod   "CASH_ON_DELIVERY" | "ONLINE_PAYMENT"
   * @param {number} params.grandTotal
   * @param {string} params.userId
   * @param {Function} params.onSuccess     called for COD success
   * @param {Function} params.onError       called on any error
   */
  const placeOrder = useCallback(async ({
    cartItems,
    shippingAddress,
    paymentMethod,
    grandTotal,
    userId,
    onSuccess,
    onError,
  }) => {

    // ── Guard: must have items ──────────────────────────────
    if (!cartItems?.length) {
      setError("Your cart is empty.");
      onError?.("Your cart is empty.");
      return;
    }

    // ── Guard: must have address ────────────────────────────
    if (!shippingAddress) {
      setError("Please add a shipping address.");
      onError?.("Please add a shipping address.");
      return;
    }

    // ── Guard: must have payment method ─────────────────────
    if (!paymentMethod) {
      setError("Please select a payment method.");
      onError?.("Please select a payment method.");
      return;
    }

    setLoading(true);
    setError(null);

    try {

      // ────────────────────────────────────────────────────────
      // STEP A: Create the order in our database FIRST
      //         We always create order before touching Flutterwave
      // ────────────────────────────────────────────────────────
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
          headers: { "Content-Type": "application/json" },
        }
      );

      const order = orderRes.data;

      // Save orderId to state (useful for error page)
      setOrderId(order.orderId);

      // ────────────────────────────────────────────────────────
      // STEP B: Handle based on payment method
      // ────────────────────────────────────────────────────────

      if (order.paymentMethod === "CASH_ON_DELIVERY") {
        // COD → order is already created and pending
        // No Flutterwave needed
        // Redirect to success page
        onSuccess?.({
          orderId: order.orderId,
          paymentMethod: "CASH_ON_DELIVERY",
        });
        return;
      }

      if (order.paymentMethod === "ONLINE_PAYMENT") {
        // ONLINE → backend gave us a Flutterwave payment URL
        // We must redirect user to that URL
        // Payment confirmation happens via webhook NOT here

        const paymentUrl = order.paymentUrl;

        if (!paymentUrl) {
          throw new Error(
            "Payment URL not received. Please try again."
          );
        }

        // Hard redirect to Flutterwave hosted page
        // User will come back to our callback URL after payment
        window.location.href = paymentUrl;
        return;
      }

      // Unknown payment method
      throw new Error("Unknown payment method received.");

    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
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
  };
}