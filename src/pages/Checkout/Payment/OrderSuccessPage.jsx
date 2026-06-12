// src/pages/Checkout/Payment/OrderSuccessPage.jsx

import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";

const API = process.env.REACT_APP_API_URL || "";

const fmt = (n) =>
  `₦${Number(n || 0).toLocaleString("en-NG")}`;

export default function OrderSuccessPage() {
  const { orderId }   = useParams();
  const navigate      = useNavigate();

  const [order,   setOrder]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // ── Fetch order details ──────────────────────────────────
  useEffect(() => {
    if (!orderId) {
      navigate("/");
      return;
    }

    axios
      .get(`${API}/api/orders/${orderId}`, {
        withCredentials: true,
      })
      .then((res) => {
        setOrder(res.data);
      })
      .catch(() => {
        setError("Could not load order details.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [orderId, navigate]);

  // ── Loading state ────────────────────────────────────────
  if (loading) {
    return (
      <div className="osp-wrapper">
        <div className="osp-loading">
          <div className="osp-spinner" />
          <p>Loading your order…</p>
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────
  if (error) {
    return (
      <div className="osp-wrapper">
        <div className="osp-error">
          <span className="osp-icon">⚠️</span>
          <p>{error}</p>
          <Link to="/orders" className="osp-btn osp-btn--primary">
            View My Orders
          </Link>
        </div>
      </div>
    );
  }

  const isCOD = order?.paymentMethod === "CASH_ON_DELIVERY";

  return (
    <div className="osp-wrapper">
      <div className="osp-card">

        {/* ── Success icon ─────────────────────────────── */}
        <div className="osp-icon-wrap osp-icon-wrap--success">
          <svg
            className="osp-checkmark"
            viewBox="0 0 52 52"
            aria-hidden="true"
          >
            <circle
              className="osp-checkmark__circle"
              cx="26" cy="26" r="25"
              fill="none"
            />
            <path
              className="osp-checkmark__check"
              fill="none"
              d="M14.1 27.2l7.1 7.2 16.7-16.8"
            />
          </svg>
        </div>

        {/* ── Heading ──────────────────────────────────── */}
        <h1 className="osp-title">
          {isCOD ? "Order Placed! 🎉" : "Payment Successful! 🎉"}
        </h1>

        <p className="osp-subtitle">
          {isCOD
            ? "Your order has been placed. Pay when it arrives."
            : "Your payment was confirmed. We're preparing your order."}
        </p>

        {/* ── Order ID ─────────────────────────────────── */}
        <div className="osp-ref-box">
          <span className="osp-ref-label">Order ID</span>
          <span className="osp-ref-value">
            {order?.id ?? orderId}
          </span>
        </div>

        {/* ── Order summary ─────────────────────────────── */}
        {order && (
          <div className="osp-summary">
            <h2 className="osp-summary-title">Order Summary</h2>

            {/* Items */}
            <div className="osp-items">
              {(order.items ?? []).map((item) => (
                <div key={item.id} className="osp-item">
                  <img
                    src={item.image || "/placeholder.png"}
                    alt={item.name}
                    className="osp-item-img"
                  />
                  <div className="osp-item-info">
                    <p className="osp-item-name">{item.name}</p>
                    <p className="osp-item-qty">
                      Qty: {item.quantity}
                    </p>
                  </div>
                  <span className="osp-item-price">
                    {fmt(item.totalPrice)}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="osp-totals">
              <div className="osp-total-row">
                <span>Subtotal</span>
                <span>{fmt(order.subtotal)}</span>
              </div>
              <div className="osp-total-row">
                <span>Delivery Fee</span>
                <span>{fmt(order.deliveryFee)}</span>
              </div>
              <div className="osp-total-divider" />
              <div className="osp-total-row osp-total-row--grand">
                <span>Total</span>
                <strong>{fmt(order.grandTotal)}</strong>
              </div>
            </div>

            {/* Payment method badge */}
            <div
              className={`osp-payment-badge ${
                isCOD
                  ? "osp-payment-badge--cod"
                  : "osp-payment-badge--online"
              }`}
            >
              {isCOD ? "💵 Pay on Delivery" : "💳 Paid Online"}
            </div>
          </div>
        )}

        {/* ── Delivery info ─────────────────────────────── */}
        {order?.shippingAddress && (
          <div className="osp-delivery-info">
            <h3 className="osp-delivery-title">
              📦 Delivering To
            </h3>
            <p className="osp-delivery-address">
              {order.shippingAddress.street},{" "}
              {order.shippingAddress.city},{" "}
              {order.shippingAddress.state}
            </p>
          </div>
        )}

        {/* ── What happens next ─────────────────────────── */}
        <div className="osp-next-steps">
          <h3 className="osp-next-title">What happens next?</h3>
          <ol className="osp-steps-list">
            {isCOD ? (
              <>
                <li>✅ Order confirmed</li>
                <li>📦 Seller prepares your items</li>
                <li>🚚 Rider picks up your order</li>
                <li>💵 Pay rider on delivery</li>
              </>
            ) : (
              <>
                <li>✅ Payment confirmed</li>
                <li>📦 Seller prepares your items</li>
                <li>🚚 Order picked up for delivery</li>
                <li>🎁 Delivered to your address</li>
              </>
            )}
          </ol>
        </div>

        {/* ── Action buttons ────────────────────────────── */}
        <div className="osp-actions">
          <Link
            to={`/orders/${orderId}`}
            className="osp-btn osp-btn--primary"
          >
            Track My Order
          </Link>
          <Link
            to="/"
            className="osp-btn osp-btn--secondary"
          >
            Continue Shopping
          </Link>
        </div>

      </div>
    </div>
  );
}