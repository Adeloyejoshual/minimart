// src/pages/admin/Finance/FinancePayments.jsx

import { useMemo, useState } from "react";
import { fmt, fmtN, fmtDate } from "../adminlayout/helpers";
import { Pill, Card, Rfr, Srch } from "../adminlayout/atoms";
import toast from "react-hot-toast";

export default function FinancePayments({
  filteredPayments, payQ, setPayQ,
  refundPayment, busy, reloadPayments, confirm,
}) {
  const [filterStatus, setFilterStatus] = useState("all");

  const stats = useMemo(() => {
    const success = filteredPayments.filter((p) =>
      ["success", "completed", "paid"].includes(p.status),
    );
    const failed = filteredPayments.filter((p) =>
      ["failed", "cancelled"].includes(p.status),
    );
    const refunded = filteredPayments.filter((p) => p.status === "refunded");
    const totalRevenue = success.reduce((s, p) => s + Number(p.amount || 0), 0);

    return {
      total: filteredPayments.length,
      success: success.length,
      failed: failed.length,
      refunded: refunded.length,
      revenue: totalRevenue,
    };
  }, [filteredPayments]);

  const displayed = useMemo(() => {
    if (filterStatus === "all") return filteredPayments;
    return filteredPayments.filter((p) => p.status === filterStatus);
  }, [filteredPayments, filterStatus]);

  const handleRefund = (p) => {
    confirm({
      title:   "Refund Payment?",
      body:    `Refund ${fmtN(p.amount)} for ${p.user}? This cannot be undone.`,
      danger:  true,
      confirm: "Yes, Refund",
      action:  async () => {
        try {
          await refundPayment(p.id);
          toast.success("Refund processed successfully");
        } catch (err) {
          toast.error(err.message || "Refund failed");
        }
      },
    });
  };

  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <h1>
            Payments{" "}
            <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "1rem" }}>
              ({fmt(displayed.length)})
            </span>
          </h1>
          <p style={{ color: "var(--muted)", fontSize: ".78rem", marginTop: 4 }}>
            Manage all platform payments and process refunds
          </p>
        </div>
        <div className="ph-right">
          <Srch value={payQ} onChange={setPayQ} placeholder="Search…" />
          <Rfr onClick={reloadPayments} />
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display             : "grid",
        gridTemplateColumns : "repeat(auto-fit, minmax(140px, 1fr))",
        gap                 : 10,
        marginBottom        : 12,
      }}>
        <StatBox label="Revenue"    value={fmtN(stats.revenue)}   color="#22c55e" />
        <StatBox label="Success"    value={fmt(stats.success)}    color="#3b82f6" />
        <StatBox label="Failed"     value={fmt(stats.failed)}     color="#ef4444" />
        <StatBox label="Refunded"   value={fmt(stats.refunded)}   color="#f59e42" />
        <StatBox label="Total"      value={fmt(stats.total)}      color="#a855f7" />
      </div>

      {/* Filter */}
      <Card>
        <select
          className="input"
          style={{ maxWidth: 220 }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="success">Success</option>
          <option value="completed">Completed</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
          <option value="pending">Pending</option>
        </select>
      </Card>

      {/* Table */}
      <Card>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>User</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Method</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((p) => {
                const canRefund = ["success", "completed", "paid"].includes(p.status);
                return (
                  <tr key={p.id}>
                    <td className="mono" style={{ fontSize: ".68rem" }}>
                      {p.reference || p.id}
                    </td>
                    <td>{p.user || "—"}</td>
                    <td className="mono" style={{ color: "var(--green)", fontWeight: 700 }}>
                      {fmtN(p.amount)}
                    </td>
                    <td><Pill s={p.status || "pending"} /></td>
                    <td className="dim" style={{ fontSize: ".7rem" }}>
                      {p.method || "—"}
                    </td>
                    <td className="mono dim" style={{ fontSize: ".68rem" }}>
                      {fmtDate(p.created_at)}
                    </td>
                    <td>
                      {canRefund ? (
                        <button
                          className="btn b-red"
                          style={{ fontSize: ".72rem", padding: "2px 10px" }}
                          disabled={busy === `rf-${p.id}`}
                          onClick={() => handleRefund(p)}
                        >
                          {busy === `rf-${p.id}` ? "…" : "Refund"}
                        </button>
                      ) : (
                        <span className="dim" style={{ fontSize: ".68rem" }}>
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!displayed.length && (
                <tr>
                  <td colSpan={7} className="empty">No payments found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{
      background   : "var(--card)",
      border       : "1px solid var(--border)",
      borderRadius : 10,
      padding      : "12px 14px",
    }}>
      <div style={{
        fontSize      : ".65rem",
        color         : "var(--muted)",
        textTransform : "uppercase",
        fontWeight    : 700,
      }}>
        {label}
      </div>
      <div style={{
        fontSize   : "1.3rem",
        fontWeight : 800,
        color,
        marginTop  : 4,
      }}>
        {value}
      </div>
    </div>
  );
}