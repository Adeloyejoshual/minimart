// src/pages/Checkout/Payment/OrderSuccessPage.jsx

import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";

/* ✅ FIXED: Use Vite env var like the rest of your app */
const API = `${import.meta.env.VITE_API_BASE_URL}/api`;

const getToken = () =>
  localStorage.getItem("marketplace_token") ||
  localStorage.getItem("token");

const fmt = (n) =>
  `₦${Number(n || 0).toLocaleString("en-NG")}`;

export default function OrderSuccessPage() {
  const { orderId }   = useParams();
  const navigate      = useNavigate();

  const [order,   setOrder]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!orderId) {
      navigate("/");
      return;
    }

    axios
      /* ✅ FIXED: Correct endpoint */
      .get(`${API}/checkout/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      .then((res) => {
        setOrder(res.data.data ?? res.data);
      })
      .catch((err) => {
        console.error("[OrderSuccess]", err);
        setError("Could not load order details.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [orderId, navigate]);

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

  /* ✅ FIXED: Backend returns payment_method (snake_case) */
  const isCOD = order?.payment_method === "CASH_ON_DELIVERY";

  return (
    <div className="osp-wrapper">
      <div className="osp-card">

        {/* Success icon */}
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

        {/* Heading */}
        <h1 className="osp-title">
          {isCOD ? "Order Placed! 🎉" : "Payment Successful! 🎉"}
        </h1>

        <p className="osp-subtitle">
          {isCOD
            ? "Your order has been placed. Pay when it arrives."
            : "Your payment was confirmed. We're preparing your order."}
        </p>

        {/* Order ID */}
        <div className="osp-ref-box">
          <span className="osp-ref-label">Order ID</span>
          <span className="osp-ref-value">
            {/* ✅ FIXED: Backend uses tracking_id */}
            {order?.tracking_id ?? order?.id ?? orderId}
          </span>
        </div>

        {/* Order summary */}
        {order && (
          <div className="osp-summary">
            <h2 className="osp-summary-title">Order Summary</h2>

            {/* Items — flatten from orders[].items[] */}
            <div className="osp-items">
              {(order.orders ?? []).flatMap((subOrder) =>
                (subOrder.items ?? []).map((item) => (
                  <div key={item.id} className="osp-item">
                    <img
                      src={item.image || "/placeholder.png"}
                      alt={item.product_name ?? "Product"}
                      className="osp-item-img"
                    />
                    <div className="osp-item-info">
                      {/* ✅ FIXED: Backend has no "name" — uses product_name from JOIN */}
                      <p className="osp-item-name">
                        {item.product_name ?? "Product"}
                      </p>
                      <p className="osp-item-qty">
                        Qty: {item.quantity}
                      </p>
                    </div>
                    <span className="osp-item-price">
                      {/* ✅ FIXED: item.price × item.quantity */}
                      {fmt(Number(item.price) * Number(item.quantity))}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Totals */}
            <div className="osp-totals">
              <div className="osp-total-row">
                <span>Subtotal</span>
                {/* ✅ FIXED: total_amount is subtotal in your schema */}
                <span>{fmt(order.total_amount)}</span>
              </div>
              <div className="osp-total-row">
                <span>Delivery Fee</span>
                <span>{fmt(order.delivery_fee)}</span>
              </div>
              <div className="osp-total-divider" />
              <div className="osp-total-row osp-total-row--grand">
                <span>Total</span>
                <strong>{fmt(order.grand_total)}</strong>
              </div>
            </div>

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

        {/* Delivery info */}
        {order && (order.address_line || order.city) && (
          <div className="osp-delivery-info">
            <h3 className="osp-delivery-title">📦 Delivering To</h3>
            <p className="osp-delivery-address">
              {[
                order.recipient_name,
                order.address_line,
                order.city,
                order.state,
              ].filter(Boolean).join(", ")}
            </p>
            {order.phone && (
              <p className="osp-delivery-address">📞 {order.phone}</p>
            )}
          </div>
        )}

        {/* Next steps */}
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

        {/* Actions */}
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