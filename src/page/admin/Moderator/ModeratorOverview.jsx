// src/page/admin/Moderator/ModeratorOverview.jsx

import { fmt } from "../adminlayout/helpers";
import { Card } from "../adminlayout/atoms";

export default function ModeratorOverview({
  stats, pending,
  marketPendingCount, reportCount,
  verificationPendingCount, vendorPendingCount,
  goTo,
}) {
  const totalQueue =
    pending.length +
    marketPendingCount +
    reportCount +
    verificationPendingCount +
    vendorPendingCount;

  return (
    <>
      <div className="ph">
        <div className="ph-left">
          <h1>🛡️ Moderator Overview</h1>
          <p style={{ color: "var(--muted)", fontSize: ".78rem", marginTop: 4 }}>
            Review pending content and keep the platform safe
          </p>
        </div>
      </div>

      {/* ── Total Queue Card ── */}
      <div style={{
        background     : totalQueue > 0
          ? "linear-gradient(135deg, #f59e42 0%, #ef4444 100%)"
          : "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
        borderRadius   : 14,
        padding        : "24px 26px",
        marginBottom   : 16,
        color          : "#fff",
      }}>
        <div style={{
          fontSize      : ".75rem",
          textTransform : "uppercase",
          letterSpacing : ".5px",
          opacity       : .9,
          fontWeight    : 700,
        }}>
          Total Items In Queue
        </div>
        <div style={{
          fontSize   : "2.4rem",
          fontWeight : 900,
          marginTop  : 4,
        }}>
          {fmt(totalQueue)}
        </div>
        <div style={{
          fontSize  : ".85rem",
          marginTop : 6,
          opacity   : .9,
        }}>
          {totalQueue === 0
            ? "🎉 All caught up! Great work."
            : "Items are waiting for your review."}
        </div>
      </div>

      {/* ── Priority Cards ── */}
      <div style={{
        display             : "grid",
        gridTemplateColumns : "repeat(auto-fit, minmax(240px, 1fr))",
        gap                 : 12,
        marginBottom        : 16,
      }}>
        <PriorityCard
          icon="📦"
          label="Pending Products"
          count={pending.length}
          description="Products awaiting approval"
          color="#3b82f6"
          onClick={() => goTo("products")}
        />
        <PriorityCard
          icon="🏪"
          label="Market Products"
          count={marketPendingCount}
          description="Marketplace listings to review"
          color="#a855f7"
          onClick={() => goTo("market_products")}
        />
        <PriorityCard
          icon="🚩"
          label="User Reports"
          count={reportCount}
          description="Reported content & users"
          color="#ef4444"
          onClick={() => goTo("reports")}
        />
        <PriorityCard
          icon="🆔"
          label="Identity / Store Verification"
          count={verificationPendingCount}
          description="ID cards & store details"
          color="#f59e42"
          onClick={() => goTo("verification")}
        />
        <PriorityCard
          icon="🏬"
          label="Vendor Verification"
          count={vendorPendingCount}
          description="Vendor applications to approve"
          color="#22c55e"
          onClick={() => goTo("vendor_verification")}
        />
      </div>

      {/* ── Guidelines ── */}
      <Card title="📋 Moderation Guidelines">
        <div style={{ fontSize: ".82rem", lineHeight: 1.8, color: "var(--muted)" }}>
          <p style={{ marginBottom: 10 }}>
            <b style={{ color: "var(--text)" }}>✓ Approve when:</b> Product listings are clear,
            legal, have proper images and descriptions, and comply with platform policies.
          </p>
          <p style={{ marginBottom: 10 }}>
            <b style={{ color: "var(--text)" }}>✗ Reject when:</b> Content is misleading,
            duplicated, contains prohibited items, uses fake images, or violates our terms.
          </p>
          <p style={{ marginBottom: 10 }}>
            <b style={{ color: "var(--text)" }}>🚩 Flag when:</b> Content needs a senior admin
            review or involves a serious policy violation that may need account action.
          </p>
          <p style={{ marginBottom: 0 }}>
            <b style={{ color: "var(--text)" }}>ℹ️ Note:</b> Always provide a clear reason
            when rejecting or flagging so sellers understand what needs to change.
          </p>
        </div>
      </Card>
    </>
  );
}

function PriorityCard({ icon, label, count, description, color, onClick }) {
  const isUrgent = count > 0;
  return (
    <div
      onClick={onClick}
      style={{
        background   : "var(--card)",
        border       : `1px solid ${isUrgent ? color + "60" : "var(--border)"}`,
        borderLeft   : `3px solid ${color}`,
        borderRadius : 12,
        padding      : "16px 18px",
        cursor       : "pointer",
        transition   : "all .2s",
      }}
      onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
      onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
    >
      <div style={{
        display        : "flex",
        alignItems     : "center",
        justifyContent : "space-between",
      }}>
        <div style={{ fontSize: "1.6rem" }}>{icon}</div>
        <div style={{
          padding      : "4px 12px",
          background   : isUrgent ? color : "var(--card2)",
          color        : isUrgent ? "#fff" : "var(--muted)",
          borderRadius : 999,
          fontSize     : ".85rem",
          fontWeight   : 800,
          minWidth     : 34,
          textAlign    : "center",
        }}>
          {count}
        </div>
      </div>
      <div style={{
        fontSize      : ".68rem",
        color         : "var(--muted)",
        textTransform : "uppercase",
        letterSpacing : ".5px",
        fontWeight    : 700,
        marginTop     : 12,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: ".78rem",
        color: "var(--text)",
        marginTop: 4,
        opacity: .8,
      }}>
        {description}
      </div>
    </div>
  );
}