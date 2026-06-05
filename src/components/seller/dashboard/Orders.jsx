// components/seller/dashboard/Orders.jsx
import { useState } from "react";
import { formatNGN } from "./Shared";

const ORDER_TABS = [
  { value: "all",        label: "All",        color: "#6366f1" },
  { value: "pending",    label: "Pending",    color: "#f59e0b" },
  { value: "processing", label: "Processing", color: "#3b82f6" },
  { value: "shipped",    label: "Shipped",    color: "#8b5cf6" },
  { value: "delivered",  label: "Delivered",  color: "#10b981" },
  { value: "cancelled",  label: "Cancelled",  color: "#ef4444" },
];

const NEXT_STATUS = {
  pending:    { next: "processing", label: "Accept",    icon: "✅" },
  processing: { next: "shipped",    label: "Ship",      icon: "🚚" },
  shipped:    { next: "delivered",  label: "Delivered", icon: "📬" },
};

const ORDER_STATUS_MAP = {
  pending:    { color: "#f59e0b", bg: "#fffbeb" },
  processing: { color: "#3b82f6", bg: "#eff6ff" },
  shipped:    { color: "#8b5cf6", bg: "#f5f3ff" },
  delivered:  { color: "#10b981", bg: "#ecfdf5" },
  cancelled:  { color: "#ef4444", bg: "#fef2f2" },
};

export const Orders = ({ orders, orderTab, setOrderTab, updateOrderStatus }) => {
  const [updating, setUpdating] = useState(null);
  const [msg,      setMsg]      = useState("");

  const handleAction = async (orderId, newStatus) => {
    setUpdating(orderId);
    setMsg("");
    const result = await updateOrderStatus(orderId, newStatus);
    if (!result?.success) setMsg(result?.message ?? "Update failed");
    setUpdating(null);
  };

  return (
    <div className="sd-card">
      <div className="sd-card-header">
        <h3 className="sd-card-title">📦 Orders</h3>
        <span style={{ color: "#9ca3af", fontSize: "0.82rem" }}>
          {orders?.length ?? 0} orders
        </span>
      </div>

      {/* Tabs */}
      <div className="sd-order-tabs">
        {ORDER_TABS.map((tab) => (
          <button
            key={tab.value}
            className={`sd-order-tab ${orderTab === tab.value ? "active" : ""}`}
            style={orderTab === tab.value
              ? { borderColor: tab.color, color: tab.color }
              : {}}
            onClick={() => setOrderTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {msg && <div className="sd-table-msg">⚠️ {msg}</div>}

      {!orders?.length ? (
        <div className="sd-empty">No orders found</div>
      ) : (
        <div className="sd-table-wrap">
          <table className="sd-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const action = NEXT_STATUS[order.status];
                const st     = ORDER_STATUS_MAP[order.status] ?? ORDER_STATUS_MAP.pending;
                return (
                  <tr key={order.id}>
                    <td className="sd-order-id">
                      #{order.id?.slice(-8).toUpperCase()}
                    </td>
                    <td>{order.customer_name ?? "—"}</td>
                    <td style={{ textAlign: "center" }}>
                      {order.item_count ?? 0}
                    </td>
                    <td className="sd-order-total">
                      {formatNGN(order.total)}
                    </td>
                    <td className="sd-order-date">
                      {order.created_at
                        ? new Date(order.created_at).toLocaleDateString("en-NG")
                        : "—"}
                    </td>
                    <td>
                      <span style={{
                        padding:      "0.2rem 0.6rem",
                        borderRadius: "100px",
                        fontSize:     "0.72rem",
                        fontWeight:   700,
                        color:        st.color,
                        background:   st.bg,
                      }}>
                        {order.status}
                      </span>
                    </td>
                    <td>
                      {action ? (
                        <button
                          className="sd-action-btn"
                          disabled={updating === order.id}
                          onClick={() => handleAction(order.id, action.next)}
                        >
                          {updating === order.id
                            ? "..."
                            : `${action.icon} ${action.label}`}
                        </button>
                      ) : (
                        <span className="sd-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};