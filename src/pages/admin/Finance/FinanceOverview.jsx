// src/pages/admin/Finance/FinanceOverview.jsx

import { fmt, fmtN } from "../adminlayout/helpers";
import { Card } from "../adminlayout/atoms";

export default function FinanceOverview({
  stats, subscriptionStats, payments, withdrawals,
  withdrawalPendingCount, goTo,
}) {
  const successPayments = payments.filter(
    (p) => ["success", "completed", "paid"].includes(p.status),
  ).length;

  const failedPayments = payments.filter(
    (p) => ["failed", "cancelled"].includes(p.status),
  ).length;

  const successRate = payments.length
    ? Math.round((successPayments / payments.length) * 100)
    : 0;

  const totalWithdrawn = withdrawals
    .filter((w) => w.status === "paid")
    .reduce((sum, w) => sum + Number(w.amount || 0), 0);

  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <h1>💰 Finance Overview</h1>
          <p style={{ color: "var(--muted)", fontSize: ".78rem", marginTop: 4 }}>
            Monitor platform revenue, transactions and cash flow
          </p>
        </div>
      </div>

      {/* ── Revenue Cards ── */}
      <div style={{
        display             : "grid",
        gridTemplateColumns : "repeat(auto-fit, minmax(220px, 1fr))",
        gap                 : 12,
        marginBottom        : 16,
      }}>
        <BigStatCard
          icon="💵"
          label="Total Revenue"
          value={fmtN(stats.revenue)}
          color="#22c55e"
          delta={`+${fmtN(stats.todayRevenue)} today`}
        />
        <BigStatCard
          icon="📊"
          label="Monthly Recurring"
          value={fmtN(stats.subscriptions?.mrr ?? 0)}
          color="#3b82f6"
          delta={`ARR: ${fmtN(stats.subscriptions?.arr ?? 0)}`}
        />
        <BigStatCard
          icon="💳"
          label="Total Payments"
          value={fmt(payments.length)}
          color="#a855f7"
          delta={`${successRate}% success rate`}
        />
        <BigStatCard
          icon="🏦"
          label="Total Withdrawn"
          value={fmtN(totalWithdrawn)}
          color="#f59e42"
          delta={
            withdrawalPendingCount
              ? `${withdrawalPendingCount} pending`
              : "None pending"
          }
        />
      </div>

      {/* ── Quick Actions ── */}
      <Card title="Quick Actions">
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
        }}>
          <ActionButton
            label="Review Withdrawals"
            count={withdrawalPendingCount}
            color="#f59e42"
            onClick={() => goTo("withdrawals")}
          />
          <ActionButton
            label="View Payments"
            color="#3b82f6"
            onClick={() => goTo("payments")}
          />
          <ActionButton
            label="Manage Subscriptions"
            count={subscriptionStats?.active ?? 0}
            color="#22c55e"
            onClick={() => goTo("subscriptions")}
          />
          <ActionButton
            label="Revenue Analytics"
            color="#a855f7"
            onClick={() => goTo("revenue")}
          />
        </div>
      </Card>

      {/* ── Payment Health ── */}
      <Card title="Payment Health">
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}>
          <MiniStat
            label="Successful"
            value={successPayments}
            color="#22c55e"
          />
          <MiniStat
            label="Failed"
            value={failedPayments}
            color="#ef4444"
          />
          <MiniStat
            label="Pending"
            value={payments.length - successPayments - failedPayments}
            color="#f59e42"
          />
          <MiniStat
            label="Total Orders"
            value={fmt(stats.orders ?? 0)}
            color="#3b82f6"
          />
        </div>
      </Card>

      {/* ── Subscriptions Snapshot ── */}
      <Card title="Subscriptions">
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
        }}>
          <MiniStat
            label="Active"
            value={fmt(subscriptionStats?.active ?? 0)}
            color="#22c55e"
          />
          <MiniStat
            label="Expired"
            value={fmt(subscriptionStats?.expired ?? 0)}
            color="#f59e42"
          />
          <MiniStat
            label="Cancelled"
            value={fmt(subscriptionStats?.cancelled ?? 0)}
            color="#ef4444"
          />
          <MiniStat
            label="New Today"
            value={fmt(subscriptionStats?.today ?? 0)}
            color="#a855f7"
          />
        </div>
      </Card>
    </>
  );
}

/* ── helpers ── */
function BigStatCard({ icon, label, value, color, delta }) {
  return (
    <div style={{
      background   : "var(--card)",
      border       : "1px solid var(--border)",
      borderRadius : 12,
      padding      : "16px 18px",
    }}>
      <div style={{ fontSize: "1.5rem", marginBottom: 4 }}>{icon}</div>
      <div style={{
        fontSize      : ".68rem",
        color         : "var(--muted)",
        textTransform : "uppercase",
        letterSpacing : ".5px",
        fontWeight    : 700,
      }}>
        {label}
      </div>
      <div style={{
        fontSize   : "1.6rem",
        fontWeight : 800,
        color,
        marginTop  : 4,
      }}>
        {value}
      </div>
      {delta && (
        <div style={{
          fontSize   : ".7rem",
          color      : "var(--muted)",
          marginTop  : 4,
        }}>
          {delta}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div>
      <div style={{
        fontSize      : ".65rem",
        color         : "var(--muted)",
        textTransform : "uppercase",
        fontWeight    : 700,
      }}>
        {label}
      </div>
      <div style={{
        fontSize   : "1.2rem",
        fontWeight : 800,
        color,
        marginTop  : 4,
      }}>
        {value}
      </div>
    </div>
  );
}

function ActionButton({ label, count, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display       : "flex",
        alignItems    : "center",
        justifyContent: "space-between",
        padding       : "12px 16px",
        background    : `${color}1a`,
        border        : `1px solid ${color}40`,
        borderRadius  : 10,
        color,
        fontWeight    : 700,
        fontSize      : ".82rem",
        cursor        : "pointer",
        transition    : "all .2s",
      }}
    >
      <span>{label}</span>
      {count > 0 && (
        <span style={{
          padding      : "2px 8px",
          background   : color,
          color        : "#fff",
          borderRadius : 999,
          fontSize     : ".7rem",
        }}>
          {count}
        </span>
      )}
    </button>
  );
}