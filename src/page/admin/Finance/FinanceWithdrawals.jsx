// src/pages/admin/Finance/FinanceWithdrawals.jsx

import { useMemo, useState } from "react";
import { fmt, fmtN, fmtDate } from "../adminlayout/helpers";
import { Pill, Card, Rfr } from "../adminlayout/atoms";
import toast from "react-hot-toast";

export default function FinanceWithdrawals({
  withdrawals, approveWithdrawal, rejectWithdrawal, markWithdrawalPaid,
  busy, reloadWithdrawals, confirm,
}) {
  const [filterStatus, setFilterStatus] = useState("pending");

  const stats = useMemo(() => {
    const pending = withdrawals.filter((w) => w.status === "pending");
    const approved = withdrawals.filter((w) => w.status === "approved");
    const paid = withdrawals.filter((w) => w.status === "paid");
    const rejected = withdrawals.filter((w) => w.status === "rejected");
    const pendingAmount = pending.reduce((s, w) => s + Number(w.amount || 0), 0);

    return {
      pending: pending.length,
      approved: approved.length,
      paid: paid.length,
      rejected: rejected.length,
      pendingAmount,
    };
  }, [withdrawals]);

  const displayed = useMemo(() => {
    if (filterStatus === "all") return withdrawals;
    return withdrawals.filter((w) => w.status === filterStatus);
  }, [withdrawals, filterStatus]);

  const handleApprove = (w) => {
    confirm({
      title:   "Approve Withdrawal?",
      body:    `Approve ${fmtN(w.amount)} for ${w.user_name || w.user}? Ready for payment processing.`,
      confirm: "Yes, Approve",
      action:  async () => {
        try {
          await approveWithdrawal(w.id);
          toast.success("Withdrawal approved");
        } catch (err) {
          toast.error(err.message || "Approval failed");
        }
      },
    });
  };

  const handleReject = (w) => {
    const reason = prompt(`Reason for rejecting withdrawal of ${fmtN(w.amount)}?`);
    if (!reason?.trim()) return;

    confirm({
      title:   "Reject Withdrawal?",
      body:    `Reject ${fmtN(w.amount)} for ${w.user_name || w.user}?\n\nReason: ${reason}`,
      danger:  true,
      confirm: "Yes, Reject",
      action:  async () => {
        try {
          await rejectWithdrawal(w.id, reason);
          toast.success("Withdrawal rejected");
        } catch (err) {
          toast.error(err.message || "Rejection failed");
        }
      },
    });
  };

  const handleMarkPaid = (w) => {
    const reference = prompt(`Payment reference for ${fmtN(w.amount)} to ${w.user_name}?`);
    if (!reference?.trim()) return;

    confirm({
      title:   "Mark as Paid?",
      body:    `Confirm ${fmtN(w.amount)} was paid via reference: ${reference}`,
      confirm: "Yes, Mark Paid",
      action:  async () => {
        try {
          await markWithdrawalPaid(w.id, reference);
          toast.success("Marked as paid");
        } catch (err) {
          toast.error(err.message || "Failed to mark as paid");
        }
      },
    });
  };

  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <h1>
            Withdrawals{" "}
            <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: "1rem" }}>
              ({fmt(displayed.length)})
            </span>
          </h1>
          <p style={{ color: "var(--muted)", fontSize: ".78rem", marginTop: 4 }}>
            Review and process seller withdrawal requests
          </p>
        </div>
        <div className="ph-right">
          <Rfr onClick={reloadWithdrawals} />
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display             : "grid",
        gridTemplateColumns : "repeat(auto-fit, minmax(140px, 1fr))",
        gap                 : 10,
        marginBottom        : 12,
      }}>
        <StatBox label="Pending"        value={fmt(stats.pending)}         color="#f59e42" />
        <StatBox label="Pending Amount" value={fmtN(stats.pendingAmount)}  color="#f59e42" />
        <StatBox label="Approved"       value={fmt(stats.approved)}        color="#3b82f6" />
        <StatBox label="Paid"           value={fmt(stats.paid)}            color="#22c55e" />
        <StatBox label="Rejected"       value={fmt(stats.rejected)}        color="#ef4444" />
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {["pending", "approved", "paid", "rejected", "all"].map((s) => (
          <button
            key={s}
            className={`btn ${filterStatus === s ? "b-solid" : "b-ghost"}`}
            style={{ fontSize: ".75rem", padding: "4px 12px", textTransform: "capitalize" }}
            onClick={() => setFilterStatus(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Amount</th>
                <th>Bank</th>
                <th>Account</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((w) => (
                <tr key={w.id}>
                  <td style={{ fontWeight: 700 }}>{w.user_name || w.user || "—"}</td>
                  <td className="mono" style={{ color: "var(--green)", fontWeight: 700 }}>
                    {fmtN(w.amount)}
                  </td>
                  <td className="dim" style={{ fontSize: ".72rem" }}>
                    {w.bank_name || "—"}
                  </td>
                  <td className="mono" style={{ fontSize: ".68rem" }}>
                    {w.account_number || "—"}
                  </td>
                  <td><Pill s={w.status || "pending"} /></td>
                  <td className="mono dim" style={{ fontSize: ".68rem" }}>
                    {fmtDate(w.created_at)}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {w.status === "pending" && (
                        <>
                          <button
                            className="btn b-solid"
                            style={{ fontSize: ".7rem", padding: "2px 8px" }}
                            disabled={busy === `aw-${w.id}`}
                            onClick={() => handleApprove(w)}
                          >
                            {busy === `aw-${w.id}` ? "…" : "Approve"}
                          </button>
                          <button
                            className="btn b-red"
                            style={{ fontSize: ".7rem", padding: "2px 8px" }}
                            disabled={busy === `rw-${w.id}`}
                            onClick={() => handleReject(w)}
                          >
                            {busy === `rw-${w.id}` ? "…" : "Reject"}
                          </button>
                        </>
                      )}
                      {w.status === "approved" && (
                        <button
                          className="btn b-solid"
                          style={{ fontSize: ".7rem", padding: "2px 8px", background: "#22c55e" }}
                          disabled={busy === `mp-${w.id}`}
                          onClick={() => handleMarkPaid(w)}
                        >
                          {busy === `mp-${w.id}` ? "…" : "Mark Paid"}
                        </button>
                      )}
                      {["paid", "rejected"].includes(w.status) && (
                        <span className="dim" style={{ fontSize: ".68rem" }}>—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!displayed.length && (
                <tr>
                  <td colSpan={7} className="empty">
                    No {filterStatus === "all" ? "" : filterStatus} withdrawals.
                  </td>
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