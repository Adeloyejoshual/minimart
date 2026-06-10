import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";

const API = "https://minimart-ivrm.onrender.com/api";
const fmt = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;

function getToken() {
  return localStorage.getItem("marketplace_token") || localStorage.getItem("token");
}

export default function OrderSuccess({ user }) {
  const { orderGroupId }        = useParams();
  const navigate                 = useNavigate();
  const [searchParams]           = useSearchParams();
  const [order,    setOrder]     = useState(null);
  const [loading,  setLoading]   = useState(true);

  useEffect(() => {
    if (!orderGroupId) return;

    axios
      .get(`${API}/checkout/orders/${orderGroupId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      .then(({ data }) => setOrder(data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderGroupId]);

  if (loading) {
    return (
      <div className="os-loading">
        <div className="os-spinner" />
        <p>Loading your order…</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="os-not-found">
        <span>📦</span>
        <h2>Order not found</h2>
        <button onClick={() => navigate("/shop/orders")}>View All Orders</button>
      </div>
    );
  }

  const isCOD    = order.payment_method === "CASH_ON_DELIVERY";
  const isPaid   = order.payment_status === "paid";

  return (
    <div className="os-page">

      {/* Success hero */}
      <div className={`os-hero ${isCOD ? "os-hero--cod" : "os-hero--paid"}`}>
        <div className="os-hero-icon">
          {isCOD ? "📦" : isPaid ? "✅" : "⏳"}
        </div>
        <h1 className="os-hero-title">
          {isCOD
            ? "Order Placed!"
            : isPaid
              ? "Payment Confirmed!"
              : "Order Received!"}
        </h1>
        <p className="os-hero-sub">
          {isCOD
            ? "Pay when your order arrives at your door."
            : isPaid
              ? "Your payment was successful. Order is being processed."
              : "We'll confirm your order once payment is verified."}
        </p>
        <p className="os-order-ref">
          Order #{orderGroupId.slice(0, 8).toUpperCase()}
        </p>
      </div>

      {/* Order tracking timeline */}
      <div className="os-section">
        <h3 className="os-section-title">Order Timeline</h3>
        <div className="os-timeline">
          {[
            { icon:"✅", label:"Order Placed",           done: true                     },
            { icon:"💳", label:"Payment Confirmed",      done: isPaid || isCOD          },
            { icon:"📦", label:"Seller Preparing",       done: false                    },
            { icon:"🚚", label:"Out for Delivery",       done: false                    },
            { icon:"🏠", label:"Delivered",              done: false                    },
          ].map((step, i) => (
            <div key={i} className={`os-timeline-step ${step.done ? "os-timeline-step--done" : ""}`}>
              <div className="os-timeline-dot">{step.icon}</div>
              <span className="os-timeline-label">{step.label}</span>
              {i < 4 && <div className={`os-timeline-line ${step.done ? "os-timeline-line--done" : ""}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Delivery address */}
      {order.address_line && (
        <div className="os-section">
          <h3 className="os-section-title">Delivering to</h3>
          <div className="os-address-card">
            <p className="os-addr-name">{order.recipient_name} · {order.phone}</p>
            <p className="os-addr-line">{order.address_line}, {order.city}, {order.state}</p>
          </div>
        </div>
      )}

      {/* Order items by seller */}
      {order.orders?.map((sellerOrder) => (
        <div key={sellerOrder.id} className="os-section">
          <div className="os-seller-header">
            <div className="os-seller-dot">
              {sellerOrder.seller_name?.[0]?.toUpperCase() ?? "S"}
            </div>
            <div>
              <p className="os-seller-name">{sellerOrder.seller_name ?? "Seller"}</p>
              <p className="os-seller-status">{sellerOrder.status}</p>
            </div>
            <span className="os-seller-total">{fmt(sellerOrder.subtotal)}</span>
          </div>

          {sellerOrder.items?.map((item) => (
            <div key={item.id} className="os-item">
              <div className="os-item-img">
                {item.image
                  ? <img src={item.image} alt={item.name} />
                  : <span>📦</span>}
              </div>
              <div className="os-item-info">
                <p className="os-item-name">{item.name}</p>
                {item.variant_name && <p className="os-item-variant">{item.variant_name}</p>}
                <p className="os-item-qty">Qty: {item.qty} × {fmt(item.unit_price)}</p>
              </div>
              <p className="os-item-total">{fmt(item.subtotal)}</p>
            </div>
          ))}
        </div>
      ))}

      {/* Price summary */}
      <div className="os-section">
        <div className="os-price-summary">
          <div className="os-price-row">
            <span>Subtotal</span>
            <span>{fmt(order.total_amount)}</span>
          </div>
          <div className="os-price-row">
            <span>Delivery</span>
            <span>{fmt(order.delivery_fee)}</span>
          </div>
          {order.discount > 0 && (
            <div className="os-price-row os-price-row--discount">
              <span>Discount</span>
              <span>- {fmt(order.discount)}</span>
            </div>
          )}
          <div className="os-price-divider" />
          <div className="os-price-row os-price-row--total">
            <span>Total {isCOD ? "(Pay on Delivery)" : "Paid"}</span>
            <span>{fmt(order.grand_total)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="os-actions">
        <button className="os-btn-primary" onClick={() => navigate("/shop/orders")}>
          View All Orders
        </button>
        <button className="os-btn-secondary" onClick={() => navigate("/minimart")}>
          Continue Shopping
        </button>
      </div>
    </div>
  );
}